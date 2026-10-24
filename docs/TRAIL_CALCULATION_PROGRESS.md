# Trail calculation optimization and progress

## Reviewed baseline and first optimization, 2026-10-24

PR25 is received and merged at `6123f1faffc28486ec248f945347db01b3b075c0`. Both its implementation run `40047997172` and final-head run `40048900979` pass both OS suites and browser checks. The implementation's `rider-pose-evidence` archive (`12543260840`, 1,789,306 bytes, SHA-256 `7dd805d4bb76cd9812e3562d707ea60a718986bf846b3efff81013c5a6089f79`) was downloaded and inspected: all four desktop poses and 390/320 px panels on both bikes, with the expected COM/domain values and no clipping. Identical image bytes were checked where the independent study is the same on both bike modes. Pose report maximum browser/Node difference is 1.11e-16 against the unchanged 1e-12 budget. This supersedes pending receiving notes in the prior handoff; no active sitting/standing claim follows.

The optimization follows the [reviewed native-view plan](PR23_GAP_REVIEW.md#next-independent-optimization-reviewed-2026-10-23). Native property conversion creates a fresh typed-array view on every read (`mujoco.js:5473,5742`); memory growth replaces the backing buffer and refreshes native views (`6475`). Inside one `observe()` work loop, `qvel`, `qfrc_damper` and `qfrc_constraint` are now fetched once after forward/energy evaluation. Their lexical scope ends before any further native call or observer callback. Arithmetic, summation order, integration, guard/rollback ordering and physics parameters are unchanged. This is not a run-wide cache.

[Initial evidence](evidence/trail-observer-optimization.json) records **20 exact complete-record comparisons** on both bikes: legacy guided/fixed, canonical guided/fixed, commands, 1.5 s trail, articulated motion, canonical launch/fresh state, initial rejection and natural guided/articulated termination. The existing injected post-command rollback test passes. A new test forces actual native memory growth after integration has begun, verifies old views detach, and compares the whole grown result exactly with an ungrown control.

Public getter instrumentation on one identical 3,200-step full-suspension guided run reduces the three tracked getter conversions from **5,087,962 to 1,717,309**. The work-loop-specific count falls from `4 * nv` to three per observation. These are getter/view-conversion counts, not native-array copy bytes or a heap-peak measurement. Both instrumented runs have the same complete-record hash.

Separate serial warmed timing, with one warm-up and three measured repeats per engine in alternating order, gives the following median whole-run reductions for 0.1 s cases: full guided **15.23%**, full articulated **13.77%**, hardtail guided **15.38%**, hardtail articulated **14.41%**. All complete and preserve exact record hashes. The receipt stores every raw sample, runtime, CPU and source hashes. These are shared-worker observations with uncontrolled host load; they are not target-device latency, tail latency or a real-time qualification. No other local simulation/test/measurement workload ran concurrently. Timing is separate from getter instrumentation and memory-growth testing.

Reproduce from a separate unchanged baseline tree:

```sh
node scripts/trail-optimization-review.mjs /path/to/baseline/dist/trail-bike.js parity artifacts/optimization/parity.json
node scripts/trail-optimization-review.mjs /path/to/baseline/dist/trail-bike.js getters artifacts/optimization/getters.json
node scripts/trail-optimization-review.mjs /path/to/baseline/dist/trail-bike.js timing artifacts/optimization/timing.json
```

## Progress increment contract

The next small increment adds transient observation to Trail bike calculation, independent of scenario/replay records and simulation clocks. Show indeterminate preparation, accepted simulation steps/time and percentage, then finalization. A rejected attempted step must never advance progress; early termination retains its accepted fraction. Completion means the result reached the page, not merely that integration reached its target time.

Use bounded step cadence and worker publication throttling; do not allocate telemetry or read wall time on every native step. Keep native views out of callback scope. Cancellation, edits, restore, replacement calculations, page lifecycle and errors must clear busy state, and the existing revision guard must reject stale progress as well as stale results. Provide an accessible progress bar and readable mobile status. Verify exact observed/unobserved results, natural and post-command rollback counts, and actual browser intermediate progress/cancellation/error behavior before receiving the UI.

The first checkpoint implemented only the native-view optimization. The implementation and receiving results below supersede its pending progress/full-suite/browser status. Preserve all physical limits, component-failure, layered terrain, active-rider and 3D goals; no solver fidelity reduction is part of this pass.

## Progress implementation checkpoint

The next increment implements that contract in the Trail bike engine, worker and page. `run(scenario, onProgress)` accepts an optional synchronous observer with scalar arguments `(phase, acceptedSteps, totalSteps, dt)`. Phases are `preparing`, `initializing`, `integrating` and `finalizing`. `acceptedSteps * dt` is simulation time, not elapsed wall time. The observer receives no native views; callback failure rejects the calculation and native owners are released. It is runtime instrumentation, never a scenario field or exported record channel. Existing one-argument calls and replay remain supported.

Preparation is indeterminate. Integration publishes at approximately one-percent accepted-step checkpoints (at most 105 callbacks including phase/final notifications); all endpoint guards, command reevaluation, work updates and requested recording precede the callback. The final accepted count is forced after rollback/recording. Initial/assembly rejection never claims accepted motion. Worker publication checks wall time only at those bounded checkpoints, throttles ordinary updates to at most 10 Hz, and always sends stage/final updates. There is no timer or callback allocation on every integration step and no native view retained across callbacks.

The page shows an accessible progress bar, percentage, simulated seconds and accepted/total steps, with a short companion status beside the calculate controls. Finalization remains busy until the result arrives. A complete result shows 100%; model-limit termination retains its partial accepted fraction; rejected setup shows zero. Cancelled/failed work explicitly says no new run was kept. Edits/restore clear the old progress. Revision checks cover progress, result and error callbacks; synchronous worker construction/post failures also clear busy state. Calculation clocks and recording stay independent of display/worker publication time.

Five focused checks pass locally: unchanged complete observed/unobserved results for both rider modes on both bikes, bounded/monotonic counts through completion/termination/rejection, observer-failure recovery, actual native-memory growth, and progress on the existing injected post-command rollback control. GPT-6.1 Sol reviewed source and receiving tests without workloads. Its startup-failure and active-replacement/mobile-capture findings were addressed.

The browser gate also covers actual intermediate progress, asserted active 390/320 px captures, deterministic cancellation and direct active replacement, stale callbacks, runtime/startup errors, completed/rejected/terminated counts and complete canonical records within the existing 1e-9 budget. A separate `calculation-evidence` artifact preserves those captures and records without increasing the prior large archives. The initial optimizer-only timing receipt above must not be described as a measured UI/worker-transfer speedup.

## Implementation received, 2026-10-24

PR26 is merged at `3130c89c7607da7729f9aa9b706aac88d4cbb7be`, with the same tree as final PR head `1eb45c6`. [Final-head CI 40092919457](https://github.com/CraigHutchinson/BikeLab/actions/runs/40092919457) also passes both 229-test OS suites and the browser gate. Its downloaded calculation artifact has identical extracted records/reports/captures to the inspected implementation artifact. The receipt's `release` section preserves this final-head evidence; the broader [MTB system review](MTB_SYSTEM_REVIEW.md) records subsequent priorities.

Implementation `84bfb5f4ed92173810f7c573cc9fb08c72e9ea54` passes [run 40074167350](https://github.com/CraigHutchinson/BikeLab/actions/runs/40074167350): **229 tests on each of Ubuntu and Windows**, plus the complete browser/headless suite. [The final evidence receipt](evidence/trail-calculation-progress.json) binds the source hashes, final parity and timing, hosted jobs, browser reports and inspected artifact files. It supersedes the earlier pending receiving status; subsequent documentation-only commits do not change the tested implementation.

All **20 complete final records match the unchanged main baseline exactly**, including natural termination and fresh-state restart. Local `node --test` finished with 36 test files passing and ten CLI/server files failing under confirmed `spawnSync`/loopback `EPERM` restrictions; the hosted suites pass those paths without changes to the tests. Native-memory growth, progress observer recovery and rejected post-command endpoint controls pass.

Pinned Chromium `141.0.7390.37` passes the actual-worker progress and lifecycle checks, with no captured page/console errors. All four additional progress cases have exact complete browser/Node records (the declared 1e-9 budget is unchanged): both bikes complete at 640/640 accepted steps, initial rejection stays at zero, and the natural model limit stops at 4,033/9,600 steps. Injected error/stale callbacks verify cleanup only, separately from those numerical comparisons.

The downloaded `calculation-evidence` archive (`12552649732`, 267,427 bytes, SHA-256 `43f9bdffb5d72610ea0cf4a5ec98eb0b5c59619d2eec80a5f6097a9437532eac`) and full browser-report archive have verified hashes. All **ten progress-panel captures** were inspected. Desktop and 390/320 px active displays show percentage, simulated seconds and accepted steps; the 320 px text wraps inside the panel. Completed results show 100%, rejected setup shows zero, and the model-limit result retains 42%. Cancelled and failed calculations explicitly say no new run was kept. Browser assertions verify active state at capture, page width, busy cleanup and replacement; this is not screen-reader participant testing.

Final serial timing uses the same protocol as the initial series, with **the progress observer disabled**:

| 0.1 s case | Baseline median (ms) | Final median (ms) | Reduction |
| --- | ---: | ---: | ---: |
| Full guided | 3,128.43 | 2,503.72 | 19.97% |
| Full articulated | 3,545.96 | 3,447.55 | 2.78% |
| Hardtail guided | 2,700.35 | 2,359.02 | 12.64% |
| Hardtail articulated | 3,078.54 | 2,639.07 | 14.28% |

Every timed result retains its exact complete-record hash. Keep both series and every raw sample: the final full-articulated result is materially smaller than the earlier optimizer-only observation. These separate shared-host series do not isolate progress overhead or establish a stable percentage speedup. Getter conversion reduction is independently measured; browser transfer time, preparation/finalization latency, cold-start and tail latency remain unmeasured. A one-percent callback cadence bounds callback count, not wall-clock time between updates. This offline engine still requires seconds of computation for 0.1 simulated seconds and is not a qualified real-time game runner.

The requested optimization/progress increment is received. Next physics work remains finite saddle support with separation/recontact and internal work ownership, followed by bounded active sit/stand control. A separate performance increment should measure target-device cold/warm calculation, recording/transfer costs and callback latency before choosing further native-view reuse, recording tiers or multirate/adaptive models. Keep all travel/ultimate guards and the existing component-failure, layered-terrain, sharp-impact and 3D acceptance gates.
