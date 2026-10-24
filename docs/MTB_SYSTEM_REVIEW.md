# Connected MTB simulation: current state and remaining gaps

Reviewed 2026-10-24 against main `3130c89c7607da7729f9aa9b706aac88d4cbb7be` (merged PR26), tree `f699f2f0e956b5389ba6d6ce91e34fe9fb810350`. This is a source/evidence review, not new dynamics, calibration or a performance experiment. GPT-6.1 Sol independently reviewed execution, state, dataset and performance gaps. The existing [D1–D12 delivery plan](DYNAMICS_DELIVERY_PLAN.md) remains the requirement inventory; this review updates its status and next priorities.

**Assessment:** BikeLab has a connected, inspectable planar bike/rider experiment with substantial numerical verification. It can generate reproducible experimental trajectories within declared model limits. It is not yet a calibrated MTB reference, a continuous riding simulation or a real-time game engine. More detailed standalone stations do not close the missing connections by themselves. The user additionally requires an [independent, detachable rider reusable across bikes](RIDER_OWNERSHIP.md); this is an architectural requirement for subsequent integration.

## What is actually connected

The [Trail bike engine](../dist/trail-bike.js) is the common browser-worker and CLI consumer. Both deformable wheels, frame translation/pitch, front suspension, full-suspension linkage or rigid hardtail rear, hub drive/brakes and a selected rider model evolve together. The viewer draws accepted native states. Fixed/guided and passive articulated riders are different model configurations, not interchangeable validation controls.

| Area | Received in the current experiment | Boundary that still matters |
| --- | --- | --- |
| Hardtail/full bike | Freely moving planar assembly, geometry-derived shock forces, finite travel buffers, loads and work/impulse accounting | Synthetic single-pivot geometry; no 3D handling, whole-frame collision or production-bike calibration |
| Tyre/rigid ground | Distributed deformable ring contacts, authored square edges and coarse facets, force vectors and explicit unsupported stops | Uncalibrated spring-supported casing; sharp-contact mesh sensitivity, complete swept collision, pressure-derived support and local stress remain unresolved |
| Traction and control | Homogeneous Coulomb contact, longitudinal slip, tick-scheduled hub drive and regularized front/rear brakes with countertorque/work | One friction coefficient for the whole ground; no calibrated materials, rolling loss, combined 3D grip, pedal drivetrain or exact wheel-lock claim |
| Rider | Five rigid segment groups, seven relative coordinates, passive joints, retained hand/foot closures, signed interface forces and moving limbs | Short unseated relaxation/flight cases; no received saddle, maintained standing, active posture, independent actor/detachment, independent left/right limbs or limb collision |
| Short trail | Both bikes complete a 1.5 s guided-rider bump/crest/drop example, with sampled unloading and support return | This is not the articulated rider completing a controlled trail, a proved both-wheel jump or a long-duration ride |
| State and replay | Versioned normalized scenarios, canonical model/launch receipts in newer formats, complete named articulated q/v import and fresh restart | Fresh restart resets time, warm seed, commands and cumulative accounting; it is not continuation of a running session |
| User experience | Worker calculation, truthful accepted-step progress, cancellation/lifecycle handling, export/replay and recorded playback | Playback and progress messages do not provide live control or streaming physical snapshots |
| Geometry/pose studies | Manufacturer reference catalogue and visible standing/hover/seating-intent geometry | Catalogue selections do not configure the solver; pose previews do not command sit/stand motion or establish saddle support |
| Terrain data | Separate R0a request/cache/cutaway experiment with synthetic layered samples | Trail bike still compiles a bounded rigid polyline; those layers/cache states do not supply its forces |
| Physical limits | Last-accepted rollback for travel, rim/casing, joint, closure, numerical and domain limits; declared assembly/service assessment | A stop is not simulated fracture, deflation or a prediction that a named component survived |

PR26 final-head [CI 40092919457](https://github.com/CraigHutchinson/BikeLab/actions/runs/40092919457) passes 229 tests on each OS and the complete pinned-browser suite. Its final progress artifact has the same extracted bytes as the ten inspected implementation captures and associated records. [Optimization/progress evidence](TRAIL_CALCULATION_PROGRESS.md#implementation-received-2026-10-24) retains 20 exact complete baseline records. This supports software/numerical consistency within the tested envelope; it does not calibrate the physical model.

## The gaps that prevent a complete ride

### 1. Supported rider posture and motion — D5

The current articulated example sinks under gravity. In the [pose probe](RIDER_POSE_STUDY.md#additional-passive-launch-diagnostic), rider COM drops 41–54 mm relative to the frame over 0.1 s. Low net rider force at an instant cannot establish equilibrium: tyre-node and other internal accelerations must also pass. Front-tyre load is distinct from handlebar support; do not enforce a preferred hand/foot percentage to correct a screenshot.

The rider must own its definition, body state and controller independently of any bike. Bike-specific hand/pedal/saddle sites and their releasable/contact bindings belong at the interface boundary. Current reusable posture/law modules are a foundation, but the native assembly embeds the rider under the frame, the rider wrapper contains chassis settings, and either released hand/foot closure currently terminates. [The ownership contract](RIDER_OWNERSHIP.md) stages same-rider/different-bike setup, independent detached motion, release/recontact and later runtime transfer between bikes. All actors still advance in one coupled world; separating ownership must preserve equal/opposite loads and work.

The preserved [`codex/rider-saddle-followup` at a6ac124](https://github.com/CraigHutchinson/BikeLab/blob/a6ac1249e8dbc7f3737fa8dde4cc8a8c717f5f29/docs/RIDER_SADDLE_CHECKPOINT.md) contains finite contact and work/force diagnostics, but remains outside main. Its cycle control fails refinement: a full-bike separation seen at the coarse step disappears at the finer step; a stronger perturbation leaves the hardtail initially unloaded. Its static probes also fail stationarity. Preserve those failed cases and integrate selected changes onto current main rather than replacing the newer guards/state/UI code with that branch.

Required sequence:

1. Receive finite compression-only saddle support, unloading, geometric separation and recontact on **both** bikes. Resolve current contact-row ownership, keep internal saddle work separate from terrain and hand/foot closure, and pass timestep/regularization sensitivity and command-boundary rollback. A zero-load proximity contact is not support.
2. Receive coupled standing/seated references where the selected laws permit them: all-coordinate velocity/acceleration, independent rider/chassis/system wrench balance, closure contribution, bounded stationary hold and reported perturbation response/stability. Equilibrium can have neutral or unstable modes; require recovery only for an explicitly claimed stable or controlled posture. Establish matched locked-posture/passive controls before active-controller tuning. Otherwise report unavailable. Do not turn exploratory solver output into a selectable equilibrium.
3. Add bounded internal actuation for stand→sit→stand on one continuous physical state. Record target, actual effort, rate/power saturation and signed rider work; changing rest angles/stiffness needs parameter-work accounting. A pose rebuild or qpos assignment is not a physical transition.
4. Compare active behavior with the established locked-posture/passive controls, then receive the [pump/manual/wheelie/hop/endo cases](RIDER_MANOEUVRES.md). Flat-pedal support and release require a different contract from the current bilateral retained-foot surrogate. Pedalling requires actual crank/pedal mechanics; hub drive alone does not supply it.

Saddle cycles can be verified without claiming a balanced seated equilibrium. Active manoeuvres need their own supported initial conditions and whole-path checks; success at two endpoint poses is insufficient.

### 2. Contact, tyre and collision coverage — D1–D4

Sharp edges and low-resolution facets are **already admitted as an experimental MVP**, not universally unsupported. Keep the actual corners and side faces. [Impact evidence](ITERATION_17_EVIDENCE.md) shows useful force/momentum controls but also nonuniform impulse changes with timestep and material-mesh changes. More contact points or a smoother-looking trajectory do not establish converged impact peaks.

The current [ring law](../dist/moving-wheel.js) does not derive support from air pressure, carcass construction or tread. Assembly pressure in [wheel-limits.js](../dist/wheel-limits.js) is a service-admission input, not a pressure-dependent force law. Independent front/rear sizes/construction and finite tyre width are missing from the connected configuration. There is no resolved rim/spoke structure from which to infer local stress.

Before widening speed, impact or manoeuvre envelopes, verify temporal collision coverage for thin/grazing edges and deforming/rotating casing, independently refine terrain shape, tyre mechanics and timestep, and add frame/fork/pedal/rider collision where promised. The straight near-rim cast and per-step motion guards do not cover all curved paths. Current pitch is guarded at ±0.35 rad; authored launch speed is bounded to ±3 m/s, with separately bounded explicit-state admission. Removing these bounds to finish a trick would not validate the newly admitted motion.

Acceptance needs below/above-boundary and grazing controls, no tunnelling/ghost support, correct force/moment/impulse/work and preserved rejected prefixes. Calibrated tyre loading additionally needs measured load-deflection, pressure, contact and slip evidence over a declared range. Keep exact brake holding, rolling resistance and drivetrain/thermal detail explicitly scoped until implemented.

### 3. Geometry, parameters and physical reference quality — D9

The [catalogue](GEOMETRY_CATALOGUE.md) has eight sourced configurations, but every `simulationPreset` is null. Published fit charts and exploded drawings do not provide all pivot/eye coordinates, mass/COM/inertia or constitutive properties. The corrected image-informed shock/BB layout remains synthetic; another brand's multi-link bike cannot inherit the single-pivot mechanism by name.

Promote one measured hardtail and one measured full-suspension configuration first, with exact size/settings, coordinate convention, topology, tyre setup, rider attachments and uncertainty. Verify unloaded/loaded geometry, leverage through travel, mass/COM and load paths before fitting force laws. Keep stand-alone axial preload/asymmetric damping capabilities distinct from the connected rig's current native linear springs/damping and custom buffers.

A physical reference requires held-out measurements after numerical checks: instrumented static support, suspension response, tyre/edge impact, drive/braking and then rider/trail trials. Quantify model discrepancy and parameter identifiability. Cross-runtime agreement and a plausible video cannot substitute for those measurements. Fixing more decimal places cannot supply missing material data.

### 4. Damage and pressure-loss continuation — D10

Current ultimate guards correctly stop unsupported geometry. They must remain until a supported continuation exists. Bottom-out may be survivable; rim damage may occur before bottom-out. There is no universal axle-force threshold that decides either outcome.

The [component inventory](OVERLOAD_AND_FAILURE.md#component-by-component-review-basis) covers rim/bead seat, spokes/nipples, tyre/tube/insert/seal, hub/axle, fork, shock/mounts, frame/links/fasteners, bars/headset, saddle/post, cranks/pedals/drivetrain and brakes. For each active component, identify supported load modes, local load/stress or a justified reduced failure envelope, provenance/uncertainty, intact/damaged state and post-failure behavior. Service pressure, assembly approval and solver strain guards are not fracture data.

Start a sourced wheel failure chain only when local mechanics support it: impact→rim/bead-seat deformation or spoke redistribution→seal retention/gap→air loss→changed tyre support/contact. Include intact-seal dent and bottom-out-without-breakage controls. Failed spokes must lose their load path; pressure loss must change the support law. Preserve mass, momentum and energy, and stop unsupported post-failure states. Do not export current rim/travel stops as “rim broke”, “blowout” or “bike survived” labels.

### 5. Material terrain and persistent history — D7, D8, D11

The existing [layered design](LAYERED_TERRAIN.md) is expressive, but its mechanics are not connected. One homogeneous friction value cannot represent wet loam over roots, coated rock, dry crumbly soil, dust or a mud-packed tyre.

The first coupled case should be finite soil cover over a supported root/rock, with bare-feature and deep-soil controls. Resolve tyre and soil deformation separately; the buried substrate affects load transfer before exposure. Prevent duplicate full soil and root support. Fine-root reinforcement needs a supported composite law or resolved root network, without counting both representations. Mixed patches need consistent shear/grip capacity and actual phase/interface identities.

Use versioned material/law/interface tables with consumed SI parameters, stable geometry IDs, provenance, valid ranges and initial versus evolving state. Front and rear wheels must share accepted rut/compaction/exposure state. Mud pickup, retention and deformation/spin shedding need rotating tyre-attached history and material/momentum/work accounting; cosmetic particles or friction tags do not implement them.

Connect the terrain request/cache boundary to the force consumer with mandatory-coverage admission, stale-version rejection and seam/eviction/reload controls. For LiDAR/ML assets retain transforms, source licences, uncertainty, generator revision/seeds and immutable asset hashes. **1–2 cm spacing is not 1–2 cm accuracy**, and surface scans do not measure buried roots or strength. Generated detail must remain distinguishable from observations. Do not expand a uniform centimetre grid over an entire trail as the initial runtime design.

### 6. Actual 3D riding — D6

Native xyz vectors and a 3D solver do not make the current planar locks a 3D bicycle. The required destination includes free lateral/roll/yaw motion, steering-axis geometry and torque, wheel gyroscopic effects, finite-width contact, camber and combined longitudinal/lateral grip, banked terrain and rider balance/control. Combined grip must share a capacity; separate full longitudinal and lateral limits would double it.

Preserve explicit frames and full inertia tensors in new contracts now. Receive a rigid-bicycle benchmark and mirrored steering/lean controls, then a steady-turn balance and braking-in-turn test with supported tyres. Extend to suspension, articulated rider, oblique impacts and asymmetric limb contacts. [The 3D gates](THREE_DIMENSIONAL_DYNAMICS.md) require mechanical controls without a hidden stabilizer before controller quality is assessed. Detailed mud and scanned assets need not precede the first bounded rigid-ground 3D ride.

## Shared execution and synthetic-data contract — D12 alongside D3–D5

The largest architectural gap is a persistent accepted-state session. [run()](../dist/trail-bike.js) validates a finite scenario, builds native state, integrates synchronously, materializes every recorded frame and destroys the native owners. Scenarios allow at most 1.5 s, 300 recording intervals and 64 scheduled commands. The worker emits progress and then one full result; it cannot process new messages while the synchronous integration loop runs. These are useful bounded experiments, not a live game session.

| Missing boundary | Minimum next implementation | Receiving test |
| --- | --- | --- |
| Persistent stepping and continuation | Keep model/native state owned by a session with independent rider/bike actors and explicit interfaces; bounded advance; time/tick, solver warm state, activation, command position and all accounting/history; dispose deterministically | Compare unchanged monolithic execution with arbitrary partitions, including contact/command boundaries and rejected steps; preserve accepted state/work/events and actor lifetimes |
| Tick inputs and snapshots | Admit commands at explicit ticks with a declared late-input policy; publish owned immutable accepted snapshots through bounded queues | Offline schedule and streamed inputs agree; display cadence, slow consumers and pause/resume cannot alter simulation time or silently drop controls |
| Recording/transfer | Bounded sinks, selected observable channels and explicit buffer leases/backpressure; retain a full-reference mode | Channel/recording choices leave mechanics unchanged; long-run memory is bounded and consumers never see overwritten native/scratch data |
| Batch generation and verification | Small case manifest with normalized inputs, immutable code/runtime/assets, model/law versions, units/frames, uncertainty, case IDs and generator/seed when used; checksummed outputs and resumable jobs | Interrupted/resumed jobs reproduce identities/results, retain rejected and terminated cases and reject provenance mismatch; verify saved outputs separately from regenerating them |
| Label semantics | Stable body/terrain/material/topology identity; channel sampling/aggregation, signed loads/work, event times/uncertainty, supported/unknown/null meanings and validity envelope | Reconstruct declared quantities independently; event refinement catches short support transitions; no sampled maximum relabelled as a continuous maximum |

The existing [fresh-state initializer](../dist/trail-initial-state.js) intentionally resets time/warmstart and imports q/v only. It must retain that behavior. Add a separately versioned continuation contract; do not silently reinterpret old files. Future pressure, soil, coating, damage and controller state belong to that persistent history. Determine the complete native integration-state requirements from the pinned engine before implementation.

`replay(record)` regenerates from its scenario; it does not compare the saved frames. Existing browser comparison helpers can underpin an explicit connected-record verifier. The current generic `scripts/verify-record.mjs` verifies wheel/suspension records, not Trail bike. Provenance, record integrity, numerical reproducibility, convergence and physical validity are separate checks. Keep historical browser failures and the declared canonical comparison budgets visible; do not promise universal bitwise agreement.

For training datasets, record unsupported outcomes as censored/out-of-domain cases, separately from physical failure. Do not silently discard them and bias the dataset toward easy completions. Sample physically compatible parameter combinations, distinguish uncertainty from spatial variation, and split held-out bikes/trails/riders rather than merely adjacent frames of the same run. Image or virtual-sensor datasets additionally need defined camera/sensor timing, transforms and observation models; those are not supplied by the current diagnostic canvases.

## Performance and fidelity: what the measurements permit

The final four 0.1 s cases take approximately **2.36–3.45 wall seconds** at the median on the shared worker, with the progress observer disabled. This is about 23.6–34.5 times slower than simulated time for those cases, not a per-step or frame-deadline measurement. The native getter optimization preserves exact outputs and reduces measured overhead, but does not establish game readiness.

Recording also has concrete cost: each preallocated slot reserves 512 × 12 float64 contact entries (48 KiB); the admitted maximum of 366 slots reserves **17.16 MiB for contacts alone**, before other frame data, two native data owners and result materialization/worker cloning. This is a source-derived allocation bound, not measured peak process memory. It argues for measuring recording and transfer before reducing physics fidelity.

Declare target hardware, bike/contact/scenario envelopes, input/render deadlines and reference workload. Measure cold/warm construction, integration time distributions and impact bursts, recording/clone/render cost, memory/backlog and input-to-display latency separately. One-percent progress bounds message count, not wall time between updates. No target frame rate is qualified yet.

Retain the [adaptive wheel design](ADAPTIVE_WHEEL.md): persistent rotating material coordinates own state; a hierarchy selects contact work, while flat/circular storage can hold it. A contact tree does not by itself improve the mechanics or conserve state. Profile first, verify fixed nonuniform models between runs, then consider live refinement/subcycling with conservative mass/momentum/energy/history transfer, predictive activation and hysteresis. Couple stiff tyre/frame/rider responses at compatible intervals; do not refine an impact against an arbitrarily frozen bike. Rendering, integration, contact resolution and model fidelity are separate rates/choices. Log decisions so offline and game execution can reproduce the same accepted transitions.

The user's separate-rate rider proposal is captured in [MULTIRATE_EXECUTION.md](MULTIRATE_EXECUTION.md). Slower intent/target updates can feed fast coupled joint/contact dynamics; sampled feedback/held effort needs its own stability, delay and work checks. There is no active rider controller or qualified slower body integrator today. The receiving plan keeps one simulation clock, stages controller state once per scheduled tick, preserves it through rollback/continuation, and refines controller period independently from physics timestep and collision coverage.

## Recommended small increments and completion gates

Two prerequisites can be designed independently, then integrated through one Trail bike consumer. Keep code changes small and avoid overlapping edits to the runner.

| Order | Increment | Concrete exit condition |
| --- | --- | --- |
| Next rider architecture increment | Separate portable rider definition/state from chassis and bike-site bindings; preserve legacy adapters | Same rider on different bikes without changed body properties; stage independent detached motion then supported release/recontact under the [ownership gates](RIDER_OWNERSHIP.md) |
| Next physics receiving increment | Reconcile finite saddle contact onto current main with explicit actor/interface ownership; keep equilibrium experiments separate | Both-bike compression/separation/recontact with refinement, independent internal work/force checks, rollback, browser replay and actual support captures; actor detachment need not block this passive cycle |
| Next execution PR | Extract a persistent session/advance boundary around **unchanged** current physics; keep `run()` as its compatibility consumer | Complete existing records preserved; arbitrary chunk boundaries, cancellation/disposal and owned snapshots verified; no duration-limit expansion before bounded storage |
| Then rider reference/control | Qualified loaded references or explicit unavailable diagnostics; matched posture controls; bounded stand→sit→stand | All-coordinate balance/hold where claimed; continuous transition, actual support changes, actuator work/saturation and unchanged ultimate guards |
| Then joined planar ride | One rider/bike runs coast→bump→brake→posture change→rollers, with lift/flight/landing added only as each becomes supported | Same commands and accepted events in offline/session paths on both bikes; no pose resets or injected lift; restart/recording and physical budgets pass |
| Reference-quality work alongside these | Sourced bike/rider/tyre configuration, improved impact/contact coverage and explicit dataset manifest/verifier | Numerical sensitivity and held-out physical errors reported per use case; uncalibrated channels stay labelled experimental |
| Broader riding | Bounded 3D rigid-ground steering/lean/combined grip, then layered terrain/history and supported damage | Each mechanism passes its existing D6–D11 gates in the connected consumer; unsupported outcomes stay explicit |
| Game qualification | Measure and receive reduced/detail combinations and their execution/transfer policies | Declared target-hardware deadlines and memory bounds plus fidelity/event/work budgets against qualified references, including impacts and supported failures |

The joined planar ride should become the evolving system regression, not another disconnected station. Pumping with zero hub drive, phase-shifted controls and matched entry states is a particularly useful later demonstration: any added mechanical energy must be explained by rider work and changes in stored energy/height. The requested Pinkbike explanation is qualitative motivation; measured precision still needs independent data. Wheelies/manuals, bunny hops and endos follow the same load/contact/work rules and retain their collision/pitch-domain dependencies.

A bounded rigid-ground game tier can be qualified before soil or damage mechanics are complete, with its supported riding/collision envelope and unsupported outcomes declared. The fuller off-road destination still requires D6–D12; a scoped release does not close the omitted mechanisms.

Completion is claim-specific. The current build is useful for exploratory synthetic mechanics and numerical regression. A useful planar demonstrator needs sustained supported rider control and continuous execution. A credible physical synthetic-data reference needs calibrated configuration and laws for its **declared outputs, mechanisms and operating envelope**, with traceable labels. A game tier needs supported handling/collision behavior and measured execution/fidelity budgets; the complete MTB goal includes 3D riding and the broader terrain/failure requirements above. None of those claims follows merely from adding more detail or finishing a visually convincing run.
