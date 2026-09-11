/* Runs only in the temporary, sandboxed BlueMap copy. Never installed upstream. */
(() => {
    "use strict";
    // BlueMap expects Storage even when its frame has an opaque origin. Use memory only.
    for (const name of ["localStorage","sessionStorage"]) {
        const values = new Map();
        Object.defineProperty(window,name,{value:{getItem:key=>values.get(String(key)) ?? null,
            setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(String(key)),
            clear:()=>values.clear(),key:index=>[...values.keys()][index] ?? null,get length(){return values.size;}}});
    }
    const parentOrigin = window.WARIUM_PARENT_ORIGIN;
    const overlayId = "warium-temporary-solution";
    let channel, overlay, mapId;
    let reservedRoot;
    const app = () => window.bluemap;
    function clear() { if(overlay){app().mapViewer.markers.remove(overlay);overlay=null;} }
    function reserveOverlay() {
        const root=app().mapViewer.markers;
        if(reservedRoot===root)return;
        // BlueMap refreshes remote markers periodically, removing sets absent upstream.
        // Reserve our local set through the same ignore list used for its built-in sets.
        const update=root.updateMarkerSetsFromData.bind(root);
        root.updateMarkerSetsFromData=(data,ignore=[])=>update(data,[...ignore,overlayId]);
        reservedRoot=root;
    }
    function bounds(markers) {
        const b={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
        for(const marker of Object.values(markers))for(const p of marker.line){b.minX=Math.min(b.minX,p.x);b.maxX=Math.max(b.maxX,p.x);b.minY=Math.min(b.minY,p.y);b.maxY=Math.max(b.maxY,p.y);b.minZ=Math.min(b.minZ,p.z);b.maxZ=Math.max(b.maxZ,p.z);}
        return b;
    }
    window.addEventListener("message", event => {
        if(event.source!==window.parent || event.origin!==parentOrigin)return;
        const msg=event.data;
        if(!msg || msg.protocol!=="warium-bluemap-v2" || typeof msg.channel!=="string" || msg.channel.length>100)return;
        const reply=data=>event.source.postMessage({protocol:msg.protocol,channel:msg.channel,...data},parentOrigin);
        if(!app()?.mapViewer?.map || !window.BlueMap?.MarkerSet)return;
        // Map exists before BlueMap finishes applying the URL's initial camera position.
        if("updateLoop" in app() && !app().updateLoop)return;
        if(msg.type==="hello"){channel=msg.channel;reply({type:"ready",mapId:app().mapViewer.map.data.id});return;}
        if(channel!==msg.channel)return;
        if(msg.type==="clear"){clear();return;}
        if(msg.type!=="solution")return;
        if(msg.mapId!==app().mapViewer.map.data.id){clear();reply({type:"error",message:"The viewer is on another map. Switch back or select the matching map ID and recalculate."});return;}
        const input=msg.markerSet?.markers;
        if(!input || Object.keys(input).length>100)return;
        const markers={};let count=0;
        for(const [id,m] of Object.entries(input)){
            if(!m || m.type!=="line" || !Array.isArray(m.line) || m.line.length<2)return;
            count+=m.line.length;
            if(count>100000 || !m.line.every(p=>p && [p.x,p.y,p.z].every(n=>Number.isFinite(n) && Math.abs(n)<=60000000)))return;
            const c=m.lineColor;
            if(!c || ![c.r,c.g,c.b,c.a].every(Number.isFinite))return;
            markers[id]={type:"line",label:String(id).slice(0,80),position:m.line[0],line:m.line,lineWidth:3,depthTest:false,
                lineColor:{r:Math.max(0,Math.min(255,c.r)),g:Math.max(0,Math.min(255,c.g)),b:Math.max(0,Math.min(255,c.b)),a:Math.max(0,Math.min(1,c.a))}};
        }
        try {
            reserveOverlay();clear();overlay=new window.BlueMap.MarkerSet(overlayId,{label:"Warium firing solution",toggleable:true,markers});
            if(overlay.markers.size!==Object.keys(markers).length)throw new Error("Incomplete marker set");
            app().mapViewer.markers.add(overlay);mapId=msg.mapId;
            if(msg.fit && Object.keys(markers).length){
                const b=bounds(markers), controls=app().mapViewer.controlsManager;
                controls.position.set((b.minX+b.maxX)/2,(b.minY+b.maxY)/2,(b.minZ+b.maxZ)/2);
                controls.distance=Math.max(100,Math.hypot(b.maxX-b.minX,b.maxY-b.minY,b.maxZ-b.minZ)*1.4);
            }
            reply({type:"drawn",markers:Object.keys(markers).length});
        } catch(_){clear();reply({type:"error",message:"This BlueMap version could not draw the trajectories."});}
    });
    setInterval(()=>{
        if(overlay && app()?.mapViewer?.map?.data.id!==mapId){clear();
            window.parent.postMessage({protocol:"warium-bluemap-v2",channel,type:"map-changed",mapId:app()?.mapViewer?.map?.data.id},parentOrigin);
        }
    },250);
})();
