# Relaxed casing cost reference - 17 November 2026

The sampled fine-mesh accuracy result now has a local force-kernel cost reference. This is a measurement increment, not an optimized model or runtime admission. Production physics, timesteps and defaults are unchanged.

| Stations | Median batch mean / evaluation | 95th-percentile batch mean | Sampled fine accuracy gate |
| --- | ---: | ---: | --- |
| 128 | 118.59 us | 182.60 us | Fails some comparisons |
| 256 | 241.82 us | 287.76 us | Passes |
| 512 | 487.58 us | 550.26 us | Passes |

Environment: Windows x64, Node 24.22.0, Intel Core Ultra 9 275HX (24 logical processors). These are descriptive results on this machine. They do not establish a real-time budget, worst-case latency or speed on other machines. The batch tail includes observed scheduling/JIT variability; it is not the distribution of individual-call latency.

## Reproducible scope

The benchmark uses all 42 saved states per mesh: three pressures, two contact phases and seven load/unload points from the [received relaxed reference](TYRE_CONTACT_RELAXATION.md). It verifies the archive hash against the fine-gate receipt and checks each reconstructed state's potential exactly before timing. Accuracy labels come from that receipt, not a node-count assumption or a new relaxed tolerance.

Factories, coordinates and buffers are prepared before measurement. Each arm gets 252 warmup evaluations, followed by fifteen 252-call batches. Each batch visits all 42 states six times. Arm order rotates and reverses on alternating rounds. Results retain every batch, checksum, setup/validation time, warmup time, process CPU time, machine description and source hashes. `configurationMs` includes six factory constructions, coordinate conversion and 42 validation evaluations; it is not an isolated factory cost.

No other agent measurements or local tests ran concurrently. A one-second host preflight observed ChatGPT as the only process using more than 0.15 CPU seconds (0.38 seconds); this was not a dedicated or guaranteed-uncontended machine. The measured batches used 3.296 CPU seconds over 3.310 wall seconds. The script deliberately makes no automatic contention claim for future callers.

The separate Node CPU profile includes startup and warmup. Approximately 69.1% of sampled time is attributed to `evaluate`, 23.4% to `geometry`, and 3.1% to `relaxEndpointInto`. Inlining and sampling affect attribution: these are not exact function timings, a measured optimization speedup, or evidence about per-step allocation. The raw profile stays in local artifacts; the portable summary records its hash and excludes absolute workspace paths. Profiled timings are not substituted into the unprofiled cost report.

[Cost report](evidence/casing-cost.json), [profile summary](evidence/casing-cost-profile.json), and [inspected plot](evidence/casing-cost.svg) preserve the distinction between accuracy and cost. This force-only benchmark excludes native mass solves, contact, integration, recording and rendering. It therefore cannot select a production mesh or stable timestep.

## Next balanced slice

1. Derive a mass/stiffness timestep admission for the actual moving-wheel generalized coordinates, including configured tyre/hub mass and spin coupling. A fixed-hub diagonal-node-mass estimate must not be presented as the coupled native bound. Keep material and native contact limitations separate.
2. Receive loaded timestep refinement and complete simulated-time cost in the native wheel consumer. Compare with the current viewer's measured latency, and keep rendering/recording cost separate. A cheaper force call can lose overall if it requires more substeps.
3. Use the profile and full-step result to select a conservative evaluator/surface reduction, local contact refinement or condensation. Preserve energy gradients, pressure/volume, phase/refinement and unloading gates against the 256/512 reference. Avoid selecting the inaccurate 128-station arm solely because it is faster.
4. Only after that receiving, integrate the same admitted law into trail-bike and separately specify near-rim/insert response. #95 remains open and uncalibrated.

```
node scripts/tyre-casing-cost.mjs
node --cpu-prof --cpu-prof-dir=artifacts/casing-cost/profile scripts/tyre-casing-cost.mjs artifacts/casing-cost/profile
python scripts/summarize-casing-profile.py
python scripts/plot-tyre-casing-cost.py
```

Create the profile output directory before the profiling command. The main benchmark asserts source stability and input/reference agreement. Local quick checks pass **99/99**; the [dirty-worktree receipt](evidence/casing-cost-quick.json) is not an exact-commit attestation. No physics or interface code changed, so the prior PR107 full Node/Edge evidence retains its original scope; no new full-suite or browser pass is claimed.
