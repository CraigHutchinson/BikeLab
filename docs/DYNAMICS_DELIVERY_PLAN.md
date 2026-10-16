# Connected bicycle dynamics delivery plan

Reviewed main 29c5532 before this iteration. The terrain probe/request stations provide geometry; the bicycle rig still has two lumped vertical tyre reactions on moving platens, constrained horizontal motion and no wheel spin. They are not yet a moving spatial bike/contact simulation.

## Tracked follow-ups and receiving sequence

| ID | Work and visible consumer | Gate / dependency | Status |
|---|---|---|---|
| D1 | Loaded spatial tyre: deformed outline, rim, all active regions, local normal forces, resultant force/moment; flat/round/edge/two-support controls | Source-backed reduced compliance family; independent energy/contact equilibrium and tyre/terrain refinement; label planar force versus real area/pressure | Next: bounded static radial-ring experiment D1a |
| D2 | Freely translating and rotating wheel into bump/step/wall; known mass and angular inertia | D1 plus contact search over complete motion, no tunnelling, momentum/impulse/work and separation/recontact checks | Planned |
| D3 | Both spatial wheels coupled to moving hardtail/full bike, suspension and rider | D2; free planar translation, tyre moments, load transfer, take-off/landing and rigid-ground controls | Planned |
| D4 | Rolling/sliding, drive/brake torque, rolling loss and combined traction | Wheel spin and contact-point velocity, local shear/history and consistent wheel/frame reactions; near-zero/reversal and locked-wheel controls | Planned |
| D5 | Rider hand/foot/saddle contacts, posture, active control and release | Observable attachment forces/moments, mass/COM/inertia, work accounting; no inferred injury model | Planned |
| D6 | Finite-width 3D tyre, camber, steering/lean and lateral/combined grip | D1/D4 finite-area semantics and 3D dynamics; fork/terrain side contacts, berm/groove controls | Planned |
| D7 | Soil cover over roots/rock, reinforcement, shared ruts/exposure | Coupled footprint and supported layer/interface constitutive laws; no duplicate soil/rock support; front/rear accepted state | Planned |
| D8 | Mud pickup, tread packing, deformation/spin shedding and carried mass | D4/D7 transfer mass, momentum/work, angular state and deposit/outflow accounting | Planned |
| D9 | Suspension/geometry/configuration realism | Sag/load/leverage diagnostics; sourced geometry/travel/mass/inertia, preload, air/coil, separate compression/rebound, friction/thermal limits; production-bike catalogue with provenance | Fork/shock finite buffers received; remaining configuration planned |
| D10 | Rim/spoke/frame/attachment failure, tyre inserts/beads and pressure loss | Supported local loads, material/geometry/state criteria; impact response first, damage second; preserve mass/work and update failed topology | Planned |
| D11 | Terrain request/cache completion and trail ingestion | Asymmetric/multimodal prefetch, transforms, known voids/roots, leases/shared state; scan/ML provenance, 1–2 cm resolution distinct from accuracy | R0a received; remaining gates planned |
| D12 | Real-time fidelity and detailed references across the joined system | Compatible tier combinations, convergence/calibration, shadow comparisons, conservative state transfer, worst-case costs and input/render budgets | Planned; offline replay is not real-time simulation |

D1a is deliberately smaller than D1: a static planar radial-ring compliance experiment against the existing authored polyline terrain. It should establish distributed contact and load-sharing visibility before adding wheel inertia, rolling or whole-bike attachment. A radial ring cannot establish calibrated pressure, true contact area, tread mechanics or full casing strain. Resolve the mathematical model and its limits from primary sources before implementation. Capture acceptance evidence and unsupported outcomes rather than silently extending it to wall crashes.

## Common acceptance rules

- Shared headless/browser mechanics, deterministic records and explicit units/provenance.
- Refine tyre and terrain independently; subdivision cannot multiply stiffness/grip. Distinguish candidates from active force-carrying contact.
- Sum local force/moment and work consistently; do not add a whole-wheel spring for every sample or full independent support for every soil layer.
- Separate convergence, physical calibration, browser captures and participant/native-device evidence.
- Preserve failed/out-of-domain states explicitly. Impact detection, rigid continuation and structural failure need their own gates.
- Retain all existing terrain/contact, layered-terrain, 3D dynamics, overload and physics-fidelity requirements; this plan orders them rather than replacing their detail.