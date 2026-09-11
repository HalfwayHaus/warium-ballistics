# BlueMap overlays

## Ironfall check (2026-09-11)

The supplied `http://ironfall.org/bluemap/#world:2362:0:-19:1500:0:0:0:1:flat` link serves BlueMap **5.12-mc1.20-6**. Its `settings.json` lists the `world` map and an empty `scripts` array. The map loads in the local calculator's iframe, but the live bridge handshake times out because the bridge is not installed. The HTTP response has no CSP or X-Frame-Options header. HTTPS verification failed with a certificate hostname mismatch for `ironfall.org`. The server owner must install the bridge; for an HTTPS-hosted calculator, also repair HTTPS on the map. No remote server configuration was changed.

The calculator accepts an HTTP(S) BlueMap URL, including its path and view fragment. A cross-origin iframe cannot directly access BlueMap's renderer. Install the included bridge once on a BlueMap server you administer to enable live trajectories.

## Map-owner setup

1. Copy `bluemap-bridge.js` into BlueMap's web root, for example `bluemap/web/js/warium-ballistics.js`.
2. Edit `ALLOWED_ORIGINS` at the top of that copy. Add the exact origin serving your calculator, such as `https://halfwayhaus.github.io`. An origin includes scheme, hostname and non-default port, but no path or trailing slash. The bundled localhost origin is only for local development. Do not use `*` or `null`.
3. Add `"js/warium-ballistics.js"` to the existing `scripts` list in BlueMap's `webapp.conf`; preserve other scripts. Reload BlueMap's configuration/webapp.
4. Permit the calculator origin in the map server's `Content-Security-Policy: frame-ancestors` configuration if embedding is restricted. A conflicting `X-Frame-Options` header can also block embedding. CORS alone does not permit framing or renderer access. Use HTTPS for both sites when the calculator uses HTTPS.
5. Open the calculator over HTTP(S), paste the map URL, and select **Connect map**. The current BlueMap map ID is filled automatically. Verify that it is the world/dimension used for your entered coordinates.
6. Calculate a solution. Wait for **Trajectories drawn on BlueMap**. The bridge draws native 3D line markers, so they stay registered to world coordinates as you pan, rotate or zoom. Green is the low arc, amber the high arc, blue crosses mark cluster release. Thin lines and impact crosses show representative bomblets. Markers are local to that browser session and replace the previous solution.

Changing calculator inputs clears the old overlay. Changing the BlueMap dimension clears it too; update the map ID and recalculate only when your coordinates belong to the newly selected world. **Disconnect** removes the overlay and unloads the frame.

Opening `index.html` directly still supports offline calculations, charts and exports. A file URL has an opaque origin and is deliberately not accepted by the bridge. Serve the folder with a static server for live BlueMap integration; e.g. `python -m http.server 8765 --bind 127.0.0.1`, then visit `http://127.0.0.1:8765`.

## Without the bridge

The map may be viewable, but no overlay is claimed until the bridge acknowledges it. **Export markers** downloads JSON with `mapId` and `markerSet`. The latter uses BlueMap's line-marker data schema and can be consumed by a server-owner integration. This download does not automatically install markers, and is not a drop-in `webapp.conf` or entire `markers.json` replacement.

## Protocol and security

The bridge checks the sender origin, parent window, connection token, map ID, line-only schema, finite coordinates and total point count. It does not accept scripts, HTML, arbitrary marker types or links from the calculator. The calculator checks the map's origin, frame window and connection token before accepting replies. No proxy or map-server credentials are needed. Submitted coordinates and trajectories are sent only to the connected map frame.

Compatibility is based on BlueMap's exposed `window.BlueMap.MarkerSet` and `window.bluemap.mapViewer.markers` APIs. Servers that customize or remove these exports require an adapter. Integration tests exercise the message protocol with a stub renderer; a live server check is still needed for a particular installed BlueMap version and framing policy.

Sources: [BlueMap webapp configuration](https://bluemap.bluecolored.de/wiki/configs/Webapp.html), [custom scripts](https://bluemap.bluecolored.de/community/Customisation.html), [MarkerSet source](https://github.com/BlueMap-Minecraft/BlueMap/blob/master/common/webapp/src/js/markers/MarkerSet.js), [LineMarker source](https://github.com/BlueMap-Minecraft/BlueMap/blob/master/common/webapp/src/js/markers/LineMarker.js).
