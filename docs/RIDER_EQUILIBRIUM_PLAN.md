# Replayable initial state and rider equilibrium

This plan follows the [load-distribution review](RIDER_LOAD_REVIEW.md). The received unseated example is a short passive sag transient. Its UI now exposes signed interface forces; it still does not receive balanced standing or seated equilibrium. No equilibrium solver, new record format, preload coefficients or acceptance pass is implemented by this note.

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

The prerequisite's negative controls must cover wrong bike/node count/build/identity; missing/swapped/duplicate coordinates; nonfinite position/velocity/seed; released closures; joint, tyre, suspension and pitch violations; conflicting launch/state fields; unsupported force fields; input mutation and partial-publication failure. Verify unchanged old replay, exact explicit-state replay, stored preload energy, observation-cadence independence, rollback from the imported accepted state and browser/headless agreement.

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
