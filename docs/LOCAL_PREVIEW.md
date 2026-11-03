# Local preview and browser receiving

Use a normal host shell from the intended BikeLab checkout. `npm start` serves the allowlisted `dist/` assets at `http://127.0.0.1:4177/`. Keep the process running while inspecting the page. Stop only the process owned by this preview when finished.

For simultaneous checkouts, choose a distinct loopback port without changing application code:

```powershell
node --input-type=module -e "import {createPreviewServer} from './server.mjs'; const s=createPreviewServer(); s.listen(4178,'127.0.0.1',()=>console.log('http://127.0.0.1:4178/trail-bike.html'));"
```

Use ordinary development ports such as 4177/4178. Port 4190 is on the fetch restricted-port list and must not be used for the preview.

Confirm HTTP 200 for the page, imported modules, worker and physics assets, then wait for the visible READY/COMPLETED state. A listening banner alone does not prove host-browser reachability.

## Restricted desktop sessions

On 2026-11-02, a sandboxed Node process reported listening but sandbox fetch failed EACCES and the in-app browser timed out. Sandboxed Edge also exited with Windows 0x80070005 / Crashpad pipe errors. The approved host execution path resolved both without modifying the server, browser flags or OS security settings. For an agent, request a narrowly scoped host execution for the loopback-only preview/test when required; do not disable security protections or expose the server on all interfaces. Leave the preview alive when the user asks to check it.

A separate rider-branch defect was then exposed: twelve imported rider assets were absent from the server allowlist. The existing `test/server.test.mjs` enumerates every top-level dist asset and caught the first 404 once loopback worked. It now passes with the complete list. A sandbox failure must never be treated as coverage of the assertions it prevented.

## Focused rider checks

Set `NODE_PATH` to an existing isolated Playwright package directory and optionally `BIKELAB_CHROMIUM` to an installed Chromium-family executable. Use `BIKELAB_ARTIFACTS` to retain separate attempts, then run:

```powershell
npm run browser-check:rider
```

The command uses a temporary browser profile and ephemeral loopback port, serves assets beneath `/BikeLab/`, and runs the same `checkRiderDrive` function as the full browser suite. It records Node/Playwright/browser versions, captures, errors, both-bike cases and full-record replay outcomes. Native UI assertions fail immediately. Numerical replay assertion failures are retained while later UI cases run; any replay failure leaves `success: false` and a nonzero exit. `uiChecksCompleted` is distinct from overall success. The full browser suite retains its original fail-fast comparator. Inspect saved captures as a separate visual gate.

This command is not `ci:full` or a hosted/cross-platform attestation. Full local coverage still requires the pinned tooling and all checks in [CI_WORKFLOW.md](CI_WORKFLOW.md). Hosted CI and Pages are not enabled by starting a preview or running this command.
