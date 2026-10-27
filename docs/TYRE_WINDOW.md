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

At 31.25 µs this observes 9.98–10 s every125 µs. Ticks must be safe aligned integers within the run; duration is at least20 ms, cadence125 µs to50 ms and at most300 added intervals. The schedule unions these ticks with ordinary coarse samples, tick zero, every command change and the requested horizon. Duplicates disappear. At most512 scheduled samples are admitted, plus one reserved slot for an early accepted termination endpoint. The helper rounds cadence upward for authored timesteps and derives an integer span; it can choose a slightly longer interval or coarser cadence to fit the available horizon/storage.

Records use `bikelab-trail-bike-tyre-window-0.1`. Ordinary diagnostic records retain their old discriminator and exact output. Observation settings are outside physical identity. Tick-zero recording preserves the existing initial-momentum baseline. A start snapshot is copied into preallocated owned q/v arrays only after state guards, any boundary command and all interval ledgers have been committed. It is materialized after integration. Rejected candidates cannot publish a snapshot. `windowObservation.start` is null if the accepted run never reaches that boundary; incomplete windows cannot generate a fresh comparison.

The start contains original tick/time, compatible scalar state and the index of its complete recorded frame. That frame supplies right-continuous command and work/energy/momentum baselines. The snapshot deliberately omits native solver history: it is not a continuation checkpoint. Fresh commands at/before the boundary become the tick-zero command; later changes through the end tick are shifted by the start tick. Whole-run cumulative ledgers remain unchanged in the uninterrupted record. Compare ledger **increments** from the start frame against fresh-run increments. Additional samples can raise sample-dependent summary maxima without changing physics.

Run `node scripts/tyre-window-review.mjs [directory] short` for both bikes at0.5 s, or `long` for uninterrupted10 s runs followed by fresh20 ms comparisons. The review saves complete records and inputs, hashes, shared-tick trajectory/force differences and ledger-increment differences. No observation adds damping, changes contact regularization or modifies actuation.

Tests cover strict schedule admission, storage overflow, authored timestep handling, deduplicated command/coarse/window samples, both-bike unchanged final states and ordinary shared frames, physical identity, replay, boundary/interior/end command remapping, snapshot ownership, start-at-zero and rejection before/at/inside the window. GPT-6.1 Sol reviewed scheduling, capture and state ownership and identified the authored-timestep helper correction. Hosted/visual receiving and long-run comparison results are separate evidence gates. This slice does not implement IK, constitutive damping, runtime detachment or stable idle.
