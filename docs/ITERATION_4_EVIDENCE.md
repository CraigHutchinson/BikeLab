# Iteration 4: spatial fixture evidence

Reviewed baseline: merged main 672e5e74adeeaa968a4620724e7380052ac35d51. The [review and receiving decision](ITERATION_4_REVIEW.md) preceded implementation. [Solver research](SOLVER_RESEARCH.md) used the user-requested GPT-6.1 sol agent and primary documentation; it selects no solver and contains no performance measurements.

## Delivered experiment

The Spatial terrain page and `node scripts/probe-terrain.mjs` consume the same `bikelab-clearance-1` geometry module. Flat, square and sampled rounded profiles, ordered-point editing/file input, prescribed circle position/radius, nearest points/normals, clearance and exported reports are implemented. The [profile contract](TERRAIN_PROBE.md) records SI units, provenance, linear interpolation, solid side, extent and resource limits. Vertical faces remain explicit. Unknown geometry/material fields fail rather than being silently ignored.

This is the geometry prerequisite of the T0 spatial-contact experiment, not a dynamic contact model. No new spring force, soil/traction law, stress field, damage threshold, live scheduler or full-bike solver is implemented. Existing wheel/suspension force laws and record schemas are unchanged.

## Numerical and software evidence

Implementation head **6d1b702db617f840e6dcc1626fb185d95c0e28d5** passed [CI run 38752744132](https://github.com/CraigHutchinson/BikeLab/actions/runs/38752744132): **64 tests on Windows and Linux**, none skipped, and Chromium interaction/browser-headless checks.

Independent geometry tests cover horizontal/inclined planes, a vertical front face, corner approach before axle arrival, multiple equidistant supports and shared-vertex deduplication. Clearance survives segment subdivision, translation and scale changes. Rounded profiles are compared against independent circle-circle distance and the polygon sagitta bound at 8/16/32/64/128 segments. The chosen fixture's error decreases from approximately 1.9213 mm at 8 segments to 0.0000757 mm at 128; nearest-vertex intervals can produce plateaus, so no fixed convergence rate is claimed. Tests enforce the preregistered 1e-10 m analytic geometry and 1e-12 unit-normal tolerances.

Input tests cover malformed metadata, unsupported fields, coordinates and radii, ordering, duplicate/reversing vertical edges, count/file limits, undefined/buried centres, full-footprint domain boundaries, owned report inputs and JSON reproduction. CLI tests distinguish available geometry (including overlap), unsupported query and invalid input. The square default has clearance -0.03197561066286547 m with nearest point [0,0.1] and approach normal approximately [-0.609710761,0.792623989]. That negative gap describes the prescribed circle; it is not physically admissible simulated penetration or tyre compression.

Local execution ran all tests but child-process and loopback operations returned EPERM. The remaining 59 tests passed across targeted non-isolated runs; the complete-suite result comes from CI, not from selectively calling the local suite successful. Existing CLI tests now assert the absence of spawn errors before interpreting output/status. The first browser CI run failed because the test supplied `.25` to a range input; correcting it to `0.25` allowed the slider and all subsequent checks to complete. No geometry law was changed to make that test pass.

## Browser and visual evidence

The durable [browser receipt](evidence/iteration-4-browser.json) records five existing station exports, a complete terrain report, 15 screenshots and no captured page/console errors. The terrain report's complete profile/setup/witnesses/diagnostics match Node. Browser checks cover square/rounded/flat selection, editable custom valley with two supports, profile file loading, invalid JSON and restore, dirty-edit save/slider gating, outside-domain/boundary states, and delayed file-read rejection after a newer edit. Existing station/reference checks remain in the same run.

Inspected the square and rounded desktop captures and the 320 px terrain capture. The equal-scale circle/profile drawing, nearest-point arrow, clearance units and overlap limitation are visible. Narrow layouts wrap readouts/table values without horizontal page overflow; browser checks also cover 390 px. The surface remains small at narrow widths because the full authored domain is fitted, so this is not a high-detail stress viewer. Reports/table values provide the exact numerical geometry.

CI retains captures/exports in `browser-evidence` for 14 days; `scripts/browser-check.mjs` regenerates them. These are headless Chromium interaction and visual checks, not native Windows input/display, participant feedback or physical calibration. The evidence receipt commit only changes documentation/report data; its complete CI must also pass before merge.

## Final review and next gate

Reviewed finite input bounds, projection signs, solid-side/domain classification, shared feature ownership, tie tolerance, report immutability, editor state, stale async reads, relative asset URLs, server allowlist and browser/CLI consumers. No blocking issue remains for this bounded geometry scope. It is not a swept collision detector: an eventual solver must predict/refine contacts within a step and enforce travel before accepting motion.

Next execute the bounded solver trials in SOLVER_RESEARCH.md: hardtail/full-suspension assembly coordinates, independent geometry/constraint/reaction tests, supported stops with ultimate travel bounds, spatial contact and full-state restart. Then receive the chosen solver in the visible whole-bike rig. Preserve component failure/pressure-loss load paths, finite mud/soil cover over roots, combined traction and tyre contamination, 1–2 cm scanned/generated provenance, validated adaptive detail/rates and full 3D lateral/turning forces as explicit later gates. Documentary engine capabilities do not satisfy those experiments.
