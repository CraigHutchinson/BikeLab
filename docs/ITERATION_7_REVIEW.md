# Iteration 7 review and preregistered scope

Reviewed merged PR #6, main `e3654feac81cd227a99d4cfe71ff1d62d48fd053`, tree `5ff56878b1c3164b3566f1d2b7ebd768d241b430`. The synchronized local tree matches exactly, including the unmodified MuJoCo artifacts recovered from the successful Pages run 38818884013. The thirteen prior bicycle tests pass locally. Reviewed all prior rig physics, worker, CLI, viewer, browser/unit checks, model contract and iteration evidence before implementation.

The previous slice intentionally uses held vertical tyre forces, native fork/shock springs, fixed longitudinal motion and spin, and endpoint rejection at unsupported limits. It does not implement trail contact, end stops, damage or a continuous event guarantee. Its time reset guard, same-path browser/headless execution, explicit failed settling and separate trial/accepted states are retained. Rollback ends the calculation; it is not a complete restart checkpoint. Existing solver precision polishing remains parked.

Review findings relevant to the receiving feature: adding a rider to the existing combined mass would double-count weight; hardcoded original coordinate indices cannot identify a new coordinate safely; the initial COM and damping budget must include any new body; saved v0.1 records require an explicit compatibility path. The viewer must distinguish a guided aggregate mass from anatomical hand/foot/saddle motion. These are implementation requirements, not claims of defects in the fixed-rider slice.

## Receiving scope

Add a selectable passive guided rider mass to the existing visible rig and shared CLI. Preserve the original fixed-rider mode exactly. In compliant mode, split the existing total frame+rider mass into configurable rider and residual frame mass. At zero rider displacement both centres coincide with the original frame origin; split its spherical inertia in the same mass ratio so locked zero displacement recovers the same mass distribution. The native frame-child slide is along local +z; its spring rest is zero and compression is negative joint displacement. Gravity creates sag and physically shifts the COM. No active support or hidden gravity compensation.

This is one additional coordinate, a bilateral spring/damper and an ideal guide. It is an explicit precursor to articulated hand/foot/saddle contacts, not anatomical posture, muscle control, separation or comfort calibration. The guide carries transverse force and rotation constraints; reported spring/damper axial force is not the complete attachment wrench. Adjustable travel bounds reject unsupported accepted endpoints, preserving the prior last-valid-state behaviour without inventing stop/failure forces.

Show the moving lump and its guide, rider compression and axial-force histories, mode and editable mass/stiffness/damping/travel. Include native rider spring/gravitational/kinetic energy and rider damping loss exactly once. Preserve record reconstruction, worker cancellation, responsive layout and all original stations. Existing v0.1 setups migrate explicitly to fixed mode; new complete records have a new identity.

## Gates fixed before implementation results

- Preserve all existing fixed-rider tests; compare original recorded channels against captured baseline runs in the same runtime.
- Exact total mass and locked-zero rider mass/inertia equivalence; independent native force law and equal/opposite work signs, no additional applied rider force.
- Both variants: static support/moment and rider sag balance within 0.01 N; nominal smooth energy/work residual below 0.02 J; all accepted rider/fork/shock/tyre states in their declared domain.
- Step refinement 0.25 to 0.0625 ms: peak contact/rider axial forces differ by less than 1%; suspension/rider compression histories differ by less than 0.1 mm. These are fixture-specific numerical gates, not universal parameter-envelope certification.
- Independent fixed-base rider oscillator against the analytical damped solution at matched times: max displacement error below 0.1 mm at 0.0625 ms. Include nonzero initial relative velocity and static gravity sag.
- Reject invalid mass budgets, schemas, nonfinite inputs and inadequate settling; test rider travel termination, repeatability and recording-cadence independence.
- Hosted Windows/Linux complete suite and Chromium browser/headless agreement below 1e-8 for recorded channels; actual mode/control/save/load/cancel/resize interactions and inspected desktop/mobile captures.

Full 3D lateral/turning dynamics, attachment-wrench failure criteria, rim/spoke/seal damage, spatial square-edge tyre stress, layered soil/root and tyre mud history, scan/ML terrain provenance, adaptive multirate and measured real-time capability remain open requirements. Next work should receive strict travel/end-stop load paths on this coupled fixture before claiming high-impact continuation.
