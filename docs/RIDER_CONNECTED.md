# Passive articulated Trail bike: first moving increment

This increment receives unseated passive motion in the existing Trail bike consumer, for both hardtail and full suspension. It does not receive saddle support, active control, anatomical calibration or real-time execution. The initial posture is a closed geometric pose, not a solved static equilibrium; gravity cases are relaxation transients. Keep PR #23 in draft.

## Contract declared before moving trials

Use a separate `bikelab-trail-bike-articulated-0.1` record and an `articulated` configuration with independent chassis mass, frame-local COM and principal inertias, the complete passive specification, closure time constant and maximum admitted attachment gap. The chassis inertias are diagonal in frame axes and must satisfy the rigid-body triangle inequalities. Initial chassis values are illustrative, not inherited from the 12 kg construction carrier or a proportional split of combined rider mass. Existing fixed/guided scenarios and exports retain their 0.4 contract and numerical path.

Articulated bike configuration omits the legacy combined mass and guide properties. Rider mass belongs to the passive posture. The initial relative rider coordinates and velocities are zero; the carrier launch gives a compatible rigid motion. Legacy rider offset must be zero. Both bike attachment sites remain explicit fixed frame-local points; feet represent a retained-foot surrogate, not moving cranks or pedal release. The full solved limb geometry, rather than a display reconstruction, supplies recorded endpoints and whole-rider COM.

The four native joint springs/dampers own their forces, potential and damping once. Hand/foot row work belongs to a separate closure ledger. Sum tyre-ground wrenches about world origin from the two wheel contact resultants; do not label total root constraint torque as external terrain torque. Keep the physical external-momentum residual, closure angular impulse and the numerically compensated residual separate. Apply no artificial counterforce. There is no guide reaction in articulated records.

Every attempted step must pass finite-state, native-solver, existing suspension/wheel/pitch and passive joint-domain checks, plus a configured closure-gap guard. Whole knee/elbow domains stay inside the initialized nonsingular bend branch; the two nonsingular limb endpoint Jacobian blocks preserve the four planar closure directions. The standing contract requires both closures active. Copy equality activation along with q, velocity, warm start and time for diagnostics/rollback. Do not advance commands or work/impulse ledgers for a rejected step. Read and copy borrowed interface observations only for supported states; historical records own their geometry and loads.

## Numerical gates declared before execution

These are illustrative numerical receiving budgets, not physical calibration:

- Initial gap and relative attachment speed: at most `1e-10` m and m/s. Instantaneous closure row/site work partition and independent summed terrain wrench: `1e-9` absolute/relative budget (ground sums may use `1e-7` for larger loads).
- Complete both-bike separated-flight and at least 0.1 s flat-ground relaxation cases at 64 casing nodes and 31.25 µs. Require changing native limb geometry in the loaded case. Default ultimate closure gap is 2 mm; exceeding it rejects the attempted step.
- Compare 31.25, 15.625 and 7.8125 µs at fixed closure settings. For the 0.1 s flat case, require energy-balance error below 0.5 J, physical linear/angular momentum residual below 0.1 N s / N m s, and closure angular impulse below 0.02 N m s. Record all values and timestep changes; a passing absolute budget alone is not convergence. Require medium/fine final frame and rider COM difference below 0.5 mm and corresponding energy difference below 0.05 J.
- Separately compare closure time constants 10 and 20 ms at fixed timestep. Report gaps, signed work and physical/numerical momentum separately. Do not tune away a failed result or treat agreement as tissue calibration.
- Deliberately cross a joint domain and require last-accepted state/geometry/work and canonical replay. Preserve exact final-frame equality when only observation cadence changes. Compare matched whole-system native mass/COM/momentum independently of the legacy guide baseline.
- Browser/headless record comparison uses `1e-9` normalized numeric tolerance; discrete events and schema must match. Inspect desktop/mobile limb/attachment geometry on both bikes and exercise switching, edits, playback, JSON export/replay and cancellation.

If a trial fails, retain its failure and narrow the received claim. Do not increase physical limits or acceptance budgets to complete it. Saddle contact is next: named pelvis/saddle shapes, independent compressive contact/friction, contact-row ownership, unloading and recontact, with separate receiving gates from [seated/unseated research](RIDER_SEATED_UNSEATED.md).

## Implementation checkpoint

`articulatedPreset(bike, 'standing'|'flight')` feeds the same `run`/`replay`/CLI/worker path. The Trail bike view offers both experiments and renders the native segment endpoints, rider COM and attachment forces. Articulated mode has independent chassis/rider mass controls; full geometry/laws remain in canonical scenario JSON. Record coordinates include all seven relative native q/vel entries and four hinge-law entries; segment spatial velocities use world angular xyz followed by linear xyz at each segment COM. State explicitly reports no saddle support.

Numerical observation failures become named termination/rollback; malformed topology remains an explicit error. The post-command fault controls inject invalid acceleration/activation or equality force only in tests, after the old-command candidate passed, and compare the recovered frame/geometry/work with the uninterrupted reference. The natural elbow-domain control verifies unsupported joint motion is never accepted. No state clamping, limit relaxation or artificial closure counterforce is used.

Primary source checks use pinned MuJoCo 3.16.0 `a892750516336d8358949f4518fcc4fbbd85beae`: `mj_instantiateEquality` in `engine_core_constraint.c` defines rider-minus-bike connect rows; `mj_rnePostConstraint` in `engine_core_smooth.c` already applies paired forces at actual sites and omits flex contacts; `mj_forward`/`mj_step` in `engine_forward.c` establish force freshness; `mj_objectVelocity` in `engine_core_util.c` returns body velocity at its inertial COM. These support the existing omitted-flex correction and separate internal closure ledger. The source-backed [interface contract](RIDER_INTERFACES.md) retains the detailed force conventions.

## Numerical receiving results

Implementation `e312974` has a [source-hashed receipt](evidence/iteration-20-connected-rider.json), reproducible with `node scripts/rider-connected-evidence.mjs`. All ten 0.1 s runs complete: both-bike separated flight, standing relaxation at three timesteps, and a separate 10 ms closure-time control. The unchanged legacy full-flat case retains its complete-output SHA-256 from `303380c` exactly.

| Standing relaxation | Step / µs | Maximum gap / mm | Maximum energy-balance error / J |
| --- | ---: | ---: | ---: |
| Full suspension | 31.25 | 0.7793 | 0.01901 |
| Full suspension | 15.625 | 0.7774 | 0.00756 |
| Full suspension | 7.8125 | 0.7766 | 0.00325 |
| Hardtail | 31.25 | 0.7046 | 0.01306 |
| Hardtail | 15.625 | 0.7037 | 0.00428 |
| Hardtail | 7.8125 | 0.7032 | 0.00175 |

Both initial closures/relative velocities pass `1e-10`. Medium/fine final rider-COM position differences are below 2 µm, frame-position differences below 9 µm and energy differences below 0.002 J. Sampled physical linear/angular momentum residuals remain below 0.011 N s / N m s at the coarsest step and reduce with timestep refinement. Full-suspension final pitch error is not monotone across these three steps, so this is bounded sensitivity evidence, not a demonstrated convergence order. The nonzero soft-closure gap persists under timestep refinement; it is not integration error that disappears simply by reducing dt.

At fixed 31.25 µs, the 10 ms closure control reduces maximum gaps to 0.334 / 0.284 mm and changes signed closure work from −0.1626 / −0.1485 J to −0.0611 / −0.0541 J (full/hardtail). The 20 ms setting's closure angular impulses are 0.000647 / 0.000602 N m s. These numerical contributions are reported, never hidden as terrain work or compensated physical conservation. The control demonstrates regularization sensitivity and does not identify a physical attachment stiffness.

All seven connected tests pass locally, covering independent chassis mass/tensor, compatible and rotating launch with independently summed momentum, terrain/closure partition, native moving geometry and COM velocities, recording invariance/replay, timestep controls, natural angle-domain rejection and post-command rollback faults. The required full cloud `node --test` finishes with 30 test files passing and ten failing under process/loopback restrictions; direct diagnostics confirm `spawnSync EPERM` and `listen EPERM`. No tests were weakened. Hosted [implementation CI](https://github.com/CraigHutchinson/BikeLab/actions/runs/39631713678) passes **213 tests on each of Ubuntu and Windows**, with zero failures/skips.

Chromium **141.0.7390.37** passes all **29 complete Trail bike record comparisons with zero difference** against Node, including six new articulated/mode-transition cases. The full browser suite captured no page/console errors. Desktop and 390/320 px screenshots for both bikes, plus the natural joint-domain stop, were downloaded from that run and visually inspected: native limb endpoints and both wheels remain in view, the mass controls are distinct, and the stopped display identifies the last accepted pose. These are rendered-state/UI checks, not real-bike or anatomical calibration. The [browser receipt](evidence/iteration-20-connected-browser.json) retains the full report, source/capture hashes, artifact identities and inspection scope; hosted artifacts expire after 14 days.

No limb/frame collision, saddle transitions, matched locked-posture connected comparison, active manoeuvres, anatomy, calibration, 3D or real-time performance is received by these short trajectories. Longer passive relaxation may hit an ultimate joint limit and must stop rather than clamp, stretch a limb or invent support. The [saddle implementation handoff](RIDER_SADDLE_PLAN.md) records the next isolated increment and its required checks.
