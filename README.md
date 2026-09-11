# Warium Ballistics Calculator

Standalone Minecraft 1.20.1 calculator using the supplied **Warium 1.3.2** and **Ritchie’s Projectile Library 2.1.1** profiles. Includes battle cannons, artillery, mortars, Peeler handheld/pod rockets, Fire Spear missiles and unguided/cluster Ordinance.

## Run

Open `index.html` or double-click `launch-calculator.cmd`. Calculations, dispersion, trajectory charts and marker exports work offline with no dependencies. The previous `rocket-missile-calculator.html` URL now opens the shared calculator.

For live BlueMap, serve this folder over HTTP(S), for example:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Visit `http://127.0.0.1:8765`, paste your BlueMap URL, connect and calculate. The map owner must install the included bridge. See [BlueMap setup and Ironfall compatibility check](BLUEMAP.md).

## Features

- Aimer pitch and mount-relative yaw share an equally prominent box in each low/high result. Select the actual launcher facing, use the recommended cardinal facing, or enter a custom world heading for a rotated base. An east-facing launcher aimed east reads 0° yaw, not −90°.
- Enforces Aimer yaw ±30.5° and pitch −21.5° to +44.5°, with settings rounded to 0.5° steps. Unusable arcs display a change-input warning and are excluded from charts, exports and BlueMap. Values are never clamped into a false solution. Mortar pitch is checked after its launch-vector conversion.
- Barrel-dependent launch speed and dispersion, plus per-ammunition rocket/mortar error estimates. Median and 90th-percentile miss are measured at the vertical target plane; these are not ground-impact CEP radii.
- Separate horizontal Ordinance elevation solutions and fixed floor-mount vector previews. Fixed previews explicitly report the nominal miss. Straight-up no-lock launches cannot hit offset targets.
- Cluster Ordinance releases eight bomblets on tick 31. Charts and BlueMap markers show the release location, mother trajectory, representative child trajectories and sample landings at target Y.
- Native BlueMap 3D world alignment. Overlays update after calculations and clear when inputs or map dimensions change. Marker JSON can also be exported without connecting a map.

The calculator models no-lock flight. It does not simulate IR/SARH guidance, terrain, vehicle motion, water, collision/fuse triggers or additional mount-specific restrictions. Aimer conversion accounts for the selected relative yaw; floor-mounted Ordinance forces its elevation rather than accepting an adjustable pitch. Charts use exact nominal aim; rounding to the available control steps adds error beyond the random dispersion estimate. See [physics verification and limitations](PHYSICS.md).

## Tests

```sh
node test-ballistics.js
node test-mission.js
node test-bridge.js
node test-aiming.js
```

Tests cover the original shell solver, all ammunition profiles, powered roots, release order, eight deterministic child paths, floor mounts, 1-versus-11-barrel precision, world-coordinate markers, URL validation and bridge origin/source/token/schema/map checks. Bridge tests use a stub renderer; a particular live map still requires server installation and compatible HTTPS/framing configuration.
