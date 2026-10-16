# Coupled planar bicycle rig

Open `bike.html`, or run `node scripts/bike-rig.mjs [setup.json] [run.json]`. The headless runner accepts a partial setup object or a complete saved rig record. Exit 0 means the requested interval completed, 2 means an unsupported trial state stopped it (partial evidence is saved), and 1 means setup/I/O failure. Completion is not a physical accuracy certification. Imported record samples are never trusted: loading reconstructs the setup and reruns it.

## Passive rider extension

Iteration 7 adds selectable [passive guided rider compliance](RIDER_MODEL.md), while preserving the fixed mode described below. Compliant mode splits the same total frame-plus-rider mass and adds one frame-local slide, producing 4/5 coordinates. It includes rider spring energy, damping loss, COM/axial-force telemetry, configurable travel rejection and explicit v0.1 fixed-record migration. The guide is a synthetic aggregate mechanism; anatomical attachments remain open.

## Assembly and scope (original fixed baseline)

Model v0.5 adds [editable geometry and the annotated high-eye default](GEOMETRY_CONFIGURATION.md). Dimensions below document the original reference preset, which old records and original buffer examples retain. Each new run records its actual configured geometry.

The rig compares an illustrative hardtail and single-pivot full-suspension bike on two prescribed vertical platens. Both use world x forward, y left, z up. Positive rotation about +y pitches the nose down. The world frame attachment permits z translation followed by y rotation; all other frame motion is fixed. Front fork compression is a third coordinate, along (-cos 65°, 0, sin 65°). The full-suspension rear swingarm adds one hinge; the hardtail has no rear suspension coordinate. Wheel spin is locked. This is a three/four-coordinate fixture, not a freely moving bicycle or a real-time riding implementation.

The frame and fixed rider share an editable 40–120 kg mass at the frame origin, with fixed illustrative diagonal inertia (8,8,8) kg·m². The front axle assembly is 3 kg with diagonal inertia 0.1 kg·m². The rear wheel/arm assembly is a lumped 4 kg at the rear axle, with diagonal COM inertia 0.13 kg·m². These positive inertias are mechanically admissible but not measured bicycle data. Changing mass does not infer a new posture or inertia. Both variants keep the same total mass to isolate this mechanism comparison; this is not a claim that real hardtails and full-suspension bikes weigh the same.

Reference frame origin: z=0.65 m. Extended front axle: (0.70,0,-0.29) m; hardtail rear axle: (-0.45,0,-0.29) m. Full-suspension pivot: (0,0,-0.15) m; rear axle in arm coordinates: (-0.45,0,-0.14) m. Tyre unloaded radius: 0.36 m. Geometry is versioned in `GEOMETRY`, not a production-bike preset. The viewer transforms recorded poses and shows unloaded radius outlines, not simulated carcass deformation.

Fork spring and damper act directly on positive compression, with no preload. A two-site bilateral spring/damper represents the shock: frame site (-0.08,0,0.15) m, arm site (-0.20,0,-0.03) m. Shock compression is L(0)-L(angle). The native tendon Jacobian maps axial force to generalized force once; no additional hinge spring or motion-ratio multiplier exists. The record reports compressive axial shock force k*(L0-L)-c*Ldot. No gas chamber, friction, independent rebound/compression curves or damper adjuster calibration is implied.

## Contact and coupling

Each wheel gets one vertical force at its COM. For platen height b and axle height z:

- delta = max(0, radius+b-z)
- deltaDot = bDot-vz
- F = max(0, k*delta+c*deltaDot) when delta>0, otherwise 0.

No native collision geoms add a second support force. These are independently prescribed flat-platen signals, with a smooth sin^4 pulse. The front pulse starts at 1 s. Rear timing is either identical, delayed by the configured interval, or disabled; front-only and rear-only tests are also available. Delay is a time setting, not a derived trail speed or a spatial terrain intersection. Geometry, finite soil layers, rolling slip and tread contamination remain separate requirements.

Pinned official single-thread MuJoCo 3.16.0 runs `implicitfast` with double-precision generalized state. Current positions and velocities are refreshed before evaluating tyre forces. Tyre forces are held for the native step; coupling is first order and does not inherit a fourth-order claim. Native spring/damper forces remain part of the articulated solve. Rendering cannot change steps or forces. Scratch and recording arrays are sized outside integration loops; engine handles are disposed on success and failure. Each browser calculation is an isolated cancellable worker; the application does not require cross-origin isolation or a backend.

Four seconds of flat-platen settling precedes each experiment. Initial fork compression is 40 mm, full-suspension angle 0.12 rad, with frame pose aligning the axles at 6 mm nominal tyre deflection. Every settling endpoint is checked. Reject if maximum absolute coordinate rate exceeds 0.002 (m/s for slides, rad/s for hinges) after settling. There is no hidden damping added during initialization. Very low damping may validly reject; it must not silently start from an unsettled pose.

## Domain and observations

Accepted endpoints must have fork compression 0–160 mm, rear angle 0–0.4 rad, shock compression at most 65 mm, tyre compression at most 20% of unloaded radius, and absolute frame pitch at most 0.5 rad. Nonfinite/unbounded states or an engine time reset terminate as well. A violating integration trial is reported separately; replay ends at the preceding valid state, including an off-record-grid endpoint. This is discrete endpoint checking, not continuous event location, native hard stops, end-stop impulse physics or failure continuation.

Energy includes body gravitational/kinetic energy, fork/shock springs and both tyre elastic stores. Trapezoidal work/dissipation quadrature uses integration endpoints:

- support power: sum F*bDot;
- suspension loss: cfork*qDotFork² + cshock*Ldot²;
- tyre loss: (F-k*delta)*deltaDot for positive delta, including the clipped unloading branch;
- residual: E(t)-E(0)+accumulated loss-accumulated support work.

Clipped unloading remains dissipative. The stationary ideal fixture has no generalized work; its constrained reactions affect dynamics but are not yet exposed as wrench telemetry. Reported maximum residual and peak load inspect every accepted integration endpoint, independently of recording cadence. `speed` is the maximum absolute generalized coordinate rate (mixed slide/hinge units), used only for diagnostics; it is not bicycle speed.

## Verification boundaries

For nominal smooth bump runs, preregistered checks require energy/work residual below 0.02 J, static axle-load/fork-sag residual below 0.001 N, and refinement from 0.25 to 0.0625 ms changing peak normal loads by less than 1% and recorded suspension travel by less than 0.1 mm. Independent geometric rotation and finite-difference shock virtual-work checks verify the linkage. These are bounded implementation checks, not a universal valid envelope for every combination of permitted controls. Energy residual is shown for every run. No full real-bike transient reference or physical calibration is available yet.

MuJoCo is received here for this bounded assembly. The previous Rapier carriage diagnostics and failed strict precision gates remain intact. Further solver precision investigation is parked at the user's request; reopen it only for a demonstrated blocker (for example, timestep-sensitive rider/travel response beyond the receiving slice's budget). Contact impacts, constraints under overload and fidelity-tier swaps still need their own evidence. Do not generalize this fixture to trail, 3D handling or real-time performance.

## Primary references and distribution

- [Pinned XML reference](https://github.com/google-deepmind/mujoco/blob/3.16.0/doc/XMLreference.rst): joint ordering, inertia and spatial tendon definitions.
- [Pinned utility implementation](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_util.c): tendon spring/damper and world COM velocity conventions.
- [Pinned stepping implementation](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_forward.c): native integration and derived-state timing.
- [Pinned passive forces](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_passive.c): native spring/damping forces.
- [Pinned force assembly](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_smooth.c): external force/torque ordering.

The unmodified official @mujoco/mujoco 3.16.0 JS/WASM artifact, Apache license, dependency/runtime notices and integrity/provenance receipt are in `dist/vendor/mujoco-3.16.0`. Source commit a892750516336d8358949f4518fcc4fbbd85beae; Emscripten 4.0.10. The shipped source map/build inputs informed the notice inventory. No package install is needed to run the site. The ~10.8 MB WASM binary is downloaded when this station calculates; no real-time or load-time target is claimed.


Iteration 8 adds optional [fork travel buffers](FORK_BUFFERS.md) in model v0.3. Earlier no-stop descriptions above describe the no-buffer baseline; fork buffers act inside the same ultimate stroke, with explicit force/energy ownership. Shock/rider stop and impact/failure qualification remain open.

Model v0.4 adds optional [rear shock buffers](SHOCK_BUFFERS.md), including strict old-record migration, hardtail dormant settings and force/work telemetry. Historical no-shock-stop statements above describe earlier baseline versions.
