/* Install in BlueMap's web root and add to webapp.conf scripts.
 * Set exact calculator origins below (scheme, host, port; no trailing slash).
 * Do not allow "null" or "*". Serve the calculator over HTTP(S).
 */
(() => {
    "use strict";
    const ALLOWED_ORIGINS = ["http://127.0.0.1:8765"];
    let owner = null, channel = null, overlay = null, mapId = null;
    function clear() {
        if (overlay) { window.bluemap.mapViewer.markers.remove(overlay); overlay = null; }
    }
    window.addEventListener("message", event => {
        if (event.source !== window.parent || window.parent === window || !ALLOWED_ORIGINS.includes(event.origin)) return;
        const msg = event.data;
        if (!msg || msg.protocol !== "warium-bluemap-v1" || typeof msg.channel !== "string" || msg.channel.length > 100) return;
        const app = window.bluemap, api = window.BlueMap;
        if (!app?.mapViewer?.map || !api?.MarkerSet) return;
        const reply = data => event.source.postMessage({ protocol: msg.protocol, channel: msg.channel, ...data }, event.origin);
        if (msg.type === "hello") {
            clear(); owner = event.origin; channel = msg.channel;
            reply({ type: "ready", mapId: app.mapViewer.map.data.id }); return;
        }
        if (owner !== event.origin || channel !== msg.channel) return;
        if (msg.type === "clear") { clear(); return; }
        if (msg.type !== "solution") return;
        if (msg.mapId !== app.mapViewer.map.data.id) { clear(); reply({type:"error", message:"BlueMap is showing a different map. Switch back to the selected map ID."}); return; }
        const data = msg.markerSet;
        if (!data || !data.markers || Object.keys(data.markers).length > 100) return;
        // Rebuild a strict line-only schema; never accept arbitrary HTML, URLs or marker types.
        const safe = {};
        let count = 0;
        for (const [id, marker] of Object.entries(data.markers)) {
            if (marker.type !== "line" || !Array.isArray(marker.line) || marker.line.length < 2) return;
            count += marker.line.length;
            if (count > 100000 || !marker.line.every(p => p && [p.x,p.y,p.z].every(n => Number.isFinite(n) && Math.abs(n) <= 60000000))) return;
            const color = marker.lineColor;
            if (!color || ![color.r,color.g,color.b,color.a].every(Number.isFinite)) return;
            safe[id] = {type:"line", position:marker.line[0], line:marker.line, label:"Warium trajectory",
                lineWidth:3, depthTest:false, lineColor:{r:Math.max(0,Math.min(255,color.r)),g:Math.max(0,Math.min(255,color.g)),b:Math.max(0,Math.min(255,color.b)),a:Math.max(0,Math.min(1,color.a))}};
        }
        clear();
        try {
            overlay = new api.MarkerSet("warium-local-solution", {label:"Warium firing solution",toggleable:true,markers:safe});
            app.mapViewer.markers.add(overlay); mapId = msg.mapId;
            reply({type:"drawn"});
        } catch (_) { clear(); reply({type:"error",message:"This BlueMap version could not draw the overlay."}); }
    });
    // Do not let trajectories follow the user into another dimension/map.
    setInterval(() => { if (overlay && window.bluemap?.mapViewer?.map?.data.id !== mapId) clear(); }, 250);
})();
