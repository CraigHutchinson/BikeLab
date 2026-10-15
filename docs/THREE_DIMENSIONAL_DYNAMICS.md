# Required destination: full 3D bicycle dynamics

User requirement reaffirmed 2026-10-15: BikeLab shall eventually simulate a bicycle in 3D, including lateral motion, turning forces and their coupled effects. This is a simulation requirement, not merely a 3D renderer. The wheel and suspension laboratories are bounded scalar experiments; the planar whole-bike rig is an intermediate validation mode.

## Frames and power contracts

Use right-handed world x forward, y left, z up. Positive yaw about z turns left; positive rotation about x leans the top of an upright bike right; positive pitch about y points the nose down. Document any UI angle-sign conversion and every external reference's frame mapping.

The eventual body state needs full position/orientation, linear/angular velocity, centre of mass and a positive-definite inertia tensor, with its expression frame recorded. Choose orientation integration and joint/constraint handling in the multibody stack decision, not in this scalar station. Planar locks must be explicit and removable, with their reactions/work observable.

Each force acts at a specified attachment/contact point. Point velocity is v_COM + omega cross r. Apply the corresponding moment r cross F, equal/opposite internal actions and explicit reaction torques. Test force, moment and power balance before assembling a rider controller.

For the axial suspension element, n points from attachment A to B, L is their separation, q=L_ext-L and u=-L'. Apply -F n to A and +F n to B. Pair power is F L'=-F u; pair power + U' + D'=0. Reject coincident attachments. For a linkage coordinate s, the generalized spring/damper action is -F dq/ds, derived from geometry. Do not add separate leverage, anti-rise or load-transfer corrections for effects already represented by the same geometry/force paths.

## Required handling mechanisms

- Free lateral translation, yaw, roll and pitch coupled to longitudinal/vertical motion; no invisible planar fixture or stabilization force in free-riding mode.
- Steering-axis geometry, trail/offset, steering inertia and torque reactions; wheel spin/inertia and gyroscopic effects. Steer angle alone must not prescribe an arbitrary lateral acceleration.
- Contact geometry with a normal and tangent frame at each tyre; full contact force/moment output and declared signs. Use contact-point relative velocities, wheel rotation, normal load, camber and longitudinal/lateral slip as consumed inputs.
- Lateral tyre force, camber effects and combined braking/drive/cornering grip under one finite traction capacity. Independently saturating longitudinal and lateral curves must not grant two full grip budgets. Research low/zero-speed slip and separation transitions explicitly.
- Rider mass/inertia and hand/foot/saddle load paths, followed by articulated passive mechanics and separately named control. Record steering torque, posture commands, delay, saturation and mechanical work. Controls must not silently teleport or stabilize the bicycle.
- Sloped/banked and uneven terrain, including loss of tyre contact and coherent force directions. Brake/drive reactions and suspension motion remain coupled during turning.
- Travel/clearance limits, end-stop load paths and component overload/failure under combined lateral, longitudinal and vertical loads. Include rim/spoke damage, bead retention and pressure loss; a vertical-only breaking threshold cannot represent cornering/impact capacity. See [the failure contract](OVERLOAD_AND_FAILURE.md).
- Spatial terrain/contact geometry, including oblique sharp/rounded features and multiple patches, with local deformation/load mapping. Allow on-demand detail and separately synchronized impact steps where validated; predictive activation and impulse/work/state consistency must preserve lateral/turning response. See [terrain and real-time requirements](TERRAIN_CONTACT.md).

These requirements preserve both hardtail and full-suspension configurations. Hardtails retain a rigid rear axle attachment; a very stiff artificial shock is not an equivalent mechanism. Source-backed production presets (Santa Cruz, Trek, Scott and others) must carry actual mechanism/geometry, stock setup, provenance and uncertainty rather than inheriting the reference single-pivot layout by name.

## Independent acceptance experiments

| Experiment | Evidence required |
|---|---|
| Rigid bicycle small-motion benchmark | Reproduce published Meijaard et al. matrices/eigenvalues or responses at several speeds, with explicit source-to-BikeLab axes/signs. Its no-slip rigid limit does not validate tyre grip or a suspension bike. |
| Left/right mirrored manoeuvres | Lateral position, yaw, roll/lean, steering and lateral forces transform with the documented signs; vertical loads, speed and energy match for symmetric setups. |
| Constant-radius turn | Under declared quasi-steady assumptions, summed lateral force agrees with m v²/R and combined rider/bike COM/resultant moment balance. tan(lean)=v²/(gR) is a limited ideal diagnostic, not a universal tyre/steering rule. |
| Pure and combined tyre slip | Independently verify longitudinal, lateral and camber responses; braking-in-turn saturation, wheel torque/power, passive dissipation/storage, zero-speed and contact-loss limits. Then calibrate against bicycle-tyre data. |
| Coupled transient manoeuvres | Steering torque, front/rear braking and uneven contact excite the expected roll/yaw/pitch/heave paths without hidden locked axes or duplicated load transfer. |
| Uncontrolled and controlled runs | Mechanical reference tests pass without a controller; repeat with declared controller, fixed/articulated rider and controller sensitivity sweeps. Balance quality is separate from mechanical accuracy. |
| Numerical and physical validation | Constraint drift, momentum/energy/work and timestep convergence before held-out speed/load/lean/terrain calibration. Native rendering/input and participant feedback remain separate gates. |

## Stack and model selection gate

Before whole-bike implementation, enumerate independent DOFs, constraints and force paths for both variants. Evaluate actual closed-loop linkage, prismatic/revolute joint, contact and inertia tests in candidate solvers, with headless replay and a renderer consuming the same snapshots. The existing one-coordinate RK4 code is not the selected general multibody engine.

Do not infer bicycle suitability from a library's car tyre model. The primary Chrono documentation reviewed here states limitations in large camber and pressure dependence for documented models; a bicycle's lean envelope needs explicit coverage. Primary sources and research limitations are in [the research receipt](SUSPENSION_RESEARCH.md). No calibrated lateral tyre law, engine selection or 3D dynamics implementation is claimed by this iteration.

## Terrain-dependent traction requirement

Pure/combined-slip validation must include the material and state actually carrying each contact patch: finite soil layers, exposed or buried roots/rock, bulk and interface shear, root support/reinforcement and retained tyre contamination. A local scalar friction multiplier alone cannot fulfil this contract. Use the [layered-terrain experiments](LAYERED_TERRAIN.md) to establish normal/tangential coupling, low-speed/reversal behaviour, shared front/rear terrain history and mud-to-root-to-dry transitions before claiming realistic off-road handling. Keep the rigid/no-slip handling benchmark as a separate limiting case.
