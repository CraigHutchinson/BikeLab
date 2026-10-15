# Iteration 6 review and scope

Reviewed merged main ed17ec7 (PR #5), its 75-test CI, browser evidence, timestep diagnosis and deployment. The diagnosis is retained in TIMESTEP_RESEARCH.md: separate rounded velocity updates and absolute coordinate rounding explain the Rapier trial's finest-step reversal. Its numerical gates remain failed; no production physics accuracy claim is inferred.

User direction now parks solver perfection unless it blocks a received dynamics feature. This supersedes the roadmap's requirement to finish a matched second carriage station before whole-bike work. Keep the diagnostic scripts and strict trial gates for follow-up; do not change thresholds to declare that trial qualified.

## Received slice

Top down: a coupled bicycle on two moving platens, hardtail/full-suspension selection, recorded replay, fork/shock travel, frame pitch and front/rear tyre loads. Controls change actual masses, spring/damper parameters and excitation. Export the setup and samples; a headless runner consumes the identical model.

Bottom up: pinned official MuJoCo 3.16.0 single-threaded double-precision WASM; a tree with world heave then frame pitch, front fork slide, and optionally rear swingarm hinge. Three/four coordinates; x translation, yaw, roll, steering and wheel spin are held by the fixture. Fixed rider is part of the frame mass/inertia. A two-site spring/damper supplies rear shock forces through the actual linkage Jacobian. No rear joint exists on the hardtail.

Use the existing unilateral vertical tyre surrogate on independently prescribed flat platens. This is not spatial terrain, tread/soil contact or free rolling. No second native contact force. External tyre forces are held for one implicitfast step; this is first-order coupling, not an RK4 accuracy claim. Use bounded fixed steps, independent statics/geometry checks, energy/work residual reporting and meaningful refinement checks. Unsupported travel/tyre compression exits terminate the offline calculation; no impact continuation.

Geometry, inertias and all spring/tyre values are illustrative. Preserve production-bike catalogue, articulated rider, 3D handling, soil/mud and physics-LOD requirements. Next balanced slice should add passive rider compliance to this visible assembly, or address an observed blocker, rather than polish micrometre agreement in isolation.

## Sources and conventions

Pinned source: https://github.com/google-deepmind/mujoco/tree/3.16.0 . XMLreference.rst specifies ordered joints and spatial tendon springlength. src/engine/engine_core_util.c defines bilateral tendon force -k(L-Lrest)-c*Ldot and mj_objectVelocity BODY as world omega then COM velocity. src/engine/engine_core_smooth.c uses force then torque for xfrc_applied. src/engine/engine_forward.c specifies implicitfast stepping. See BIKE_RIG.md for assembly, domain and evidence details.

Axes x forward, y left, z up. Positive pitch about +y is nose down. Positive fork compression is backward/up along (-cos(head angle),0,sin(head angle)). Positive rear angle lifts an axle at negative x. Shock compression is extended length minus current attachment distance; native bilateral spring lengthening force handles compression, with leverage applied only by its Jacobian.
