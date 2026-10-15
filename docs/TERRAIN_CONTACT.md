# Spatial terrain, contact detail and real-time execution

User requirements added to this iteration review:

- A square rock edge, rounded obstacle and flat surface must be distinguishable through spatial ground/contact geometry, so loads and local stresses can respond to their different shapes.
- Accept a defined ground profile, spatial height vector/points or contact geometry with enough metadata to interpret it. One obstacle height does not specify an impact.
- Fine contact/impact computation need not run continuously. Activate it when needed, potentially at a separate physics rate, to support a real-time simulation without losing important events or changing the physical result arbitrarily.

Status: the [spatial clearance probe](TERRAIN_PROBE.md) now supplies a bounded rigid planar geometry fixture. Dynamic spatial contact, stress and adaptive physics remain design/research and acceptance contracts. The current wheel station has a prescribed vertically moving flat platen and a lumped radial tyre surrogate. Its sine/bump controls are time histories, not spatial rocks. No sharp-edge stress, finite contact patch, carcass/rim impact model or real-time performance guarantee is claimed. Connect this work to [overload and failure](OVERLOAD_AND_FAILURE.md) and [3D dynamics](THREE_DIMENSIONAL_DYNAMICS.md).

## Geometry input contract

Use explicit, versioned geometry with SI units, coordinate frame, physical extent, material assignment, motion and provenance. A vector of heights needs sample positions or origin/spacing.

| Representation | Required meaning |
|---|---|
| Planar profile | Ordered (x,z) vertices/segments, or z_i with x_i or declared origin/spacing; explicit interpolation. A polyline can retain a vertical step segment. A single-valued height function cannot represent all vertical-face/overhang geometry. |
| 3D height field | Grid coordinates/origin/orientation/spacing and cell interpolation; declare its single-valued-surface limitation. Preserve a rock's front face through another supported representation when necessary. |
| 3D mesh or obstacle primitive | Vertex topology or primitive dimensions/transforms, outward-normal convention, physical feature/edge radius where known, material regions and collision-side rules. |
| Supplied contact candidates | Point positions/frames, surface/feature IDs, normal or geometry from which to derive it, surface velocity, and penetration/separation convention. Declare the source/ownership of any patch area or compliance. These are geometry candidates, not automatically force, pressure or stress. |

Choose supported representations in the contact design pass and reject unsupported ones visibly. Unordered height/point clouds without spacing, topology or normals are ambiguous. A prescribed contact manifold can drive a bounded experiment, but its provider must update it with wheel pose and deformation; frozen contact points are not valid after the wheel moves or the tyre deflates.

Validate finite coordinates, units/scale, profile ordering/spacing, duplicate/degenerate features, required mesh connectivity, normal orientation, self-intersections/ambiguity, materials and domain boundaries. Define behavior outside the terrain domain; do not silently extrapolate road or bridge a gap. Resource/resolution bounds must be explicit.

## From geometry to loads and stress

1. Query the terrain using current wheel pose, tyre shape/radius/width, rim envelope and applicable deformation state. Encounter positions and point velocities come from actual motion. A time-delayed under-axle height omits front-face/edge contact, bridging and geometry-dependent normals.
2. Distinguish flat, rounded, vertical-face and edge contact, climbing a corner, separation/recontact and multiple simultaneous contacts. A finite tyre can touch features away from the point below the axle.
3. Preserve edge shape. Record any interpolation/filtering, collision margin or rounding that changes it. An ideal infinitely sharp edge may produce a continuum stress singularity: finite peak-stress claims need a supported feature radius/compliance/patch treatment. Mesh-dependent singular peaks are not component-strength predictions.
4. Return contact/patch IDs, locations, normals, gap/compression convention and relative point velocities. Edge normals can be nonunique; the selected formulation must resolve them consistently. Moving terrain contributes external work.
5. Apply constitutive contact forces at their actual points, including all spatial components, moments and power. Contact remains unilateral and can separate. Do not apply every reaction vertically at the axle regardless of surface orientation.
6. Multiple contacts share the tyre's mechanics and traction capacity. Do not apply a whole-wheel spring or a full grip budget independently to every sampled point, or double-count neighboring triangle contacts. Increasing point density must not arbitrarily multiply stiffness, load or friction.
7. Local contact pressure and carcass/bead/rim/spoke stress need a supported finite-area deformation/load-transfer model or a calibrated reduced law. Point heights, total normal force and the present radial spring constant alone cannot determine those stresses. Tyre/rim construction and terrain compliance matter; internal air pressure and contact pressure distribution are distinct.
8. Couple concentrated deformation/load to tyre bottoming, rim strike, bead retention, spoke redistribution and the evidenced failure criteria. Pressure loss changes tyre shape/compliance and subsequent contact; feedback must work in both directions. Stop if the resulting regime is unsupported.

A complete finite-element tyre is not mandated. A reduced model is acceptable when its geometry, compliance, local load mapping and applicability are independently supported. Read primary model/numerical references before implementation. Do not infer a validated stress field from a plausible animation.

## Adaptive detail and multiple physics rates

Separate **model fidelity**, **terrain/contact resolution** and **integration timestep**. More contact points do not automatically need a different time step; a small time step alone does not repair inadequate geometry or constitutive physics. Choose each from the problem and an explicit accuracy/error budget.

Ordinary smooth contact may use a verified inexpensive representation. An approaching sharp feature, rapid contact change, multiple contacts, small tyre-to-rim clearance, stop engagement, local deformation or proximity to a failure envelope can require finer geometry/compliance and/or smaller steps. A geometric rock corner and sustained 3D cornering are different triggers: the ordinary model must still carry valid lateral/combined-slip behavior in its stated range. Existing leaks, damage and persistent contact states continue evolving even after impact detail is deactivated.

Required switching and scheduling rules:

- Predict potentially relevant contact using swept geometry over the coarse advance, including tyre envelope and motion bounds. Activate detail before the wheel can cross a feature or failure boundary. Endpoint height/force checks alone can miss a brief edge strike entirely.
- Define activation/deactivation criteria, validity bounds and hysteresis. Keep detail active through contact/impact settling and unresolved damage, avoiding rapid switching. Use a physically supported conservative fallback when uncertainty makes a coarse advance unsafe.
- Detailed contact/impact may substep at a higher physics rate than the whole-bike update, while the renderer remains independent. Coupled stiff bodies/joints may need to substep together; a high-rate tyre against a frozen coarse-rate wheel/frame is not automatically correct. Select synchronization from coupling/convergence evidence.
- Exchange forces through time-integrated linear/angular impulses and consistent work across synchronization intervals, not only the final instantaneous force. Resolve equal/opposite actions, contact motion and body response coherently. Use documented trajectories/interpolation where appropriate, with event synchronization or rollback/refinement before accepting a step that crossed a constraint/failure event.
- Map state between coarse/fine representations consistently, including stored elastic energy, geometry, pressure, damage history and any internal contact state. Do not reset a damaged wheel, reseal a leak, inject energy or erase a force impulse when changing detail level. Unsupported state mappings must retain detail or stop explicitly.
- Preserve simulation time and fixed input semantics. Fidelity/rate selection should depend on physical/error criteria. If computational budget affects the schedule, record the effective choices so replay can reproduce them; wall-clock load must not silently choose whether a spoke breaks.
- Declare per-subsystem step bounds, synchronization policy, error thresholds, look-ahead, switching hysteresis and computation budget as versioned settings once consumed. Record activation intervals, substeps, state transfers, missed-budget diagnostics and failures with the run.

No particular multirate integrator, contact algorithm or frame-rate target is selected here. Research primary references, implement a bounded experiment and validate before deployment. Use measured costs on declared target hardware to choose a real-time budget. Keep averages, tail/worst observed cost, event density and simulation backlog separate. Include dense rock fields, repeated strikes, two-wheel impacts and damaged/deflated states; sparse-impact averages alone do not establish real-time behavior.

When work exceeds the budget, reduce rendering/optional diagnostic detail first where useful. Any coarser physical fallback must stay inside a verified accuracy/validity envelope. Otherwise report that real time cannot be maintained, slow the simulation or terminate explicitly. Do not skip damage checks, let a tyre tunnel through a rock, allow suspension overtravel or make a component effectively indestructible to meet a display deadline.

## Acceptance experiments

- Equal-height flat, rounded and square-edged fixtures at declared speed, tyre/load and initial position. Record obstacle width, slope/edge radius and geometry; include front-face contact before the axle reaches the top. Do not enforce a universal peak-force ordering for every shape/speed.
- Independent geometric references for plane, ramp, arc and finite-radius corner contacts; wheel bridging, multiple contacts, vertical segments, edge departure and recontact. Verify normals and force moment arms, not only axle height.
- Separate quasi-static deflection/force balance from dynamic impulse, energy/work, peaks and local stress. Refine geometry/patch resolution and integration timestep independently; contact density must not multiply forces. Establish event/force/stress convergence before fracture thresholds are trusted.
- Rim strike, spoke redistribution and seal-loss cases with intact/no-damage controls, as specified in the overload contract. Local damage can occur without an exceptional global axle force or suspension bottom-out. Validate against appropriate physical data.
- Compare adaptive/multirate runs with an independently converged always-detailed reference on smooth, isolated-edge and worst admitted repeated-impact cases. Predetermine tolerances for trajectory, impulses, energy, local stress and failure-event timing/classification; do not merely compare screenshots or execution time. Near uncertain thresholds, refine or report uncertainty rather than hiding a mismatched failure outcome.
- Test switching just before/after contact, grazing and short-duration strikes, events within one coarse step, simultaneous front/rear events, coarse/fine state transfer, persistent leak/damage evolution, conservative no-impact motion and repeated switch cycles. Verify no missed event or artificial impulse/energy gain.
- Include future 3D oblique edges, off-centre tyre contact, camber, lateral impacts and braking/turning. A 2D centreline profile cannot establish lateral stress or bead retention.
- Benchmark only after correctness: measured update costs and timing distribution, backlog, active detailed-contact count and actual accuracy on declared hardware. Keep rendering/input performance and mechanical verification distinct.

Runs must retain geometry content or a retrievable immutable geometry asset with hash/revision, transformations, interpolation, material and resolution settings. Record contact/patch IDs, points/normals, forces/moments, supported pressure/stress/deformation quantities, damage and adaptive schedule with units/timestamps. The viewer uses the same geometry/contact data and labels exaggerated deformation. Browser/headless replay must agree without depending on a silently updated terrain asset.

## Next delivery gate

Research a spatial wheel/contact experiment with independently checkable planar shapes and a path to 3D surfaces. Establish an always-detailed reference first, then demonstrate adaptive activation and rate coupling against it. Include spatial contact, overload and measured real-time capability in the whole-bike solver decision. The smooth platen remains a separate controlled station; neither sharp-edge stress nor real-time high-impact handling is received by the current iteration.

## Layered soil and material history

The [layered-terrain contract](LAYERED_TERRAIN.md) extends geometry/material assignment into finite covers, buried roots/rocks, soil deformation and interface shear, fine-root reinforcement, and tyre-carried contamination. Mud over a buried root is the first acceptance family. Contact must transmit load through the cover to the substrate before exposure, without duplicating support or traction. Persistent terrain and tyre state must survive adaptive-detail changes. Scanned/ML-generated 1–2 cm trail detail is a separate data/provenance and convergence requirement, not a physical-accuracy claim. These mechanisms remain planned; current station physics is unchanged.

Adaptive terrain/contact is one part of [system-wide physics fidelity](PHYSICS_FIDELITY.md). Use compatible subsystem tiers, coupled impulses/work, reference conformance and explicit state adapters; do not select terrain detail independently of tyre, bike and rider validity.
