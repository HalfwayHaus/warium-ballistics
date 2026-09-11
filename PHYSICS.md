# Warium 1.3.2 model notes

Verified by inspecting the user-supplied `Warium 1.3.2.jar` and `ritchiesprojectilelib-2.1.1+mc.1.20.1-forge.jar`. These files were inspected as data, not executed as Minecraft mods. Decompiled code is not distributed with the calculator.

## Motion and ammunition

Each tick advances position, applies AbstractArrow's 0.99 air drag and subtracts 0.05 vertical velocity. The projectile entity then runs its Warium flight procedure, which may multiply all velocity components. Powered flight must be included in the root search and its refinement, not just the displayed path.

| Profile | Launch speed (blocks/tick) | Launch inaccuracy | Powered behavior |
| --- | --- | --- | --- |
| Battle cannon AP | `(3.3 + barrels/1.25) × multiplier` | `8/(barrels×2)` | None |
| Battle cannon solid | `(3.2 + barrels/1.25) × multiplier` | `8/(barrels×2)` | None |
| Battle cannon explosive | `(3 + barrels/1.25) × multiplier` | `10/(barrels×2)` | None |
| Artillery solid | `(3.2 + barrels/1.25) × multiplier` | `10/(barrels×1.5)` | None |
| Artillery explosive | `(3 + barrels/1.25) × multiplier` | `14/(barrels×1.5)` | None |
| Mortar | 5 | 5 | None |
| Peeler handheld | 6 | 2.5 | ×1.01 for ticks 1–60 |
| Rocket pod | 6 | 2 | ×1.01 for ticks 1–60 |
| Fire Spear | 6 | 2 | ×1.01 for ticks 1–70 |
| Unguided Ordinance | 4.5 | 3 | ×(1+0.02×multiplier) for ticks 1–40 |
| Cluster Ordinance | 4.5 | 3, then child spread 12 | Same multiplier for ticks 1–30; releases at tick 31 |

`multiplier` is 2 with RPL, 1 without. `ProjectilelibsProcedure` owns that difference. RPL's `ServerEntityMixin` synchronizes precise projectile motion and does not itself replace gravity. The old missile page's 140-tick burn/self-destruction profile does not match this supplied 1.3.2 unguided rocket. `MaxTime` is not by itself a lifetime limit; `OrdinanceTriggerProcedure` uses it for trigger gating.

Sources in the JAR: `ArtilleryFireScriptProcedure`, `BCFireScriptProcedure`, `MortarOnBlockRightClickedProcedure`, `OrdinanceCorePowerProcedure`, `SmallRocketFlightProcedure`, `FireSpearFlightProcedure`, `LargeRocketFlightTickProcedure`, `ClusterRocketFlightTickProcedure`, `MissileHardpointFireProcedure`, `ProjectilelibsProcedure` and the corresponding projectile entities.

## Horizontal and vertical Ordinance

A horizontal mount supports the elevation search. Results show Aimer pitch and relative yaw together. Relative yaw is the signed, wrapped difference between the target world heading and the selected base heading. Automatic mode recommends the nearest cardinal direction and explicitly requires matching that direction in game; it never silently assumes a diagonally rotated block. A rotated base can use a custom heading. World headings remain internal to geometry and BlueMap.

`AimerProcedureProcedure` stores a lateral component `tan(yaw)` with the cardinal-facing sign and vertical component `tan(pitch)`. The horizontal magnitude is therefore `1/cos(relativeYaw)`. Cannon Aimer pitch is `atan(tan(elevation)/cos(relativeYaw))`; mortar conversion uses the existing additional 0.5 vertical and halved horizontal components. These conversions preserve the nominal trajectory when yaw is nonzero.

`LeftPullOnKeyPressedProcedure` and `RightPullOnKeyPressedProcedure` check −30 and +30 before a 0.5-degree step, allowing endpoints −30.5 and +30.5. The Down/Up equivalents check −21 and +44, allowing pitch endpoints −21.5 and +44.5. Exact requirements outside these ranges are rejected before rounding. Valid settings are rounded to 0.5-degree steps. Yaw failure clears every solution; pitch failure marks the affected arc and removes it from charts/exports/map overlays. A fixed floor trajectory is not an adjustable pitch and is only usable if its nominal target-plane miss is below 0.001 block.

`OrdinanceCorePowerProcedure` constructs X/Z first and subsequently handles FLOOR/UP by forcing vertical component `Pitch = 1.5`. It does not clear the existing horizontal vector. Therefore a retained horizontal magnitude `h` launches at `atan2(1.5,h)`, giving 56.3099° for `h=1`. The calculator accepts that setup magnitude and reports the fixed path's vertical miss at the target range; it does not pretend to find adjustable low/high solutions for a fixed mount. A true vertical vector (`h=0`) cannot reach an offset target without guidance, so the calculator explains that instead of inventing a turn toward the target.

Floor-mount block reference uses (+0.5,+3,+0.5). Horizontal Ordinance offsets depend on `OffsetReturnProcedure` and direction; enter the exact spawn origin for those mounts. No IR/SARH guidance, target locks, moving launch vehicle, water, terrain collision, interception or fuse triggers are simulated.

## Cluster release

After AbstractArrow updates on tick 31, `ClusterRocketFlightTickProcedure` spawns eight `SmallBombProjectileEntity` instances at the mother's position, uses its current velocity as the shoot direction and speed, and applies inaccuracy 12. It removes the mother. The release speed therefore includes tick-31 drag/gravity but no tick-31 thrust. The child flight continues without the mother's engine.

The nominal aim solves the zero-spread child centerline. Paths that reach the target before release are not bomblet solutions. The release marker, mother path and all eight representative child paths are exported in world coordinates. Each sample child's landing is its descending intersection with the flat plane at target Y; absence of a crossing is reported explicitly. Random bomblet directions cannot be known before firing. The eight displayed samples are reproducible illustrations, not eight distinct expected directions or a guaranteed coverage boundary. The unpowered dropped cluster-bomb entity has a different launch setup and is not represented as a powered missile here.

## Precision

Each result uses 800 deterministic trials of independent per-axis triangular shoot perturbations: `0.0172275 × inaccuracy × (U1-U2)` added to the normalized launch direction, then multiplied by launch speed, without renormalizing. Powered boost is replayed per tick. A cluster trial adds another independent perturbation at release using the mother's post-update speed.

The median and 90th-percentile values measure Euclidean vertical/cross-range miss at the vertical plane through the target perpendicular to the nominal horizontal bearing. Percentage error divides the median by the straight-line target distance. Trials that cannot reach the plane use closest simulated approach, as in the original solver. These figures are **not ground-impact CEP radii** and should not be drawn as horizontal map circles. On a fixed floor mount they include the setup's systematic miss; the separate nominal vertical miss distinguishes that from random spread. The eight sample landings illustrate ground spread separately.

The inaccuracy formula makes 11 barrel blocks substantially tighter than one barrel block. Range, elevation and runtime speed also affect miss distances, so a barrel count is not a universal percentage-accuracy score. Control-step rounding, additional mount-specific limits, collisions and real server behavior still require in-game validation.
