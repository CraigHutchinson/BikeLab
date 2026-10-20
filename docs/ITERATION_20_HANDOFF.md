# Iteration 20 completeness review and session handoff

Reviewed 2026-10-20. Continue [draft PR #23](https://github.com/CraigHutchinson/BikeLab/pull/23), branch `codex/articulated-rider-review`, from tested implementation `083b0d82af6ce7e7945062379204c9bb72262f01`. Base main is merged PR #22 at `e73f6cc9d5bd130ec632bcb4d890ad7286ddb4cf`. Refresh both remote heads before resuming; this note is a documentation-only follow-up.

**Assessment:** the design is coherent enough to build the native rider prerequisite. It is not a complete articulated-rider design or a received D5a feature. No blocking defect was identified in the current posture constructor; the major risks are the still-unimplemented closed-chain dynamics and interface accounting.

| Area | Complete at this checkpoint | Gap before dynamic acceptance |
| --- | --- | --- |
| Posture and mass | Versioned, owned five-group specification; analytic bent-limb construction; reach/singularity rejection; full COM/inertia aggregation; CLI | Native body/joint construction, compatible initial velocities, combined constraint rank and drift; illustrative properties remain uncalibrated |
| Passive mechanics | Seven-coordinate topology and bilateral hand/foot attachment proposal | Choose explicit joint rest angles, stiffness/damping, ultimate domains and stop behavior; define residual frame inertia and frame/rider mass ownership in the new mode |
| Interfaces | Source-backed native force signs and work ownership documented | Named equality-row observer, saddle geometry/contact filtering, unilateral separation/recontact, correct paired wrench origins and signed work; existing recorder rejects these contact/constraint types |
| State and configuration | Separate posture format; old simulation untouched | Versioned connected scenario/record integration, new rider mode validation, initialization/rollback state, preallocated telemetry and historical replay controls |
| Visible receiving feature | Browser can import and reproduce construction reports | Render actual articulated segments/attachments and loads in Trail bike; add selectable setups, lifecycle checks and inspected desktop/mobile captures on both bikes |
| Manoeuvres | Pump/manual/wheelie/hop/endo/landing and later 3D goals with conservation checks | Bounded active joints and their work, contact-event evidence, larger supported envelopes and measured validation; no manoeuvre is implemented |

Two important distinctions: limb `bendSine` does not prove native loop conditioning, and a feasible pose does not prove collision-free or anatomically admissible motion. Bilateral feet are a retained-foot surrogate, not validated flat-pedal or clipless behavior. Changing the rider mass distribution also changes the physical baseline: compare a matched locked posture, not an unrelated legacy COM/inertia.

## Verified evidence

[Run 39446046739](https://github.com/CraigHutchinson/BikeLab/actions/runs/39446046739) passed **193 tests on both Linux and Windows**, without failures/skips. Chromium 141.0.7390.37 compared two complete posture reports with maximum difference **1.11e-16** against a 1e-12 normalized tolerance. All **23 connected-bike exports matched exactly**, with no captured page/console errors. This is construction/regression evidence, not articulated dynamics or new rider visual verification.

The five focused construction tests and CLI specification round trip also pass locally. The local full suite completed with 26 test files passing and 9 failing under process-spawn/loopback restrictions; direct diagnostics showed `spawnSync EPERM` and `listen EPERM`. Do not weaken tests to accommodate that environment.

## Resume in small increments

1. Read [iteration review](ITERATION_20_REVIEW.md), [construction contract](RIDER_POSTURE.md) and [manoeuvre goals](RIDER_MANOEUVRES.md). Preserve existing fixed/guided replay.
2. Build native rider bodies, hinges and named point-connect attachments from the constructed pose. Independently compare body/site geometry, total mass/COM/inertia and a matched rigid aggregation. Verify initial closure, velocity compatibility and rank, including redundant planar y rows. Declare numerical budgets before tuning.
3. Add equality/saddle routing and paired force/work diagnostics. Native RNE already owns these loads; retain the omitted-flex correction only where required. Verify momentum, spring energy, damping and regularization sensitivity before trail integration.
4. Receive passive standing and saddle approach/separation/recontact on both bikes with shared browser/headless records, rollback and visual evidence. Then add active rider work/limits and the short manoeuvre controls.

Keep suspension/casing bounds, the ±0.35 rad frame-pitch boundary and explicit unsupported-overload termination. Do not relax them to make a trick complete. Component failure/blowout, full swept collision, layered terrain/mud, sourced geometry/anatomy, 3D lateral/turning and measured adaptive/multirate real-time behavior remain open. PR #22 also retains an untested rollback subpath after new-command endpoint reevaluation; do not lose that coverage follow-up.

Use GPT-6.1 Sol for bounded research as requested. Commit and push each increment. This workspace has reconstructed local Git history: local commit IDs differ from GitHub IDs although source trees match. Prefer a fresh checkout of the remote branch in another session; when using connector commits, verify the tree and update the branch with the expected remote head. Never overwrite newer upstream work.
