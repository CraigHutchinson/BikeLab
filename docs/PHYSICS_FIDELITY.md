# System-wide physics fidelity and reference models

Status: architecture requirement for the next iteration, added during PR #1 review on 2026-10-15. This is a design review brief, not an implemented LOD scheduler, general solver API or real-time performance claim. The current stations calculate a finite experiment in a worker and replay it; fast playback does not demonstrate live coupled whole-bike simulation.

## Intended experience and engineering boundary

The eventual game must advance a joined-up bicycle, rider and terrain system in real time. Use progressively cheaper physical representations where measured error permits. A high-detail model may run slower than real time as the reference for developing, comparing and refining the game model. It must be possible to select alternative implementations for repeatable experiments and, where state transfer is verified, switch fidelity during a run.

Separate three evidence levels: analytical/numerical reference, converged detailed model, and physical measurements. A detailed model is the computational reference, not automatically physical ground truth. Its constitutive assumptions, calibration, resolution, convergence and uncertainty must be documented. A reduced model can match an incorrect detailed model. Both require held-out physical checks before corresponding real-bike claims.

## Fidelity belongs to mechanisms, with compatible system combinations

Use named model IDs/revisions, capabilities and validity envelopes rather than a universal integer meaning more accurate everywhere. A subsystem may initially have only one supported representation. Do not construct a full engine or a tier for every component before a real consumer exists.

| System | Candidate detailed reference | Candidate real-time representation to evaluate |
|---|---|---|
| Tyre and contact | Spatial casing/tread response, finite patches, supported pressure and local load transfer | Calibrated reduced carcass/patch/contact state with bounded combined slip |
| Soil/root/rock | Finite-layer deformation/shear and embedded-feature support or resolved root mechanics | Reduced layer/composite state and explicit supported obstacle geometry |
| Retained mud | Deforming tread voids and material adhesion/transfer with rotation | Bounded angular/width sectors or aggregate states for retained mass, packing and release |
| Suspension | Measured/modelled spring, hydraulic/friction/thermal state and physical stops | Reduced force/state law with the same supported work and travel semantics |
| Bike structure/assemblies | Flexible load paths, local deformation and evidenced failure criteria | Rigid/reduced-flex bodies with calibrated stress/damage proxies where valid |
| Rider | Articulated body, contact and muscle/control dynamics | Reduced body/compliance/controller with declared load and action limits |
| Brakes/drivetrain | Detailed friction, thermal and engagement compliance | Reduced torque/heat/engagement states preserving reaction paths and power |

These are candidates, not promises or selected algorithms. Their numerical formulation and data must be researched before implementation. A reduced model lacking a required mechanism cannot claim it from another tier's validation.

Some tiers must change together. A finite soil model with a rigid tyre may not reproduce the patch of a deformable tyre; an impact model against a frozen coarse-rate frame can get impulse/work wrong. Define compatible model combinations and coupling groups, including stiffness, integration constraints and shared contact state. Frame/rider/controller changes alter loads feeding the tyre and soil; a collection of independently fitted components is not sufficient whole-system evidence.

The [rider/control multirate contract](MULTIRATE_EXECUTION.md) applies this to the independent rider: slow intent/targets first, separately qualified sampled feedback/actuator dynamics, and initially fast coupled body/contact mechanics. True body subcycling needs supported response trajectories and impulse/work transfer; it is not implemented by decimating joint diagnostics or collision queries.

## Common physical contracts

At each interface, declare frames, units, attachment/contact locations and velocities, applied forces/moments, constraints and reaction ownership. Record time intervals, force impulses, work, stored/dissipated energy and material transfers where applicable. Internal interactions need equal/opposite exchange, without duplicated normal support, grip, lever effects or damage loads.

A model descriptor should eventually name consumed inputs, produced outputs, private state, initialisation, validity checks, failure/unsupported outcomes, memory bounds and compatible partners. A selected model must account for all promised output quantities; do not expose a local stress estimate through an abstraction that has only total axle force.

Keep a canonical persistent state where physically meaningful: pose and momentum, pressure/air mass as consumed, spring state, damage, soil deformation/history, coating mass/distribution, tyre spin phase and relevant thermal/moisture state. Models can own additional private state. Do not pretend a single universal array can represent every constitutive model without information loss; explicit state adapters and restart artefacts are required.

The experiment runner owns input time and commands. The physical solver owns coupled state advancement. Rendering consumes snapshots. A comparison harness observes independent runs. No renderer or shadow reference silently overwrites authoritative physics.

## Mud release as the first cross-system example

Mud can remain as small masses between tread blocks, including portions in the contact region. Tread/carcass deformation changes void geometry and loading, allowing extrusion, fracture or detachment under a supported material/interface law. Rotation and acceleration also alter the forces needed to retain material; gravity, adhesion/cohesion, water state and confinement matter. Spin must not simply clear all mud at a universal RPM.

A candidate reduced model tracks bounded retained mass and packing/coating state by angular sector (and width band where needed), transported with wheel rotation. A sector passes through contact, deforms, may collect/transfer material, unloads and can shed material outside contact. The detailed reference supplies or validates retention/release response across this cycle. An aggregate wheel-level model is admissible only if its loss of spatial distribution is within the intended error budget.

Account for carried mass, centre of mass and inertia to the required fidelity. Uneven retained mass can create rotating imbalance; a uniform thin-ring inertia approximation needs its own envelope. Include mass in the contact region without counting it twice as ground soil and attached wheel mass. Neglecting small carried mass in bike dynamics can be a measured approximation, while its effect on tread packing/traction may still be important.

Pickup and release exchange material, momentum and energy. Detached material starts with a supported release velocity inherited from the contact/rotating material plus any modelled relative motion; its later treatment may be a bounded deposit rule or a more detailed flight model. A cosmetic spray does not itself establish physical shedding. Log retained, transferred and shed mass and any approximation to untracked material, including boundary outflow.

Required controls isolate stationary tread compression/unloading, unloaded wheel spin, rolling pickup/release, combined deformation/spin, reverse rotation, contact loss, persistent coating on dry rock and repeated passes. Compare distribution, retained mass, release phase/rate, inertia/torque, traction and material/work budgets. The cheap model must match the declared reference quantities, not just the appearance of flying mud.

See [layered terrain](LAYERED_TERRAIN.md) for cover, root reinforcement, soil and tyre state ownership.

## Comparison and parallel reference execution

Support three distinct comparison modes when their consumers arrive:

1. **Prescribed-input component comparison:** identical geometry/material state, imposed motion/load history and initial conditions drive independent detailed and reduced instances. Compare force, moments, material state and work without changing either input history.
2. **Coupled scenario comparison:** each whole system evolves independently from the same initial scenario and input schedule. Compare trajectory, handling, constraints, forces/events and history. Do not force both systems to follow one recorded trajectory and then call that a closed-loop validation.
3. **Optional shadow reference:** a reference runs alongside or asynchronously behind the authoritative game model for diagnostics. Use immutable snapshots/input streams with independent mutable state and time-stamped paired windows. It cannot feed corrective forces, delayed state or controller decisions into the live system unless a separate verified coupling/control scheme is explicitly selected.

A lagging reference must not be compared at the same wall-clock instant with a different simulation time. Record reference lag and backlog; bound queues, checkpoint/replay selected windows and report missing comparisons when work is dropped. A slow reference need not run continuously on the player's hardware. Offline replay or a separate process/machine may be appropriate; no infrastructure is selected here.

Separate open-loop mechanical comparisons from controller-driven runs: independently evolving rider controllers may issue different commands in response to model differences. Store both command streams. Measure closed-loop outcome separately so the controller cannot conceal a bad force law.

Use recorded scenarios with fixed versions/seeds and held-out cases. Report per-output tolerances, scaling, peak/event errors and uncertainty, not just an average score. Continuous trajectory errors, contact/shedding events, failure classification and conservation errors need different measures. Near a validity/failure boundary, refine or report uncertainty rather than averaging away a changed outcome.

Accuracy comparisons may run concurrently when resources allow. Throughput/tail-latency claims must be measured with declared reference workload and contention; record shadow-enabled and shadow-disabled costs separately. Do not use a contended background-reference run as clean production-performance evidence.

## Model replacement and in-run switching

Replacement between runs is the first delivery: select model IDs and rerun the same scenario. In-run switching is a later capability gated by explicit source-to-target and target-to-source adapters.

- Define switch eligibility, predictive triggers, hysteresis and coupling-group boundaries. Select from physical validity/error needs, not just camera distance. Offscreen tyres still influence the bike.
- Map observable and persistent state, constitutive history, momentum, stored energy, pressure, soil volume/mass, coatings and damage. Preserve stable geometry/material IDs, tyre phase and terrain state across streaming and model changes.
- If coarse state cannot reconstruct detailed microstate, use a documented constrained reconstruction with uncertainty, or restart a detailed checkpoint/replay window. Do not label invented microstate as preserved ground truth.
- Compare before/after forces and state budgets at synchronization points. A smooth force blend can still inject energy or duplicate reactions; smoothing is not proof of a correct transfer.
- Keep integration rate, contact/terrain resolution, model fidelity and rendering rate separate. Subcycling requires consistent interval impulses/work and response trajectories; stiff coupling may require advancing the group together.
- Verify repeated switches, thresholds, zero speed, contact creation/loss, wet/dry interfaces, two-wheel shared ruts, retained mud, pressure leaks and damage. Retain the current supported model or stop if a valid transfer cannot be made.

A real-time deadline must not make the bike indestructible or erase soil/tyre history. Reduce optional rendering/diagnostics first. A cheaper physics fallback must be explicitly validated for the active state. If none is valid, report loss of real time and slow or stop; log the selected schedule so replay can reproduce it.

## Required architecture review next iteration

Review the entire current implementation and follow-up plan before adding another major mechanism:

- Map current consumers: wheel/suspension solvers, shared worker lifecycle, setup/record formats, verifier, scenario CLI, viewers and browser/headless gates. Preserve tested behavior and version compatibility during any extraction.
- Distinguish precomputed playback from future continuous coupled simulation, including worker ownership, fixed input time, snapshots, bounded recording, cancellation and asynchronous reference execution.
- Enumerate hardtail/full-suspension/rider bodies, joints, DOFs and load paths alongside compatible tyre/soil/suspension model combinations. Apply 3D, overload and material-history contracts together.
- Identify the minimum shared interface required by a concrete paired-model experiment. Compare current duplication and coupling against that need; avoid a speculative plugin framework or forcing all models through the scalar RK4 API.
- Establish state ownership, units/frames, capability negotiation, supported transfers, deterministic experiment manifests and unsupported-outcome handling.
- Set explicit accuracy and real-time budgets on declared hardware. Measure update-time distribution, worst observed event bursts, active contact count, memory, backlog and input/render latency separately. Declare whether reference/shadow work shares the machine.
- Produce a model/coupling matrix, receiving experiment, verification plan and migration decision log. Keep the user-visible cutaway/comparison experience and bottom-up memory/solver constraints in the same review.

First bounded architectural slice: compare the existing axial station with its independent analytical reference through a paired experiment/reporting path, retaining the present viewer and records. That validates comparison/ownership mechanics only; it is not a reduced model of hydraulic hardware or a proof of full-bike real-time performance. Then receive spatial-wheel and mud-over-root experiments with the selected contact solver. Reuse existing tests/reference formulas rather than duplicate them solely to demonstrate an interface.

No full multibody engine, real-time budget, physical terrain ground truth, in-run LOD transfer or model-learning system is approved as implemented by this PR. The review must decide the minimum next changes using these named consumers.

Iteration 3 follow-through: [architecture review](ITERATION_3_ARCHITECTURE.md) and [reference-comparison evidence](ITERATION_3_EVIDENCE.md). The first paired analytical/numerical experiment is implemented in the suspension viewer and headless report; full LOD scheduling, reference shadowing and in-run state transfer remain planned.

Iteration 17: [contact-aware wheel resolution](ADAPTIVE_WHEEL.md) applies these requirements to the connected faceted-impact consumer. It distinguishes persistent material coordinates, contact hierarchy and circular storage; records nonuniform stiffness/mass and rotating-imbalance pitfalls; and stages measured query work, fixed nonuniform meshes, then conservative live adaptation. The fixed current mesh remains unchanged.
