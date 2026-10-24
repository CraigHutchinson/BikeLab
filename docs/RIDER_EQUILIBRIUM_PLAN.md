# Replayable initial state and rider equilibrium

This plan follows the [load-distribution review](RIDER_LOAD_REVIEW.md). The received unseated example is a short passive sag transient. Its UI now exposes signed interface forces; it still does not receive balanced standing or seated equilibrium. No equilibrium solver, new record format, preload coefficients or acceptance pass is implemented by this note.

Current status, 2026-10-24: the explicit-state prerequisite below was implemented and received in merged PR23; [its contract](PR23_MAJOR_ITERATION.md#complete-fresh-state) preserves fresh-run semantics. The equilibrium algorithm/acceptance remains open, and the separate saddle branch's probes are rejected. The original prerequisite design below is retained as rationale, not a new request to reimplement state import. See [the system review](MTB_SYSTEM_REVIEW.md) for current priorities.

## First increment: explicit state, without a solver

The current `run()` launch writes chassis travel/heave/pitch, fork/rear compression, wheel spin and launch velocities. The tyre-node displacements and seven rider coordinates remain at their construction defaults. That path cannot generally encode a loaded equilibrium: tyres deform, soft hand/foot connects may need finite gaps, and the initial authored joint pose is not a gravity-supported solution.

Add a versioned explicit-state initializer as a separate, reviewable prerequisite. Preserve the old launch/record paths exactly. Keep this a fresh run at time/tick zero; a true continuation checkpoint needs a different contract containing command position, time, accumulated work/impulses and any history-dependent material/controller state.

- Include every supported scalar joint's position and velocity: chassis, suspension, wheel spins, every tyre-node u/v coordinate and all seven rider coordinates. Resolve native joint names, types and `jnt_qposadr`/`jnt_dofadr`; do not trust external array offsets. Canonicalize order and reject unknown, duplicate, missing, nonfinite or mismatched entries. This planar version must not silently accept future quaternion/free-joint states.
- Bind the initializer to physical configuration, topology, baked posture/laws, contact parameters and native build. Define the identity/fingerprint inputs precisely and exclude the initializer itself. Demonstrate browser/Node portability; raw generated XML strings may differ in floating-point formatting, so a mismatch cannot simply be ignored.
- Make state import mutually exclusive with derived launch fields. Apply it before initial observation, guard evaluation and energy/momentum baselines. The old launch writes must not overwrite it. Importing state must perform no integration or hidden settling.
- Rider coordinates remain displacements from the constructed pose: `theta = theta0 + q`. Do not wrap, recenter joint coordinates or rebuild the posture after import. Changing the baked posture or spring reference changes the physical meaning of the same q and invalidates its identity.
- Declare warm-start and equality-activation ownership. Prefer a documented deterministic fresh seed for the first initializer; if a seed is accepted instead, require complete finite entries and bind their ordering. Never inherit scratch from a prior run. The current unseated contract still requires both named closures active.
- Recompute derived positions, contacts, accelerations and forces through the actual observation pipeline, including current commands and travel buffers. Do not import cached contacts, constraint rows, accelerations or forces. Reject unsupported actuator, mocap, plugin, applied-force and other state instead of discarding it.
- Initial stored spring/tyre/buffer energy belongs in `initialEnergy`. Fresh cumulative work/loss starts at zero without deleting that stored energy. Changing preload/rest angles or stiffness during a run requires an explicit signed-work contract; damping cannot support a static posture.

Keep the construction gate of `1e-10` initial closure gap for the existing geometric/default-launch controls. A loaded explicit state has a separate admission contract: finite soft-constraint gaps, tyre deformation, suspension compression and joint positions must remain inside their existing ultimate guards. Do not relax those guards or make an imported state's allowed gap depend on whether the solver happened to converge.

The prerequisite's negative controls must cover wrong bike/node count/build/identity; missing/unknown/duplicate coordinates and wrong joint types; permuted input order must canonicalize, while independent named-value placement checks catch address-mapping errors; nonfinite position/velocity/seed; released closures; joint, tyre, suspension and pitch violations; conflicting launch/state fields; unsupported force fields; input mutation and partial-publication failure. Verify unchanged old replay, exact explicit-state replay, stored preload energy, observation-cadence independence, rollback from the imported accepted state and browser/headless agreement.

## Then solve and receive a coupled equilibrium

Solve rider posture and declared preload/support together with suspension compression, tyre deformation and ground reactions. Solving the rider against a fixed fixture is an isolated control, not a stationary connected bike. Do not prescribe a universal hand/foot percentage, zero rider COM motion by constraint, or rescale native reactions to match a visual preference. If the specified laws cannot support a pose within their domains, return an explicit unavailable result and preserve the failed case.

Before choosing or running an equilibrium algorithm, declare numeric budgets and units for all the following. This UI increment deliberately claims no solver or numeric equilibrium acceptance:

| Check | Required independent evidence |
| --- | --- |
| Stationarity | Native translational/angular velocities and accelerations, including internal joints and tyre nodes; separate units and scales rather than one mixed-coordinate norm |
| Force and moment balance | Independently sum rider, chassis and whole-system wrenches at explicit origins; include gravity and actual attachment/contact application points |
| Load paths | Signed hand/foot/saddle loads and front/rear tyre resultants; static axle/COM comparison under its stated flat-ground assumptions |
| Numerical closure contribution | Physical external balance and soft-connect pair moment/work reported separately; a compensated residual cannot hide a large numerical couple |
| Domain/contact consistency | Admitted bend branch, closure gaps, suspension travel and tyre/rim limits; saddle gap/load relation consistent with its regularized compression-only law |
| Persistence | A declared hold duration without hidden settling, position correction or active support that is absent from the model; measure drift and work/energy |
| Sensitivity | Timestep and contact/closure-regularization controls, plus small perturbations and a matched locked-posture control |
| Reproducibility | Complete producer settings and explicit initial state, fresh reconstruction, exact replay, owned outputs, rollback and shared browser/headless records |

Unseated receiving cases retain valid hand/foot attachments with no saddle support. Seated cases add the [finite unilateral saddle contract](RIDER_SADDLE_PLAN.md), then unload, separate and recontact. Intended sitting is not a measured support state. The parameter source/calibration remains distinct from these numerical gates; active posture maintenance and pump/wheelie/hop/endo controls follow their own torque/power/work limits.

## Primary source check

Both GPT-6.1 Sol and the primary agent read the pinned native source at `a892750516336d8358949f4518fcc4fbbd85beae`:

- [`mj_setState`](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_support.c#L285) copies selected state fields, including special handling of equality activation; it does not refresh derived geometry or forces.
- [`mjtState`](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/include/mujoco/mjtype.h#L511) distinguishes q/velocity, warm start, equality activation, applied forces and other integration state. Copying only q/velocity is not a general continuation checkpoint.
- [`warmstart`](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1071) may select between saved and smooth accelerations; seed ownership matters. [`mj_forward` versus `mj_step`](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L2016) distinguishes coherent force evaluation from advancing the simulation.

These sources justify the ownership/freshness requirements, not a chosen equilibrium algorithm. Read the actual primary algorithm reference before implementing one. Preserve the future 3D lateral/turning, finite component failure/blowout, layered terrain and measured multirate real-time gates; importing a stationary planar state does not receive those capabilities.


## Implementation preflight review, 2026-10-22

GPT-6.1 Sol reviewed the plan against the pinned native implementation, with no code edits or simulations. The primary agent checked the reset and warm-start source through GitHub's contents API at the exact commit above: `engine_io.c` blob `8fba829afa0567a6bedc3421a5745731f533a2fe`, `engine_forward.c` blob `68263c633c60e119790c51f15447f6a850738806`. This is design evidence; the initializer and equilibrium solver remain unimplemented.

The next visible slice is an explicit loaded-state candidate in **Trail bike**, on both full suspension and hardtail: import a complete candidate, inspect its admitted geometry and initial loads at time zero, run without hidden settling, export and replay it. The candidate must be labelled as a supplied state, never as a solved equilibrium. The UI and headless path must share the same admission decision and owned canonical state. This requires the following decisions before changing the record format:

| Decision | Required contract |
| --- | --- |
| Launch versus supplied state | Use a new version/discriminator with mutually exclusive initialization forms. Today `validate()` fills all launch defaults in `scenario.motion` and `inputFromRecord()` requires them. Rejecting those fields on import while exporting them again would break self-replay. Keep the existing record branch unchanged and define the new canonical representation first. |
| Complete scalar ownership | Resolve each named joint's type and separate qpos/DOF address. Require unique, complete coverage, including every tyre-node coordinate. Permuting entry order is valid and must canonicalize. Two plausible values exchanged between valid names are not generically detectable; test physical placement independently instead of promising detection. |
| Coordinate/rate admission | Existing ultimate travel, bend, closure and tyre guards do not bound every imported rate or unwrapped wheel angle. Finite values alone are insufficient. A first equilibrium-candidate slice could require all rates zero; moving-state import instead needs explicit engineering bounds in m/s and rad/s, plus first-step resolution and rollback controls. Choose and document the scope before accepting arbitrary finite rates. Do not silently wrap angles. |
| Fresh seed and activation | Construct fresh data, time zero, zero `qacc_warmstart`, both named closures active. A zero initial seed does not disable the native warm-start policy. Reject imported activation, cached forces/contacts, nonzero time and cumulative ledgers. Check unsupported native model features as well as payload fields. |
| Physical compatibility | Bind the physical description, joint/reference topology, geometry, masses/inertias, posture/laws, terrain/contact and numerical settings to the native JS/WASM hashes in vendored provenance. Exclude the initializer and presentation. Decide explicitly whether commands and timestep belong to physical compatibility or only to full run/replay identity. |
| Cross-runtime geometry | Canonical authored parameters alone can miss generated numeric geometry differences, while raw XML hashes can reject equivalent decimal spelling. Compare canonical numeric physical descriptors; use canonical generation or an explicit measured compatibility tolerance when binary64 values differ. Do not silently accept a mismatch or claim bit-exact identity from an authored-input match. |
| Admission and baseline publication | Copy/validate before native writes. Supplied state replaces derived launch writes. Apply tick-zero commands and use the current buffer/drive observation pipeline before guards, energy/momentum baselines and publication. Initial stored energy stays in the baseline; accumulated work and impulses start at zero. A bare `mj_forward` call does not reconstruct application-owned buffer forces. |

Native reset [clears velocities, applied forces and the warm seed and initializes equality activation](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_io.c#L1403), then [copies qpos0](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_io.c#L1479). The solver [compares the seed with its smooth solution](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1071), and integration [saves acceleration for the next step](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1486). Application admission bounds and calibration do not follow from those routines. The [ECMAScript trigonometric contract](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.sin) permits implementation approximations; bike and rider geometry still uses JS trigonometry even though wheel generation already addresses this portability concern.

Retain the negative controls above, add canonical-record self-import and physically mismatched geometry controls, and verify that no partial accepted state escapes on rejection. Then solve coupled equilibrium and receive saddle compression/unloading/recontact; neither a supplied zero-velocity state nor a low force residual at one instant establishes maintained standing.


The portability risk now has a measured receiving control: [Edge 157 versus Node model construction](ITERATION_20_EVIDENCE.md#newer-edge-numerical-portability-follow-up). Six limb-quaternion/spring-reference XML token differences produce a maximum normalized full-record discrepancy of 1.18e-7; using the same browser-generated native XML reduces it to 8.00e-14. Retain this scenario when selecting canonical geometry and identity semantics. Pinned Chromium passing exactly does not remove this newer-runtime requirement.
