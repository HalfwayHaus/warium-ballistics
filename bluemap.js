(() => {
    "use strict";
    const M = window.WariumMission;
    const frame = document.getElementById("bluemap-frame"), status = document.getElementById("map-status");
    const input = document.getElementById("bluemap-url"), mapId = document.getElementById("bluemap-id");
    const connect = document.getElementById("connect-map");
    let channel, ready=false, timer, ackTimer, result=null, session=null, generation=0, abort;
    function send(type,data={}) {
        // Sandboxed BlueMap has an opaque origin. A frame reference + random channel scopes messages.
        if(session && frame.contentWindow)frame.contentWindow.postMessage({protocol:"warium-bluemap-v2",channel,type,...data},"*");
    }
    function dispose() {
        send("clear");clearInterval(timer);clearTimeout(ackTimer);ready=false;
        if(session)fetch(`/mirror/${session}/`,{method:"DELETE"}).catch(()=>{});
        session=null;frame.src="about:blank";frame.hidden=true;
    }
    function update(value,fit=true) {
        result=value;document.getElementById("download-markers").disabled=!result?.solutions.length;
        document.getElementById("fit-map").disabled=!ready || !result?.solutions.length;
        if(!ready)return;
        clearTimeout(ackTimer);
        if(!result?.solutions.length){send("clear");status.textContent="Temporary map ready. Calculate a valid solution to draw it.";return;}
        send("solution",{mapId:mapId.value.trim(),markerSet:M.markerSet(result),fit});
        status.textContent="Drawing trajectories on your temporary map…";
        ackTimer=setTimeout(()=>{status.textContent="The map has not confirmed the overlay. Reconnect to reload the temporary viewer.";},7000);
    }
    connect.addEventListener("click",async()=>{
        const current=++generation;abort?.abort();abort=new AbortController();dispose();
        connect.disabled=true;document.getElementById("fit-map").disabled=true;
        try {
            const url=M.parseMapUrl(input.value.trim());
            if(!["http:","https:"].includes(location.protocol))throw new Error("Open the calculator with its map service (npm start) to load a temporary BlueMap copy.");
            status.textContent="Loading a temporary copy of the public map…";
            const response=await fetch("/api/bluemap/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:url.href}),signal:abort.signal});
            if(!response.headers.get("content-type")?.includes("application/json"))throw new Error("This host is serving static files only. Run the included calculator map service; no change to the BlueMap server is needed.");
            const data=await response.json();
            if(!response.ok)throw new Error(data.error || "The public map could not be loaded.");
            if(current!==generation){fetch(`/mirror/${data.id}/`,{method:"DELETE"}).catch(()=>{});return;}
            session=data.id;channel=crypto.randomUUID();mapId.value="";
            try{localStorage.setItem("warium-bluemap-url",url.href);}catch(_){}
            frame.src=data.viewerUrl;frame.hidden=false;
            const link=document.getElementById("open-map");link.href=url.href;link.hidden=false;
            let attempts=0;
            timer=setInterval(()=>{
                send("hello");
                if(++attempts>=90){clearInterval(timer);status.textContent="The temporary viewer did not finish loading. Check that the map is public and uses a supported BlueMap webapp, then reconnect.";}
            },500);
        }catch(error){if(error.name!=="AbortError")status.textContent=error.message;}
        finally{if(current===generation)connect.disabled=false;}
    });
    window.addEventListener("message",event=>{
        if(!session || event.source!==frame.contentWindow || event.origin!=="null")return;
        const msg=event.data;if(!msg || msg.protocol!=="warium-bluemap-v2" || msg.channel!==channel)return;
        if(msg.type==="ready" && typeof msg.mapId==="string"){
            clearInterval(timer);ready=true;if(!mapId.value.trim())mapId.value=msg.mapId;update(result);
        }else if(msg.type==="drawn"){
            clearTimeout(ackTimer);status.textContent="Trajectories drawn on your temporary BlueMap copy. The original map is unchanged. Green: low arc; amber: high arc; blue: cluster release.";
        }else if(msg.type==="error" || msg.type==="map-changed"){
            clearTimeout(ackTimer);status.textContent=msg.type==="map-changed"?"Map changed; the old trajectories were cleared. Match the map ID to your coordinates before recalculating.":String(msg.message).slice(0,300);
        }
    });
    mapId.addEventListener("change",()=>update(result));
    document.getElementById("fit-map").addEventListener("click",()=>update(result));
    document.getElementById("disconnect-map").addEventListener("click",()=>{
        ++generation;abort?.abort();dispose();connect.disabled=false;
        document.getElementById("open-map").hidden=true;document.getElementById("fit-map").disabled=true;status.textContent="Temporary map closed.";
    });
    document.getElementById("download-markers").addEventListener("click",()=>{
        if(!result?.solutions.length)return;
        const data={mapId:mapId.value.trim() || null,markerSet:M.markerSet(result)};
        const href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
        const link=document.createElement("a");link.href=href;link.download="warium-markers.json";link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
    });
    window.addEventListener("warium-result",event=>update(event.detail));
    try{input.value=localStorage.getItem("warium-bluemap-url") || "";}catch(_){}
})();
