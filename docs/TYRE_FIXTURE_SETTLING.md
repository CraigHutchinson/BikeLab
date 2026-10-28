# Longer fixed-hub settling controls

The user correctly noted that 100 ms cannot rule out later settling. This increment extends the existing fixed-hub mechanics to five uninterrupted seconds, with explicit 0.5, 1 and 5 s checkpoints. It also resolves the recording-cadence ambiguity identified by the [100 ms study](TYRE_FIXTURE_DECAY.md): interval statistics now consume every accepted physics endpoint. Physical coefficients, native stepping, timestep bounds and all tyre/contact guards are unchanged.

In `tyre-fixture.html`, choose 0.5, 1 or 5 s. These controls enable measurement automatically. The interval histories show RMS speed, load deviation and maximum node acceleration; the selected interval displays signed work/residual information. Switch the history range to the dense final window to inspect local waveform detail. Worker progress/cancellation and complete JSON save/import/replay remain available. Short legacy controls retain their previous record format and behavior. Calculate control reapplies automatic recording cadence; JSON/import preserves the exact authored observation schedule.

```sh
node scripts/tyre-fixture.mjs saved-measured-input-or-record.json
node scripts/tyre-fixture-settling.mjs artifacts/tyre-fixture-settling
```

The study can be split into `coarse` and `refined` groups with disjoint output names. It saves complete records and source hashes before execution. These are numerical comparisons, not hardware-performance measurements. [Evidence and complete input references](evidence/tyre-fixture-settling.json) preserve all twelve cases.

## Measurement contract

The opt-in `measurement` contains format `bikelab-fixed-hub-observation-0.1`, `binDt`, and a nullable dense `window` with integer `startTick`, `endTick`, `strideTicks`. New records use `bikelab-fixed-hub-measured-0.1`; old model identifiers reject these settings. Observation settings are excluded from physical identity. Native XML, the original summaries, final state and shared frames retain exact equivalence when measurement is enabled.

Measured horizons are bounded to 1 ms–5 s, with the existing 7.8125–62.5 µs timestep admission. At most 250 aligned intervals and 300 coarse recording intervals are admitted. A dense window adds at most 257 points; its union with coarse samples is deduplicated before integration and capped at 600. A final accepted off-grid endpoint is retained after a stop. Controls preserve authored timesteps and choose aligned recording divisors; an authored 40 µs timestep is tested. The default dense window covers up to the last 20 ms at approximately 125 µs cadence.

Preallocated endpoint/interval storage receives each accepted segment only after mechanical/time guards pass. A rejected candidate contributes no duration, maxima, energy or work. Boundaries receive trapezoidal half-weights; partial bins remain explicitly partial. Initial rejection produces no invented statistics. Accumulator overflow is an execution error rather than an exportable domain stop. An off-cadence termination endpoint remains in the complete record but is outside the on-grid dense-window index list. Maximum speed/acceleration retain their node and accepted tick, including zero-valued bins. Contact identities and physical contact-point moments remain sampled diagnostics; the inner loop does not add native contact-object traversal.

Force means and population time variance use the positive-weight central-moment recurrence in [NAG g02btc §3](https://www.originlab.com/pdfs/nagcl09/manual/pdf/G02/g02btc.pdf), with duration weights and no Bessel correction. This avoids subtracting nearly equal raw moments. Kinetic-energy and squared-speed integrals use trapezoidal endpoints. The ledger is `ΔE + Δloss − ΔsignedContactWork`; native gravity and elastic energy are not counted again. These are measurements of the discrete accepted trajectory, not certified continuous-time extrema or proof of convergence.

## Five-second results

All eight bike/wheel/rate starts complete five seconds at 31.25 µs. Full-front/imported and hardtail-rear/zero additionally complete at 15.625 and 7.8125 µs. The shorter checkpoints are prefixes of these uninterrupted paths, not fresh restarts. Each run has fifty 100 ms statistical intervals and 161 points in its final dense window.

Every-step interval RMS speed, **mm/s**, over the fixed intervals ending at each checkpoint:

| Start / timestep | 0.4–0.5 s | 0.9–1.0 s | 4.9–5.0 s |
| --- | ---: | ---: | ---: |
| Full front, imported / 31.25 µs | 4.069 | 4.322 | 4.575 |
| Full front, imported / 15.625 µs | 2.212 | 2.204 | 2.156 |
| Full front, imported / 7.8125 µs | 1.556 | 2.192 | 2.946 |
| Hardtail rear, zero / 31.25 µs | 5.282 | 8.792 | 14.468 |
| Hardtail rear, zero / 15.625 µs | 5.428 | 7.533 | 9.639 |
| Hardtail rear, zero / 7.8125 µs | 5.382 | 9.101 | 14.775 |

More duration alone does not establish settling in these controls. Motion remains nonzero and the timestep dependence is not uniformly monotonic. Full-front maximum energy residual over five seconds is approximately 0.367/0.108/0.0359 J across the three steps. Hardtail-rear/zero is approximately 0.365/0.00788/0.0282 J. Discrete final-interval node accelerations reach thousands of m/s²; these are local casing/contact endpoint quantities, not rider acceleration or calibrated damage predictions. The observations do not prove asymptotic instability, a unique mechanism, or that still longer runs could never relax.

## Validation and next work

Independent tests compare weighted moments with two-pass references, every-step interval statistics with dense native traces, and opt-in/out or recording-cadence variants with exact physical-state/summary equality. Boundary failures verify accepted-prefix statistics and maxima; malformed inputs, bounded storage, replay discriminators and authored-timestep scheduling are checked. The full local test invocation passes 46 files with the same eleven subprocess/loopback-restricted failures. The UI scheduling helper added afterward has its focused checks. New hosted tests, measured-mode worker replay and actual 0.5/5 s captures remain pending. Prior PR50's 100 ms browser receiving is complete.

The [feedback plan](ISSUE_WORK_PLAN.md) incorporates #48's solver-versus-material compliance distinction and #49's sharp-rock refinement/event proposal. Contact-free derivative controls reported in the separate PR46 branch still need independent receiving. Reproduce those and the isolated normal-row compliance before selecting damping or changing stepping. Longer runs do not remove those gates. Geometry labels and mandatory terrain publication remain separate small correctness tasks; whole-bike perturbation recovery, 60 s idle, rider control/IK, detachment, terrain materials, damage and eventual 3D remain the product destination.
