# Local-first verification and hosted CI

Adopted 2026-10-28 from [CraigHutchinson/.github CI strategy](https://github.com/CraigHutchinson/.github/blob/main/docs/ci-strategy.md), source blob `40526a967ab0ef3fedbff3a35b24f053050c0ef0`.

## Temporary hosted-CI pause

User direction: **all projects must avoid needing hosted CI until 1 November 2026**. BikeLab's workflows have a checked-in literal false guard during the pause and require repository variable `BIKELAB_HOSTED_CI_ENABLED=true` before allocating any runner. Leave it unset/false throughout the pause. This covers smoke, full, weekly scheduling, policy and Pages. It does not automatically enable on 1 November.

Use local verification and include `[skip ci]` in publication/merge commits during the pause, including when a branch still has the older workflow. Do not dispatch workflows, add full/release labels, create release tags or request hosted deployment during the pause. Skipped checks are **not passed checks**. No ruleset is weakened to make pending checks green. Hosted platform/browser and release receipts remain pending.

The pause is a temporary delivery constraint; it does not waive the normal evidence gates below. Local engineering can continue. A maintainer-authorized direct push can adopt this infrastructure during the pause, with local results and missing hosted coverage recorded explicitly.

## BikeLab adaptation

BikeLab runs JavaScript and pinned WASM, not C++. The shared strategy's named C++ reusable workflows and `tools/ci/local_ci.py` were absent on its default branch at adoption. BikeLab therefore supplies a small Node runner and native workflows with the same tier semantics; it does not invent compiler, sanitizer or CMake coverage. Revisit shared reuse when a compatible implementation exists.

| Tier | Command / trigger | Coverage |
| --- | --- | --- |
| Quick | `npm run ci:quick`; main pushes and PRs after the pause | Vendor SHA-256 checks; policy decisions; Pages dependency resolution; analytical wheel/suspension references; records; terrain request lifecycle. One Ubuntu job. |
| Unit | `npm run ci:unit` | Vendor hashes and the complete Node test suite, including existing WASM and CLI cases. No browser. Cannot publish a full attestation. |
| Full local | `npm run ci:full` | Pinned Playwright check, vendor hashes, complete Node suite, passive idle records and all browser receiving. Fails if any prerequisite/check fails. One machine's coverage only. |
| Full hosted | Manual request, `v*`/`milestone/*` tag, `ci:full`/`ci:release` PR, weekly changed main | Complete Node suite on Ubuntu 24.04, Windows 2022 and macOS 14; Chromium receiving and idle evidence on Linux. |
| None | Documentation, licences or provenance manifests only | Smoke and PR metadata events use path ignores. These paths do not bypass full/release validation. |
| Pages | Manual request on main | Packages only `dist/` at the exact current-main SHA carrying successful hosted `ci/full`; no repeated tests or automatic deploy per push. |

A weekly request allocates only the short planning job if the current main SHA already has successful `ci/full`; it skips the matrix/browser. A newer failed full status requires investigation/rerun. Empty, skipped or cancelled runs never produce successful full evidence. Repeated explicit full requests are allowed.

All jobs have timeouts and pinned runner images, all actions use commit pins, superseded CI runs cancel, write permissions are confined to metadata reporting and Pages deployment. Browser tooling remains outside application dependencies; its npm download cache is keyed by pinned Playwright version and runner platform. Performance measurements remain local and uncontended.

## Local use and receipts

Use Node 24. `.ci/local.json` declares the commands. Each run writes `artifacts/ci/<level>.json` with head SHA, dirty state, OS/architecture, Node version, commands, exit codes, timing and explicit coverage. The runner fails if tracked/untracked status or HEAD changes during verification. Development checks may run with edits, but a dirty-tree receipt is not a commit attestation.

For full local coverage, install isolated Playwright 1.56.1 and Chromium, set `NODE_PATH` to that installation's `node_modules`, then run `npm run ci:full`. `BIKELAB_CHROMIUM` can select an existing browser; its actual version is recorded by the browser suite. A different browser is local evidence, not a claim that hosted Chromium passed. Keep complete records/captures; numerical replay is distinct from inspecting captures and participant feedback.

After publishing a commit, `node scripts/local-ci.mjs full --attest` reruns full validation from a clean checkout and posts `local-ci/full` only if every command succeeds, the source remains unchanged and that exact SHA exists remotely. Requires authenticated `gh`. `quick --attest` publishes only `local-ci/quick`. Authentication failure leaves the local receipt and fails publication; it never creates a success status by assumption. Status publication itself does not request a hosted test run, but after the pause it may start the small policy workflow.

## Normal merge and release policy

After hosted CI resumes, code PRs need exact-head smoke plus either hosted `ci/full`, or label `ci:local-verified` and successful exact-head `local-ci/full`. `ci:release` always requires hosted full. `ci/policy` evaluates those conditions, including when labels change or smoke/local/full evidence arrives. It does not accept an old SHA's status. Metadata jobs check out trusted main, never the fork's code with write credentials. Fork PRs receive read-only smoke; receive reviewed code on a trusted repository branch for full validation.

The three labels already exist (verified through the public API at adoption). For a new clone/repository, create labels once using authenticated CLI (not during this pause if doing so would label an active PR):

```powershell
gh label create ci:full --repo CraigHutchinson/BikeLab --color 1D76DB --description "Request full hosted validation" --force
gh label create ci:local-verified --repo CraigHutchinson/BikeLab --color 0E8A16 --description "Require successful exact-head local-ci/full" --force
gh label create ci:release --repo CraigHutchinson/BikeLab --color B60205 --description "Release PR requires hosted full" --force
```

Label/ruleset configuration is repository metadata, not supplied by these files. Apply `ci/policy` to code PRs through appropriately scoped rulesets; do not require a path-filtered job unconditionally for docs-only PRs or block authorized direct pushes. Existing protections are left intact. Release publication remains manual and must follow successful full validation of the release SHA; this workflow creates no GitHub release automatically.

On or after 1 November, remove the temporary literal false guards from the four workflows, then deliberately set `BIKELAB_HOSTED_CI_ENABLED=true`, then request one full run on the intended main SHA. Validate the workflows on GitHub before claiming operational hosted coverage, and deploy Pages separately only after that run succeeds. No automatic wake-up or resume is scheduled.

## Adoption evidence

Local quick passed 46 tests; the complete Node suite passed 276 tests with no skips/failures on Windows / Node 24.22.0. Actionlint 1.7.7 passed all four workflows. Missing Playwright correctly failed the full-local runner, and a dirty checkout correctly refused attestation before any publication. GitHub settings require credentials unavailable to this shell; no variable or ruleset change is claimed. The checked-in false guards guarantee the pause independently of repository variables. No hosted run, cross-OS execution, new browser receiving or deployment is claimed by the infrastructure change. Browser evidence for the existing product remains in its prior receiving receipts; new longer-settling controls in PR54 retain their own pending gates.
