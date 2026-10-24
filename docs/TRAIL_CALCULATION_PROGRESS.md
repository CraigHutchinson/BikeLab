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

At this first checkpoint only the native-view optimization and its local evidence are implemented. Progress UI, the full suite and browser receiving remain pending. Preserve all physical limits, component-failure, layered terrain, active-rider and 3D goals; no solver fidelity reduction is part of this pass.

## Progress implementation checkpoint

The next increment implements that contract in the Trail bike engine, worker and page. `run(scenario, onProgress)` accepts an optional synchronous observer with scalar arguments `(phase, acceptedSteps, totalSteps, dt)`. Phases are `preparing`, `initializing`, `integrating` and `finalizing`. `acceptedSteps * dt` is simulation time, not elapsed wall time. The observer receives no native views; callback failure rejects the calculation and native owners are released. It is runtime instrumentation, never a scenario field or exported record channel. Existing one-argument calls and replay remain supported.

Preparation is indeterminate. Integration publishes at approximately one-percent accepted-step checkpoints (at most 105 callbacks including phase/final notifications); all endpoint guards, command reevaluation, work updates and requested recording precede the callback. The final accepted count is forced after rollback/recording. Initial/assembly rejection never claims accepted motion. Worker publication checks wall time only at those bounded checkpoints, throttles ordinary updates to at most 10 Hz, and always sends stage/final updates. There is no timer or callback allocation on every integration step and no native view retained across callbacks.

The page shows an accessible progress bar, percentage, simulated seconds and accepted/total steps, with a short companion status beside the calculate controls. Finalization remains busy until the result arrives. A complete result shows 100%; model-limit termination retains its partial accepted fraction; rejected setup shows zero. Cancelled/failed work explicitly says no new run was kept. Edits/restore clear the old progress. Revision checks cover progress, result and error callbacks; synchronous worker construction/post failures also clear busy state. Calculation clocks and recording stay independent of display/worker publication time.

Five focused checks pass locally: unchanged complete observed/unobserved results for both rider modes on both bikes, bounded/monotonic counts through completion/termination/rejection, observer-failure recovery, actual native-memory growth, and progress on the existing injected post-command rollback control. GPT-6.1 Sol reviewed source and receiving tests without workloads. Its startup-failure and active-replacement/mobile-capture findings were addressed.

Full `node --test` and the 20-case final parity matrix are in progress at this checkpoint. The browser gate now also covers actual intermediate progress, asserted active 390/320 px captures, deterministic cancellation and direct active replacement, stale callbacks, runtime/startup errors, completed/rejected/terminated counts and complete canonical records within the existing 1e-9 budget. Actual browser receiving and capture inspection remain pending; local loopback is unavailable in this environment. A separate `calculation-evidence` artifact preserves those captures and records without increasing the prior large archives. The initial optimizer-only timing receipt above must not be described as a measured UI/worker-transfer speedup.
