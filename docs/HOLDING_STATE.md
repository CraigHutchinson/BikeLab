# BikeLab current checkpoint — 2026-11-03

The quota hold was resumed at the user's request. Continue autonomously from this reviewed checkpoint; preserve other worktrees and the independent stability stream.

## Delivery state

Draft [PR69](https://github.com/CraigHutchinson/BikeLab/pull/69), branch `codex/rider-crouch`, remains stacked on [PR68](https://github.com/CraigHutchinson/BikeLab/pull/68). It now includes preview asset serving, canonical starting-angle admission, focused browser receiving and the evidence below. Local implementation commits are `8be092f` and `0fc2c8a`; connector publication uses separate commits with a verified identical tree. Do not rewrite the parent stack.

[PR60](https://github.com/CraigHutchinson/BikeLab/pull/60) now carries successful focused #39 geometry browser evidence at `ae5fd730a4899ce8813822f44c0abaf1e8be0db2`; it is still draft/unmerged. No GitHub issue is closed. The original geometry preview and current rider checkout are separate branches; do not use one as evidence for the other.

## Evidence and limits

[Browser receiving](RIDER_BROWSER_RECEIVING.md) completed all UI assertions on both bikes with no page/console errors. Six representative captures were visually reviewed. The overall browser gate remains failed: **12/22** browser/Node complete-record comparisons exceed the unchanged tolerance. The complete Node suite passes **337/337**, including real HTTP serving and the new starting-angle regression. No full-local/hosted attestation is claimed.

The [crouch matrix](RIDER_CROUCH.md) still completes all ten native runs. All eight moving cases fail only the declared 10.75 mm transient tracking budget; no gains, physics, passive domains or acceptance thresholds were tuned. Current browser crouches show the same tracking failure visibly. Complete raw records/captures/logs remain in ignored artifacts; compact receipts and hashes are committed.

## Next balanced work

1. Trace the first browser/Node divergence from identical serialized target/controller configuration: compiled target deltas/native attributes, then state/contact/effort history. Coordinate with #57 and PR54; keep this narrow portability investigation separate from broader stability implementation. Do not weaken comparisons or tune gains to hide it.
2. Design and receive versioned reference-velocity feedback through the common bounded drive, with geometry/clock-derived rates, explicit interpolation and boundary ownership, record/replay identity, and the unchanged crouch budgets. Actual-velocity damping remains a hypothesis for lag, not a proven diagnosis.
3. Receive supported tracking before one-wheel endo/wheelie or hop/flight/landing policies. Keep support feasibility, phase history and continuation ownership explicit; #58 normal and #59 solver/reference gates remain independent.

## Working preview and reproduction

Use the `bikelab-rider-controller` checkout beneath the authorized visualization workspace, not Sub0Llm. [LOCAL_PREVIEW.md](LOCAL_PREVIEW.md) records the verified host launch. Restricted sandbox Node can report listening while host browsers time out; run the loopback-only preview/check through the approved host path when needed, verify HTTP and browser readiness, and leave it running for user inspection. Restart after a host-session teardown if it is no longer listening; do not assume an old process or tab survives.

`npm run browser-check:rider` collects the complete focused UI sequence while retaining every strict replay failure and exits nonzero if any comparison fails. `npm run ci:unit` checks all Node tests and vendor hashes. `node scripts/rider-crouch-review.mjs` regenerates the mass/control/refinement matrix. Avoid editing during local CI receipt generation.

Hosted CI/Pages remain disabled in this branch; resumption on/after 1 November is deliberate. Follow [CI workflow](CI_WORKFLOW.md), use `[skip ci]`, and do not claim skipped checks as passed. No hosted run, deployment or merge was part of this receiving checkpoint.
