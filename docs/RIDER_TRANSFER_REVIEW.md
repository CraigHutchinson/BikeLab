# Matched hold and slow rider transfer — 2026-10-29

This diagnostic separates the response to a small target change from the absolute error already present in the unchanged-target hold. It uses the same [timed target receiver](RIDER_TARGET_DRIVE.md), native physics, passive rider, gains and effort limits. It is not a successful supported crouch, equilibrium or balance controller.

## Receiver and reproducible inputs

In Trail bike, select **Rider targets · held transfer/recovery** or **Rider targets · matched hold control**, then full suspension or hardtail. Each runs for one second with 43 commands and 10 ms observations: initial hold to 0.2 s; transfer to 0.4 s; target hold to 0.6 s; recovery to 0.8 s; recovery hold to 1.0 s. The requested hip moves 2 mm forward and 2 mm down, with 0.002 rad trunk change. The control retains the original pose at exactly the same phase/tick boundaries. Both start from identical native joint coordinates and velocities. Their state identity hashes intentionally differ because identity includes the target sequence.

`node scripts/rider-transfer-review.mjs` writes eight full native records and a report under `artifacts/rider-transfer`: two bikes, control/transfer, and 31.25/15.625 microsecond steps. The [compact receipt](evidence/rider-transfer-review.json) retains generator inputs, normalized-scenario and full-record SHA-256 hashes, native engine metadata, all phase summaries and selected matched samples. Regenerate full normalized inputs using `riderTransferPreset(bike, {control, dt})` from this revision. Full generated records are local artifacts, not checked-in fixtures.

The shared postprocessor reports sampled hip/whole-rider COM/joint error, saturation counts, minimum sampled wheel load and signed phase work. Samples at a phase boundary belong to the new phase; the final phase includes the final observation. Work uses the exact start/end boundary ledger entries. Missing boundaries produce null work, not interpolation. Partial and unreached phases remain explicit; empty intervals have null extrema. The page displays the whole recorded phase summary while scrubbing, not a running estimate through the selected frame. These saved-sample extrema do not establish every-step support or peak load.

## Observed result

All eight runs completed under the existing guards, and every paired frame through 0.2 s is exactly identical. The following values are transfer minus matched hold at 31.25 microseconds; they are frame-local hip displacement, not absolute tracking accuracy.

| Bike | End of target hold, 0.6 s: forward / vertical | End of recovery hold, 1.0 s: forward / vertical |
| --- | --- | --- |
| Full suspension | +2.074 / -2.186 mm | +0.043 / +0.175 mm |
| Hardtail | +2.130 / -2.101 mm | -0.001 / +0.098 mm |

At 15.625 microseconds the corresponding full-suspension values are +2.063 / -2.205 mm and +0.040 / +0.171 mm; hardtail values are +2.132 / -2.075 mm and -0.011 / +0.089 mm. Both time steps show a relative response near the requested 2 mm shift and a final relative hip difference below 0.2 mm. Two steps are a sensitivity check, not a convergence proof or a declared tolerance.

Absolute error remains much larger: peak sampled hip error is about 27 mm for the unchanged full-suspension hold and 29 mm for hardtail. During the final recovery hold, transfer-arm peak hip error remains about 22.8 mm and 21.5 mm respectively. No sampled torque/power saturation occurs. The initial phase includes zero wheel load; later sampled loads are positive, which does not prove uninterrupted support. Final transfer-minus-control rider work is +0.101 J full suspension and +0.090 J hardtail at the coarser step. Absolute rider work remains negative. Returning the target and returning near the matched control are distinct from returning to the requested posture.

## Verification and limits

Eight new synthetic tests independently exercise phase boundary ownership, work differences, partial/unreached intervals, missing boundary samples, malformed observations, matched mechanics/native launch state, and the control/transfer clock contract. All 62 quick-tier tests and vendor provenance checks pass on Windows / Node 24.22.0, including these eight tests. Saved native records were re-read to verify hashes, normalized scenarios, summaries, matched launch joints and exact common-prefix frames. No dynamics or controller gains changed.

The browser regression now receives both examples on both bikes, saves/replays full records, checks phase summaries and captures desktop/mobile panels. Execution and capture inspection remain deferred under the approved unavailable-Edge fallback. Hosted CI and Pages remain paused until deliberate resumption on or after 1 November. This slice does not claim browser agreement, full-suite completion or physical calibration. The parent full-suite receipt retains its unchanged loopback `connect EACCES` failure.

## Consequence for the work plan

The large absolute error predates the requested transfer. This comparison demonstrates a command response on that moving baseline; it does not identify the baseline's cause or isolate numerical error. Do not tune gains or add damping merely to reduce this diagnostic's error.

The separate [stability PR54](https://github.com/CraigHutchinson/BikeLab/pull/54), reviewed at `cb86fc9c43900cca50cfbce5f12db959c922d3cb`, reports missing sibling-node damping derivatives in its contact-free audit. That branch's full-response candidate and connected receiving remain unqualified; its reported diagnosis is not independently reproduced here.

Next independent rider work: characterize unchanged-target hold error against signed attachment loads, joint effort and COM motion, with explicit phase observations and no new feedback gains. This provides a concrete input to the B numerical gate and subsequent support-aware hold design. Once numerical behavior is qualified, declare tracking/support/work budgets and receive supported shift/recovery before adaptive phase policy. The [unified control architecture](RIDER_CONTROL_ARCHITECTURE.md) continues to cover crouch, bunny hop, endo, wheelie, pumping and landing through shared task targets and bounded effort; this slice adds no trick-specific controller.
