# Delivery and validation plan

Status: 2026-10-14. Slice 1 implementation and numerical/interaction verification are delivered. Pixel-level visual inspection remains open; see SLICE_1_EVIDENCE.md. Later slices remain proposed.

## Definition of a received slice

Each slice must deliver its user-visible experiment, the physical mechanism it consumes, independent tests, repeatable scenarios and a short account of what the evidence does and does not establish. A headless physics component without the promised viewer is incomplete. An animation without verified dynamics is also incomplete.

## Slice 0 - Planning baseline

Deliver the component map, rig contracts, parameter provenance model and this roadmap.

Completed: initial documentation.

Completed for Slice 1: stack/model decision, implementation, analytical tests and browser interaction checks. Open: pixel-level visual inspection and physical reference hardware selection. See STACK_DECISION.md and SLICE_1_EVIDENCE.md.

## Slice 1 - Loaded-wheel test

### Experience

A side-view loaded wheel on a vertically moving platen. Controls expose effective mass, radial stiffness/damping for the explicitly simplified model, disturbance amplitude/frequency and run/pause/reset/step. Show displacement and contact force on synchronized plots. Save/replay a run and compare two parameter choices under identical forcing.

Use a smooth single bump and sinusoidal excitation first. Do not introduce edge impacts until the contact geometry and integration have appropriate tests. Do not expose tyre tread or inflation as controls before a consumed mapping exists.

### Mechanics

One vertical coordinate and velocity, gravity, prescribed support motion and unilateral elastic/damped contact. Research the actual contact law and integration method before implementation, including relative velocity, separation behaviour and energy accounting. Demonstrate independent limiting cases before enabling arbitrary input combinations.

### Proposed gates

- Resting equilibrium agrees with the simplified model's independent static solution within 0.1% of the characteristic deflection after the declared settling window.
- An independent sustained-contact reference case agrees in phase/amplitude with a separately calculated solution; establish explicit tolerances before evaluating the implementation.
- Contact normal force is nonnegative; the separated wheel follows its independently checked free-flight behaviour.
- Compare step h, h/2 and h/4 over a fixed physical interval. Target less than 1% change between the two finest steps for displacement amplitude and force impulse in smooth cases. Investigate peak/event-time convergence separately; do not hide event differences in averages.
- Unforced conservative and dissipative cases pass separate energy checks. Prescribed-motion cases account for support work. Choose and record error budgets before results are judged.
- Headless and interactive runs use the same simulation path and yield matching recorded samples for the same build, platform, input and step.
- Reset and replay reproduce the initial state and input. Invalid/nonfinite parameters fail visibly before execution.
- The viewer keeps responding during a run; measure actual update/render costs before assigning a performance target to the hardware.

These thresholds are proposed development gates, not claims of 0.1% real-world tyre accuracy.

## Slice 2 - Fork and shock stations

Experience: inspect spring and damping curves, compress a mechanism and compare rebound responses.

Foundation: axial suspension element, preloading, friction/end stops when included, and consistent force/work reporting. Start with a verified simple force law before adding air chambers or adjustment circuits.

Gate: independent equilibrium and transient tests, dissipative sign checks, travel-bound behaviour, tests at multiple masses/stiffness scales, and convergence checks. Distinguish synthetic law validation from agreement with real component curves.

Trade-off: simple curves are inspectable but cannot yet reproduce a named fork/shock. Next balanced slice puts these tested elements into the actual bicycle geometry.

## Slice 3 - Planar whole-bike rig

Experience: switch between a hardtail and single-pivot full-suspension bike; inspect fork/rear motion, frame heave/pitch, tyre loads and fixture reactions under identical independent or travelling inputs.

Foundation: explicit bodies/joints, geometry-derived force paths, two tyre contacts and a documented fixed-rider mass. Enumerate DOFs and constraints before implementing the assembly.

Gate: total mass/inertia checks, static axle-load and sag references, independent linkage kinematics, no artificial hardtail suspension DOF, no constraint drift beyond a declared tolerance, energy/work accounting and timestep convergence. Verify both bike variants in the unfiltered regression suite.

Trade-off: planar motion isolates vertical response but excludes balance and cornering. Fixture effects limit interpretation. Next slice adds the rider mechanics that strongly affect the observed vertical response.

## Slice 4 - Articulated rider

Experience: compare seated/standing postures and passive limb compliance, then add scripted weight shifts.

Foundation: articulated masses, joint limits and explicit hand/foot/saddle contact. Keep passive mechanics separate from action control. Contact attachment/release must be visible and logged.

Gate: static supported posture, joint/contact limits, passive energy behaviour, controller saturation/work and reproducible posture transitions. Compare against fixed-rider runs to expose rather than conceal the change in assumptions.

Trade-off: a planar paired-limb model cannot establish asymmetric handling realism. Next slice adds rolling longitudinal forces and actions.

## Slice 5 - Rolling, brakes and drivetrain

Experience: traverse the same obstacle under coasting, braking and drive inputs; compare front/rear braking and suspension response.

Foundation: active wheel rotation, longitudinal slip, brake reaction paths, crank/gear/freewheel model and free longitudinal bike motion where appropriate. Research and independently verify slip definitions near zero speed.

Gate: force/torque and power balances, coasting limits, traction saturation, braking-to-stop including zero-speed behaviour, freewheel transitions and contact-loss cases. Confront actual measured data before quantitative brake/grip claims.

Trade-off: longitudinal contact cannot establish cornering grip. Next slice introduces steering, lean and lateral contact together.

## Slice 6 - Three-dimensional handling

Experience: inspect and run steering, camber, slalom and constant-radius tests with a declared rider controller.

Foundation: 3D body inertia, steering assembly, lateral/combined-slip tyre response and bounded balance control.

Gate: independently checked reference manoeuvres, symmetry/sign tests, convergence, controller sensitivity and validation across held-out speeds/loads. Separate controller quality from mechanical model accuracy.

Trade-off: calibration is demanding and parameter identifiability may be weak. Do not substitute automatic stabilization for evidence. Next slice receives these capabilities in a short playable trail.

## Slice 7 - Received trail and calibration

Experience: a short rideable trail with repeatable setup comparisons, telemetry replay and appropriate sound/input feedback.

Foundation: the laboratory mechanisms running under actual terrain/input conditions, with only consumer-required additions.

Gate: physical calibration receipts, held-out validation, performance on the intended hardware, native graphics/input execution and separate participant feedback. Record the valid speed, load, tyre and terrain envelope.

Trade-off: detailed tread/soil, structural flex and thermal behaviour are separate extensions. Add them in response to observed limitations and specific experiments.

## Planned extension - production-bike selection

User requirement, 2026-10-14: offer off-the-shelf bike presets from Santa Cruz, Trek, Scott and other manufacturers.

Prepare the catalogue alongside whole-bike work; expose selection when the geometry, suspension mechanism and components are actually consumed. The initial single-pivot test rig remains a reference mechanism, not an assumed model of every production bike.

First delivery: a small source-backed set spanning hardtail and full suspension, identified by model year, frame size and build specification. Selecting a bike loads its stock configuration; rider/setup changes remain editable overrides. Show modelling confidence and missing/estimated parameters. Compare different bikes using the same rider and excitation.

Acceptance: source/provenance coverage, geometry/assembly checks, correct mechanism selection, reproducible catalogue revisions, stock-reset behaviour and saved-run reproduction. Published specifications and measured dynamic calibration remain distinct. See [catalogue requirements](PARAMETERS.md#production-bike-catalogue).

## Stack decision before Slice 1 coding

Evaluate a small number of candidates against:

- Headless testing and one authoritative simulation implementation.
- Rapid interactive controls, plotting and replay on the user's Windows machine.
- Control over integration, unilateral contact and energy instrumentation.
- A practical path to constrained multibody and later 3D dynamics.
- Packaging, licensing, maintenance and graphics/input support.

A browser or desktop laboratory UI can consume the same conceptual contracts. Do not assume a game engine's default rigid-body/vehicle model already satisfies the tyre/suspension requirements. Conversely, do not build a general physics engine merely to avoid evaluating existing solvers.

Record the chosen stack and limitations in a short decision note before code. Use primary documentation for current capabilities. The workspace's research preference names Sonnet/Terra; neither is available in the currently exposed agent model list, so research should proceed locally unless that availability changes.

## Verification workflow

1. Give every scenario a stable identifier and fixed input/initialisation.
2. Store build/version, solver settings, setup, provenance and analysis windows with results.
3. Run unit/property checks and scenario regressions independently of rendering.
4. Inspect the same runs visually for scale, pose/contact agreement and plot synchronization.
5. Compare new physics against independent references, not only previous output from the same implementation.
6. Add physical calibration as distinct evidence; retain uncertainty and applicability bounds.
7. Review implementation quality and consumer boundaries before accepting each slice. If C++ is chosen, load cpp-write before authoring and run cpp-review before merge.
8. Report completion honestly: mathematical, numerical, physical and user-experience evidence separately.

## Next actionable work package

Current delivery: stack decision and Slice 1 are implemented; pixel-level visual inspection remains open. Next implementation is Slice 2, the suspension station.

Delivered: runnable wheel/platen station, headless scenario runner, controls/plots, saved input/replay, independent tests and an evidence note. Next: close visual inspection and add verified fork/shock force curves and transient experiments.

Do not require the user to pick a real bike, game controller or final graphics engine before this bounded slice can begin. Use clearly labelled illustrative parameters and keep the reference dataset question open.
