# BikeLab holding state — 2026-10-30

User requested a clean pushed checkpoint to conserve quota. Stop here after publication; no further controller tuning, browser experiment, merge or deployment is part of this checkpoint.

## Published work and local ownership

The runtime configuration-derived controller is in draft [PR68](https://github.com/CraigHutchinson/BikeLab/pull/68), remote head `123aecec190a860e3d463112cd20e8b20aad7ae9`, based on PR67. The crouch follow-up lives on `codex/rider-crouch`, stacked on `codex/rider-controller`. Local implementation commit is `3a05ffbd42047ec11a80ff22b1bb55f76d2534d5`; connector publication uses a separate commit with an identical verified Git tree. The publication commit and draft PR are the remote recovery points. Do not rewrite the parent stack.

Use the `bikelab-rider-controller` checkout under the authorized visualization workspace, not the unrelated Sub0Llm working directory. No stability work is folded into this branch. Preserve other worktrees and PR54.

## Evidence and known limit

See [crouch protocol/results](RIDER_CROUCH.md) and [machine-readable receipt](evidence/rider-crouch.json). All ten native runs complete; all eight moving cases fail only the 10.75 mm tracking-error budget (peaks 15.6–18.4 mm). Final hip errors are below 1.7 mm. The two unchanged-posture controls are labelled controls. No tuned gains, relaxed domains or new force law was introduced.

Quick: 90/90 on the clean implementation commit. Full local Node suite: 335/336, with the existing sandbox loopback EACCES failure. No browser/full/hosted attestation is claimed. All ten raw-record hashes and final-observer assessments were rechecked. Complete raw records and local logs are retained under ignored `artifacts/`; their summary, hashes, phase metrics and reproduction script are committed.

## Resume in this order

1. Retry authorized Edge access for #39's geometry-provenance UI check. Verify the served source/revision before claiming evidence; the old ambient port 4177 alone does not establish it. Then receive both-bike rider worker/replay/crouch/control/mobile cases in `scripts/rider-drive-browser-check.mjs`. No successful retry is claimed at this checkpoint.
2. Review the failed crouch baseline and design versioned reference-velocity feedback through the common bounded drive. Derive rates from target geometry/clock; define interpolation, boundary semantics and record/replay identity first. Preserve mass-derived effort/gains and frozen budgets. Actual-velocity damping is a hypothesis for lag, not a proven diagnosis.
3. Receive supported tracking before one-wheel endo/wheelie or hop/flight/landing policy. Keep support feasibility, phase history and continuation ownership explicit. Stability PR54, contact-normal #58 and residual/reference #59 gates remain independent.

Reproduction: `node scripts/rider-crouch-review.mjs` writes the ten full records and report; `node --test test/rider-crouch.test.mjs test/rider-transfer.test.mjs test/pages.test.mjs` checks the focused surface. Run `npm run ci:quick` or `npm run ci:unit` without concurrent repository edits.

Hosted CI and Pages remain paused. Follow [CI workflow](CI_WORKFLOW.md): keep literal guards and repository enable variable disabled, use `[skip ci]`, and do not dispatch, deploy, tag releases or merge. Resumption on/after 1 November is deliberate, not automatic. Skipped checks are not passed checks.
