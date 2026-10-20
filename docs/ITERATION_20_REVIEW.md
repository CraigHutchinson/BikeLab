# Iteration 20 review — passive articulated rider

For the current completeness assessment, verified results and resume order, start with the [session handoff](ITERATION_20_HANDOFF.md).

Design checkpoint only; no articulated rider is implemented or validated by this note. Reviewed merged PR #22 at main `e73f6cc9d5bd130ec632bcb4d890ad7286ddb4cf` before selecting the next increment. Its final PR run [39404903865](https://github.com/CraigHutchinson/BikeLab/actions/runs/39404903865) passed 188 tests on Linux and Windows and 23 exact connected-bike browser/headless comparisons. The main [test and Pages run](https://github.com/CraigHutchinson/BikeLab/actions/runs/39409826183) also passed and published the tested assets. The [iteration 19 evidence](ITERATION_19_EVIDENCE.md) retains unresolved casing/timestep sensitivity and physical calibration limits.

The next D5a receiving slice extends the existing connected Trail bike, for both hardtail and full suspension, with a passive planar articulated posture. Keep the current fixed and guided rider modes and their historical replay unchanged. This is preparation for MTB synthetic data and game dynamics, not a biomechanical or injury model.

## Review findings that affect implementation

The existing guide is a single frame-child slide with a synthetic mass/inertia split. Its complete guide reaction cannot be redistributed into hand, foot and saddle loads. Adding visible limbs to that mechanism would not resolve those interfaces.

`dist/trail-bike.js` currently admits only tyre-flex/ground contacts in its recorder. Its constraint-work dispatch accepts wheel contacts and brake rows, and rejects equality rows. Both paths must acquire explicit ownership for rider attachments and saddle contacts. Do not classify saddle force as terrain traction or absorb closure work into brake work.

The native post-constraint inverse dynamics already includes point-connect forces and rigid-body contact forces. Keep the existing correction for omitted wheel flex-ground forces at the appropriate complete-wheel boundaries; do not subtract rider closure or saddle forces a second time. Report every wrench with its force direction and origin, then transport moments when comparing interfaces.

Current angular-momentum diagnostics multiply the middle principal inertia by angular speed about y. New inertial frames must preserve y as a principal axis, or diagnostics must transform the full COM inertia tensor into world axes. Validate that calculation independently. The existing proportional split of 8 kg m² is a synthetic guide baseline and must not become an anatomical inertia estimate.

## Proposed first topology

Use five aggregate planar bodies, with all quantities explicitly marked illustrative initially:

| Body group | Coordinates or connection | Interpretation |
| --- | --- | --- |
| Trunk, pelvis and head | Relative x/z slides and y hinge from the frame | Independently moving rider root; no spring tether to the world |
| Paired thighs | Hip hinge from the trunk | Left/right mass combined; no asymmetric leg motion |
| Paired shanks and feet | Knee hinge from the thigh group | No ankle or pedal rotation in this slice |
| Paired upper arms | Shoulder hinge from the trunk | Combined arm group |
| Paired forearms and hands | Elbow hinge from the upper-arm group | No wrist or independent hand motion |

The tree has seven relative planar coordinates. Hand and foot point closures each constrain two independent planar translations, leaving three posture degrees of freedom before saddle contact. This count assumes a nonsingular configuration; actual Jacobian rank is an acceptance check. Passive joint springs/damping act about declared rest angles. Their parameters and ultimate angle domains are model configuration, not measured muscle or tissue limits.

| Bike interface | D5a behavior | Explicit limit |
| --- | --- | --- |
| Hands to handlebar site | Bilateral point-connect constraint; orientation remains free | Can transmit tension; does not predict grip loss or per-hand sharing |
| Feet to BB/platform site | Bilateral point-connect constraint at a frame-fixed reference | No crank, pedal, freehub or shoe-release mechanics |
| Pelvis to saddle pad | Unilateral frictionless contact, initially separated in the standing control | No tensile support, pelvis weld or saddle friction calibration |

Named attachment locations use the same versioned frame coordinates as the calculated bike geometry. They are not inferred from the existing drawing or from a manufacturer wheelbase alone. Start with an explicit illustrative configuration. Each subsequent measured geometry must retain source, units, coordinate transform and uncertainty.

Native site-based connects pull their sites together even if the reference pose is open. Construct a feasible closed posture before launching: solve each two-link chain, select the intended bent elbow/knee branch, and reject unreachable, almost straight or fully folded configurations. Require coincident sites and compatible initial velocities. Do not begin with an impossible pose and use constraint stabilization as the posture solver.

Each native connect creates three rows; the y row is redundant for strictly planar motion. Measure independent rank, conditioning, closure error and regularization sensitivity. Do not count six native rows as six independent planar constraints. If the chosen planar closure cannot satisfy the declared numerical gates, revise the topology or constraint formulation before receiving it.

## Mass, work and state ownership

The aggregate rider masses sum to `riderMass`; the residual frame remains `mass-riderMass`. Validate all masses, COM locations and positive physical inertia tensors, including triangle inequalities. Derive combined COM/inertia with the parallel-axis theorem. Posture changes the assembly mass distribution and must change the native dynamics. A matched locked-posture control uses the same new aggregate mass properties; it need not reproduce the old centered guide's different COM/inertia.

Resolve constraints by named equality IDs, never by assumed persistent row numbers. With the rider site as the first connect object, native multiplier force acts on that rider body and its opposite on the bike body. For the two actual attachment-site velocities, the pair's work rate is `F · (vRider - vBike)`. Retain the signed native row work in the total constraint ledger once. Soft closure can have nonzero gap, work and a residual pair moment at a common origin; measure these and whole-system momentum instead of declaring exact ideal-constraint cancellation.

Saddle forces and relative normal work belong to the rider/bike interface. Terrain contact and impulse remain external to the joined bike/rider. Joint spring energy and damping loss must be included once, alongside existing suspension, tyre, drive and brake terms. Do not introduce a second manually applied counterforce for a force already owned by the native constraints.

Preallocate recording and scratch storage. Export segment poses/velocities, effective mass/inertia, joint coordinates and passive loads, named attachment points, aggregate hand/foot forces, saddle status/force, closure errors and separated work. Keep aggregate loads labelled as aggregate, with no invented left/right split. Preserve model version, uncertainty, unsupported-state reasons and simulation tick ownership across worker, CLI and playback.

Existing guide travel/stops apply only to the guided model. Articulated mode needs its own explicit joint/posture domain and last-admissible-state rollback. Do not silently clamp limbs, preserve the guide spring under a new skeleton, or release an attachment at an arbitrary force. Hand/foot release and reattachment require a later supported state-transition and impulse/work contract.

## Small implementation sequence and receiving gates

1. Add the versioned posture/mass specification and native tree/closure construction, with independent kinematics, rank, mass/COM/inertia and feasible-initialization controls. Preserve old scenarios exactly.
2. Add equality/saddle contact routing and force/work telemetry. Verify native row signs against body Newton/Euler balance, paired wrenches at a common origin, spring energy gradients, damping signs and regularized constraint work.
3. Receive a standing passive posture on both connected bikes, then saddle approach, separation and recontact. Render actual segment and attachment geometry, loads and unsupported outcomes in the existing Trail bike view; use the same headless scenario.
4. Establish airborne momentum, gravity/equilibrium, matched locked-posture comparison, timestep/constraint-regularization refinement, observation invariance, rollback and replay. Pin numerical budgets before tuning; do not relax them after observing a failure. Run the full test suite and complete browser/headless comparisons, then inspect desktop/mobile captures.

Commit and push each reviewable increment. Intermediate construction tests are prerequisites, not a received D5a feature: delivery still requires the connected visual/headless consumer and independent evidence. Avoid controller tuning or fitted damping that conceals mass, closure or load-accounting errors. Passive anatomy, active rider control and physical calibration remain separate claims.

## Primary sources and their limits

GPT-6.1 Sol performed the bounded source review; the pinned native XML and RNE sections were also checked directly during consolidation.

- [MuJoCo 3.16.0 equality XML](https://github.com/google-deepmind/mujoco/blob/3.16.0/doc/XMLreference.rst#L5021): point-connect versus weld semantics, site-based closure and runtime equality activation. Activation support does not itself validate a release/reconnection law.
- [MuJoCo 3.16.0 post-constraint RNE](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_smooth.c#L2555): connect forces are applied at each body's attachment point with opposite signs; rigid-body contact loads are also included. The proposed work and momentum checks follow these actual points and conventions.
- [De Leva, 1996](https://pubmed.ncbi.nlm.nih.gov/8872282/): population-derived segment inertial parameters tied to anatomical landmarks. Only the abstract was reviewed; no coefficient table was extracted or implemented, and it is not an MTB participant measurement.
- [Dembia, Moore and Hubbard, 2015](https://doi.org/10.12688/f1000research.5292.2): the Yeadon implementation provides a later route from anthropometric measurements, densities and posture to segment/combined inertia. This does not supply measured BikeLab rider data or validate the proposed dynamic joint reductions.

The five-body topology and implementation sequence are engineering proposals. No numerical defaults or release thresholds are sourced from these references in this checkpoint.

User-requested whole-system stretch goals are recorded in [RIDER_MANOEUVRES.md](RIDER_MANOEUVRES.md): pumping, manuals/powered wheelies, bunny hops, endos and landing absorption, followed by 3D berm pumping. Their acceptance requires active rider work, contact-state and momentum checks after the passive slice; visual resemblance alone does not establish precision or calibration.

The first implementation increment is the separate [posture construction specification](RIDER_POSTURE.md): owned versioned parameters, feasible two-link geometry, mass/COM/full inertia aggregation and independent construction tests. This does not yet implement the native rider tree, attachment constraints, saddle contact or the connected visual consumer.

Preserve the remaining destination: active rider controls and release, finite-width 3D steering/lean/lateral and combined tyre forces, sharp/faceted impact limits, layered soil over roots/rock and shared mud history, sourced rim/spoke/frame/bead failure and tyre pressure loss, scan/ML provenance, and measured adaptive/multirate fidelity. Unsupported overload must continue to terminate rather than invent extra suspension or limb travel.

## Native construction gates (declared before receiving the implementation)

The next prerequisite uses the five posture bodies with seven relative coordinates, plus a free planar carrier fixture. Initial native body/site/COM and inertia differences must be within 1e-10 SI (mass 1e-10 kg); closure gaps and common rigid-motion relative site velocity within 1e-10 m and m/s. Central-difference site-gap derivatives with a 1e-6 coordinate perturbation must agree with native equality Jacobians within 1e-8. The two y rows must be zero within 1e-12. The four-row minor using hip/knee/shoulder/elbow columns, normalized by the four limb lengths, must match the product of bend sines within 1e-10 and stay above the admitted non-singularity bound. This proves rank four at initialization; it is not a dynamic conditioning or drift certificate.

A second independent control rigidly locks the same five bodies and compares their native generalized inertia, bias force and energy to one body carrying the matched aggregate mass/COM/full inertia (1e-9 absolute / relative budget). Test both bend branches, changed mass distribution, translated/rotated carrier states and nonzero rigid velocities. Closure regularization is explicit (`solref .02 1`, `solimp .9 .95 .001 .5 2`); these are numerical fixture parameters, not tissue properties or approved final dynamics settings. No parameter is tuned from these construction results. Dynamic force/work, drift/refinement and saddle gates remain subsequent increments.
