# Iteration 20 completeness review and session handoff

Reviewed 2026-10-20. Continue [draft PR #23](https://github.com/CraigHutchinson/BikeLab/pull/23), branch `codex/articulated-rider-review`, from native construction implementation `20e411958314e1e538d5c0864f545ab76469e830`. Base main is merged PR #22 at `e73f6cc9d5bd130ec632bcb4d890ad7286ddb4cf`. Refresh both remote heads before resuming. The current native-construction evidence is recorded below; D5a remains incomplete.

**Assessment:** the native rider construction prerequisite is implemented and independently checked at initialization. It is not a complete articulated-rider design or a received D5a feature. No blocking defect was identified in the current posture constructor; the major risks are the still-unimplemented closed-chain dynamics and interface accounting.

| Area | Complete at this checkpoint | Gap before dynamic acceptance |
| --- | --- | --- |
| Posture and mass | Versioned five-group specification; feasible bent-limb construction; native body/joint tree; full COM/inertia; matched rigid aggregation; compatible rigid launch; native rank-four proof in dense/sparse storage; CLI | Dynamic closure drift/conditioning; illustrative properties remain uncalibrated |
| Passive mechanics | Seven native relative coordinates and bilateral hand/foot point connects, with explicit zero-reference convention | Choose explicit joint rest angles, stiffness/damping, ultimate domains and stop behavior; define residual frame inertia and frame/rider mass ownership in the new mode |
| Interfaces | Source-backed native force signs and work ownership documented | Named equality-row observer, saddle geometry/contact filtering, unilateral separation/recontact, correct paired wrench origins and signed work; existing recorder rejects these contact/constraint types |
| State and configuration | Separate posture and native inspection formats; complete canonical input and owned report arrays; old simulation untouched | Versioned connected scenario/record integration, new rider mode validation, initialization/rollback state, preallocated telemetry and historical replay controls |
| Visible receiving feature | Browser imports geometric and native construction reports and compares them to Node | Render actual articulated segments/attachments and loads in Trail bike; add selectable setups, lifecycle checks and inspected desktop/mobile captures on both bikes |
| Manoeuvres | Pump/manual/wheelie/hop/endo/landing and later 3D goals with conservation checks | Bounded active joints and their work, contact-event evidence, larger supported envelopes and measured validation; no manoeuvre is implemented |

Two important distinctions: the native rank proof at the initial pose does not prove dynamic loop conditioning, and a feasible pose does not prove collision-free or anatomically admissible motion. Bilateral feet are a retained-foot surrogate, not validated flat-pedal or clipless behavior. Changing the rider mass distribution also changes the physical baseline: compare a matched locked posture, not an unrelated legacy COM/inertia.

## Earlier construction evidence

[Run 39446046739](https://github.com/CraigHutchinson/BikeLab/actions/runs/39446046739) passed **193 tests on both Linux and Windows**, without failures/skips. Chromium 141.0.7390.37 compared two complete posture reports with maximum difference **1.11e-16** against a 1e-12 normalized tolerance. All **23 connected-bike exports matched exactly**, with no captured page/console errors. This is construction/regression evidence, not articulated dynamics or new rider visual verification.

The five focused construction tests and CLI specification round trip also pass locally. The local full suite completed with 26 test files passing and 9 failing under process-spawn/loopback restrictions; direct diagnostics showed `spawnSync EPERM` and `listen EPERM`. Do not weaken tests to accommodate that environment.

## Current native checkpoint

The local full suite at `20e4119` passes **196 tests, zero failures and zero skips** using the authorized desktop execution path. This supersedes the earlier local sandbox restriction; no test was weakened. All nine focused native/posture/server checks pass, the native CLI round trip is exact, and unknown CLI flags are rejected. GPT-6.1 Sol independently reviewed the source mapping, ownership, Jacobians and tests and found no actionable issue; that review did not execute tests. Full browser and hosted CI results are pending at this writing and will be recorded before closing this checkpoint.

## Resume in small increments

1. Read [iteration review](ITERATION_20_REVIEW.md), [construction contract](RIDER_POSTURE.md) and [manoeuvre goals](RIDER_MANOEUVRES.md). Preserve existing fixed/guided replay.
2. Native construction is received as a prerequisite in `dist/rider-native.js`; preserve its declared gates, zero-reference convention and dense/sparse controls. Choose the connected passive joint laws/rest angles/ultimate domains and residual frame mass/inertia explicitly. Do not interpret the free-carrier construction fixture as a bike or a supported dynamic rider mode.
3. Add named equality force/work routing with preallocated runtime scratch, plus saddle geometry/contact filtering and paired interface diagnostics. Public site Jacobians are dense, whereas the connected model uses sparse native constraints. Native RNE already owns rigid closure/contact loads; retain the omitted-flex correction only where required. Verify momentum, spring energy gradients, damping signs and regularization sensitivity before trail integration.
4. Receive passive standing and saddle approach/separation/recontact on both bikes with shared browser/headless records, rollback and visual evidence. Then add active rider work/limits and the short manoeuvre controls.

Keep suspension/casing bounds, the ±0.35 rad frame-pitch boundary and explicit unsupported-overload termination. Do not relax them to make a trick complete. Component failure/blowout, full swept collision, layered terrain/mud, sourced geometry/anatomy, 3D lateral/turning and measured adaptive/multirate real-time behavior remain open. PR #22 also retains an untested rollback subpath after new-command endpoint reevaluation; do not lose that coverage follow-up.

Use GPT-6.1 Sol for bounded research as requested. Commit and push each increment. The resumed desktop checkout tracks the actual remote PR23 branch. Older uncommitted PR22 notes were preserved in the named stash `Preserve earlier PR22 local evidence before resuming PR23 2026-10-20`; do not reapply them over the newer documentation. Other worktrees and prior stashes remain untouched. Refresh remote heads and preserve newer upstream work when continuing.
