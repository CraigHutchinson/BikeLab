# Rider workstream integration — 2026-11-03

## Scope and merge decision

The user requested all work in this stream be merged to main, with remaining work continued in follow-up PRs. This checkpoint integrates **PR60, PR61 and PR62–69**, preserving their published heads as ancestors, together with upstream main `05cf1200f9cf28bcbe7738b3905d4b258ba333ae`. Stability PR54 and overlapping historical PR46 remain separate; neither is included or declared complete.

This is an explicitly accepted experimental checkpoint. The normal full-evidence merge policy is not satisfied: no successful full-local/hosted attestation exists, and the retained rider browser numerical comparison fails. The user's instruction accepts those known limits for this merge; no comparison, test, CI gate, repository protection, workflow variable or model budget is weakened. The source PR catalogue in [the plan](ISSUE_WORK_PLAN.md) remains a dated pre-integration snapshot.

## Integrated verification

On clean source commit `3f12b7d4b68f356d73311cb77f97ed9bbdfd6ffa`, Windows / Node 24.22.0:

- `npm run ci:unit`: **349/349 pass**, no skips; pinned vendor hashes pass. Includes actual loopback serving, all terrain tests, legacy hashes and rider tests.
- Existing exported geometry and terrain browser checks: **pass**, no page/console errors, Playwright 1.62.1 / Edge 157.0.4341.36. Geometry rounded import/export/reload and custom edit pass. Terrain covers six scenarios plus post-cancellation reverse replay, delayed live delivery, supersession, missing/invalid data, playback and 390/320 px layouts. Geometry/discrete identities are checked independently of timing-dependent cache observations.
- Eight captures retained; geometry label, terrain live-delivery and 320 px captures visually inspected. These are UI evidence, not participant testing.
- Current main workflows, `scripts/ci-policy.mjs` and `test/ci.test.mjs` are unchanged in the integrated diff. Merge conflicts were documentation-only.
- Rider runtime sources and existing rider browser scripts are byte-identical to PR69. Its prior full focused UI receipt remains applicable to those unchanged sources; the long rider sequence was not rerun for this integration. The terrain/geometry changes do not select or alter the rider force model.

[Machine-readable receipt](evidence/workstream-integration.json) retains source identity, source PR heads, clean unit receipt, actual browser/tool versions and raw-artifact hashes. Only documentation/evidence changes follow the tested commit. No new cross-platform, full-local, hosted, release or physical-calibration pass is claimed.

The focused integration browser harness in ignored `artifacts/integration-browser.mjs` uses `createPreviewServer` on 127.0.0.1 and invokes `checkGeometryLabels` and `checkTerrainRequest` from the existing checked-in browser modules. It introduces no duplicate assertions. To reproduce, run those functions through the existing full browser harness or the retained focused harness with `NODE_PATH` pointing to installed Playwright and `BIKELAB_CHROMIUM` to the chosen browser. The complete raw log/JSON/captures remain under `artifacts/integration-browser`; unit receipt is `artifacts/ci/unit.json`. See [host preview procedure](LOCAL_PREVIEW.md).

## Follow-up PR boundaries

1. **Replay portability:** keep all 12/22 failed browser/Node comparisons and the current 1e-9 normalized budget. Trace identical-input compiled targets/model attributes and the first state/contact/witness/normal/residual/effort divergence with #41/#45/#57 and #52/#73. Do not tune physics to hide the difference.
2. **Reference-rate controller:** version geometry/clock-derived reference velocity through the common bounded drive. Preserve runtime mass/gravity/inertia derivation, legacy replay and fixed crouch budgets. All eight moving native crouches still fail the 10.75 mm transient tracking budget; final recovery alone is not acceptance.
3. **Independent stability stream:** PR54 receives its loaded-policy cross-check, law-versus-integrator and 10 s physically specified rest controls, then spin and both-bike held buffers/control work. Retain #58/#59 support/reference gates and the eventual 60 s idle/recovery requirement.
4. **Supported manoeuvres:** receive crouch/recovery before shared phase/support policies for endo, wheelie and bunny-hop preload/release/flight/landing. Saddle/retention, independent rider, continuation, calibration and 3D retain their existing gates.
5. **Delivery:** a later ordinary code PR resumes normal smoke/full policy. This merge is not a release and does not request Pages deployment. #39/#40 fixes now have integrated local/browser evidence; issue disposition remains a separate explicit catalogue action.

Do not delete artifact-bearing local worktrees or stop the user's existing preview as part of branch cleanup. Continue new implementation from updated main in a fresh `codex/` branch.
