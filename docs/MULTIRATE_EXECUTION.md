# Rider control, coupled physics and separate update rates

User requirement, 2026-10-24: consider rider joint updates at a separate/lower rate than bike collision and other expensive detail. This is a design and receiving contract; no new rate, actuator, scheduler or decimated physics is implemented here. It complements [independent rider ownership](RIDER_OWNERSHIP.md), [physics fidelity](PHYSICS_FIDELITY.md) and [adaptive wheel/contact work](ADAPTIVE_WHEEL.md).

Source baseline: main `c5ded411422203185e3bf17ca623e840e10035e6`, which merges the PR27 system/ownership review without changing the received PR26 physics.

**Decision:** introduce slower rider intent/target updates first, while the articulated bodies, passive joints and active bike/rider contacts remain in the fast coupled solve. Sampling feedback or holding commanded torque is a separate controller choice. Advancing rider bodies at a larger timestep is a later numerical coupling experiment, not a consequence of making the rider an independent actor.

## Distinguish the work before assigning a rate

| Work | Initial treatment | What must remain correct between updates |
| --- | --- | --- |
| Rider intent/planning | Candidate slower rate for posture goals, anticipation and strategy | Timestamped goals, explicit hold/interpolation and controller memory; no pose teleportation |
| Feedback/servo computation | Begin with slow targets and fast state feedback; separately evaluate sampled feedback/held effort | Sensor sample age, control delay, actual effort/limits, stability and rider work |
| Actuator activation/filter state | Its own validated dynamics and bandwidth when implemented | Continuous state, saturation, torque/rate/power limits and force response; it cannot be frozen merely because intent is unchanged |
| Rider rigid-body and passive joint mechanics | Fast coupled integration initially | Inertia, gravity, current-state spring/damping response, attachment reactions, joint domains and momentum |
| Hand/foot/saddle and bike/terrain contacts | Coherent collision/contact evaluation and coupled response at the admitted physics step | Creation/loss, current contact geometry/velocity, force/impulse/work, release/recontact and ultimate limits |
| Collision candidate discovery | Potential reusable conservative candidate sets, after coverage validation | Motion/deformation/steering horizons, geometry versions and invalidation; candidate reuse never means stale contact forces |
| Observation, recording, render/progress | Separate schedules consuming owned accepted snapshots | Guards and accounting retain required resolution; display clocks cannot advance physics or hide short events |

Rates are configurable model/execution choices, not a universal human-joint frequency. For a **future experiment** at the existing 31.25 microsecond physics step, controller periods of 160/320/640 ticks correspond to 200/100/50 Hz. These are illustrative comparison points, not recommended defaults, measured human response rates or qualified game settings. The currently admitted timestep range remains unchanged; the present engine has no active rider controller to schedule.

## Current implementation and primary source check

`rider-native.js` stores joint stiffness/damping on native hinges. `evaluatePassiveRider()` in `rider-passive.js` is a diagnostic copy of those laws, not their force application. Reducing its call frequency would not create a slower physical rider, and its cost has not been established as a meaningful optimization target.

`trail-bike.js` advances the entire native model with `mj_step()`. Its `observe()` also refreshes application-owned travel-buffer forces, native constraints, guard inputs and work partitions; it is not merely display telemetry. Do not run that function less often as a shortcut to slower rider updates.

The pinned MuJoCo source at `a892750516336d8358949f4518fcc4fbbd85beae` was read for this review:

- [`mj_fwdVelocity`](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L182) computes current velocities and passive forces; [`mj_forwardSkip`](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1957) then computes actuation, acceleration and constraints.
- [`mj_step`](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L2022) runs forward dynamics and the selected whole-model integrator. Native stage/callback APIs are not an independently received rider/bike multirate integrator.

An actual partitioned integrator needs its own primary algorithm review before implementation. No such algorithm is selected by this note. GPT-6.1 Sol independently checked the current source and the proposed rate boundaries without running measurements.

## One simulation clock and explicit scheduling

Start with a fixed physics step `h` and integer controller period/phase ticks. At tick `k`, after the interval endpoint passes its old-command mechanical guards, stage a due controller update from that endpoint sample exactly once. The staged controller and endpoint are committed only after the new-command guards also pass. Commands are right-continuous: finish interval `[k-1,k]` with its old command, then apply and validate the new command for the following interval. Tick-zero initialization is explicit. This follows the existing drive/brake boundary convention; never integrate work across a command discontinuity using an averaged old/new command.

Controller history must not advance inside a generic native forward callback. `mj_forward()` is also used for endpoint reevaluation, diagnostic data and rollback; a stateful controller called there could advance several times at the same simulation time. The application scheduler owns the tick transaction. In slow-target mode the target is held: a pure fast servo may recompute effort from current joint state and that target during repeated force evaluations. Only the separate sampled-effort experiment holds the torque command. Neither path consumes another slow sample or advances persistent controller/RNG state during force reevaluation. Only accepted transactions publish controller state, commands, events and ledgers.

Record period/phase, feedback sample tick and any modeled sensor/actuation delay, hold/interpolation policy, target and actual effort, saturation and actuator/controller state. A zero-order hold is explicit; interpolation needs an authored or causally available target trajectory, not a future feedback sample. Retargeting may change motion/energy and is not a cosmetic interpolation.

Wall-clock callbacks, render frames, worker chunk sizes and progress publication cannot decide control ticks. Continuation includes next-update tick, held command, sensor/filter/controller state, actuator state and any policy RNG state. Rejected steps or post-command failures restore all of them together with actor/interface state and work. Do not consume a control update twice on retry or drop it at a chunk boundary. Live late-input handling needs a declared policy; never backdate a received input silently.

If later physics subcycling changes the integration step, preserve controller periods in physical simulation time on a common exact tick basis. Counting a fixed number of variable-size solver steps would change controller behavior when impacts trigger detail. Log effective schedules and mode changes for offline/game replay. Physical event handling may synchronize or refine a coupling group; any event-triggered controller update is a separate declared policy with its own delay assumptions.

## Force, work and impact requirements

Holding an actuator command does not hold a body pose. Current-state passive damping still needs its constitutive response: holding `-c * velocity_old` after velocity reverses can deliver positive mechanical power, instead of the intended `-c * velocity_current²`. This is not an admissible cheap passive damper. A sampled active torque may legitimately add energy, but it must be recorded as actuator work with its actual limits.

Evaluate actual mechanical effort against actual relative motion at the physical integration resolution. For an ideal constant generalized joint torque over one interval, work is `torque * (q_end - q_start)`; general transmissions and time-varying effort require their own force/velocity work calculation. Keep passive potential/loss, actuator work and numerical closure/contact work distinct. Changing spring reference/stiffness also needs the [parameter-work contract](RIDER_POSE_STUDY.md#small-next-dynamics-increments), without double counting it as applied torque work.

For future partitioned body integration, transferring equal/opposite **average forces alone** is insufficient. Coupling must preserve interval linear/angular impulse at consistent origins and work against supported interface motion trajectories. A frozen attached rider changes the apparent inertia and load path seen by tyres, suspension and the frame during impact. Fast collision queries cannot repair that response. Any reduced or asynchronously advanced rider must expose a verified dynamic response over the interval and synchronize before its validity/contact assumptions fail.

Keep guards, contact/release events and overload detection at their required mechanical resolution. Do not wait for a slow posture update to detect a rim strike, saddle recontact or exhausted travel. Conservative prediction/coverage must promote a coupling group before a risky advance, or reject the advance. Promotion after an under-resolved impact does not recover a missed impulse. Attached actors may need to advance together; a separated free-flight actor can only use an independent schedule after its motion, internal stiffness and imminent collisions are covered by a validated policy.

## First experiment and receiving gates

Implement after explicit rider bindings, bounded actuation/work and the persistent session boundary are available. Keep the default passive path and native timestep unchanged.

1. Compare held slow posture targets with the same fast feedback/actuator law. Then test sampled feedback/held effort separately. Label these as different control policies; their outputs need not be identical. Do not combine controller changes, larger physics steps and reduced contact geometry in one claimed optimization.
2. Replay the **same applied control stream** through offline and arbitrarily chunked session execution; require unchanged mechanics under unchanged numerical policy. Separately compare fine/slow controllers with declared errors for joint/COM motion, support loads, closure, work, constraints and contact events. Recomputed closed-loop controllers may issue different commands; retain both streams rather than hiding that difference.
3. Refine physics timestep and controller period independently. Sweep controller phase relative to square/faceted impacts, velocity reversal, actuator saturation and joint boundaries. Later include saddle separation/recontact, release/capture, stand/sit and pumping at matched entry state; the cases must be supported before they can qualify the rate policy.
4. Verify zero effort, held target, feedback reversal, delay, rejected update and termination. Exercise updates exactly at command/contact/chunk boundaries, pause/resume and repeated diagnostic forwards. Required evidence includes correct transactional rollback and no change to accepted mechanics when only rendering/recording cadence changes.
5. Show commanded versus actual posture/effort, controller sample/update time and mechanical contact/support state in Trail bike; export them with headless/browser replay. Do not animate intermediate poses and present them as solved contact states.
6. Measure controller computation saved **and whole-run cost**, including synchronization, recording/transfer and impact bursts, on declared hardware without unrelated local workloads. Require fidelity/event/work budgets as well as performance; a cheaper controller alone does not qualify real-time physics.

Slower integration of rider bodies, held Jacobians/passive forces, or independent contact clocks remain later research gates. The first optimization opportunity is expensive policy/intent calculation and observation work where profiling supports it, while the joined mechanical response remains resolved. Missing deadlines must not freeze the rider, remove its inertia, relax travel limits or erase damage/terrain history.
