# Uninterrupted tyre observation window

This increment tests a limitation of the [fresh tyre probe](TYRE_MOTION.md): importing coordinates resets native warm start/history. It adds samples to the original run and captures a compatible physical state at an accepted window boundary. It does not pause, rebuild or reset that run. Comparison with a fresh reconstruction measures restart sensitivity; neither agreement nor disagreement establishes equilibrium or a unique cause of casing oscillation.

After a completed active run, **Observe final interval (~20 ms)** reruns the same initial setup and full horizon with extra late samples. The tyre history plots focus on that interval. **Restart observation window fresh** imports the captured start state, resets time/warm start/work and remaps the commands inside the window. Both actions retain progress, cancellation, saved records and headless replay. The original **Inspect tyre motion** still probes from the final state instead.

Explicit configuration:

```json
{
  "diagnostics": "bikelab-tyre-motion-0.1",
  "observationWindow": {
    "format": "bikelab-tyre-window-0.1",
    "startTick": 319360,
    "endTick": 320000,
    "strideTicks": 4
  }
}
```

At 31.25 µs this observes 9.98–10 s every 125 µs. Ticks must be safe aligned integers within the run; duration is at least 20 ms, cadence 125 µs to 50 ms and at most 300 added intervals. The schedule unions these ticks with ordinary coarse samples, tick zero, every command change and the requested horizon. Duplicates disappear. At most 512 scheduled samples are admitted, plus one reserved slot for an early accepted termination endpoint. The helper rounds cadence upward for authored timesteps and derives an integer span; it can choose a slightly longer interval or coarser cadence to fit the available horizon/storage.

Records use `bikelab-trail-bike-tyre-window-0.1`. Ordinary diagnostic records retain their old discriminator and exact output. Observation settings are outside physical identity. Tick-zero recording preserves the existing initial-momentum baseline. A start snapshot is copied into preallocated owned q/v arrays only after state guards, any boundary command and all interval ledgers have been committed. It is materialized after integration. Rejected candidates cannot publish a snapshot. `windowObservation.start` is null if the accepted run never reaches that boundary; incomplete windows cannot generate a fresh comparison.

The start contains original tick/time, compatible scalar state and the index of its complete recorded frame. That frame supplies right-continuous command and work/energy/momentum baselines. The snapshot deliberately omits native solver history: it is not a continuation checkpoint. Fresh commands at/before the boundary become the tick-zero command; later changes through the end tick are shifted by the start tick. Whole-run cumulative ledgers remain unchanged in the uninterrupted record. Compare ledger **increments** from the start frame against fresh-run increments. Additional samples can raise sample-dependent summary maxima without changing physics.

Run `node scripts/tyre-window-review.mjs [directory] short` for both bikes at 0.5 s, or `long` for uninterrupted 10 s runs followed by fresh 20 ms comparisons. The review saves complete records and inputs, hashes, shared-tick trajectory/force differences and ledger-increment differences. No observation adds damping, changes contact regularization or modifies actuation.

Tests cover strict schedule admission, storage overflow, authored timestep handling, deduplicated command/coarse/window samples, both-bike unchanged final states and ordinary shared frames, physical identity, replay, boundary/interior/end command remapping, snapshot ownership, start-at-zero and rejection before/at/inside the window. GPT-6.1 Sol reviewed scheduling, capture and state ownership and identified the authored-timestep helper correction. This slice does not implement IK, constitutive damping, runtime detachment or stable idle.

## Received comparison

PR36 implementation `45bc899` passed all 265 tests on both Ubuntu and Windows in [run 40477012147](https://github.com/CraigHutchinson/BikeLab/actions/runs/40477012147). Browser checks passed; all four new complete worker records replay exactly locally. Actual desktop/320 px diagnostic panels and the hardtail history capture were inspected. The [receipt](evidence/tyre-window.json) preserves artifact/record/capture hashes, complete comparison inputs and local validation limits. Pages packaging/deployment was skipped on the PR.

Both original 10 s runs completed 320000 steps at 31.25 µs. Their final states exactly match the prior PR34 runs. Each final 9.98–10 s interval contributes 161 matched observations at 125 µs spacing. The largest differences across both bikes and wheels were:

| Compared quantity | Maximum absolute difference |
| --- | ---: |
| Node-0 position vector | 1.62 × 10⁻¹³ m |
| Node-0 velocity vector | 1.37 × 10⁻¹⁰ m/s |
| Vertical wheel force | 7.96 × 10⁻⁸ N |
| Rider COM vector | 3.51 × 10⁻¹⁵ m |
| Energy increment | 2.51 × 10⁻¹² J |
| Residual increment | 1.42 × 10⁻¹² J |

Fresh reconstruction reproduces the inspected uninterrupted motion to negligible differences in these windows. Resetting history does not explain their activity. This does not establish that solver history is irrelevant for other states, timesteps or durations, or identify a unique remaining cause. In particular, the uninterrupted whole-run residual maxima of roughly 1.3 J and fresh-window maxima of 0.0013–0.0024 J cover different horizons. Only their matched increments are comparable here.

The uninterrupted windows still reach sampled maximum local node speeds of 0.070/0.048 m/s (full front/rear) and 0.112/0.114 m/s (hardtail front/rear). Sampled local accelerations reach approximately 4284 m/s² on a low-mass casing coordinate; this is not rider acceleration. No stable-idle or long-term decay gate is passed.

Provenance qualification: the long process imported the helper before its authored-timestep correction. Its recorded source hashes were collected at completion and must not be described as hashes of the loaded helper bytes. Both exact recorded default inputs are reproduced by the final helper, and both saved fresh records replay exactly under final source. The integration/capture/restart implementation did not change during execution. The receipt retains this distinction instead of asserting an unavailable loaded-source hash.

## Following control

The separately identified [fixed-hub loaded casing fixture](TYRE_FIXTURE.md) now implements this next control; its hosted receiving remains separate. It precedes changes to constitutive damping or contact regularization. Transfer one wheel's accepted hub transform, local node displacements and rates into the same ring/contact mechanism. Preserve node masses, spring/rest geometry, edge viscosity, gravity and flat-contact settings. Explicitly hold the hub stationary, removing rider, suspension and hub-motion feedback; this diagnostic boundary is not a replacement whole-bike model or solved equilibrium.

Compare the imported moving-node state with a separately labelled zero-node-velocity control at the same positions, then repeat at the existing refined timesteps. Keep the initial stored energy, gravity potential, signed contact work, nonnegative viscous loss and fixture reactions in the accounting. The stationary fixture performs zero work. A distinct identity and explicit wheel-state adapter must prevent bypassing whole-bike state compatibility.

Deliver the fixture with a visible wheel/contact/history consumer, headless input/replay, progress/cancel and independent force/energy/admission tests. Persistence would show that casing/contact activity can occur without whole-bike feedback; disappearance would motivate measured hub-motion replay. Neither outcome alone justifies extra damping. Compatible perturbation recovery, a 60 s idle gate and support-aware rider/IK control remain subsequent work.
