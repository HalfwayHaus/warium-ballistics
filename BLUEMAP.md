# Temporary BlueMap viewer

Paste a public BlueMap link into the calculator to open an interactive, temporary copy and draw firing solutions on it. The BlueMap owner does not install a script, enable CORS or edit the original map. Trajectories exist only in your calculator viewer.

## For players

1. Open the calculator on a host running its map service.
2. Paste the full BlueMap web page URL, including any map/view fragment, and select **Connect map**.
3. Confirm the automatically filled map ID matches the world/dimension of your firing coordinates.
4. Calculate. The viewer centers on the valid trajectories. Green is the low arc, amber the high arc, and blue marks cluster release. Bomblet paths and sample landing crosses also appear for cluster Ordinance.
5. Pan, rotate or zoom using BlueMap's controls. The lines use world coordinates and move with the map. **Fit trajectories** brings the shot back into view.

Editing firing inputs clears the old overlay until you recalculate. Changing the map dimension clears it too; update the map ID only when your coordinates belong to that world. **Disconnect** removes the overlay, unloads the map and closes the server session. Sessions also expire after 30 minutes without resource requests. Reloading or restarting the service creates a new session.

Invalid Aimer pitch/yaw arcs are excluded. Nominal paths do not detect terrain or obstructions. Cluster paths are representative samples, not predictions of a particular random shot. The underlying public map's terrain and freshness determine what terrain you see.

## Run locally

Install Node.js 22 or newer. Double-click `launch-with-bluemap.cmd`, or run the following in the repository folder:

```sh
npm start
```

Open `http://127.0.0.1:8765`. There are no npm dependencies to install. Keep the terminal running while using the map. Set `PORT` if another program is using 8765.

Opening `index.html` directly, or running a static file server, still supports calculations, charts and **Export markers**. Loading a temporary map requires `server.js`.

## Host the calculator for players

Run `node server.js` on a Node-capable host and route the calculator's public HTTPS origin to it. Serve this app at the origin root, including `/api/bluemap/` and `/mirror/`. Set:

| Variable | Example | Purpose |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Listen on the host/container network interface. Default is local-only `127.0.0.1`. |
| `PORT` | `8765` | Internal listening port, or the port assigned by the hosting platform. |
| `PUBLIC_ORIGIN` | `https://calculator.example.com` | Exact public calculator origin. Configure the reverse proxy to preserve this Host header. |

The host needs outbound access to public HTTP(S) map resources. TLS for the calculator is normally terminated by the hosting platform or reverse proxy. An HTTP-only BlueMap can be used from an HTTPS calculator because the browser requests the copied resources through the calculator's HTTPS origin.

**GitHub Pages cannot run Node.** Pushing this repository to Pages updates its offline/static calculator but does not activate temporary maps there. Host this app with the included service and point players to that URL. No player-side installation is needed on a hosted instance.

Session and cache state are in one process's memory. Use one instance, or sticky routing if deploying multiple instances. The service permits up to 32 active sessions and 48 concurrent upstream resource fetches, with a 64 MB cache, 30-second cache lifetime, 24 MB per-resource limit and 20-second request deadline. Size the calculator host's bandwidth for the number of players exploring maps; only requested tiles are fetched, never an entire world download.

## How it works

The calculator creates a random session under `/mirror/<session>/`. The service fetches the public BlueMap entry page, versioned renderer assets and map data as needed. It rewrites map-data roots to that temporary route and inserts `map-adapter.js` into the copied HTML. Nothing is uploaded to BlueMap.

The copied webapp runs in a sandboxed iframe without the calculator's origin or persistent storage. Its adapter receives trajectory data through a parent-window and channel-checked message protocol, then creates native BlueMap line markers. It reserves this local marker set so normal upstream marker polling cannot remove the solution. Other map users never see these trajectories.

The relay sends read-only GET requests without upstream login cookies or credentials. Local/private network addresses are rejected, DNS results are validated and pinned to the connection, and resource paths stay within the configured map roots. Mirrored documents retain a sandbox even when opened in another tab. The viewer cannot read the calculator's cookies or storage. BlueMap's expected storage interface is emulated in memory for that frame only.

The calculator host sees the supplied map URL and requested resource paths; the map host sees ordinary public asset/tile requests from the calculator host. Trajectory coordinates travel to the embedded viewer. Exploring/fitting the view also requests tiles around those coordinates. Owner-configured extra scripts/styles are disabled in this temporary copy; the original map and its customization remain unchanged.

## Compatibility and verification

Verified on 2026-09-11 with the supplied [Ironfall BlueMap](http://ironfall.org/bluemap/#world:2362:0:-19:1500:0:0:0:1:flat), reporting **5.12-mc1.20-6**. Its settings still contain an empty `scripts` array. The temporary viewer loads terrain and displays world-aligned firing markers without any map-owner changes. Use its working HTTP URL; its HTTPS endpoint currently reports a certificate hostname mismatch, which the service does not ignore.

Compatibility uses BlueMap's exposed `window.BlueMap.MarkerSet`, `window.bluemap.mapViewer.markers` and controls APIs. Standard BlueMap webapps with relative asset URLs are supported. Older versions, heavily customized HTML, authentication gates, anti-bot checks, different renderer exports or oversized assets may need further adaptation. A private map requiring login is not supported. The UI reports connection/drawing failures instead of claiming an overlay is present.

Tests cover session creation/removal/expiry, resource routing/caching, read-only requests, private-address/path restrictions, sandbox headers, origin/channel/schema checks, dimension changes, camera fitting and persistence through upstream marker refreshes. The live browser check also verifies visible terrain and markers.

**Export markers** remains available offline. The JSON contains `mapId` and a BlueMap-compatible `markerSet`; exporting is optional and does not write anything to a server.

References: [BlueMap webapp source](https://github.com/BlueMap-Minecraft/BlueMap/blob/master/common/webapp/src/js/BlueMapApp.js), [MarkerSet](https://github.com/BlueMap-Minecraft/BlueMap/blob/master/common/webapp/src/js/markers/MarkerSet.js), [normal marker refresh](https://github.com/BlueMap-Minecraft/BlueMap/blob/master/common/webapp/src/js/markers/NormalMarkerManager.js), [line markers](https://github.com/BlueMap-Minecraft/BlueMap/blob/master/common/webapp/src/js/markers/LineMarker.js).
