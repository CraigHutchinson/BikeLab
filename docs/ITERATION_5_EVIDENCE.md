# Iteration 5 evidence: constrained solver arm

Reviewed baseline: `0abfde70c96a134de069f5b23160a0c91dcd9d5a`. [Review and preregistered gates](ITERATION_5_REVIEW.md) were committed before implementation. GPT-6.1 Sol supplied the requested bounded research; [the trial contract](SOLVER_TRIAL.md) records primary references, exact dependency provenance, sign conventions and limitations.

## Delivered

The Solver trial station and `scripts/trial-solver.mjs` execute the same pinned Rapier WASM prismatic assembly, with adjustable physical spring/damper, mass, preload, stroke, initial state, tilt, transverse loading, torque probe and integration step. Browser execution uses a cancellable module worker. Replay, reference overlay, signed error plot, per-channel maximum/RMS errors, every-step closure and snapshot/restart evidence are visible and exportable.

Local Node 24 execution passed **72 tests**, none skipped. Existing wheel/suspension/terrain tests remain unfiltered. New tests cover artifact integrity/licence, input bounds, static equilibrium at three scales, independent undamped cosine motion, mirrored tilt, torque-loaded angular closure, preregistered refinement, same-runtime repeat/report reproduction, full-world restart and CLI exit semantics. Candidate snapshots reproduce all subsequent body state components and final world bytes for these tested cases; contact and external history are absent.

## Measured finding

The default release **does not pass the reference gate**. The fixed 1 µm displacement / 0.1 mm/s velocity / 0.1 N reconstructed-force limits remain unchanged. [Complete refinement receipts](evidence/iteration-5-refinement.json) retain setup, binding/core/source identity, settings, errors, closure/restart and complete-report hashes.

| Requested step | Max compression error | Max velocity error | Max reconstructed-force error |
|---|---:|---:|---:|
| 0.5 ms | 41.145 µm | 0.584542 mm/s | 0.351549 N |
| 0.25 ms | 20.235 µm | 0.290582 mm/s | 0.172351 N |
| 0.125 ms | 9.757 µm | 0.144829 mm/s | 0.090138 N |
| 0.0625 ms | 4.843 µm | 0.072195 mm/s | 0.044681 N |
| 0.03125 ms | 9.139 µm | 0.107309 mm/s | 0.091767 N |

The last two rows extend the preregistered three-step grid diagnostically. Refinement is not monotonic at the finest step; do not claim a fixed convergence order or attribute the reversal solely to float32 without further isolation. All five moving runs still fail the displacement gate, while closure and restart pass. The default maximum translational closure is approximately 1.49e-8 m against 1e-5 m; unloaded rotation is zero. Separate nonzero torque cases exercise angular closure. The static-equilibrium preset passes the implemented trial gates. No solver is selected or rejected generally from this one fixture.

Actual joint reaction impulses are unavailable in this binding. The spring-force channel is reconstructed from state, so it cannot qualify attachment overloads. Energy/work, stops, contacts, loop closure and complete bike assembly remain unexecuted gates. No timing or real-time capability claim is made.

## Browser and visual checks

The local [browser receipt](evidence/iteration-5-browser.json) records isolated headless Edge 156.0.4314.8, 19 screenshots, no captured page/console errors, and all earlier station checks. It checks a real WASM module worker, exact candidate browser/Node channels and metadata, tolerance-checked analytical values, default failure, static pass, refinement controls, replay/pause/step/scrub, dirty/invalid gating, cancellation, restore and hidden/mobile canvas recovery. The downloaded full report is retained in ignored artifacts.

The first complete-report exact comparison exposed analytical JavaScript transcendental rounding, not candidate divergence: largest reference differences were approximately 1.39e-17 m and 1.14e-13 N. The final browser test retains exact candidate comparisons, checks analytical/derived metrics with 1e-12 normalized tolerance, and records actual channel differences. Numerical accuracy limits are unchanged. This is observed agreement for the tested runtimes, not cross-platform determinism promised by the ordinary compat package.

Inspected the final desktop and 390 px screenshots, plus the earlier 320 px view. Fixed compressed plot-heading/legend spacing found during inspection. Controls, units, failed thresholds and unavailable reactions are readable; narrow readouts wrap and tables remain inside their panel. These are automated headless interactions and inspected captures, not native input/display or participant feedback. The bundled Playwright browser was absent locally; verification used an existing Edge executable with an isolated profile. Hosted CI uses the existing pinned Chromium installation.

## Review and next gate

Reviewed all new module consumers (worker, viewer, CLI, browser and unit tests), fixture signs, f32 timestep identity, bound/resource checks, ownership/freeing of worlds, snapshot scope, static paths/MIME, vendored integrity/licence and dirty/cancellation controls. Added the three-axis torque probe when review found that zero applied torque did not challenge angular closure. Tests retain the failed release rather than silently loosening its limits. No identified blocker remains for publishing this explicitly bounded feasibility station.

Next implement the matched MuJoCo arm and compare the same physical fixture, including reaction observability. Then complete the energy/work, geometry/constraint/travel/contact and hardtail/full-suspension assembly matrix before the visible whole-bike rig. The game destination, layered soil/root and tyre mud pickup/shedding/carried-mass contracts remain unchanged.

Hosted checks and deployment receipts are recorded after the implementation commit passes CI.

## Continuation: verified remote head and diagnosed reversal

Verified PR #5 remote head `c6a4cc96145bb122f01bbfc38c60a1fad19c115c` and tree `b05da30ddd0f6ec6d6d396d9cc36ece053f1240d`; the local synchronized tree and vendored module SHA-256 match. That head includes the pagehide/pageshow ResizeObserver lifecycle repair and passed hosted [run 38781295494](https://github.com/CraigHutchinson/BikeLab/actions/runs/38781295494). The repair was retained.

The [timestep diagnosis](TIMESTEP_RESEARCH.md) now explains the previously unassigned reversal using pinned engine source, 50 actual-engine controls and independent rounded-arithmetic controls. The original finest peak is 9.139 µm around 0.205 s. Force balancing removes that early peak but exposes a late 5.665 µm peak around 1.905 s; centring alone retains the early peak. Both together restore refinement in the tested controls. This supports separate accumulated velocity-operation and absolute-position rounding mechanisms, rather than a sign error, wrong reference clock, or merely final-output precision. It is not a complete bitwise error budget.

The production equations, trial parameters, lifecycle fix and accuracy gates remain unchanged. Reports/viewer now distinguish outer dt from the four internal substeps and explain why smaller dt can increase error. The alternate controls are diagnostic only; their changed force paths do not qualify them as real bike replacements. New regressions compare diagnostic/production samples, matched internal steps, crossed engine controls and scalar negative controls. The original 72-test suite plus three diagnostic tests requires hosted CI; local child-process/loopback restrictions still prevent a local complete-suite pass.
