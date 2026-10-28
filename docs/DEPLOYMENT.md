# GitHub Pages deployment

The public laboratory is https://craighutchinson.github.io/BikeLab/.

Repository: https://github.com/CraigHutchinson/BikeLab

Pages is configured through the GitHub API with build_type=workflow and HTTPS enforced. Under the [local-first CI policy](CI_WORKFLOW.md), `.github/workflows/full.yml` performs explicitly requested full validation. The separate `.github/workflows/pages.yml` accepts a manual request on main, requires successful hosted `ci/full` on the exact current-main SHA, and uploads only `dist/` from that verified SHA. Pushes and pull requests do not automatically deploy or rerun the full matrix.

Hosted workflows, including deployment, are paused through 31 October 2026. Keep the checked-in false guards and `BIKELAB_HOSTED_CI_ENABLED` unset/false until deliberate authorized resumption on or after 1 November. Do not dispatch Pages during the pause. Local receipts and old hosted successes do not qualify a different main SHA for publication.

All browser assets use relative paths for the /BikeLab/ project prefix. The module worker runs locally in each visitor's browser. No package install, build service, credentials or application server is needed by the deployed laboratory.

The optional browser test tooling is isolated from the application: full CI installs Playwright 1.56.1 in runner temporary storage. `scripts/browser-check.mjs` serves actual assets/modules/workers under a `/BikeLab/` prefix, exercises controls and saved-file agreement, and captures screenshots. The new `browser-and-idle-evidence` artifact retains the report and station exports/captures for 14 days; historical receipts name their earlier separate artifacts. Regenerate with the same script; a successful capture is not itself a visual inspection. For local use, install Playwright separately (or use an available playwright-core), and optionally set `BIKELAB_CHROMIUM` to the browser executable. Full local attestation requires pinned Playwright 1.56.1. The application vendors its pinned Rapier and MuJoCo runtimes and their notices; it requires no package installation. MuJoCo is served as a JS module plus a binary WASM asset, with exact application/wasm MIME type and no charset suffix. The single-thread build requires no cross-origin isolation.

## Operate and verify

After the pause is deliberately lifted, use `gh run list --workflow full.yml` and `gh run view RUN_ID` to inspect full validation. Request it with `gh workflow run full.yml --ref main` when needed. Only after successful exact-head `ci/full`, use `gh workflow run pages.yml --ref main` to deploy. Inspect Pages configuration with `gh api repos/CraigHutchinson/BikeLab/pages`.

Deployment is gated by the complete hosted suite, including subdirectory asset resolution. Deployment success is distinct from browser interaction and visual inspection. The pre-publication review is preserved in REVIEW_2026-10-15.md; its local-only repository status describes that earlier review point.

To roll back, revert the relevant commit on main, verify the new exact SHA, then request deployment separately after the pause. Changes to physics must still pass the numerical and browser/headless verification rules.
