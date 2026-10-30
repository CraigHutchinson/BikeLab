# Larger retained-rider crouch/recovery — 2026-10-30

Build on the versioned runtime controller in PR68, independently of stability PR54. The next consumer is a visible lowering, hold and recovery through the same sampled target producer and bounded effort path. No new force tables, gains, root actuation, passive-domain expansion or contact law is introduced.

## Declared experiment and budgets (before simulation)

Default vertical hip displacement is 5% of configured thigh-plus-shank length (43 mm at the default body); hip x and trunk pitch retain their starting values. Request five phases of 0.5 s: initial hold, lower, crouch hold, rise and recovery hold. Each move has 20 linear target increments. The matched hold uses identical phase/tick timing and the original pose throughout. IK validates each requested target against the original passive domains; an infeasible request fails rather than being clipped.

The assessment is a saved-sample experiment screen, not a continuous-support or manoeuvre certification. The following budgets are frozen before receiving runs:

- Complete the full 2.5 s without a mechanical-domain termination.
- From lowering onward, sampled hip tracking error <= 25% of requested displacement (10.75 mm for default geometry).
- At the end of crouch hold, achieve 80–120% of requested lowering relative to the initial commanded hip height.
- At final recovery, hip error <= 3 mm.
- From lowering onward, each wheel's recorded vertical load >= 1% of total configured system weight, and static-effort eligibility remains two-wheel contact at each saved sample. These thresholds are protocol policy, not a friction or support-feasibility model.
- No saved sample may report torque/power saturation. Existing held-speed/power and passive-domain guards remain the physical admission path.
- Absolute net rider work over the run <= three times rider mass * gravity * requested displacement. This is a dimensionless comparison budget, not total positive work or metabolic energy; cancellation is possible and phase work must also be reported.

Zero gravity cannot pass the weight-normalized screen. Missing phases, missing samples, incomplete data or a failed control cannot masquerade as a pass. Refinement compares matched 31.25 / 15.625 microsecond runs; target clock and saved cadence are independent of integration. No controller tuning follows a failed screen without a separate documented decision.

Receive both bikes, masses 20/70/100 kg, matched 70 kg hold controls and 70 kg timestep refinement. UI displays the requested versus observed lowering, the individual budgets and partial/failed status alongside existing effort/load/work diagnostics. Browser checks remain pending; the user authorized an Edge retry, then requested a quota holding state before it ran. Hosted CI/Pages remain paused.

## Receiving result and holding state

All ten 2.5 s runs completed: both bikes at 20/70/100 kg, matched 70 kg unchanged-posture controls, and 70 kg half-timestep runs. Every moving case fails only the frozen tracking budget (10.75 mm). No budget was relaxed and no gain or effort law was tuned. The other saved-sample budgets pass; controls remain labelled controls, not crouch passes.

| Bike | Rider kg | Observed lowering mm | Peak tracking error mm | Final error mm | Net rider work J |
| --- | --- | --- | --- | --- | --- |
| full | 20 | 45.082 | 16.601 | 0.845 | 0.477 |
| full | 70 | 46.074 | 15.939 | 1.289 | 0.901 |
| full | 100 | 47.618 | 18.426 | 1.632 | -0.536 |
| full | 70 (half dt) | 46.075 | 15.932 | 1.291 | 0.896 |
| hardtail | 20 | 45.059 | 16.562 | 0.841 | 0.310 |
| hardtail | 70 | 45.011 | 15.617 | 0.441 | -1.503 |
| hardtail | 100 | 44.936 | 16.533 | 0.346 | -3.471 |
| hardtail | 70 (half dt) | 44.950 | 15.619 | 0.442 | -1.501 |

At 70 kg, maximum matched coarse/fine hip differences are 0.0404 mm (full suspension) and 0.0711 mm (hardtail); final differences are about 0.0022 mm. This limited refinement does not qualify every-step contact, solver residuals, tyre convergence or other runtimes. Matched-hold comparisons and phase work are retained in [the complete summary receipt](evidence/rider-crouch.json), alongside record hashes, peak-error decomposition and source identities. Complete raw records remain in local ignored `artifacts/rider-crouch-matrix`; `node scripts/rider-crouch-review.mjs` regenerates them.

The final observer reproduces all ten original assessments, and all ten record hashes match. Six crouch tests cover independent ideal samples, each failed budget, malformed/partial records, control identity, configured geometry and clock rejection. Eight existing transfer presets remain unchanged. The full local suite passed 335/336: the sole failure is sandbox loopback `connect EACCES 127.0.0.1`. Clean implementation commit `3a05ffbd42047ec11a80ff22b1bb55f76d2534d5` passed 90/90 quick checks plus vendor hashes. These checks are not a full/browser or hosted attestation.

## Next balanced slice

First finish browser receiving: the previously authorized #39 Edge retry, then both-bike crouch/control selection, visible budget failures, export/replay and 320 px layout. This remains pending at the user's requested quota checkpoint.

The next numerical experiment should compare a versioned reference-velocity feedback policy against this unchanged baseline, using rates derived from the requested geometry and command clock through the same bounded drive. Current damping uses actual joint velocity alone; at the full-suspension 70 kg peak lag, it substantially opposes the position-feedback term. This motivates a test, not a causal proof or an instruction to increase gains. Define target-rate interpolation, command-boundary ownership, serialized record identity and replay before implementation; retain the frozen crouch budgets and both-bike mass/refinement/control matrix.

Only after supported tracking is received should support-transition policy extend the shared loop to endo/wheelie and hop/flight/landing. Keep PR54 and contact/solver qualification separate. No accepted crouch, one-wheel balance, hop, physical calibration or continuous-support claim follows from this checkpoint.
