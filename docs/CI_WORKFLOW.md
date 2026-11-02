# Local-first verification and hosted CI

Adopted 2026-10-28 from [CraigHutchinson/.github CI strategy](https://github.com/CraigHutchinson/.github/blob/main/docs/ci-strategy.md), source blob `40526a967ab0ef3fedbff3a35b24f053050c0ef0`.

## Minimal hosted-CI resumption, 2026-11-01

The user authorized resumption with local-first verification and full hosted runs only when needed. This supersedes the 28–31 October pause. Routine code changes allocate one short Ubuntu smoke job. Ordinary PRs may use exact-head successful `local-ci/full` plus `ci:local-verified` instead of the full hosted matrix. A quick or partial local run never substitutes for that full attestation. Full validation remains mandatory for critical version/release candidates; request it explicitly with a label, tag or manual dispatch.

There is **no weekly full schedule**, automatic recovery matrix on resumption, or automatic Pages deployment. Documentation-only changes remain ignored. A full request for a SHA already carrying successful latest `ci/full` skips the matrix; manual dispatch deliberately reruns it. A failed/pending newer status cannot inherit an older success. A `ci:full`/`ci:release` label remains a request for each subsequent changed PR head until removed.

The explicit gates need no scheduled wake-up or repository-settings write:

| Repository variable | Behavior |
| --- | --- |
| `CI_MODE=off` | No hosted runners, including metadata and Pages. |
| `CI_MODE=smoke` | Smoke/metadata only; full requests (including manual and release) wait until the mode is changed. Separately requested Pages may package an already fully verified main. |
| `CI_MODE` unset or `full` | Smoke plus deliberately requested full; separately requested Pages. |
| `BIKELAB_HOSTED_CI_ENABLED=false` | Retained emergency off switch, regardless of `CI_MODE`. Unset or `true` permits the mode above. |

Only the checked-in pause guards are removed. Existing explicit off settings are respected; no repository-variable or ruleset change is claimed. `[skip ci]` remains available for nonfunctional checkpoints, but is no longer required for normal code publication. Skipped checks are not passed checks. This adaptation retains BikeLab's full-evidence merge gate; it does not implement the shared strategy's optional `ci:skip` label.

## BikeLab adaptation

BikeLab runs JavaScript and pinned WASM, not C++. The shared strategy's named C++ reusable workflows and `tools/ci/local_ci.py` were absent on its default branch at adoption. BikeLab therefore supplies a small Node runner and native workflows with the same tier semantics; it does not invent compiler, sanitizer or CMake coverage. Revisit shared reuse when a compatible implementation exists.

| Tier | Command / trigger | Coverage |
| --- | --- | --- |
| Quick | `npm run ci:quick`; code main pushes and PRs | Vendor SHA-256 checks; policy decisions; Pages dependency resolution; analytical wheel/suspension references; records; terrain request lifecycle. One Ubuntu job. |
| Unit | `npm run ci:unit` | Vendor hashes and the complete Node test suite, including existing WASM and CLI cases. No browser. Cannot publish a full attestation. |
| Full local | `npm run ci:full` | Pinned Playwright check, vendor hashes, complete Node suite, passive idle records and all browser receiving. Fails if any prerequisite/check fails. One machine's coverage only. |
| Full hosted | Manual request, `v*`/`milestone/*` tag, explicitly labelled `ci:full`/`ci:release` PR | Complete Node suite on Ubuntu 24.04, Windows 2022 and macOS 14; Chromium receiving and idle evidence on Linux. |
| None | Documentation, licences or provenance manifests only | Smoke and PR metadata events use path ignores. These paths do not bypass full/release validation. |
| Pages | Manual request on main | Packages only `dist/` at the exact current-main SHA carrying successful hosted `ci/full`; no repeated tests or automatic deploy per push. |

The full planning job deduplicates successful exact-head requests before allocating its matrix/browser. Empty, skipped or cancelled runs never produce successful full evidence. Manual dispatch can deliberately repeat a successful run. Ignored label/status events have separate concurrency groups so they cannot cancel useful runs. Policy metadata is reevaluated after PR smoke, relevant labels, local-full status or hosted-full completion; ordinary main smoke does not allocate a redundant metadata job.

All jobs have timeouts and pinned runner images, all actions use commit pins, superseded CI runs cancel, write permissions are confined to metadata reporting and Pages deployment. Browser tooling remains outside application dependencies; its npm download cache is keyed by pinned Playwright version and runner platform. Performance measurements remain local and uncontended.

## Local use and receipts

Use Node 24. `.ci/local.json` declares the commands. Each run writes `artifacts/ci/<level>.json` with head SHA, dirty state, OS/architecture, Node version, commands, exit codes, timing and explicit coverage. The runner fails if tracked/untracked status or HEAD changes during verification. Development checks may run with edits, but a dirty-tree receipt is not a commit attestation.

For full local coverage, install isolated Playwright 1.56.1 and Chromium, set `NODE_PATH` to that installation's `node_modules`, then run `npm run ci:full`. `BIKELAB_CHROMIUM` can select an existing browser; its actual version is recorded by the browser suite. A different browser is local evidence, not a claim that hosted Chromium passed. Keep complete records/captures; numerical replay is distinct from inspecting captures and participant feedback.

After publishing a commit, `node scripts/local-ci.mjs full --attest` reruns full validation from a clean checkout and posts `local-ci/full` only if every command succeeds, the source remains unchanged and that exact SHA exists remotely. Requires authenticated `gh`. `quick --attest` publishes only `local-ci/quick`. Authentication failure leaves the local receipt and fails publication; it never creates a success status by assumption. Status publication itself does not request a hosted test run, and may start the small policy workflow.

## Normal merge and release policy

Code PRs need exact-head smoke plus either hosted `ci/full`, or label `ci:local-verified` and successful exact-head `local-ci/full`. `ci:release` always requires hosted full. `ci/policy` evaluates those conditions, including when labels change or smoke/local/full evidence arrives. It does not accept an old SHA's status. Metadata jobs check out trusted main, never the fork's code with write credentials. Fork PRs receive read-only smoke; receive reviewed code on a trusted repository branch for full validation.

The three labels already exist (verified through the public API at adoption). For a new clone/repository, create labels once using authenticated CLI (creating a label alone does not request tests):

```powershell
gh label create ci:full --repo CraigHutchinson/BikeLab --color 1D76DB --description "Request full hosted validation" --force
gh label create ci:local-verified --repo CraigHutchinson/BikeLab --color 0E8A16 --description "Require successful exact-head local-ci/full" --force
gh label create ci:release --repo CraigHutchinson/BikeLab --color B60205 --description "Release PR requires hosted full" --force
```

Label/ruleset configuration is repository metadata, not supplied by these files. Apply `ci/policy` to code PRs through appropriately scoped rulesets; do not require a path-filtered job unconditionally for docs-only PRs or block authorized direct pushes. Existing protections are left intact. Release publication remains manual and must follow successful full validation of the release SHA; this workflow creates no GitHub release automatically.

Before a critical version, request one full run on the intended SHA and verify the hosted result. Deploy Pages separately only after its exact-main hosted full gate passes. Performance measurements remain local and uncontended.

## Resumption evidence

The four policy tests pass locally. Vendor hashes pass. The quick command reports failure honestly: 45 of 46 in-process tests pass and the reference CLI test is blocked by `spawnSync node EPERM` in this execution environment. No quick/full attestation was published. All four workflow documents parse as YAML; actionlint was unavailable (the attempted download did not complete), so this is not an actionlint or hosted execution claim. A GPT-6.1 Sol review identified the ignored-event concurrency hazard; the workflows now isolate those events. Main `05cf120` and draft PR54 `e011843` contain the restoration. Their initial smoke jobs were skipped without a runner, so repository gates still prevent hosted receiving. The connector cannot read or change Actions variables; an enabled repository needs `CI_MODE` unset/full (smoke for routine-only operation) and `BIKELAB_HOSTED_CI_ENABLED` unset/true. The first successful normal smoke run remains the hosted receiving gate. No full matrix or deployment was requested.

## Adoption evidence

Local quick passed 46 tests; the complete Node suite passed 276 tests with no skips/failures on Windows / Node 24.22.0. Actionlint 1.7.7 passed all four workflows. Missing Playwright correctly failed the full-local runner, and a dirty checkout correctly refused attestation before any publication. GitHub settings require credentials unavailable to this shell; no variable or ruleset change is claimed. At adoption the checked-in false guards guaranteed the pause independently of repository variables; the resumption above replaces them. No hosted run, cross-OS execution, new browser receiving or deployment is claimed by the infrastructure change. Browser evidence for the existing product remains in its prior receiving receipts; new longer-settling controls in PR54 retain their own pending gates.
