# Iteration 18 evidence — connected homogeneous traction

PR #20 was reviewed and merged at `47d598bb90e70a6efd3290189a279368546c5f57` after exact-head Linux/Windows tests and browser agreement passed in [run 39311598678](https://github.com/CraigHutchinson/BikeLab/actions/runs/39311598678). Actual corrected full/hardtail overload and 320 px captures were inspected. The [iteration review](ITERATION_18_REVIEW.md) records the next receiving contract and primary-source conventions.

D4a adds homogeneous Coulomb interface friction to the same connected hardtail/full-suspension bike and guided rider. All native contact-force components feed the existing ground/bearing diagnostics. Every active traction contact exports normal/tangent force, signed slip in m/s and normal velocity. The viewer receives friction input, coast/sliding presets, full local arrows and load-weighted slip histories. Version 0.3 requires surface configuration; old 0.1/0.2 records replay with zero friction and the unchanged normal-only solver path.

## Independent controls and review

Six focused tests cover a rigid sliding reference in both directions; the full native tangential cone; independently derived flex point velocity including skin rotation and inverse-distance edge weighting; inclined connected launch kinematics and exported scalar slip/work; generalized/contact wrench sums; both assemblies; separation/landing; observation-only invariance; legacy replay; invalid inputs and traction overload rollback/replay. The two-frame historical 0.2 fixture is extracted from the unchanged full-bump export of PR #20's tested implementation `0e1b4b1`, Actions run `39310260209`; every original frame field matches exactly after replay. It is not regenerated from the new engine.

GPT-6.1 Sol independently checked the source conventions and implementation. No consequential numerical defect was found. Its evidence gaps were closed with inclined exported-slip/work and full native-cone controls. Planar lateral force has a declared 1 micronewton accuracy budget: overloaded controls produced about 48.5 and 17.8 nanonewtons. This is numerical noise, not lateral riding validation. The nine numerical trials below reached a maximum sampled lateral force of about 0.261 micronewtons. Signed positive friction-power samples are retained rather than clamped away.

## Separate timestep and casing evidence

`node scripts/traction-evidence.mjs` regenerates the [numerical receipt](evidence/iteration-18-traction.json). All nine trials complete within the existing geometric/travel/support limits. The 0.3 s coast/sliding examples complete for both assemblies. Total tangential work is about -0.0418/-2.4534 J for full suspension and -0.0598/-2.6515 J for hardtail. This is freely rotating tyre contact, not locked-wheel braking. Maximum total constraint-power partition discrepancy is below 9e-13 W.

The full-suspension zero-spin sliding control uses the same 0.08 s horizon, 64 casing nodes and unchanged flat terrain:

| Step | Maximum energy-balance residual | Tangential work | Horizontal impulse |
| --- | ---: | ---: | ---: |
| 31.25 microseconds | 0.24050 J | -2.32169 J | -3.35096 N s |
| 15.625 microseconds | 0.10719 J | -2.28600 J | -3.37356 N s |
| 7.8125 microseconds | 0.05097 J | -2.28182 J | -3.36396 N s |

Balance error decreases, but contact impulse is not uniformly converged. At 15.625 microseconds, 32/64/128 nodes produce horizontal impulse -3.32066/-3.37356/-3.26378 N s and tangential work -2.26553/-2.28600/-2.26682 J. These are numerical sensitivities, not calibrated grip, peak-force or convergence certificates. Sampled positive per-contact tangent power reaches 2.30 W in the finer-step control while integrated tangent work remains negative; regularized contact does not prove exact instantaneous passivity or sticking.

## Receiving verification

Local `node --test` passes all 183 tests with no failures/skips on physics checkpoint `8825b44`. Its hosted Linux, Windows and complete browser checks pass in [run 39314132354](https://github.com/CraigHutchinson/BikeLab/actions/runs/39314132354). The complete local Trail bike browser run passes all 17 exports with maximum numeric difference 4.44e-16 and no captured errors.

The final UI-only follow-up corrects the preset-driven slip chart accessible label and renames its selector to History channel. Fresh Edge 156.0.4314.30 worker/headless sliding exports pass on both assemblies, with maximum numeric difference 2.22e-16 and 1.11e-16. Actual desktop full/hardtail and 320 px captures were inspected: casing/contact arrows, grip input, signed slip histories, force/work readouts and narrow layout are legible. There were no captured page errors. The [browser receipt](evidence/iteration-18-browser.json) records file hashes and the completed local checks.

The hosted workflow exercises all stations and 17 complete connected-bike browser/headless exports, including old impact/flight/overload and new coast/sliding cases, dirty/cancel/import/lifecycle behavior, grip rejection, narrow layouts and consistent ten-station navigation. The final UI change adds accessible slip-selection assertions. Exact-head Windows/Linux and full-browser success remain merge gates; their run links and deployment status are recorded on [PR #21](https://github.com/CraigHutchinson/BikeLab/pull/21). Screenshots alone are not interactive or numerical evidence.

Brake/drive controls are explicitly retained for D4b with solved-torque ownership, carrier countertorque and deterministic input/work checks. Pressure/tread calibration, rolling resistance, layered soil/roots/rock, shared mud pickup/shedding/carried mass, anatomical rider, 3D turning/combined grip, damage, scan/cache provenance and measured real-time physics tiers remain open. The homogeneous coefficient does not represent these mechanisms.
