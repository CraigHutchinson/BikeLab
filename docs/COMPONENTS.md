# Dynamic systems: component inventory

Status: staged scope. The loaded-wheel station and bounded axial suspension station, recording and viewers exist. The suspension law includes preload and separate viscous compression/rebound damping; friction, air chambers, end-stop forces, full-bike and later systems remain proposed. Priority denotes the first consumer, not a promise that the full fidelity described below ships at that stage. Eventual full 3D dynamics, including lateral and turning forces, is required; see THREE_DIMENSIONAL_DYNAMICS.md.

## System boundaries

The simulation advances physical state. The rider controller generates bounded actions. The experiment supplies terrain/rig motion and scripted commands. The renderer consumes snapshots. Telemetry observes the same state that the renderer receives. None of these should silently alter another subsystem's parameters.

| Component | Owns | Exchanges with other systems | First consumer and later refinement |
|---|---|---|---|
| Frame assembly | Body mass, centre of mass, inertia and mounting points | Joint reactions, rider contact forces, drivetrain and brake reactions | Planar whole-bike rig; later structural flex |
| Geometry definition | Wheel/axle locations, steering axis, fork offset, BB, saddle, grips and pivot coordinates | Derived geometry and validated assembly constraints | Whole-bike construction; later adjustable geometry |
| Fork | Telescopic constraint, spring, damper, friction and end stops | Forces between upper and lower assemblies | Suspension station, then hardtail and full suspension |
| Rear structure | Rigid rear connection or articulated links | Axle path and shock displacement from actual linkage coordinates | Whole-bike rig; initial full suspension uses an explicit single-pivot mechanism |
| Shock/spring element | Force versus displacement, velocity and internal state when needed | Equal/opposite attachment forces | Suspension station and rear linkage |
| Wheel assembly | Radius, mass, axial rotational inertia and axle motion | Tyre wrench, brake torque and drive torque | Loaded wheel, then rolling bike |
| Tyre radial response | Compression, elastic response, damping and unilateral contact | Normal load and tyre deflection | Loaded-wheel station; initially a labelled surrogate |
| Tyre contact geometry | Support surface, effective contact location and obstacle representation | Contact normal and contact patch approximation | Smooth rig inputs first; edge/rough-surface capability later |
| Tyre tangential response | Slip-dependent longitudinal/lateral forces and combined grip | Wheel torque, body forces, surface properties | Braking/rolling and then 3D handling |
| Tyre construction/setup | Inflation, dimensions, casing, compound, tread, insert and rim compatibility | Parameters or calibrated curves supplied to contact models | Measured tyre stage; no invented universal pressure-to-stiffness mapping |
| Terrain | Geometric surface and material properties | Contact queries and prescribed rig motion | Platen and travelling-profile rig; later trail surfaces |
| Rider body | Segment masses/inertias, joints, geometry and posture | Forces through hands, pedals and saddle | Whole-bike fixed mass first; articulated rider next |
| Rider contact | Hand/foot constraints, saddle contact and contact transitions | Body/contact reactions with explicit release conditions | Articulated rider; later loss of grip and impacts |
| Rider controller | Delayed, bounded steering/lean/brake/pedal/posture actions | Commands only; no direct teleportation of bodies | Scripted rider first; balance and anticipatory control later |
| Steering assembly | Steering DOF, inertia, limits and input torque | Grips, fork, frame and wheel/contact dynamics | 3D handling; locked explicitly in planar rig |
| Brakes | Front/rear wheel torque and reaction path | Wheel, fork/frame and rider inputs | Rolling/braking slice; later thermal effects |
| Drivetrain | Crank/gear kinematics, drive torque and freewheel state | Wheel, frame, linkage and rider reactions | Rolling/pedalling slice; chain path effects when needed |
| Air interaction | Aerodynamic forces with stated assumptions | Relative airflow and body forces | Riding slice if required by its speed range |
| Solver | State advancement, joints, contact resolution and error reporting | Physical state and applied forces | Loaded-wheel station onward |
| Experiment runner | Scenario input, initial state, clocks, run duration and repeatability | Prescribed motions and rider commands | Every station and regression test |
| Recorder | Parameter snapshot, events, signals and result metadata | Immutable run evidence | Every station |
| Visualisation | Camera, bodies, overlays, graphs, replay and comparisons | Read-only simulation snapshots | Every interactive slice |

## Bicycle variants

### Hardtail

Rear axle is rigidly attached to the frame. Rear tyre deformation and rider motion remain active. A hardtail must not be approximated by an extremely stiff rear shock: that would introduce an artificial joint and numerical stiffness.

### Full suspension

Use explicit rear links, pivots and shock attachments. Start with a single-pivot reference geometry to make axle path and shock displacement independently checkable. Multi-link layouts follow when a selected physical reference or test requires them.

### Rigid reference

Lock or replace the fork constraint deliberately for diagnostic runs. Record this as a distinct model configuration. It is useful for isolating tyre and rider behaviour and is not a substitute for either required bike variant.

## Effects to derive rather than add twice

- Frame load redistribution from the assembled masses, external forces and geometry.
- Rear axle path and shock leverage from linkage kinematics.
- Wheel spin response from inertia and applied/contact torques.
- Suspension/braking interaction from force paths when the model includes those paths.
- Chain-induced suspension interaction from chain geometry and forces when implemented.

Do not add independent corrective coefficients for the same effect without documenting what the underlying model omits.

## Intentionally staged fidelity

Early station: smooth contact geometry, simplified radial tyre curve, lumped masses, prescribed excitation and passive dynamics.

Whole-bike station: planar rigid bodies, front suspension, explicit rear mechanism, fixed rider mass, pitch/heave and separate tyre contact.

Articulated rider: passive joints and contact first, bounded actions second. Rider parameters must not be tuned solely to make a flawed bike model look stable.

Later riding: 3D steering and lean, combined-slip grip, tread/material calibration, deformable terrain, structural compliance and temperature. These require their own observed tests; they are not implicit in the early station.

Overload/failure is a required physical contract for high-impact behavior, not an optional cosmetic riding effect. Review every active assembly against [the component failure matrix](OVERLOAD_AND_FAILURE.md): suspension stops, rim/spokes/tyre seal, hub/axle, fork/shock mounts, frame/links, steering/rider supports, drivetrain and brakes. Preserve travel/clearance constraints and actual load redistribution after damage; stop explicitly where the model cannot represent the outcome.

Terrain/contact consumes actual spatial shape, with explicit geometry, normals and material/motion metadata. Preserve square-edge, rounded and flat distinctions and finite tyre/multiple-contact behavior. Local stress requires a supported deformation/load-transfer law. Detailed impact work may activate on demand and substep separately, with predictive activation, consistent impulses/energy and persistent damage/pressure. See [TERRAIN_CONTACT.md](TERRAIN_CONTACT.md) for the fidelity, rate-coupling and measured real-time gates.

## Inventory expansion questions

1. Which intended riding behaviours are essential first: seated rough-trail comfort, standing descending, braking bumps, cornering, pumping or jumping?
2. Which real reference bike, shock, fork and tyre can supply geometry and measurements?
3. Which controls will eventually be available to a player, and which actions must be performed by a simulated rider?
4. Which surfaces must distinguish tread choices? A tread label alone must not stand in for validated contact behaviour.
5. Which comparisons should a user be able to trust quantitatively, rather than only inspect qualitatively?

These questions guide later refinement. They do not block the bounded loaded-wheel slice.
