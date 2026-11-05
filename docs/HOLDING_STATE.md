# BikeLab workstream handoff — 2026-11-04

**Pressure/material update, 5 November:** [draft PR96](https://github.com/CraigHutchinson/BikeLab/pull/96) implements the [prescribed pressure/energy kernel](TYRE_PRESSURE_KERNEL.md) for user-priority #95. Shared volume geometry compounds changing area and pressure; nine V8 checks and 123 states pass with source-bound evidence. Smoke passes on source5200268; full is skipped. The execution workspace is unavailable, so Node/full-suite, plot, casing-prestress/insert and production integration remain pending. PR91 retains corrected-stage ownership.

The tracked [spinning-contact working plan](working/SPINNING_CONTACT.md) preserves provisional decisions, blocked checks and the next implementation sequence for merged PR90 and its follow-up. Push updates to it with draft changes.

**Spinning contact update, 4 November:** PR90 is merged. The [native-stage evidence](SPINNING_RK4_STAGE.md) records 576 exact-parity steps, six independent ballistic controls and all 14 focused tests. Linux in-process receiving is 419/432 with thirteen environment-blocked checks; the preserved upstream Windows receipt passes 432/432 and has identical report bytes. Scientific visualization is received; browser/macOS follow-ups remain. PR91 owns corrected stages. User-priority [issue 95 pressure/material work](working/TYRE_PRESSURE.md) is next.

Current next task: implement issue #95's pressure/material diagnostic with coupled area/pressure and energy checks. PR91 separately owns the physical-target stage policy. Preserve its work; qualify loaded trajectories before connected/rest use. The [live issue plan](ISSUE_WORK_PLAN.md#current-upstream-reconciliation) includes #86–89: anchor push/pull reporting, airborne brake-tap momentum, continuous target streaming and reference-rate damping. These remain separate from the unresolved passive-law/identical-state rider replay gate.

## Historical delivery context

Latest delivery: PR54 merged at 69b9621; PR46 closed as superseded with original evidence preserved. Longer full-suspension controller replay still fails after target-table substitution (5,208 leaves outside budget). Next isolate compiled passive laws and identical-state controller effort; see [diagnostic update](RIDER_REPLAY_DIAGNOSTIC.md#longer-controller-receiving--3-november-2026). Earlier merge-readiness entries below are historical.

**Subsequent delivery decision, 3 November:** after reviewing the known failed macOS hashes and cancelled browser job, the user explicitly requested the merges. The [checkpoint decision](MERGE_CHECKPOINT_2026_11_03.md) supersedes the earlier wait-before-merge disposition for PR54 only; missing software receiving remains follow-up work, not a pass. PR46 is to be closed as superseded after its preserved evidence and replacement reach main. Dated catalogue counts below describe the review snapshot.

Main **1dedf06** contains the complete #60/#61/#62–69 workstream through #80 and target replay diagnosis through #81. The [two-week review](PROGRESS_REVIEW_2026_11_03.md) consolidates progress, all 30 open issues and the two remaining PRs; the [issue plan](ISSUE_WORK_PLAN.md#current-upstream-reconciliation) is authoritative for current work.

Next tasks:
- **#54 merge readiness:** 7a8000c includes main; loaded-policy 24/16 receiving is complete. Current full run passes Ubuntu/Windows but fails two legacy macOS hashes (416/418), with browser cancelled. Diagnose cross-platform signals and complete the required software receiving before merging its bounded checkpoint. No full pass or exception is implied.
- **#46 preservation/supersession:** its original nullspace receipt is archived with source provenance. Receive #54's independent reproduction and confirm coverage, then explicitly supersede the duplicate fixture draft; leave it open meanwhile.
- **Rider replay/control:** extend identical-input diagnosis to long/controller records and version compiled-target identity; then derive reference-rate feedback through the common bounded controller. All 12/22 original production replay failures and all eight moving crouch transient failures remain.
- **Connected support and execution:** new #77–79/#82–83 add brake creep, collision/witness sensitivity and smoothing admission/refinement gates. Keep stability work independent, with persistent session/snapshot and bounded-recording work on unchanged mechanics alongside it after replay identity. Supported crouch precedes endo/wheelie/hop.

[Integration](WORKSTREAM_INTEGRATION.md) records 349/349 local Node and passing geometry/terrain browser checks; [diagnostic evidence](RIDER_REPLAY_DIAGNOSTIC.md) records the later 353/353 suite and two passing target-table interventions. Those interventions are diagnostic only. No full rider attestation exists. Minimal CI is restored: PR81 smoke passed, full skipped; PR54 full/policy failed. Existing receipts keep their original source identity.

Preserve artifact-bearing worktrees and the user's preview processes. [LOCAL_PREVIEW.md](LOCAL_PREVIEW.md) records host execution and HTTP/browser readiness; verify rather than assuming a previous session is alive. Continue small reviewed increments from current main and merge completed work under the standing authorization. No release or Pages deployment accompanies this plan update.
