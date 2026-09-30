"use strict";
// Calculator-owned, read-only BlueMap relay. No upstream credentials or writes.
const http = require("node:http"), https = require("node:https"), dns = require("node:dns/promises");
const net = require("node:net"), crypto = require("node:crypto"), fs = require("node:fs/promises"), path = require("node:path");
const ROOT = __dirname, SESSION_TTL = 30 * 60 * 1000, MAX_BODY = 24 * 1024 * 1024;
const MIME = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".md":"text/plain; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".woff2":"font/woff2"};
function publicAddress(ip) {
    if (net.isIP(ip) === 4) {
        const [a,b,c] = ip.split(".").map(Number);
        return !(a===0 || a===10 || a===127 || a>=224 || (a===100 && b>=64 && b<=127) ||
            (a===169 && b===254) || (a===172 && b>=16 && b<=31) || (a===192 && (b===168 || b===0 || (b===88 && c===99))) ||
            (a===198 && (b===18 || b===19 || (b===51 && c===100))) || (a===203 && b===0 && c===113));
    }
    // Only global unicast IPv6, excluding documentation and transition ranges.
    return net.isIP(ip) === 6 && /^[23]/i.test(ip) && !/^200[12]:/i.test(ip) && !/^2001:db8:/i.test(ip);
}
function mapUrl(value) {
    const u = new URL(value);
    if (!["http:","https:"].includes(u.protocol) || u.username || u.password) throw new Error("Use a public HTTP(S) BlueMap link without login credentials.");
    if (u.port && !/^\d+$/.test(u.port)) throw new Error("Invalid map port.");
    return u;
}
function baseUrl(value) {
    const u = mapUrl(value); u.hash = ""; u.search = "";
    if (u.pathname.endsWith("/index.html")) u.pathname = u.pathname.slice(0,-10);
    else if (!u.pathname.endsWith("/")) u.pathname += "/";
    return u;
}
function scopedUrl(root, suffix) {
    if (/[\\\0]/.test(suffix)) throw new Error("Invalid resource path.");
    const u = new URL(suffix, root);
    if (u.origin !== root.origin || !u.pathname.startsWith(root.pathname)) throw new Error("Resource is outside this map.");
    const decoded = decodeURIComponent(u.pathname);
    if (decoded.split("/").some(p=>p===".." || p==="." || p.includes("\\"))) throw new Error("Invalid resource path.");
    return u;
}
async function publicLookup(hostname) {
    const host = hostname.replace(/^\[|\]$/g, "");
    const records = net.isIP(host) ? [{address:host,family:net.isIP(host)}] : await dns.lookup(host,{all:true});
    if (!records.length || records.some(r=>!publicAddress(r.address))) throw new Error("Only publicly reachable maps are supported; private or local network addresses are blocked.");
    return records.find(r=>r.family===4) || records[0];
}
async function fetchPublic(url, redirects = 0) {
    mapUrl(url.href);
    const resolved = await publicLookup(url.hostname);
    return new Promise((resolve,reject) => {
        const client = url.protocol === "https:" ? https : http;
        const req = client.get(url, {agent:false, headers:{"User-Agent":"Warium-Ballistics-Map-Viewer/1.0","Accept-Encoding":"identity"},
            // Pin the validated address to the actual connection (DNS rebinding protection).
            lookup: (_host, opts, done) => opts.all ? done(null,[resolved]) : done(null,resolved.address,resolved.family)
        }, response => {
            if ([301,302,303,307,308].includes(response.statusCode)) {
                response.resume();
                if (redirects >= 3 || !response.headers.location) return reject(new Error("Too many map redirects."));
                const next = new URL(response.headers.location,url);
                if (next.hostname !== url.hostname || (url.protocol==="https:" && next.protocol!=="https:")) return reject(new Error("Map redirects must stay on the same hostname without downgrading HTTPS."));
                fetchPublic(next,redirects+1).then(resolve,reject); return;
            }
            const chunks=[]; let size=0;
            response.on("data", chunk => { size += chunk.length; if(size > MAX_BODY) req.destroy(new Error("Map resource exceeds 24 MB.")); else chunks.push(chunk); });
            response.on("end",()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks),url}));
            response.on("error",reject);
        });
        const deadline = setTimeout(()=>req.destroy(new Error("Map request timed out.")),20000);
        req.on("close",()=>clearTimeout(deadline)); req.on("error",reject);
    });
}
function mirrorHtml(html, prefix) {
    if (!/bluemap/i.test(html) || !/<html[\s>]/i.test(html)) throw new Error("This URL does not look like a BlueMap web page.");
    // Keep BlueMap's own versioned renderer/assets, but add our session-only adapter first.
    // No remote page executes with the calculator's origin: the iframe is sandboxed.
    return html.replace(/<base\b[^>]*>/gi, "").replace(/<head\b[^>]*>/i, match =>
        `${match}<base href="${prefix}"><script src="${prefix}__adapter.js"></script>`);
}
function createApp({fetcher=fetchPublic, now=Date.now} = {}) {
    const sessions = new Map(), cache = new Map(), inflight = new Map(); let cacheSize=0, active=0;
    function prune() {
        for (const [id,s] of sessions) if(now()-s.used>SESSION_TTL) sessions.delete(id);
        for (const [key,c] of cache) if(now()>c.expires) {cacheSize-=c.value.body.length;cache.delete(key);}
    }
    async function resource(u) {
        prune(); const key=u.href;
        if(cache.has(key))return cache.get(key).value;
        if(inflight.has(key))return inflight.get(key);
        if(active>=48)throw new Error("Map service is busy. Please retry shortly.");
        const promise=(async()=>{
            active++;
            try {
                const value=await fetcher(u);
                if(value.status===200 && value.body.length<=8*1024*1024){
                    while(cacheSize+value.body.length>64*1024*1024 && cache.size){const key=cache.keys().next().value;cacheSize-=cache.get(key).value.body.length;cache.delete(key);}
                    cache.set(key,{value,expires:now()+30000});cacheSize+=value.body.length;
                }
                return value;
            } finally {active--;inflight.delete(key);}
        })();inflight.set(key,promise);return promise;
    }
    function send(res,status,body,type="application/json",extra={}) {
        res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...extra});
        res.end(typeof body==="object" && !Buffer.isBuffer(body) ? JSON.stringify(body) : body);
    }
    const handler = async (req,res) => {
        try {
            // Reject DNS-rebinding Host headers for the local default deployment.
            const host = req.headers.host || "";
            const expected = process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN).host : null;
            if (expected ? host!==expected : !/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)) return send(res,403,{error:"Unrecognized calculator host."});
            const u = new URL(req.url,"http://"+host);
            if(u.pathname==="/api/bluemap/session"){
                if(req.method!=="POST")return send(res,405,{error:"Use POST."});
                const origin=req.headers.origin;
                if(!origin || new URL(origin).host!==host)return send(res,403,{error:"Open the calculator on this server to connect a map."});
                if(!String(req.headers["content-type"]).startsWith("application/json"))return send(res,415,{error:"Expected JSON."});
                let body="";for await(const chunk of req){body+=chunk;if(body.length>4096)return send(res,413,{error:"Map link is too long."});}
                const requested=mapUrl(JSON.parse(body).url), base=baseUrl(requested.href);
                prune(); if(sessions.size>=32)return send(res,429,{error:"Too many map sessions. Disconnect another map or retry later."});
                const entry=await resource(base);
                if(entry.status!==200)throw new Error(`Map returned HTTP ${entry.status}. Only public maps are supported.`);
                const finalBase=baseUrl(entry.url.href);
                const settings=await resource(new URL("settings.json",finalBase));
                if(settings.status!==200)throw new Error("BlueMap settings.json could not be loaded. Paste the BlueMap web page link.");
                const config=JSON.parse(settings.body.toString());
                if(!Array.isArray(config.maps) || !config.maps.length)throw new Error("BlueMap has no available maps.");
                const id=crypto.randomBytes(24).toString("hex"), prefix=`/mirror/${id}/`;
                const dataRoot=baseUrl(new URL(config.mapDataRoot || "maps",finalBase).href);
                const liveRoot=baseUrl(new URL(config.liveDataRoot || "maps",finalBase).href);
                const html=mirrorHtml(entry.body.toString(),prefix);
                // Fetching the entry page yields to other connections; recheck the limit.
                if(sessions.size>=32)return send(res,429,{error:"Too many map sessions. Disconnect another map or retry later."});
                sessions.set(id,{base:finalBase,dataRoot,liveRoot,config,html,origin,used:now()});
                return send(res,201,{id,viewerUrl:prefix+requested.hash,maps:config.maps,version:config.version});
            }
            const mirror=u.pathname.match(/^\/mirror\/([a-f0-9]{48})\/(.*)$/);
            if(mirror){
                prune();const s=sessions.get(mirror[1]);
                // Sandbox every mirrored document, including one opened directly in a tab.
                const cors={"Access-Control-Allow-Origin":"*","Cross-Origin-Resource-Policy":"cross-origin",
                    "Content-Security-Policy":"sandbox allow-scripts allow-pointer-lock; base-uri 'self'; form-action 'none'; object-src 'none'"};
                if(!s)return send(res,410,{error:"This temporary map expired. Connect again."},"application/json",cors);
                if(req.method==="DELETE" && mirror[2]===""){
                    if(req.headers.origin!==s.origin)return send(res,403,{error:"Wrong origin."});
                    sessions.delete(mirror[1]);return send(res,200,{closed:true});
                }
                if(req.method!=="GET")return send(res,405,{error:"Map resources are read-only."});
                s.used=now();const suffix=mirror[2];
                if(!suffix || suffix==="index.html")return send(res,200,s.html,"text/html; charset=utf-8",cors);
                if(suffix==="__adapter.js"){
                    const adapter=await fs.readFile(path.join(ROOT,"map-adapter.js"),"utf8");
                    return send(res,200,`window.WARIUM_PARENT_ORIGIN=${JSON.stringify(s.origin)};\n`+adapter,"text/javascript; charset=utf-8",cors);
                }
                if(suffix==="settings.json")return send(res,200,{...s.config,useCookies:false,scripts:[],styles:[],mapDataRoot:"__data",liveDataRoot:"__live"},"application/json",cors);
                // Snapshot/polling data only: do not open an unbounded upstream SSE connection.
                if(suffix.endsWith("/live/sse"))return send(res,204,"","text/event-stream",cors);
                let root=s.base, relative=suffix;
                if(suffix.startsWith("__data/")){root=s.dataRoot;relative=suffix.slice(7);}
                if(suffix.startsWith("__live/")){root=s.liveRoot;relative=suffix.slice(7);}
                const upstream=scopedUrl(root,relative+u.search), value=await resource(upstream);
                if(value.status!==200)return send(res,value.status,{error:`Map resource returned HTTP ${value.status}.`},"application/json",cors);
                const type=value.headers["content-type"] || MIME[path.extname(upstream.pathname)] || "application/octet-stream";
                const headers={...cors};if(value.headers["content-encoding"])headers["Content-Encoding"]=value.headers["content-encoding"];
                return send(res,200,value.body,type,headers);
            }
            if(req.method!=="GET" && req.method!=="HEAD")return send(res,405,{error:"Method not allowed."});
            const name=u.pathname==="/"?"index.html":decodeURIComponent(u.pathname.slice(1));
            // Never serve repository metadata, JARs or server implementation/config files.
    const allowed=/^(index\.html|drop-range\.html|drop-range\.js|rocket-missile-calculator\.html|styles\.css|app\.js|ballistics\.js|mission\.js|bluemap\.js|README\.md|BLUEMAP\.md|PHYSICS\.md)$/;
            if(!allowed.test(name))return send(res,404,{error:"Not found."});
            const body=await fs.readFile(path.join(ROOT,name));
            return send(res,200,req.method==="HEAD"?"":body,MIME[path.extname(name)]);
        } catch(error) {
            if(!res.headersSent)send(res,400,{error:error.code==="ERR_TLS_CERT_ALTNAME_INVALID"?"The map's HTTPS certificate does not match its hostname. Use its working public URL or contact its host.":error.message});
            else res.end();
        }
    };
    return {handler,sessions};
}
if(require.main===module){
    const port=Number(process.env.PORT || 8765), host=process.env.HOST || "127.0.0.1";
    http.createServer(createApp().handler).listen(port,host,()=>console.log(`Warium calculator: http://${host}:${port}`));
}
module.exports={createApp,publicAddress,publicLookup,mapUrl,baseUrl,scopedUrl,mirrorHtml,fetchPublic};
