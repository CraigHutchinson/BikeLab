# Whole-system rider manoeuvre stretch goals

User direction, 2026-10-20: pumping, wheelies, bunny hops, endos and related manoeuvres should demonstrate the joined MTB, rider, suspension and tyre model. These are planned acceptance scenarios for the same browser/headless engine, not animation targets or implemented capabilities. Both hardtail and full suspension remain in scope.

## Pumping reference and precision

The requested [Pinkbike explanation by Seb Stott](https://www.pinkbike.com/news/how-to-pump-your-bike-physics.html) motivates testing rider-motion timing relative to trail curvature and explicitly identifies rider work as the source of added mechanical energy. It is a useful qualitative demonstration, not a measured trajectory or force dataset.

Do not encode a universal `mass × radius × speed = constant` rule about a changing trail-curvature centre. The joined bike has multiple contacts, gravity, traction, elastic storage and a moving rider; external moments and the chosen reference point matter. Use the full system's momentum and work balances. An isolated torque-free point-mass radial-motion control can verify the simplified angular-momentum relationship separately.

A [primary pump-track study](https://arxiv.org/pdf/2311.07251) demonstrates a reduced variable-length two-mass system on a prescribed track. Its constrained path and simplified contacts differ from BikeLab's freely moving two-wheel assembly. Use it to motivate a reduced reference case, not to certify realistic tyre loading or MTB accuracy. The [MIT dynamics derivation](https://ocw.mit.edu/courses/2-003j-dynamics-and-control-i-spring-2007/cbb6ca8545b3afc8645ee9293e6bc2bc_lec03.pdf) supplies the angular-momentum balance, including the extra term for a moving reference point.

Successful manoeuvres can demonstrate system integration and, with refinement, numerical precision. Physical accuracy of pump gains, hop height or balance limits additionally needs measured rider/bike inputs and an independent motion/load reference with uncertainty. Do not tune a controller until the picture resembles a trick and call that calibration.

## Staged demonstrations

| ID | Scenario and visible outcome | Independent checks and dependencies |
| --- | --- | --- |
| M1 | Pump through smooth rollers with no hub drive; compare passive posture, a timed active cycle and a deliberately mistimed cycle | At the same track station compare COM speed, height, rider work, elastic storage and loss. Record posture phase versus curvature, front/rear contact loads and suspension travel. Net energy gain must be supplied by rider work. Requires active rider joints and work/actuation limits after passive D5a. |
| M2 | Manual: front wheel separates while the rear stays supported, with rear drive zero | Verify front load goes to zero, continued rear support, whole-system impulse/moment and rider work. Recontact uses the same tyre model. Distinguish a transient lift from sustained balance. |
| M3 | Powered wheelie: rear hub torque contributes to front lift | Separate hub and rider work, retain drive countertorque and rear traction limits, and compare a matched zero-drive run. Abstract hub drive does not validate pedalling biomechanics. |
| M4 | Bunny hop: front lift, rear lift, whole-system flight and landing | Take-off momentum follows preceding ground impulse and gravity. During flight verify ballistic total COM motion and total angular momentum about COM; rider/bike relative attitude may change. No lift impulse, pose projection or airborne traction may be injected. |
| M5 | Endo/stoppie: front braking produces rear-wheel lift while front support remains | Rear contact becomes inactive without tensile terrain force; check front grip, solved brake torque/work, load transfer and pitch balance. Distinguish a short lift from a controlled front-wheel balance. |
| M6 | Landing absorption and deliberate extension over a lip | Compare active and passive runs with matched entry state and declared commands. Record actuator absorption/injection, tyre/suspension storage and loss, contact impulses and ultimate limits. Do not assume every active posture lowers peak load. |
| M7 | Berm pumping, side-to-side flat-ground pumping and asymmetric tricks | Wait for 3D steering, lean, finite-width contact, lateral/combined traction and independent limb support. A planar vertical pumping result does not receive these cases. |

M1–M6 form a progression, not a promise that their outcomes already follow from the current guided rider. First receive passive articulation and attachment loads, then bounded active joints, then short controlled lift/landing cases, and only then full manoeuvre envelopes. A low-speed manual or endo that reaches a declared model boundary is an unsupported run, not a completed manoeuvre.

## Common mechanical and data contract

- Record commanded and actual joint effort, relative velocity and actuator work, with torque, speed, power and motion limits. For ideal relative rotary drives, mechanical power is the sum of `torque × joint speed`; general native transmissions require their actual generalized force and velocity. Changing spring rest angles or prescribing posture can also inject energy and needs explicit work accounting. [Pinned MuJoCo actuation conventions](https://github.com/google-deepmind/mujoco/blob/3.16.0/doc/computation/index.rst#L294).
- Keep gravity and all physical masses unchanged during a pump. Internal actuation can add mechanical energy from the rider's energy supply; it cannot provide a net external impulse to the isolated bike/rider. Ideal stationary no-slip support supplies impulse without supplying positive mechanical work. Retain actual signed regularized contact work and numerical error rather than hiding them.
- Use passive, zero-actuation and changed-phase controls. Compare at matched trail position or a clearly defined event, not merely equal elapsed time. Report initial/final posture and elastic energy so release of preloaded suspension or a different COM height is not mistaken for sustained pump gain.
- Infer wheel support from native force and separation, with declared tolerances and event-time refinement. Export both wheel contact states, COM state, bicycle attitude, rider joint state, attachment loads, cumulative drive/brake/rider work, losses and termination. Labels must distinguish lift, flight, landing, supported balance and unsupported termination.
- D5a's bilateral foot attachment can pull on the bike. Label it a retained-foot surrogate. A flat-pedal bunny-hop claim needs unilateral normal support, bounded friction and foot separation; a clipless claim needs sourced retention/release behavior. Hands likewise need explicit grip/release semantics before claiming rider detachment or bail-out.
- Preserve suspension and casing limits during preload, take-off and landing. Wheel/rim/spoke/frame/bead failure, blowout and pressure loss require supported local loading and component criteria. Stop an unsupported overload instead of granting extra travel or arbitrary structural strength.
- The current frame-pitch limit is ±0.35 rad, about ±20°. Extend it only with appropriate geometry, collision, rider-attachment, support and integration evidence. Do not remove it merely to finish a wheelie or endo. Frame/fork/rider collision and complete swept casing detection remain separate gaps.
- Refine solver time, command timing, contact-event time and casing/terrain resolution independently. Fixed commands test mechanics; closed-loop controllers need separately recorded feedback and commands so their adaptation cannot conceal a model error. Browser and offline runs share the same versioned scenario and accepted transitions.

Acceptance budgets must be declared per receiving case before tuning. Keep qualitative behavior, numerical balance/refinement, measured calibration, visual inspection and real-time performance as separate evidence. Offline playback of a successful trick does not establish a real-time game simulation.

Seated support, unseated hovering, chosen absorption/resistance and transitions have a separate [primary-source research follow-up](RIDER_SEATED_UNSEATED.md). Keep intended posture distinct from actual saddle contact; receive passive support first, then identify bounded active strategies from measured motion and loads.

## Unified controller receiving — 2026-10-29

Bunny hop, endo and wheelie remain explicit intended scope alongside the initial crouch/shift. The [shared control-loop direction](RIDER_CONTROL_ARCHITECTURE.md#unified-mtb-control-direction--2026-10-29) assigns phase/feedback policy above common feasible targets and bounded effort. The [D1 runtime command receiver](RIDER_TARGET_DRIVE.md) exercises transfer/recovery target scheduling, work and rollback on both bikes, without claiming any M1–M7 manoeuvre or stable dynamic recovery. Phase labels are intent, not contact evidence. Use the same mechanism for future policies while retaining each manoeuvre's support, momentum, work and validity gates above.
