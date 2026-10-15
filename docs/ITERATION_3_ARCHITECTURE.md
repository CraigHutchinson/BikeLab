# Iteration 3: architecture review and receiving slice

Reviewed baseline: fdeb07cf1190ee21a13cf2f8dd5eccf24753dee5 (merged PR #1), 2026-10-15. This review precedes implementation of the reference-comparison slice. Read the current solver/worker/viewer, record/CLI, test/browser/deployment boundaries and the terrain, 3D, overload and fidelity plans. The baseline's Windows/Linux tests and browser/headless checks passed; its Pages deployment is live.

## Product target: the Gran Turismo of mountain biking

BikeLab is developing a riding game with convincing bike setup, handling and trails. Laboratories provide repeatable evidence and tuning tools for that experience; accumulating standalone instruments is not the final product.

The intended player loop is: choose a stock or custom bike and rider; adjust a meaningful setup; ride a repeatable section; inspect replay and telemetry; change one thing; feel and measure the result. Include both hardtail and full suspension. Later stock Santa Cruz/Trek/Scott/other presets need model year, size, build and provenance; a brand name never supplies missing mechanics.

The first joined-up riding milestone is a short controlled test course, with coasting/braking, a smooth bump, off-camber turn and a clearly identified root/soil segment as each mechanism becomes supported. Controls, readable camera motion, tyre/suspension/chain sound cues and replay must consume actual physical state. Research-only overlays remain optional. Steering input is a rider/control command, not a direct lateral force or prescribed yaw. Rider assists must be explicit and evaluated separately from passive mechanics.

Do not imply that the present browser laboratory already implements riding, a garage, force feedback, audio or calibrated products. Build those experiences in bounded receiving slices alongside their physical foundations. Avoid a polished ride that bypasses unimplemented physics and a sophisticated solver with no usable riding consumer.

## Existing boundaries and dispositions

| Finding | Consequence | Decision for this slice |
|---|---|---|
| Both stations precompute finite trajectories in workers, then replay samples. | Solve/replay speed is not a continuous simulation deadline measurement. | Preserve this honest experiment mode; defer continuous worker scheduling until a coupled consumer exists. |
| Suspension tests have a closed-form oscillator oracle, but the viewer exposes only setup-to-setup comparison. | Users cannot inspect numerical/reference agreement. | Receive the oracle as a read-only comparison in the suspension viewer and a headless report. |
| The closed-form test solution uses a near-critical branch and subtractive overdamped root. | Generalising it needs conditioning checks. | Reuse its mathematics in one module, stabilise critical/strong-damping limits, and independently test that oracle. |
| Solver state and diagnostics are station-specific. | A universal state vector or solver interface now would erase meaning or add unused abstractions. | Keep station APIs; define only the actually consumed comparison result. |
| Viewer code is partly duplicated; worker lifecycle and record verification are already shared. | Premature UI/solver unification could couple otherwise independent stations. | Preserve viewers and records. Share the comparison through an explicit worker sidecar; review extraction when another real consumer needs it. |
| Default asymmetric damping and moving support are outside the simple exact oracle. | An apparently successful comparison could certify the wrong equation. | Explicit applicability checks, no silent parameter changes; offer a clearly described reference-compatible setup action. |
| Terrain/tyre/soil and full-bike coupling do not yet exist. | Generic LOD or parallel-worker interfaces would be speculative. | Keep their architecture contracts and acceptance tests; no in-run swapping, model registry or physics plugin framework yet. |

No change to the existing force laws, integration results or saved-run format is needed. A comparison is derived evidence, not part of the authoritative state. Existing old records must still rerun and verify.

## Bodies, coordinates and coupling gates

For a free planar rigid single-pivot reference with a fixed rider, use frame x/z/pitch (3), fork translation (1), two wheel spins (2), plus rear-member rotation (1) for full suspension: 6 hardtail / 7 full-suspension coordinates before external fixtures. A hardtail has no rear joint. Locking x and both wheel spins in a vertical rig leaves 3 / 4; declare those fixtures and reactions. These counts assume ideal joints, no drivetrain coordinate and no structural/tyre internal coordinates. Real multi-link mechanisms need their own constraint-rank check.

A corresponding free 3D reference starts with frame pose (6), steering (1), fork (1), two spins (2), plus the single-pivot rear coordinate (1): 10 / 11 before rider articulation and additional compliant states. These are independent physical coordinates, not the count of quaternion components. Check closed-loop geometry, constraint rank and inertial aggregation in the solver decision.

| Coupling group | Exchange and state ownership | Gate before live use |
|---|---|---|
| Frame/fork/rear member/wheels | Joints, attachment wrenches, momentum and suspension work | Hardtail and full-suspension geometry, constraint and power references |
| Tyre/soil/root/rock | Shared contact geometry, normal/shear load, deformation/history | Coupled covered-root controls; no duplicate support/grip |
| Tread/retained mud | Rotation/deformation, retained mass/inertia, transfer momentum/work | Deformation-only, spin-only and combined release references |
| Rider/steering/contact | Articulated mass, grip/foot/saddle reactions and bounded commands | Passive tests first, then mirrored/controlled handling |
| Pressure/damage/overload | Persistent pressure, geometry and changed load paths | Supported stops/failure criteria and explicit unsupported continuation |

Each group must declare compatible models, timestep limits and state-transfer ability. A cheaper model is chosen by measured error/validity, not by camera distance alone. Reference shadow work cannot correct live forces implicitly. The detailed plan remains in [PHYSICS_FIDELITY.md](PHYSICS_FIDELITY.md).

## Receiving slice and acceptance

Add an analytical reference overlay and maximum/RMS error report to the existing suspension station. Candidate and reference use identical setup and simulation timestamps. Support fixed-base, equal viscous damping, completed interior-travel runs only. The reference's passive-energy envelope must remain inside stroke throughout, avoiding claims based solely on sampled travel checks. Other cases show a reason instead of a pass.

Compare compression (m), compression velocity (m/s) and signed axial force (N). Fix numerical thresholds before results are judged: maximum errors 1e-6 m, 1e-4 m/s and 0.1 N at recorded times. These are laboratory software gates, not hardware-accuracy or continuous peak/event guarantees. Keep per-channel errors visible. Refining dt can improve agreement; changing the recording interval changes the evaluated sample set and must be reported.

Worker results carry comparison data separately from the existing run. The viewer reads it; the candidate receives no reference feedback. Reports include comparison/reference/candidate versions, complete setup, sample grid and limits. A CLI consumes the same comparison module. It exits nonzero on a failed or unavailable comparison. Saved simulation files retain their original schema and verifier; the comparison is recomputed.

Verify the oracle independently using exact special cases, nonzero initial velocity, ODE/initial-condition checks, critical-limit continuity and extreme damping. Exercise multiple mass/stiffness scales, refinement, unsupported cases, malformed/misaligned candidate signals and deliberately altered signals. Browser tests must show applicable and unavailable states, actual worker delivery, overlays, configuration action and numerical agreement with the headless report. Inspect captured desktop/mobile output. Preserve the unfiltered existing suite.

## Numerical derivation and source mapping

[Weisstein's authored damped-motion derivation](https://mathworld.wolfram.com/DampedSimpleHarmonicMotion.html) gives x'' + beta x' + omega0^2 x = 0 and the characteristic roots. In this station x=e=q-q_eq, beta=c/m, omega0^2=k/m, q_eq=(mg-preload)/k, e(0)=q0-q_eq and e'(0)=u0. This mapping applies only to fixed support and equal damping; the reference must not use the production force evaluator or RK steps.

With alpha=c/(2m), use the underdamped sine/cosine solution, repeated-root limit at critical damping and two real decay roots above critical. Evaluate sin(omega t)/omega and sinh(beta t)/beta with their small-argument limits near critical. Rationalise the slow overdamped root to avoid subtracting nearly equal large numbers. This is a numerical evaluation choice for the same closed form, not a new physical model.

The relative mechanical energy (m u^2 + k e^2)/2 is nonincreasing for c>=0, so |e(t)| <= sqrt(e0^2 + (u0/omega0)^2). This sufficient envelope is conservative: a physically admissible case may be marked unavailable if the bound reaches beyond travel. No end-stop impact is predicted.

## Next balanced slice after this delivery

Use the paired experiment/report path to assess candidate constrained multibody/contact solvers with the explicit 6/7 and 10/11-coordinate bike tests and spatial wheel/covered-root fixtures. Select a solver only after it receives geometry, snapshots and headless evidence. Then deliver the visible hardtail/full-suspension rolling-road rig, followed by a short controllable riding course with steering/rider/braking as their gates pass.

Measure real-time budgets on declared target hardware once a live coupled workload exists. Until then, record local/browser solve timing as diagnostic only. Keep numerical agreement, physical calibration, native input/render/audio experience and participant evidence separate.
