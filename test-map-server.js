"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), http = require("node:http");
const {createApp, publicAddress, publicLookup, mapUrl, baseUrl, scopedUrl} = require("./server");

test("map relay rejects local/private addresses and resource escapes", async () => {
    for (const ip of ["127.0.0.1","10.1.2.3","172.16.1.1","192.168.1.1","169.254.169.254","0.0.0.0","100.64.0.1","198.18.0.1","::1","::ffff:127.0.0.1","fc00::1","fe80::1","2001:db8::1"])
        assert.equal(publicAddress(ip),false,ip);
    assert.equal(publicAddress("1.1.1.1"),true);
    assert.equal(publicAddress("2606:4700:4700::1111"),true);
    await assert.rejects(publicLookup("127.0.0.1"), /publicly/);
    await assert.rejects(publicLookup("[::1]"), /publicly/);
    for(const url of ["file:///etc/passwd","ftp://example.com","https://u:p@example.com"])
        assert.throws(()=>mapUrl(url));
    const root=baseUrl("https://example.com/bluemap/index.html#world:0:0:0");
    assert.equal(root.href,"https://example.com/bluemap/");
    for(const suffix of ["../secret","//evil.example/a","https://evil.example/","..%2fsecret","%2e%2e%2fsecret","a\\secret"])
        assert.throws(()=>scopedUrl(root,suffix),suffix);
    assert.equal(scopedUrl(root,"maps/world/settings.json").href,"https://example.com/bluemap/maps/world/settings.json");
});

test("temporary viewer mirrors public files, isolates scripts, clears sessions and expires", async t => {
    let time=0;
    const calls=[];
    const config={version:"5.12",maps:["world","nether"],mapDataRoot:"tiles",liveDataRoot:"live-data",scripts:["owner-script.js"],styles:["owner-style.css"],useCookies:true};
    const app=createApp({now:()=>time,fetcher:async url=>{
        calls.push(url.href);
        const isSettings=url.pathname.endsWith("/settings.json");
        const body=url.pathname==="/bluemap/" ? '<html><head><title>BlueMap</title><base href="/old/"><script type="module" src="./assets/app.js"></script></head><body></body></html>' : isSettings?JSON.stringify(config):"public map asset";
        return {url,status:200,headers:{"content-type":isSettings?"application/json":"text/html","set-cookie":"upstream=private"},body:Buffer.from(body)};
    }});
    const server=http.createServer(app.handler);
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    t.after(()=>new Promise(resolve=>server.close(resolve)));
    const origin=`http://127.0.0.1:${server.address().port}`;
    const connect=()=>fetch(origin+"/api/bluemap/session",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({url:"http://maps.example/bluemap/#world:3:0:4"})});
    const response=await connect();assert.equal(response.status,201);
    const session=await response.json(), prefix=`/mirror/${session.id}/`;
    assert.match(session.id,/^[a-f0-9]{48}$/);
    assert.equal(session.viewerUrl,prefix+"#world:3:0:4");
    const page=await fetch(origin+prefix), html=await page.text();
    assert.match(html,new RegExp(`<base href="${prefix}">`));
    assert.ok(html.indexOf("__adapter.js")<html.indexOf("assets/app.js"));
    assert.ok(!html.includes("/old/"));
    assert.match(page.headers.get("content-security-policy"),/sandbox allow-scripts/);
    assert.ok(!page.headers.get("content-security-policy").includes("allow-same-origin"));
    const settings=await (await fetch(origin+prefix+"settings.json")).json();
    assert.deepEqual(settings.scripts,[]);assert.deepEqual(settings.styles,[]);
    assert.equal(settings.useCookies,false);assert.equal(settings.mapDataRoot,"__data");
    assert.equal(settings.liveDataRoot,"__live");
    const adapter=await (await fetch(origin+prefix+"__adapter.js")).text();
    assert.ok(adapter.includes(`window.WARIUM_PARENT_ORIGIN="${origin}"`));
    const tile=await fetch(origin+prefix+"__data/world/lowres/0/0.json");
    assert.equal(await tile.text(),"public map asset");
    assert.equal(tile.headers.get("access-control-allow-origin"),"*");
    assert.equal(tile.headers.get("set-cookie"),null);
    assert.match(tile.headers.get("content-security-policy"),/sandbox/);
    await fetch(origin+prefix+"__data/world/lowres/0/0.json");
    assert.equal(calls.filter(url=>url.endsWith("tiles/world/lowres/0/0.json")).length,1,"tile requests share a bounded cache");
    await fetch(origin+prefix+"__live/world/live/players.json");
    assert.ok(calls.includes("http://maps.example/bluemap/live-data/world/live/players.json"));
    const beforeSSE=calls.length;
    assert.equal((await fetch(origin+prefix+"__live/live/sse")).status,204);
    assert.equal(calls.length,beforeSSE,"no unbounded upstream event streams");
    const beforeWrite=calls.length;
    assert.equal((await fetch(origin+prefix+"__data/world/file",{method:"POST"})).status,405);
    assert.equal(calls.length,beforeWrite,"writes never reach the map");
    for(const name of [".git/config","server.js","package.json","map-adapter.js"])
        assert.equal((await fetch(origin+"/"+name)).status,404);
    assert.equal((await fetch(origin+"/api/bluemap/session",{method:"POST",headers:{Origin:"https://other.example","Content-Type":"application/json"},body:"{}"})).status,403);
    assert.equal((await fetch(origin+prefix,{method:"DELETE",headers:{Origin:"https://other.example"}})).status,403);
    assert.equal((await fetch(origin+prefix,{method:"DELETE",headers:{Origin:origin}})).status,200);
    assert.equal((await fetch(origin+prefix)).status,410);
    const fresh=await (await connect()).json();
    time=30*60*1000+1;
    assert.equal((await fetch(origin+`/mirror/${fresh.id}/`)).status,410);
    assert.equal(app.sessions.size,0);
});

test("invalid maps and missing settings return useful errors", async t => {
    const app=createApp({fetcher:async url=>({url,status:200,headers:{},body:Buffer.from(url.pathname.endsWith("settings.json")?'{}':'<html><head>Not a map</head></html>')})});
    const server=http.createServer(app.handler);
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    t.after(()=>new Promise(resolve=>server.close(resolve)));
    const origin=`http://127.0.0.1:${server.address().port}`;
    const response=await fetch(origin+"/api/bluemap/session",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({url:"http://example.com/"})});
    assert.equal(response.status,400);
    assert.match((await response.json()).error,/no available maps/);
    assert.equal(app.sessions.size,0);
});
