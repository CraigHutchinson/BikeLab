# Rider control: inverse kinematics, effort and actual dynamics

User question, 2026-10-26: whether inverse kinematics or another model is needed to represent humanoid dynamics. The recommended direction separates these responsibilities:

| Layer | Question answered | Current or next role |
| --- | --- | --- |
| Setup inverse kinematics | Which joint angles reach the hand/foot locations? | Already present in `constructPosture`: analytic two-link chains, bend branches and reach/singularity rejection. |
| Runtime task-to-pose targets | Which nearby feasible posture follows hip/trunk or COM intent? | Next small adapter for slow weight transfer and crouch/extension, initially with retained supports. |
| Bounded joint effort | What effort follows the selected targets within declared limits? | The new [sampled PD probe](RIDER_DRIVE.md); it does not guarantee exact tracking or balance. |
| Inverse dynamics / whole-body control | Which feasible efforts and support forces produce the desired acceleration? | Later gravity compensation, support-aware COM/momentum control and absorption. |
| Forward articulated dynamics | What motion actually results from effort, gravity, compliance and contacts? | Keep the shared native bike/rider physics as the authority for actual state. |

More IK alone cannot fix slumping: reachable posture is not proof of support force, equilibrium or tracking ability. A freely evolving articulated body plus explicit actuation/contact is the physical representation; IK and inverse dynamics are control tools above it. A general optimization or model-predictive controller is premature until the simpler drive's receiving failures are understood.

## Minimum next task adapter

Author a modest hip shift or crouch/extension trajectory and trunk preference on both bikes, using explicit current hand/foot bindings and the existing segment geometry. Generate compatible joint goals without rebuilding the native rest pose, changing passive laws or writing q/v. Preserve immutable rider definitions and branch/domain checks. Reject or explicitly report infeasible reach instead of stretching limbs.

Record the requested task, feasible target, actual hip/trunk/whole-rider COM, joint tracking error, torque/saturation and signed work. Receive a slow transfer and recovery before a repeated-bump controller. Then add feedback from COM velocity, pitch and solved support loads, introducing additional force/dynamics machinery only when those cases establish the need. Target-generation clocks can be slower than mechanical integration; they must remain deterministic and participate in replay/rollback.

Whole-rider COM is mass-weighted geometry, not simply hip position. The combined bike/rider COM is different again. Hands and feet transmit forces through the bike and are internal to the combined system; desired COM acceleration needs feasible external support. During flight, internal effort changes shape and relative attitude but cannot impose an arbitrary combined COM trajectory.

## Support changes and 3D

The task layer consumes actual interface state. A released hand is no longer a retained support constraint. Saddle contact can unload. IK may suggest reaching a bar or saddle but cannot snap a distant contact closed. Inverse dynamics must respect the current contact set, friction, unilateral support, joint/effort limits and infeasible requests. The current retained-foot surrogate cannot certify ordinary flat-pedal behavior.

Eventual 3D requires independent left/right limbs, suitable joint freedoms and orientation targets, rider/bike collision, lateral/turning contact forces and contact transitions. Changing IK algorithms does not supply those mechanisms. Independent rider identity, reusable configuration and explicit interface ownership remain required.

## Primary references reviewed

GPT-6.1 Sol read the accessible [Buss and Kim selectively damped least-squares IK draft](https://static.aminer.org/pdf/PDF/002/887/419/selectively_damped_least_squares_for_inverse_kinematics.pdf), April 2004; the [published article](https://doi.org/10.1080/2151237X.2005.10129202) is from 2005. It motivates handling singular/unreachable kinematic targets, but numerical damping/clamping does not establish dynamic feasibility. Its example gains, iterations and timing are not BikeLab parameters.

[Stephens and Atkeson, Dynamic Balance Force Control, 2010](https://www.cs.cmu.edu/~cga/papers/stephens-iros10.pdf) was also read. It separates COM/momentum and feasible contact-force objectives from posture tasks. Its humanoid foot assumptions and actuation mapping do not transfer directly to bicycle tyres and rider supports. This informs architecture; no such controller or human calibration is implemented here. A Khatib operational-space manuscript was located but could not be retrieved, so it is not counted as reviewed evidence.

## D0 target preparation checkpoint — 2026-10-29

The [sampled task-target preview](RIDER_TASK_TARGETS.md) now consumes a fixed passive rider definition and hip/trunk intent in the Trail page and headless tool. It reuses setup IK, preserves body/anchors/laws, and rejects infeasible sampled targets. It does not yet update runtime drive goals or evaluate actual motion. Browser receiving remains deferred. The next adapter must consume these targets through canonical native drive mapping, actual retained bindings and command-tick replay/rollback, with actual tracking/effort/work diagnostics and the existing dynamic-acceptance gates.
