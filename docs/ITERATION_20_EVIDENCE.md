# Iteration 20 native rider construction evidence

Implementation: `20e411958314e1e538d5c0864f545ab76469e830`, with the additional admitted near-straight boundary control in `f92a799d4dd0e5751624c2b462f899425ac16845`. This is the initialization prerequisite for D5a in [PR #23](https://github.com/CraigHutchinson/BikeLab/pull/23), not a completed articulated-rider simulation. The [machine receipt](evidence/iteration-20-native-construction.json) retains full native reports, complete input specifications, comparison results and source SHA-256 values.

## Independent numerical checks

The local full `node --test` run at the implementation head passes **196 tests**, with zero failures and zero skips, on Node 24.22.0. It includes the unchanged connected hardtail/full-suspension cases and historical replay. The three native tests also pass with the subsequent near-straight fixture: bend sine approximately 0.0012 against the admitted 0.001 threshold. No acceptance budget or test was relaxed. The earlier session's process/loopback restrictions do not occur under the authorized desktop execution path.

The native tests compare actual body endpoints, COM and full central inertia; prove four independent constraint rows using separate analytic limb minors and the two zero y rows; compare all Jacobian columns to central differences in dense and sparse native storage; and verify a common rigid launch at translated/rotated carrier states. A locked five-segment tree agrees with one matched aggregate body in mass matrix, bias forces and kinetic/gravitational energy. Both bend branches, changed rider mass, changed trunk COM/inertia and the near-straight boundary are covered. See the [predeclared budgets](ITERATION_20_REVIEW.md#native-construction-gates-declared-before-receiving-the-implementation).

The retained default and opposite-branch browser cases have zero rider mass discrepancy, maximum COM discrepancy 5.56e-17 m, maximum full-tensor component discrepancy 1.12e-15 kg m² and maximum initial attachment gap 2.78e-16 m. Their redundant y rows are exactly zero. These are construction roundoff measurements, not physical accuracy estimates or moving-constraint drift bounds.

The native CLI exports its complete specification and reproduces the same report on reload; unknown CLI flags fail explicitly. GPT-6.1 Sol independently reviewed the pinned-source conventions, native ownership, Jacobians, mass mapping and consumers and found no actionable issue. That review did not execute tests or simulations.

## Browser and regression receiving

The complete local browser suite passes with Edge 156.0.4314.36 and Node 24.22.0:

- Two geometric posture reports: maximum absolute browser/Node difference 8.89e-16.
- Two native posture reports, including body tensors and attachment Jacobians: maximum absolute difference 1.78e-15.
- Both construction comparisons use the declared 1e-12 normalized tolerance.
- All **23 connected-bike exports** pass their existing comparison budget; no captured page or console errors.
- Existing station interaction, input rejection, replay, cancellation, lifecycle and narrow-layout checks pass.

Existing Trail bike desktop square-impact and 320 px braking viewport captures were inspected and remain legible. They still show the guided rider. No articulated rider is rendered by this increment, and these captures are not evidence for that unfinished visual consumer. Full local captures/report are under `artifacts/iteration-20-native-browser`; the committed receipt retains numerical results and the complete check list.

Hosted validation is tracked at [implementation run 39471897499](https://github.com/CraigHutchinson/BikeLab/actions/runs/39471897499) and [boundary-control run 39472778408](https://github.com/CraigHutchinson/BikeLab/actions/runs/39472778408). At the receipt-writing checkpoint the first run's Linux and Windows tests passed; hosted browser checks were still running. Later exact-head status is visible on PR #23. This draft is not ready for D5a merge/release.

## Remaining dynamic acceptance

The native carrier is an explicit 12 kg fixture, and its mass is excluded from the reported rider aggregate. The fixture performs a forward evaluation without stepping time. It contains no passive joint laws, ultimate joint-domain guards, saddle contact, connected-bike force/work routing, active control or manoeuvre. Its regularization is numerical and uncalibrated.

Continue from the [updated handoff](ITERATION_20_HANDOFF.md): independently owned chassis/rider mass, explicit joint rest-angle convention and passive laws, named hand/foot and unilateral saddle load/work routing, then standing/separation/recontact on both connected bikes with shared records, rollback and actual segment visualization. Initial rank and locked-body equivalence do not receive those dynamic gates.

## Subsequent passive joint-law prerequisite

Resumed from remote `92f2b01`; its [exact-head hosted run 39473709573](https://github.com/CraigHutchinson/BikeLab/actions/runs/39473709573) completed successfully. The next increment implements [versioned passive joint laws](RIDER_PASSIVE.md), native rest-coordinate mapping and initial load inspection. Its [machine receipt](evidence/iteration-20-passive-laws.json) contains complete specifications/reports and source hashes. It is still a static constitutive prerequisite, not moving rider acceptance.

All five new focused tests pass locally on Node 24.19.0. They cover configuration ownership and replay, domain/branch rejection, atomic output, independent spring-energy gradients, dissipative damping, native force/potential ownership and initial gravitational potential. Nonzero rest offsets, an offset exceeding π, both bend branches, zero coefficients and changed mass are included. Existing geometric/native construction checks also pass; passive CLI replay is byte-identical and unknown flags are rejected. GPT-6.1 Sol independently reviewed the pinned source and implementation and found no actionable issue; it did not rerun tests.

The full cloud `node --test` completed with **28 test files passing and nine failing**, not a clean full-suite pass. Process-spawning/loopback checks remain restricted (`spawnSync EPERM`, `listen EPERM`), as in the earlier cloud session. The permission-expanded server retry was interrupted. Local browser evidence was not produced; CI now includes two complete browser/Node passive reports at the existing 1e-12 normalized tolerance plus all existing connected regressions. No new articulated-rider screenshot or moving limit enforcement is claimed. Hosted results for this increment must be recorded after its push.
