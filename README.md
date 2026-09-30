# Warium Ballistics Calculator

Standalone Minecraft 1.20.1 calculator using the supplied **Warium 1.3.2**, **Ritchie’s Projectile Library 2.1.1**, and **Futurism 0.0.1** profiles. Includes battle cannons, artillery, mortars, Peeler handheld/pod rockets, Fire Spear missiles, Ordinance, and Futurism railguns and large ordinance.

## Run

Open `index.html` or double-click `launch-calculator.cmd`. Calculations, dispersion, trajectory charts and marker exports work offline with no dependencies. The previous `rocket-missile-calculator.html` URL now opens the shared calculator.

For BlueMap overlays, install Node.js 22 or newer and double-click `launch-with-bluemap.cmd`, or run:

```sh
npm start
```

Visit `http://127.0.0.1:8765`, paste a public BlueMap URL, connect and calculate. **The BlueMap owner does not install anything.** The calculator loads a temporary, interactive copy of the public map and adds trajectories only to that viewer. No npm dependencies or installation step are required.

To offer this to players on a website, run the included Node service on the calculator's host. Players then only need a browser. GitHub Pages alone serves static files and cannot run this service; it continues to support calculations and marker exports. See [BlueMap setup, hosting and compatibility](BLUEMAP.md).

## Features

- Aimer pitch and mount-relative yaw share an equally prominent box in each low/high result. Select the actual launcher facing, use the recommended cardinal facing, or enter a custom world heading for a rotated base. An east-facing launcher aimed east reads 0° yaw, not −90°.
- Enforces Aimer yaw ±30.5° and pitch −21.5° to +44.5°, with settings rounded to 0.5° steps. Unusable arcs display a change-input warning and are excluded from charts, exports and BlueMap. Values are never clamped into a false solution. Mortar pitch is checked after its launch-vector conversion.
- Barrel-dependent launch speed and dispersion, plus per-ammunition rocket/mortar error estimates. Median and 90th-percentile miss are measured at the vertical target plane; these are not ground-impact CEP radii.
- Futurism 205 mm, 60 mm and 15 mm railguns use the JAR's distinct barrel-speed, spread, RPL multiplier, drag compensation and projectile lifetime. Their maximum barrel counts are 21, 11 and 6 respectively. The 60 mm nine-shot load has its own spread.
- Futurism large ordinance has rocket, cruise, cluster and seeker variants. Guided variants show an explicitly labeled unguided launch preview; their true impact depends on the programmed coordinates or target lock.
- The [drop-range page](drop-range.html) estimates maximum modeled reach from release Y and target Y for large and extra-large bombs, cruise missiles, rockets, medium and heavy guided missiles, and the loitering drone. Powered ranges are optimistic straight-and-level envelopes. Sensor-locked munitions require acquisition, and the manually piloted drone has no finite range determined by altitude alone.
- Separate horizontal Ordinance elevation solutions and fixed floor-mount vector previews. Fixed previews explicitly report the nominal miss. Straight-up no-lock launches cannot hit offset targets.
- Cluster Ordinance releases eight bomblets on tick 31. Charts and BlueMap markers show the release location, mother trajectory, representative child trajectories and sample landings at target Y.
- Temporary BlueMap viewer with native 3D world alignment and a **Fit trajectories** button. Public map files load on demand; the original map is unchanged. Overlays survive map refreshes, update after calculations and clear when inputs or map dimensions change. Marker JSON can also be exported without connecting a map.

The firing-solution calculator models no-lock flight. It does not simulate IR/SARH guidance, terrain, vehicle motion, water, collision/fuse triggers or additional mount-specific restrictions. Aimer conversion accounts for the selected relative yaw; floor-mounted Ordinance forces its elevation rather than accepting an adjustable pitch. Charts use exact nominal aim; rounding to the available control steps adds error beyond the random dispersion estimate. The drop-range page models an open-air reach envelope, not a guaranteed impact radius. See [physics verification and limitations](PHYSICS.md).

## Tests

```sh
npm test
```

Tests cover the original shell solver, all ammunition profiles, powered roots, release order, eight deterministic child paths, floor mounts, 1-versus-11-barrel precision, Aimer limits, world-coordinate markers, proxy path/address restrictions, session lifecycle and overlay origin/source/token/schema/map checks. Adapter tests use a stub renderer; the live temporary viewer was also checked against Ironfall's BlueMap 5.12 webapp. See [BLUEMAP.md](BLUEMAP.md) for compatibility limits.
