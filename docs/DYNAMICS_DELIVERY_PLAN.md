# Connected bicycle dynamics delivery plan

Originally planned against main 29c5532; received against main 1a364dc in iteration 13. The terrain probe/request stations provide geometry; the bicycle rig still has two lumped vertical tyre reactions on moving platens, constrained horizontal motion and no wheel spin. They are not yet a moving spatial bike/contact simulation.

## Tracked follow-ups and receiving sequence

| ID | Work and visible consumer | Gate / dependency | Status |
|---|---|---|---|
| D1 | Loaded spatial tyre: deformed outline, rim, all active regions, local normal forces, resultant force/moment; flat/round/edge/two-support controls | Source-backed reduced compliance family; independent energy/contact equilibrium and tyre/terrain refinement; label planar force versus real area/pressure | D1a received: [static radial experiment](STATIC_FOOTPRINT.md); corner and physical tyre gates remain open |
| D2 | Freely translating and rotating wheel into bump/step/wall; known mass and angular inertia | D1 plus contact search over complete motion, no tunnelling, momentum/impulse/work and separation/recontact checks | Planned |
| D3 | Both spatial wheels coupled to moving hardtail/full bike, suspension and rider | D2; free planar translation, tyre moments, load transfer, take-off/landing and rigid-ground controls | Planned |
| D4 | Rolling/sliding, drive/brake torque, rolling loss and combined traction | Wheel spin and contact-point velocity, local shear/history and consistent wheel/frame reactions; near-zero/reversal and locked-wheel controls | Planned |
| D5 | Rider hand/foot/saddle contacts, posture, active control and release | Observable attachment forces/moments, mass/COM/inertia, work accounting; no inferred injury model | Planned |
| D6 | Finite-width 3D tyre, camber, steering/lean and lateral/combined grip | D1/D4 finite-area semantics and 3D dynamics; fork/terrain side contacts, berm/groove controls | Planned |
| D7 | Soil cover over roots/rock, reinforcement, shared ruts/exposure | Coupled footprint and supported layer/interface constitutive laws; no duplicate soil/rock support; front/rear accepted state | Planned |
| D8 | Mud pickup, tread packing, deformation/spin shedding and carried mass | D4/D7 transfer mass, momentum/work, angular state and deposit/outflow accounting | Planned |
| D9 | Suspension/geometry/configuration realism | Sag/load/leverage diagnostics; sourced geometry/travel/mass/inertia, preload, air/coil, separate compression/rebound, friction/thermal limits; production-bike catalogue with provenance | Fork/shock/rider buffers, annotated linkage and sag/load diagnostics received; measured production configuration remains open |
| D10 | Rim/spoke/frame/attachment failure, tyre inserts/beads and pressure loss | Supported local loads, material/geometry/state criteria; impact response first, damage second; preserve mass/work and update failed topology | Geometric rim boundary and declared assembly/service checks received in [iteration 14](WHEEL_LIMITS.md); damage and leakage remain planned |
| D11 | Terrain request/cache completion and trail ingestion | Asymmetric/multimodal prefetch, transforms, known voids/roots, leases/shared state; scan/ML provenance, 1–2 cm resolution distinct from accuracy | R0a received; remaining gates planned |
| D12 | Real-time fidelity and detailed references across the joined system | Compatible tier combinations, convergence/calibration, shadow comparisons, conservative state transfer, worst-case costs and input/render budgets | Planned; offline replay is not real-time simulation |

D1a is deliberately smaller than D1: a static planar radial-ring compliance experiment against the existing authored polyline terrain. It should establish distributed contact and load-sharing visibility before adding wheel inertia, rolling or whole-bike attachment. A radial ring cannot establish calibrated pressure, true contact area, tread mechanics or full casing strain. Resolve the mathematical model and its limits from primary sources before implementation. Capture acceptance evidence and unsupported outcomes rather than silently extending it to wall crashes.

## Product destination and next integration milestones

User direction, 2026-10-18: the destination is simulated mountain-bike dynamics **including the rider**, serving both synthetic-data generation and game simulation. Standalone stations are verification tools. They are not the final product, and further isolated diagnostics should be justified by a blocker in the connected simulation.

The immediate receiving target is D1b/D2: a wheel with mass and spin moving over authored flat, rounded and square-edge terrain. First resolve the sharp-feature casing/contact formulation that the scalar radial surrogate cannot support. Then consume the same contact forces in dynamic motion, with separation/recontact, impact impulse and energy checks, continuous contact search and explicit rim/support limits. Do not mistake a prescribed geometric sweep for this dynamic milestone. The next iteration should deliver the smallest defensible part of that path, with its whole-bike interface identified before authoring.

Next integrate D3/D4: front and rear spatial wheel contacts driving the existing hardtail/full-suspension and rider model on a short trail, with forward motion, wheel spin, braking/drive inputs, load transfer, take-off and landing. Keep existing suspension travel buffers and ultimate boundaries. This becomes the end-to-end regression scenario and visible consumer; support forces must come from the same contact model used headlessly, with no parallel animation-only bike motion.

Then extend D5 from the current guided mass to articulated rider mass/inertia and observable hand, foot and saddle contacts. Introduce posture and control inputs with their work/actuation limits, release and recontact. Preserve fixed/passive controls for comparison. A single guided rider coordinate is not a completed rider model. D6 receives 3D steering, lean, camber and lateral/combined tyre forces; a planar prototype is not completion of the game or synthetic-data goals.

Build the shared execution/data contract alongside the first connected trail run, rather than waiting for all terrain detail. A versioned scenario contains bike/rider configuration, initial state, terrain/material provenance, seed and timestamped control inputs. Offline batch execution and the interactive game adapter consume the same physics/state transitions; rendering and input sampling remain separate from simulation time. Export explicit frames/units, body and joint states, tyre contacts/slip, component loads, control work and supported damage/pressure events. Retain model version, fidelity, uncertainty and termination reasons in labels. Deterministic replay and conservation/convergence checks are separate from real-world calibration; generated labels must not imply measured accuracy.

D12 must establish representative hardware budgets, worst-case physics cost, latency and fidelity error on the connected bike/rider scenarios before a real-time claim. More detailed impact/contact work may run on demand or at a separate rate only after activation, synchronization, state transfer and force/work consistency are verified. Offline high-detail runs serve as references for game tiers. D7/D8/D11 then add layered soil over roots/rock, shared ruts and mud history, and scanned/generated trail detail with provenance; D10 adds failure and pressure loss only with supported local loading and component criteria. These remain required capabilities, with order adjusted when they block the connected consumer.

## Common acceptance rules

- Shared headless/browser mechanics, deterministic records and explicit units/provenance.
- Refine tyre and terrain independently; subdivision cannot multiply stiffness/grip. Distinguish candidates from active force-carrying contact.
- Sum local force/moment and work consistently; do not add a whole-wheel spring for every sample or full independent support for every soil layer.
- Separate convergence, physical calibration, browser captures and participant/native-device evidence.
- Preserve failed/out-of-domain states explicitly. Impact detection, rigid continuation and structural failure need their own gates.
- Retain all existing terrain/contact, layered-terrain, 3D dynamics, overload and physics-fidelity requirements; this plan orders them rather than replacing their detail.
