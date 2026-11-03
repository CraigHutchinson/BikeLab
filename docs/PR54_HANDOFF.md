# PR54 bounded correction checkpoint — 2026-11-03

The user requests merging the completed workstream checkpoint into main. This supersedes the earlier instruction to keep PR54 draft until spinning/connected receiving. It does not claim that those follow-up physics gates are complete or waive the [normal software merge checks](CI_WORKFLOW.md#normal-merge-and-release-policy).

The checkpoint preserves the implicit derivative and mesh contact failures, adds versioned native-RK4/flat-vertex paths, receives coupled hub translation and bounded contact entry/recontact, and completes the supplied loaded-policy cross-check. Fresh product defaults and legacy record mechanics are preserved. The scientific plots consume saved diagnostic data; they do not constitute product browser receiving.

- Flat fixed-hub: 24 supplied 20 ms cases and 16 predeclared refinements pass.
- Translating release: 24 cases and 16 refinements pass at each of 1, 5 and 20 ms, including independent normal-force and momentum checks.
- Contact entry/recontact: six 20 ms cases and four refinements pass, including analytic entry and a separation/recontact cycle.
- New bounded contact policy on supplied inputs: 24 cases and 16 refinements pass; all 24 saved grids revalidate and comparisons recompute without integration. Twenty focused tests pass, including failed-prefix resumption. See [result](CASING_CONTACT_LOADED.md) and its committed evidence.

Main `05cf120` and PR54 had separately adopted the same CI restoration from `2dd2be6`. All seven changed code/configuration blobs match exactly. The eighth changed file, `docs/CI_WORKFLOW.md`, retains the same policy plus the PR's later truthful skipped-run observations. The branch integration retains the received tree and records both remote parents; it does not replace main's work.

Full software receiving remains outstanding at this handoff. The existing broad exploratory run was 306/319 with environment-blocked subprocess/loopback checks and one later-repaired fault injection; it is not a final-tree attestation. The current local environment still reports subprocess and loopback `EPERM`, and installed Playwright differs from pinned 1.56.1. A network-enabled shell attempt was cancelled without a result. No skipped or unavailable check is counted as passed. One deliberate hosted full request is appropriate for this merge checkpoint; routine subsequent changes retain the minimal CI policy. No Pages deployment or release is requested.

Next physics increment: implement the [prescribed-state spinning gap-acceleration isolation](SPINNING_HUB_PLAN.md#prescribed-state-gap-acceleration-isolation). Native row acceleration omits the convective contribution to physical gap acceleration, so a matching native force alone cannot qualify a physically invariant rotating contact law. Then receive spinning controls, both connected bikes and continuous buffer versus held controller work, followed by supported active-rider recovery and long idle.

Keep hard travel/rim/casing limits and last-accepted rollback. Physical breakage/blowout needs supported component loading and failure/pressure-loss data. Faceted/layered terrain and mud/root interaction, independent detachable rider ownership, pump/wheelie/hop/endo controls, 3D lateral/turning forces, scanned/generated surface provenance, and measured multirate game/reference-data fidelity remain explicit follow-ups.
