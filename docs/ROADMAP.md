# Delivery and validation plan

Status: continued 2026-10-15 after review of the entire a1d96dd baseline; see ITERATION_2_REVIEW.md. Slice 1 visual inspection is now recorded, and the bounded Slice 2 axial station is implemented and verified; see SLICE_2_EVIDENCE.md. Whole-bike and later slices remain proposed. Full 3D simulation, including lateral motion and turning forces, is a required destination; see THREE_DIMENSIONAL_DYNAMICS.md.

## Definition of a received slice

Each slice must deliver its user-visible experiment, the physical mechanism it consumes, independent tests, repeatable scenarios and a short account of what the evidence does and does not establish. A headless physics component without the promised viewer is incomplete. An animation without verified dynamics is also incomplete.

## Slice 0 - Planning baseline

Deliver the component map, rig contracts, parameter provenance model and this roadmap.

Completed: initial documentation.

Completed for Slice 1: stack/model decision, implementation, analytical tests, browser interaction checks and subsequent desktop/mobile screenshot inspection. Open: physical reference hardware selection/calibration. See STACK_DECISION.md, SLICE_1_EVIDENCE.md and SLICE_2_EVIDENCE.md.

## Slice 1 - Loaded-wheel test

### Experience

A side-view loaded wheel on a vertically moving platen. Controls expose effective mass, radial stiffness/damping for the explicitly simplified model, disturbance amplitude/frequency and run/pause/reset/step. Show displacement and contact force on synchronized plots. Save/replay a run and compare two parameter choices under identical forcing.

Use a smooth single bump and sinusoidal excitation first. Do not introduce edge impacts until the contact geometry and integration have appropriate tests. Do not expose tyre tread or inflation as controls before a consumed mapping exists.

Required spatial-contact extension: consume a defined ground profile/surface or contact geometry, distinguishing square rock edges from rounded/flat support through tyre-envelope contact locations, normals and supported local deformation/stress. The existing temporal flat platen does not do this. [TERRAIN_CONTACT.md](TERRAIN_CONTACT.md) also requires adaptive detail and independently validated multiple physics rates where useful for real time; activation must precede impact and preserve force/work and damage state.

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

Implemented bounded delivery: shared preloaded coil and asymmetric viscous damper, editable fork/shock-scale fixtures, force curves, release/moving-base experiments, comparisons, replay and complete saved setups. Stroke exits terminate explicitly; no end-stop impact, friction or air-spring law is claimed. Primary research, independent test gates and actual evidence are in SUSPENSION_RESEARCH.md, SUSPENSION_MODEL.md and SLICE_2_EVIDENCE.md.

User-required extension: maintain admissible travel during overload, model top-out/bottom-out load paths before continuing through impacts, and establish physical failure criteria for active components. Rim deformation/fracture, spoke failure and deformation-induced tubeless leakage are explicit review cases. The component matrix and release gates in [OVERLOAD_AND_FAILURE.md](OVERLOAD_AND_FAILURE.md) are required for high-impact claims; the current stop-at-domain-limit behavior is a fallback, not a damage simulation.

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

Required contracts: full force/moment application at attachment/contact points, explicit x-forward/y-left/z-up signs, wheel gyroscopic effects, near-zero-speed slip, camber/lean coverage, combined traction budget and declared controller work. Use the detailed acceptance matrix in THREE_DIMENSIONAL_DYNAMICS.md, including rigid-bicycle benchmark, mirror tests, constant-radius force/moment balance and braking-in-turn. A 3D renderer alone does not satisfy this slice.

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

## Layered-terrain workstream

Integrate the [layered-terrain data and acceptance contracts](LAYERED_TERRAIN.md) in the spatial-contact and multibody design decision now. Implement their T0–T4 gates alongside the receiving slices:

- Before whole-bike spatial contact: rigid geometry controls, then a finite soil cover over a supported buried root with a cutaway/force viewer. Establish distinct tyre/soil/root deformation and load paths.
- With rolling and 3D slip: bulk/interface shear, mixed patches, root reinforcement/support and shared front/rear soil history; validate combined traction, reversal and repeated passes.
- Before mud-surface fidelity claims: carried tyre coating, tread packing and pickup/shedding; clean/dirty transition controls and material/work budgets.
- Before detailed trail fidelity claims: ingest scanned or generated tiles with provenance/uncertainty, 1–2 cm target detail where justified, persistent deformation and seam/active-region convergence. ML detail remains labelled synthetic until independently measured.

The immediate PR adds the design and source-backed research boundaries only. No soil constitutive law, executable terrain schema or universal friction preset is selected. Initial fixture values may be illustrative; real trail and tyre claims require controlled measurements and held-out validation. This work does not replace the hardtail/full-suspension assembly, overload or production-bike catalogue gates.

## System-wide physics fidelity architecture review

The [iteration 3 architecture review](ITERATION_3_ARCHITECTURE.md) reviews the existing implementation and planned mechanisms together against [PHYSICS_FIDELITY.md](PHYSICS_FIDELITY.md). Detailed reference models may run slower than real time; reduced models need measured conformance, explicit capability/validity envelopes and compatible subsystem combinations. Support paired experiments first, bounded parallel/shadow comparisons where useful, and in-run replacement only after state-transfer verification.

Review continuous simulation versus recorded playback, model/state ownership, worker/snapshot/record boundaries, coupling rates and resource budgets before choosing abstractions. Mud deformation/spin release and carried mass are a cross-system example. Produce a concrete model/coupling matrix and receiving comparison experiment; preserve the existing validated stations during any refactor. This architectural gate precedes the next major physics implementation, including whole-bike assembly and layered contact.

## Next actionable work package

Current delivery: Slice 1 has been reviewed again, its screenshot gap is closed for the inspected states, and Slice 2 has a working visual/headless consumer with independent evidence (47 passing tests on Linux and Windows plus Chromium checks). Physical calibration remains open.

The architecture review now enumerates initial planar 6/7 and spatial 10/11 hardtail/full-suspension coordinates, coupling groups and a game-facing setup/ride/replay loop. The first receiving slice adds analytical/reference comparisons to the suspension viewer and headless runner; see ITERATION_3_EVIDENCE.md. Next compare candidate multibody/contact solvers against concrete geometry/constraint/energy tests before Slice 3 coding. Preserve the eventual 3D lateral/turning contract. Select source-backed component data when available; do not infer production-bike accuracy from the synthetic suspension fixtures.

Include overload capability in that design decision: geometry-derived travel limits, end-stop force/impulse paths, component deformation/failure state, pressure loss and safe termination of unsupported post-failure configurations. Research a bounded stop and wheel/rim/spoke/seal experiment next; require its independent physical/numerical evidence before enabling high-impact continuation. See OVERLOAD_AND_FAILURE.md.

Couple it to the spatial geometry and adaptive-computation experiment in TERRAIN_CONTACT.md. Establish converged flat/rounded/square-edge references before optimizing contact detail or update rates. Include 3D surface contact, event detection, conservative synchronization and measured worst-case real-time capability in solver selection.

Do not require the user to pick a real bike, game controller or final graphics engine before this bounded slice can begin. Use clearly labelled illustrative parameters and keep the reference dataset question open.

## Iteration 4 continuation

Reviewed merged main 672e5e7 before implementation; see [ITERATION_4_REVIEW.md](ITERATION_4_REVIEW.md) and [the 64-test/browser evidence receipt](ITERATION_4_EVIDENCE.md). The [spatial clearance probe](TERRAIN_PROBE.md) supplies authored planar geometry and visible/headless nearest-point/normal/gap queries for flat, rounded and square fixtures. It is the geometry prerequisite of T0, not a dynamic tyre, stress or layered-soil model. [SOLVER_RESEARCH.md](SOLVER_RESEARCH.md) compares Rapier, MuJoCo and Chrono from primary sources and proposes explicit coupled trials; no multibody solver is selected yet. Next implement those bounded constraint/reaction/travel and spatial-contact trials before whole-bike dynamics. Preserve all overload, layered-terrain, multirate and eventual 3D gates.

## Iteration 5 continuation

[The prismatic solver trial](SOLVER_TRIAL.md) is the first executable Rapier arm, after [review of 0abfde7](ITERATION_5_REVIEW.md). It adds a visible/headless constrained carriage with tilted gravity/transverse load, fixed numerical gates and exact same-runtime snapshot/restart comparison. This is deliberately smaller than the full candidate matrix: the moving default fails the strict reference limit and joint reactions are unavailable. No whole-bike solver is selected. Next receive a matched second solver arm and reaction/energy/stop/contact/assembly tests before the hardtail/full-suspension rig. See [iteration 5 evidence](ITERATION_5_EVIDENCE.md).

## Iteration 6 continuation — received coupled rig

User direction parks solver perfection unless it becomes a concrete blocker. [Review and scope](ITERATION_6_REVIEW.md) supersede the earlier matched-carriage prerequisite. The [coupled bicycle rig](BIKE_RIG.md) receives a 3/4-coordinate hardtail/full-suspension assembly, geometry-derived shock leverage, two vertical platen contacts, mass/spring/damper controls, replay and shared headless output. MuJoCo is selected for this bounded fixture; it is not a blanket certification for free riding, spatial contact or real-time performance. Existing Rapier diagnostics and failed precision gates remain available.

Next balanced dynamics slice: passive articulated rider compliance on the existing visible assembly, with explicit hand/foot/saddle attachment, posture/mass distribution, load/work accounting and fixed-rider comparison. Retain measured parameter provenance and later production-bike catalogue. Reopen precision research only for a demonstrated receiving-feature blocker. End-stop impacts, fixture wrench telemetry and a calibrated whole-bike transient reference remain follow-ups; unsupported overload still terminates.

## Iteration 7 continuation — passive rider prerequisite

[Review of merged PR #6](ITERATION_7_REVIEW.md) precedes the [guided-rider extension](RIDER_MODEL.md). The same visible hardtail/full-suspension fixture now receives one passive rider coordinate, configurable mass partition/spring/damping/travel, signed histories and energy/loss evidence. Fixed mode remains the exact original baseline. This is a bounded prerequisite to the anatomical hand/foot/saddle, posture and control contracts above, not completion of them.

Next prioritize the coupled fixture's strict travel/end-stop and attachment-load-path experiment: converge a supported stop model with independent momentum/work checks and explicit ultimate boundaries before allowing impact continuation. Then add observable component loads and sourced failure/pressure-loss criteria; do not infer rim/spoke/seal survival from axial rider or axle loads. Preserve 3D lateral/turning, spatial corner contact, layered root/soil and tyre mud history, detailed trail provenance, and validated adaptive/multirate real-time gates. See [iteration 7 evidence](ITERATION_7_EVIDENCE.md).

User-prioritized spatial follow-up (2026-10-16): receive the [deformed tyre and distributed contact experiment](TERRAIN_CONTACT.md#follow-up-deforming-tyre-and-distributed-contact-user-request-2026-10-16). Render the loaded tyre and all force-carrying regions, with local loads/normals and resultant moments; then feed that same footprint into mixed-material grip and shear. The existing nearest-point clearance visualization does not satisfy this requirement. Start with flat/rounded/square/two-support controls, verify resolution-independent load distribution, and retain the mud-over-root and fidelity-tier contracts. This is planned alongside the next dynamics slices, not an implemented contact patch.

### Terrain request-first receiving sequence

[Terrain sampling contract](TERRAIN_SAMPLING_CONTRACT.md): R0 is a prescribed-motion request/cache viewer and headless replay with straight, cornering, reversal, seam and soil-over-rock cutaway fixtures. It shows mandatory versus prefetched coverage, off-patch acquisition and explicit missing data. R1 adds loaded distributed tyre contact; R2 adds layered response/shared soil history; R3 adds 3D rolling traction and measured fidelity-tier conformance. These are named receiving stages, not implemented terrain physics. Retain the scoped checkpoints in [terrain request scope](TERRAIN_REQUEST_SCOPE.md).


## Iteration 8 — fork travel buffers

The [fork-buffer model](FORK_BUFFERS.md) receives finite top/bottom travel forces in the coupled viewer and headless runner, with independent impulse/work checks, engagement/energy plots and retained ultimate-bound termination. The review of merged PR #7 precedes implementation; see ITERATION_8_REVIEW.md. Precision polishing remains parked unless a receiving feature fails its declared budget.

Next dynamics extension: shock buffers through the existing changing linkage leverage, then explicit rider attachment-limit/load paths. The spatial follow-up above is a separate priority: deformed tyre envelope, all load-bearing contact regions and distributed material-dependent grip. Neither fork buffer loads nor nearest rigid-circle witnesses substitute for contact pressure, traction, component damage or real-bike calibration.


## Iteration 9 — terrain request receiving subset

[R0a](ITERATION_9_EVIDENCE.md) receives the request-first design in a separate viewer/headless replay: finite-width swept bounds, static layered samples, explicit stepped-rock geometry, async source reuse, owned outputs and missing-data admission. See [scope](ITERATION_9_SCOPE.md) for the implemented subset and remaining R0 gates. This does not complete the full R0 contract or change bicycle forces. The [image review](GEOMETRY_VISUAL_REVIEW.md) closes the BB/frame drawing comparison while retaining sourced physical linkage calibration as a follow-up.

Next terrain work: asymmetric/multimodal optional route ribbons, resolved root/reinforcement and known-void controls, source transforms/import, and bounded leased outputs/shared state identities as required by the first loaded-tyre consumer. R1 must add physically supported distributed deformable contact; geometry arrays and normals are not springs or forces. Shock/rider end-stop loads, damage/leakage, 3D turning traction, contamination and measured multirate operation remain open.


## Iteration 10 — rear shock dynamics

[Rear shock buffers](SHOCK_BUFFERS.md) now map axial top/bottom forces through the changing single-pivot derivative, with visible swing moment, total shock force and stored/lost energy. [Review](ITERATION_10_REVIEW.md) captures model/configuration gaps; [evidence](ITERATION_10_EVIDENCE.md) records bounded receiving checks. Hardtail and disabled-buffer baselines remain unchanged. Next focus on sag/load/leverage configuration diagnostics and sourced geometry/mass inputs, followed by rider attachment load paths. Terrain follow-ups remain separate.


## Iteration 11 — annotated linkage and configuration diagnostics

The [manufacturer catalogue](GEOMETRY_CATALOGUE.md) receives eight source-linked reference configurations and a selectable/exportable viewer table. Continue searching for dimensioned suspension drawings/CAD and verified mass data before promoting any reference into a production simulation preset; fit charts and exploded parts schematics alone do not determine linkage kinematics.

The [geometry/configuration slice](GEOMETRY_CONFIGURATION.md) corrects the high swingarm shock-eye mechanism identified by the user's image annotations, changes the actual native geometry and shared drawing, and receives the next sag/load/leverage view from iteration 10. Versioned geometry controls/presets preserve old recorded physics. See [review](ITERATION_11_REVIEW.md) and [evidence](ITERATION_11_EVIDENCE.md). Source measurements, uncertainty and mass distribution remain prerequisites for production presets. Next bike dynamics work: explicit rider attachment/limit load paths and observable fixture/pivot wrenches, then component failure criteria. Separate terrain R0/R1 and eventual 3D lateral/turning, shared layered soil/mud and multirate gates remain required.

## Iteration 12 — rider stops and attachment reactions

The [rider stop/load slice](RIDER_STOPS_LOADS.md) receives finite lower/upper guide stops and observable guide, fixture and rear-attachment wrenches, with current-state diagnostic solves and explicit load origins. [Review](ITERATION_12_REVIEW.md) precedes the implementation. The native spatial shock and generalized buffer contributions are separated before reporting the pivot-bearing load. Fixed recording rate is not a guarantee of converged force impulses; headless evidence separately refines observation and integration.

Next dynamics work: measured anatomical attachment locations, hand/foot/saddle contact and independently articulated rider, then component stress/failure criteria using appropriate load paths. Existing lumped guide reactions do not resolve those loads. The manufacturer catalogue still requires dimensioned suspension coordinates and mass/inertia before calibrated presets. Terrain R1 distributed tyre contact, layered deformation/mud, pressure loss, 3D lateral/turning and measured multirate operation remain open.

## Iteration 13 — static distributed tyre footprint

The [D1a footprint station](STATIC_FOOTPRINT.md) receives PR #14's static radial-ring checkpoint with a worker-based viewer, headless replay, all active local loads and independent energy/contact verification. See [review](ITERATION_13_REVIEW.md), [evidence](ITERATION_13_EVIDENCE.md) and the [connected delivery plan](DYNAMICS_DELIVERY_PLAN.md). Supported fixtures include flat, rounded, square-step-top and two separated supports. Exposed corners, rim strikes and unresolved contour intersections are visibly unsupported; no calibrated pressure/stress or impact response is claimed.

Next spatial slice: explicit sharp-feature/normal-cone constraints with compatible energy weights and receiving evidence, then free moving-wheel impacts before whole-bike spatial contact. Keep layered soil over roots/rock, shared material history/mud, sourced rim/spoke/bead failure and pressure loss, finite-width 3D lateral/turning and measured fidelity/multirate gates open. The existing bicycle rig remains a separate moving-platen experiment.

## Iteration 14 — wheel physical-limit assessment

The [wheel-limit station](WHEEL_LIMITS.md) receives continuous first rim-contact/domain events and sourced, declared tubeless compatibility/maximum-pressure assessment. Incompatible declarations block approach/static loads; unknown evidence permits geometry inspection only. [Review](ITERATION_14_REVIEW.md) and [evidence](ITERATION_14_EVIDENCE.md) keep blowout, bead release, rim/spoke fracture and pressure-loss criteria explicitly unknown. Manufacturer service recommendations are not breaking thresholds.

Next: a richer sharp-feature casing/contact formulation with independent energy/normal-cone verification, then dynamic impact/momentum and supported local stress before fracture or seal-loss continuation. Obtain exact component construction, local load/strength and leak/pressure data. Preserve rigid travel limits, layered materials/mud, 3D lateral/turning and measured multirate gates.

Product priority reaffirmed 2026-10-18: deliver a connected moving MTB **including the rider** for synthetic data and game simulation. The [integration milestones and shared execution/data contract](DYNAMICS_DELIVERY_PLAN.md#product-destination-and-next-integration-milestones) order the next work: dynamic spatial wheel contact → moving hardtail/full bike and rider trail runs → articulated contacts/control → 3D riding, supported terrain/damage and measured real-time fidelity. Stations remain verification tools; scenario/label provenance and offline/game parity accompany the first connected run.
