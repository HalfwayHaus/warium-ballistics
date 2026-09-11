(() => {
    "use strict";
    const M = window.WariumMission;
    const frame = document.getElementById("bluemap-frame");
    const status = document.getElementById("map-status");
    const input = document.getElementById("bluemap-url");
    const mapId = document.getElementById("bluemap-id");
    let url, channel, ready = false, timer, attempts = 0, result = null, ackTimer;
    function send(type, data = {}) {
        if (url && frame.contentWindow) frame.contentWindow.postMessage({protocol:"warium-bluemap-v1",channel,type,...data}, url.origin);
    }
    function update(value) {
        result = value;
        document.getElementById("download-markers").disabled = !result?.solutions.length;
        if (!ready) return;
        clearTimeout(ackTimer);
        if (!result?.solutions.length) { send("clear"); status.textContent = "Connected. Calculate a valid solution to draw it."; return; }
        send("solution", {mapId:mapId.value.trim(),markerSet:M.markerSet(result)});
        status.textContent = "Sending trajectories to BlueMap…";
        ackTimer = setTimeout(() => { status.textContent = "BlueMap has not confirmed the overlay. Reconnect or check the bridge setup."; }, 5000);
    }
    document.getElementById("connect-map").addEventListener("click", () => {
        try {
            const next = M.parseMapUrl(input.value.trim());
            if (location.protocol === "https:" && next.protocol === "http:") throw new Error("An HTTPS calculator requires an HTTPS BlueMap link.");
            send("clear"); clearInterval(timer); clearTimeout(ackTimer);
            url = next; ready = false; attempts = 0; channel = crypto.randomUUID();
            try { localStorage.setItem("warium-bluemap-url", url.href); } catch (_) {}
            frame.src = url.href; frame.hidden = false;
            const link = document.getElementById("open-map"); link.href = url.href; link.hidden = false;
            status.textContent = "Connecting to BlueMap…";
            timer = setInterval(() => {
                send("hello");
                if (++attempts >= 20) { clearInterval(timer); status.textContent = "Overlay not connected. The map owner must install the bridge and permit embedding. You can still export marker data."; }
            }, 500);
        } catch (error) { status.textContent = error.message; }
    });
    window.addEventListener("message", event => {
        if (!url || event.origin !== url.origin || event.source !== frame.contentWindow) return;
        const msg = event.data;
        if (!msg || msg.protocol !== "warium-bluemap-v1" || msg.channel !== channel) return;
        if (msg.type === "ready" && typeof msg.mapId === "string") {
            clearInterval(timer); ready = true;
            if (!mapId.value.trim()) mapId.value = msg.mapId;
            update(result);
        } else if (msg.type === "drawn") { clearTimeout(ackTimer); status.textContent = "Trajectories drawn on BlueMap. Green: low arc. Amber: high arc. Blue: cluster release."; }
        else if (msg.type === "error") { clearTimeout(ackTimer); status.textContent = String(msg.message).slice(0, 300); }
    });
    mapId.addEventListener("change", () => update(result));
    document.getElementById("disconnect-map").addEventListener("click", () => {
        send("clear"); clearInterval(timer); clearTimeout(ackTimer); ready = false; url = null;
        frame.src = "about:blank"; frame.hidden = true; document.getElementById("open-map").hidden = true;
        status.textContent = "Map disconnected.";
    });
    document.getElementById("download-markers").addEventListener("click", () => {
        if (!result?.solutions.length) return;
        const data = {mapId:mapId.value.trim() || null, markerSet:M.markerSet(result)};
        const href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], {type:"application/json"}));
        const link = document.createElement("a"); link.href = href; link.download = "warium-markers.json"; link.click();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
    });
    window.addEventListener("warium-result", event => update(event.detail));
    try { input.value = localStorage.getItem("warium-bluemap-url") || ""; } catch (_) {}
})();
