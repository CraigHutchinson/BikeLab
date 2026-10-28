# Fixed-hub 100 ms study

PR47's [fixed-hub control](TYRE_FIXTURE.md) is merged at `a757109`. It received both OS test suites, complete browser replay and actual desktop/mobile inspection. This follow-up extends the **existing** admitted control to 100 ms; it changes no physical coefficients, guards, native integration or state initialization. The four 9.98 s source seeds retain their loaded shapes, including when local node velocities are set to zero.

Run `node scripts/tyre-fixture-decay.mjs artifacts/tyre-fixture-decay`. The runner saves complete inputs/records, source and record hashes, accepted-step progress, five 20 ms interval summaries, and matched timestep comparisons. Open `tyre-fixture.html`, choose 100 ms, or load any generated record to inspect it through the existing viewer. The [receipt](evidence/tyre-fixture-decay.json) preserves all input overrides, hashes and numerical findings.

## Controls and interpretation

The 24 primary runs cover both wheels on both bikes, imported/zero local rates and 31.25/15.625/7.8125 µs integration steps. All complete 100 ms with 500 µs observations. Twenty-four dense 20 ms controls use 125 µs observations; their complete record hashes exactly match the original study, and all 41 shared prefix frames agree. Eight finest-step alternate runs use 625 µs observations; their 41 shared frames, final complete node states and all-step summaries exactly match the 500 µs runs.

Each interval uses integer step boundaries. Mean kinetic energy, RMS speed and force variation are trapezoidal estimates from **saved samples**, with shared endpoints receiving their proper half-weights. Contact-set changes and maxima are sampled observations, not continuous event counts or extrema. The 500 µs cadence has a 1 kHz Nyquist limit; a second cadence probes sensitivity but cannot certify all contact transients. The unchanged all-step peak force and energy-residual summaries remain separate.

The ledger is `ΔE + ΔdampingLoss − ΔsignedContactWork`, using shared interval endpoints. Native energy already includes gravity and elastic storage. All recorded damping increments are positive and pass the declared 1e-12 J monotonicity tolerance. Signed contact work can be negative; it includes soft-contact storage/release and is not all dissipation. No clamp work, extra energy or corrective force is introduced. Partial/rejected runs retain their reason and incomplete intervals; unavailable comparisons are explicit and cause a nonzero study exit status.

## Findings

Finest-step RMS speed estimated from 500 µs samples, in **mm/s** (records use SI):

| Wheel / initial rates | 0–20 ms | 20–40 ms | 40–60 ms | 60–80 ms | 80–100 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full front / imported | 1.547 | 1.531 | 1.306 | 1.374 | 1.487 |
| Full front / zero | 1.247 | 1.316 | 1.350 | 1.368 | 1.343 |
| Full rear / imported | 7.001 | 7.074 | 7.135 | 7.195 | 7.294 |
| Full rear / zero | 4.551 | 4.631 | 4.762 | 4.888 | 5.021 |
| Hardtail front / imported | 1.738 | 1.012 | 1.211 | 1.763 | 0.991 |
| Hardtail front / zero | 1.396 | 1.386 | 0.934 | 1.307 | 1.582 |
| Hardtail rear / imported | 7.631 | 7.681 | 7.692 | 7.779 | 7.860 |
| Hardtail rear / zero | 4.267 | 4.324 | 4.393 | 4.443 | 4.478 |

These samples do not demonstrate settling. Rear values increase modestly across the five intervals; front estimates vary with phase and cadence. For the hardtail-front imported-rate 20–40 ms interval, changing only recording cadence from 500 to 625 µs changes the RMS estimate from 1.012 to 1.418 mm/s, about 40%. Shared frames and the complete final state remain identical: the estimator changes, not the simulated trajectory.

Timestep sensitivity also remains. In the final interval, the full-front imported-rate fine/finest comparison reaches a sampled node-0 velocity difference of 0.0354 m/s and vertical-load difference of 28.45 N. The hardtail-front imported-rate velocity difference reaches 0.0582 m/s. Finest-step full-front maximum all-step residual grows from about 0.000136 J over 20 ms to 0.000712 J over 100 ms. The final-interval residual increment is about 0.000145 J, larger than its sampled mean kinetic energy of 0.00000111 J. These are reasons to retain numerical qualification limits, not a diagnosis of a particular contact law or a direct error bound on kinetic energy.

Zero-rate starts retain stored deformation and can accelerate. Neither persistence nor decline over 100 ms establishes equilibrium, asymptotic stability, a calibrated decay constant or the cause of motion. This remains a fixed-boundary control; it does not qualify whole-bike idle or rider posture control.

## Receiving and next increment

Eight focused checks pass, including the existing fixture/static-page checks. Independent arithmetic checks cover time weighting, interval boundaries, signed work, cadence-statistic differences, incomplete runs, monotonicity reporting and malformed observations. The headless study saves all 56 complete records and 16 refinement comparisons. GPT-6.1 Sol reviewed the analysis and receiving code. New hosted browser checks complete full-front/imported and hardtail-rear/zero 100 ms controls at the finest step and export final panel/RMS captures; [hosted run 40659445351](https://github.com/CraigHutchinson/BikeLab/actions/runs/40659445351) at `fa3b5a3` now passes the full browser suite and 272 tests on each OS. All eleven downloaded records replay exactly on the receiving machine. The ZIP digest matches and both 100 ms final panels/RMS histories were visually inspected: the casing/contact rendering, final time/progress and persistent sampled waveforms are visible. The initial mobile failure used a fixed 50 ms resize delay; the receiver now waits for actual matching canvas dimensions. The earlier 20 ms visual evidence remains valid for its stated scope.

Next add bounded interval statistics at every accepted physics step and a dense late-time observation window. Preserve progress, replay, accepted-prefix rollback and preallocated integration storage. Compare those measurements with saved-sample estimates before changing damping. Whole-bike perturbation recovery, 60 s idle, support-aware rider/IK and saddle/detachment follow; this study does not advance the separate calibrated damage, layered terrain, 3D or real-time gates.
