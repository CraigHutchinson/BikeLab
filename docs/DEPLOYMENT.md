# GitHub Pages deployment

The public laboratory is https://craighutchinson.github.io/BikeLab/.

Repository: https://github.com/CraigHutchinson/BikeLab

Pages is configured through the GitHub API with build_type=workflow and HTTPS enforced. The .github/workflows/pages.yml workflow tests Node 24 on Windows and Linux, uploads only dist/, and deploys after both platforms pass. Pull requests test without publishing. A push to main or a manual workflow_dispatch on main publishes the static site.

All browser assets use relative paths for the /BikeLab/ project prefix. The module worker runs locally in each visitor's browser. No package install, build service, credentials or application server is needed by the deployed laboratory.

## Operate and verify

Use gh run list --workflow pages.yml to find runs, then gh run view RUN_ID to inspect the test and deployment jobs. Use gh workflow run pages.yml --ref main to redeploy main. Inspect Pages configuration with gh api repos/CraigHutchinson/BikeLab/pages.

The workflow is gated by the complete automated suite, including subdirectory asset resolution. Deployment success is distinct from browser interaction and visual inspection. The pre-publication review is preserved in REVIEW_2026-10-15.md; its local-only repository status describes that earlier review point.

To roll back, revert the relevant commit on main and let the same tests and deployment run. Changes to physics must still pass the numerical and browser/headless verification rules.
