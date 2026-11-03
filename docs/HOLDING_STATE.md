# BikeLab current checkpoint — 2026-11-03

## Upstream reconciliation

Use the [current issue/PR consolidation](ISSUE_WORK_PLAN.md#current-upstream-reconciliation) as the execution order. Live review found 25 open issues, including new #70–76, and 12 open draft PRs. The [catalogue receipt](evidence/upstream-catalogue-2026-11-03.json) pins their heads. No issue or PR was closed or merged.

Upstream main `05cf120` restored minimal local-first CI on 1 November; the previous statement that the entire project remained paused was stale. This rider branch still has older literal workflow guards. Reconcile upstream policy at the stack root before integration; do not overwrite it from a stale branch. No repository setting or workflow was changed by this review, and no successful hosted check is inferred. See [CI policy and branch state](CI_WORKFLOW.md).

## Delivery and evidence

Draft [PR69](https://github.com/CraigHutchinson/BikeLab/pull/69), branch `codex/rider-crouch`, is stacked on PR68 and the ordered #62–69 rider chain. It includes preview asset serving, canonical starting-angle admission and focused browser receiving. Local implementation commits `8be092f` and `0fc2c8a` were connector-published with identical trees; do not rewrite the parent stack. The current consolidation changes documentation only.

[PR60](https://github.com/CraigHutchinson/BikeLab/pull/60) at `ae5fd73` has successful focused #39 import/export/reload and visual evidence, but remains draft/unmerged. [PR61](https://github.com/CraigHutchinson/BikeLab/pull/61) at `c105637` still needs its own host/server and browser receiving for #40. The now-working preview procedure removes the old execution obstacle; results from PR69 do not certify PR61.

[Browser receiving](RIDER_BROWSER_RECEIVING.md) completes both-bike UI assertions with no page/console errors; six representative captures were inspected. Overall browser verification still fails: **12/22** full-record comparisons exceed the unchanged budget. Node tests pass **337/337** on the recorded implementation tree; no full-local or hosted attestation is claimed. [Crouch](RIDER_CROUCH.md) completes all ten native runs, but all eight moving cases fail the frozen 10.75 mm transient tracking budget. Raw records remain in ignored artifacts with committed hashes.

[PR54](https://github.com/CraigHutchinson/BikeLab/pull/54) at review head `f595805` has advanced through flat fixed-hub, translation, and bounded entry/recontact receiving. Loaded-policy cross-check, spin, both-bike held buffers/control, long supported rest and full/browser gates remain. #73–76 require a law-versus-integrator comparison and physically specified rest before broad stability claims. PR46 overlaps the received fixture work: preserve unique evidence and review supersession, without merging its old duplicate path wholesale.

## Next balanced work

1. Complete independent #39/#40 delivery gates and reconcile the stale CI/plan documents during integration; no full matrix merely for this documentation checkpoint.
2. Trace identical-input browser/Node target/model/state/contact/effort divergence. Include witness weights, contact normals and solver residuals to test the #52/#73 hypothesis. Preserve strict replay budgets; coordinate a minimal case with PR54 rather than adding a second stability implementation.
3. In the separate stability stream, cross-check entry policy against loaded releases and qualify contact law independently of integrator. Add 10 s rest diagnostics with friction and an explicitly described held brake/lock or rolling-loss model, paired fixed/free-hub and both-bike controls, drift/ripple/switch/work metrics. Retain the later 60 s idle/recovery gate.
4. Receive versioned reference-velocity feedback through the existing common bounded drive, with geometry/clock-derived rates, runtime mass/inertia, legacy record compatibility and unchanged crouch budgets. An isolated controller experiment can progress; supported manoeuvre acceptance still needs numerical/contact evidence.
5. After supported crouch/recovery, add phase/support policy for endo, wheelie and bunny-hop preload/release/flight/landing. Keep independent rider ownership, saddle/retention, continuation and eventual 3D explicit.

## Preview and reproduction

Use this `bikelab-rider-controller` checkout, not Sub0Llm. [LOCAL_PREVIEW.md](LOCAL_PREVIEW.md) records the verified host launch: loopback-only rider preview at port 4178, geometry branch at 4189. Verify HTTP and in-app readiness; a restricted Node listening banner is insufficient. Keep the host process alive while the user inspects it, and recheck rather than assume an old session survives.

`npm run browser-check:rider` collects all focused UI cases while retaining replay failures and exits nonzero for any failed comparison. `npm run ci:unit` verifies all Node tests and vendor hashes. `node scripts/rider-crouch-review.mjs` regenerates the mass/control/refinement matrix. Do not edit during evidence generation. Current focused Edge evidence uses Playwright 1.62.1, not the full-local pinned 1.56.1 requirement.
