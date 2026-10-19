# Iteration 18 review and receiving scope

Reviewed PR #20 at e4a9bf72a49ce44871214db50e0be61ffb0cdc41, including the merged PR #19 physics, exact implementation-tree identity with its earlier green run, current Linux/Windows checks, numerical receipts and actual corrected full/hardtail overload and 320 px screenshots. Frame clipping and near-zero force scaling are corrected. Final browser CI remains a merge gate. Impact mesh sensitivity, soft-contact work and incomplete swept-casing collision remain explicit limitations.

The next balanced slice is D4a: homogeneous native sliding friction in the existing connected hardtail/full-suspension bike, with every deformed contact's full force vector and signed slip in m/s, plus a normal/tangent work split. The visual consumer gets grip and skid/coast examples; the shared headless engine exports identical owned scenarios and diagnostics. This remains a planar uncalibrated reference experiment, not a real-time or physical tyre-grip qualification.

Preserve the existing exact frictionless model by retaining condim=1 and its solver options when friction is zero. Positive friction uses native elliptic condim=3 on both wheel flexes and every terrain slab. Values are illustrative interface coefficients, not claims about named materials. Record migration must supply zero friction for old 0.1/0.2 scenarios and retain 0.1's smooth-only admission.

Receiving checks: native rigid sliding sign/cone/work, independently calculated weighted point velocity for an interior flex contact, contact vector sums against generalized wheel/root loads, constraint-power partition, both bike assemblies, separation/recontact, mesh/timestep sensitivity, observation-only invariance, old replay, complete browser/headless exports, actual desktop/mobile inspection. Do not certify exact sticking: native soft constraints can creep. Keep numerical and physical evidence separate.

## D4b drive and brakes, retained next

GPT-6.1 Sol inspected pinned MuJoCo 3.16.0 sources. Rear drive is a signed wheel-relative generalized torque, with its countertorque on the carrier and work torque times relative spin displacement. Brake capacity uses nonnegative native DOF friction loss; the solved friction-row torque is distinct from the command. Friction rows enter qfrc_constraint[spin], so subtract them before naming that quantity ground moment. Distinguish total carrier-on-wheel moment from ideal bearing moment. Do not count brake work both in total constraint work and as a separate loss.

Controls should be a bounded list of integer-tick, right-continuous commands. Finish the interval with the old command before switching and refreshing endpoint diagnostics. Rebuild native row views after every solve; never cache contact addresses across brake changes. Rollback cannot retain an unaccepted command, work or impulse. Native dry friction is regularized, not an exact lock guarantee: independently measure rest, reversal, release, under/over-capacity drive and free carrier/rotor momentum/work before connection. Event cadence must not depend on display/record cadence.

## Retained wider work

Layered soil over rock/roots, reinforcement versus isolated roots, shared front/rear terrain history, tread packing, pickup/shedding through deformation/spin and carried mud mass remain required. A homogeneous interface coefficient does not implement these. Preserve finite-width contact, route corridor/cache extraction, scanned/generated source uncertainty, 3D lateral/combined grip, anatomical rider control, pressure/damage, physics tiers and conservation-qualified adaptive mesh work. See LAYERED_TERRAIN.md, TERRAIN_SAMPLING_CONTRACT.md, PHYSICS_FIDELITY.md and ADAPTIVE_WHEEL.md.

## Primary references and conventions

- [Pinned contact parameter mixing](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_collision_driver.c#L1616): equal-priority contact coefficients and dimensions combine by maximum; set both sides deliberately.
- [Pinned friction clamp and DOF row construction](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_constraint.c#L149): zero coefficient with condim=3 is not the exact frictionless path. Brake rows identify their DOF and carry its unit Jacobian.
- [Pinned flex point weighting](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_util.c#L574): normalized inverse distances to vertices; combine body Jacobians evaluated at the contact point, including skin/rotation offsets.
- [Pinned contact API](https://github.com/google-deepmind/mujoco/blob/3.16.0/include/mujoco/mujoco.h): contact force is force:torque in contact coordinates. Transform all three force components by the frame transpose, positive on side 1. Elliptic constraint velocities have the same side-1-minus-side-0 convention. Resolve world vectors before projecting onto planar tangent (normalZ, -normalX).
- [Pinned slow-slip guidance](https://github.com/google-deepmind/mujoco/blob/3.16.0/doc/modeling.rst#L1550): regularization permits small sustained slip; tuning is not a physical calibration.
