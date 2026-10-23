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

The full cloud `node --test` completed with **28 test files passing and nine failing**, not a clean full-suite pass. Process-spawning/loopback checks remain restricted (`spawnSync EPERM`, `listen EPERM`), as in the earlier cloud session. The permission-expanded server retry was interrupted. Local browser evidence was not produced; CI now includes two complete browser/Node passive reports at the existing 1e-12 normalized tolerance plus all existing connected regressions. No new articulated-rider screenshot or moving limit enforcement is claimed. Implementation `e1de599` is pushed. [Hosted run 39500226732](https://github.com/CraigHutchinson/BikeLab/actions/runs/39500226732) passes **201 tests on both Linux and Windows**, with zero failures/skips. Chromium 141.0.7390.37 passes both passive reports and both native construction reports with **zero difference** against Node, plus all **23 connected-bike exports exactly**. Geometric posture comparison differs by at most 1.11e-16; no page/console errors were captured. This receives static law/regression checks only; D5a remains incomplete.

## Named interface observation, 2026-10-21

Implementation `4ad46a59243501b6d1490083c95a5c01da9b1dda` adds [named hand/foot force and work observation](RIDER_INTERFACES.md) to the native/passive inspection consumers. The [machine receipt](evidence/iteration-20-rider-interfaces.json) retains all four complete input specifications, browser/headless interface reports, comparison errors, declared budgets, check descriptions and raw local source hashes. Report versions are native 0.2 and native-passive 0.2; input formats and connected Trail bike records are unchanged.

The full local suite passes **206 tests, zero failures/skips** on Node 24.22.0. A subsequent test-only cleanup adjustment also passed its focused CLI test. New independent checks verify site velocities by central position differences, point-force ownership against native RNE body loads, generalized force/work projection, dense/sparse layouts, changing activation and row indices, unrelated equality/brake/contact rows, atomic failures, actual WASM backing-memory growth and copied output ownership. All three CLI modes now have automated canonical replay and invalid-input coverage. The separate connected post-command endpoint rollback follow-up remains open.

The complete local browser suite passes with **Edge 156.0.4314.36**. All **23 connected-bike exports** pass their existing comparisons, and no captured page/console errors occurred. Both native and both passive reports include interface loads: maximum normalized browser/Node interface difference is **6.12e-11** against the predeclared **1e-9** force/work/moment budget. Other native/passive construction fields differ by at most **8.00e-14** and retain the existing **1e-12** normalized construction budget. These measure numerical agreement, not physical accuracy. The complete report and captures are under `artifacts/iteration-20-interfaces-browser`; this increment changes no visible simulation geometry or UI.

At this receipt's writing checkpoint, [implementation CI run 39562528032](https://github.com/CraigHutchinson/BikeLab/actions/runs/39562528032) has passed Linux and Windows tests; its hosted browser job is still running. Later status belongs to that run and the current PR head. No merge or Pages deployment is claimed.

The observer only reads a coherently refreshed state and never applies forces or advances time. It returns the numerical pair moment separately; it does not yet replace the guided-bike root-wrench shortcut in an articulated connected run. Saddle contact, independent chassis mass/inertia, dynamic domains/rollback, moving closure/refinement and actual segment visualization remain required for D5a. The [seated/unseated research](RIDER_SEATED_UNSEATED.md) records later measured rider choice and active posture work; none of these numerical checks calibrates human behaviour or a real-time game tier.


## First moving unseated rider, 2026-10-21

Implementation `e312974ac15b3bef9028d3e9a7f60b86e3544630` connects the passive rider to both Trail bike assemblies and adds actual native segment visualization. [Declared gates and results](RIDER_CONNECTED.md) link the [source-hashed receipt](evidence/iteration-20-connected-rider.json). Ten 0.1 s receiving runs complete, including three timesteps and a separate closure-time sensitivity control for both bikes. Maximum default closure gaps are 0.779 / 0.705 mm; energy-balance errors are 0.0191 / 0.0131 J or smaller. Timestep refinement reduces energy and sampled momentum residuals without eliminating the finite soft-closure gap. Whole-rider COM, seven native coordinates/velocities and segment COM velocities are retained.

Seven connected tests pass locally, including independent rotating whole-system momentum and exact rollback of two post-command numerical faults. The full cloud `node --test` reports 30 passing test files and ten failures in process/loopback-dependent files; direct CLI/server diagnostics report `spawnSync EPERM` / `listen EPERM`. The unchanged legacy full-flat result matches its prior complete-output hash. Hosted [implementation run 39631713678](https://github.com/CraigHutchinson/BikeLab/actions/runs/39631713678) passes **213 tests on each of Ubuntu and Windows**, zero failures/skips. Chromium **141.0.7390.37** passes all **29 complete Trail bike comparisons exactly**, with no captured page/console errors. Downloaded desktop and 390/320 px captures for both bikes, plus the joint-domain stop, were visually inspected; limbs/wheels remain in view and the last-accepted stop is explicit. The [browser receipt](evidence/iteration-20-connected-browser.json) retains the complete browser report and inspection/hash metadata. This is hosted visual evidence; local loopback remains restricted.

Do not infer saddle support, equilibrium, anatomy, collision/strength calibration, active manoeuvres, 3D or real-time suitability. D5a and PR #23 remain incomplete/draft. The next [saddle increment plan](RIDER_SADDLE_PLAN.md) includes the source-checked parent/child collision-filter trap and separate contact/work routing; it adds no mechanics yet.


## Signed rider support display received, 2026-10-22

The desktop continuation fast-forwarded six upstream commits to `795cffd`, reviewed the moving rider and support display, and repaired its pending browser gate in `c3ae724`. The page correctly disabled rider history options; Playwright's `elementState` followed the enclosing label from the option to its enabled select. The test now checks the option's native `disabled` property and `:disabled` state, and checks that keyboard navigation skips both unavailable channels. No application physics or comparison tolerance changed. [Pinned Playwright implementation](https://github.com/microsoft/playwright/blob/v1.56.1/packages/injected/src/injectedScript.ts#L642).

The [support receipt](evidence/iteration-20-support-browser.json) records source blobs/hashes, the hosted report, separate local outcomes and nine inspected capture hashes. **213 local tests pass** on Node 24.22.0, with no failures/skips. [Implementation CI](https://github.com/CraigHutchinson/BikeLab/actions/runs/39744331686) passes **213 tests on each OS** and the full pinned Chromium **141.0.7390.37 / Playwright 1.56.1** browser suite. All **31 complete Trail bike records match Node exactly**; there are no captured page/console errors. The following documentation head `5edf914` also [passes CI](https://github.com/CraigHutchinson/BikeLab/actions/runs/39744994925).

The primary agent inspected both bikes' support tables at 390/320 px, a desktop vertical history and a desktop signed horizontal history, no-frame rejection, zero-gravity flight and the last accepted joint-domain stop. Readouts stay associated with applied records, clear when there is no accepted frame, and distinguish rider support from tyre loads. Hosted checks also cover pending edits, mode switching, replay/cancellation, independent masses and the common ten-station navigation. A separate local Edge presentation-only check passes both-bike tables/histories, those mobile widths, zero gravity, clearing, pending edits and stopped-state inspection. These are automated interactions and inspected captures, not participant usability evidence.

### Newer Edge numerical portability follow-up

The full local suite with **Edge 157.0.4341.10 / Playwright 1.62.1** does **not** pass the articulated browser/Node gate. The first full-suspension standing record exceeds the existing `1e-9` normalized budget; the complete record's maximum normalized difference is **1.1757450740779163e-7**, at a fork-load component. This failure is preserved, not hidden by the successful hosted run or the presentation-only check.

The [reproducible diagnostic](../scripts/rider-portability-review.mjs) first confirms the saved input reproduces exactly in the selected browser. It then compares generated XML and replays in Node with the exact browser-built native model. The [source-hashed receipt](evidence/iteration-20-edge-portability.json) retains the full scenario and results: **six XML token differences** in limb quaternions and tiny spring references; **331 numeric fields** exceed the ordinary budget. Using the exact browser XML reduces the maximum normalized discrepancy to **7.993605777301127e-14**, with zero fields above budget. That isolates native model construction for this case; it does not establish universal runtime determinism. Production model construction and tolerances remain unchanged.

Reproduce after the normal browser check has saved its failed articulated record, using the same optional Playwright tooling and `BIKELAB_CHROMIUM` browser selection:

```sh
node scripts/rider-portability-review.mjs artifacts/iteration-20-support-browser/trail-bike/full-articulated-standing.json artifacts/rider-portability.json
```

Canonical generated geometry and rest-reference identity is a concrete prerequisite to portable explicit loaded-state admission. Carry this case into the [state preflight](RIDER_EQUILIBRIUM_PLAN.md#implementation-preflight-review-2026-10-22); do not solve it by silently ignoring physical-identity mismatches or widening the current gate. The controlled model-factory substitution exists only in the diagnostic CLI and is restored in `finally`. No equilibrium, saddle support, physical calibration, real-time performance, merge or Pages deployment is claimed by this increment.
