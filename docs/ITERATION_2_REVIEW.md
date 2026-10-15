# Prior-iteration review before Slice 2

2026-10-15. Baseline: a1d96dd5a3fad932af777259f48f727e7fe3257b, including all six commits from the initial laboratory through Pages publication. All 32 tracked files were read: source, tests, scripts, settings, workflow and design/evidence documents. No existing PRs were returned. Shell Git transport was unavailable; the exact baseline files were retrieved through the GitHub connector and kept as a local comparison snapshot.

## Findings before implementation

- The wheel's relative contact velocity, gravity sign, unilateral force and effective clipping loss remain consistent with its documented surrogate. The analytical, free-flight, energy, convergence, extreme-input and sampling-independent diagnostics checks pass again. No wheel force-law change is warranted by this review.
- Complete-record validation, bounded inputs, CLI exclusive output, imported precision and worker generation guards are present and covered. Cancellation tests cover both calculation and file-read intervals. Record loading is correctly labelled as a setup rerun.
- Static assets use project-relative URLs. Pages gates main deployment on Linux/Windows tests and packages only dist/. The local server has an explicit allowlist; new station assets must be added to both serving and dependency verification.
- README reports 32 baseline tests; the roadmap still reports 31. The original review's local-only status is historical, as clarified by DEPLOYMENT.md. Update current status without rewriting historical receipts.
- The current model is explicitly vertical. Existing plans already mention 3D, but turning-force, combined-slip, full-wrench, inertia/sign and controller validation need actionable acceptance contracts. Add these before whole-bike assembly; preserve hardtail/full-suspension and the production-bike catalogue.
- Scalar axial suspension force must remain signed: a captured rebound damper can pull. Reusing the wheel's nonnegative normal-force clamp would violate the new element's power balance. Travel limits must not silently clamp motion or invent impact reactions.

## Baseline evidence and outstanding gate

Node v24.19.0: 31 socket-independent tests pass, zero skipped. The complete suite was attempted; its HTTP test cannot bind 127.0.0.1 in this session's sandbox (EPERM). Two requests for additional network permission were interrupted without results. Chromium launch also fails on a denied socket operation, even when prepared for request interception. These are environment limitations, not passing HTTP/browser checks.

The earlier visual acceptance item therefore remains open. The continuation prepares Slice 2 and its repeatable browser checks as reviewable work while retaining that gate; it does not declare either slice visually received. Numerical, browser/headless, screenshot, calibration and participant evidence must remain distinct. A successful future browser run must inspect actual screenshots, including mobile and extreme valid states, before changing this status.

Research was delegated to the user-requested GPT-6.1 Sol. See SUSPENSION_RESEARCH.md for primary sources actually read, derivations and preregistered validation targets. No physical calibration, final engine selection or 3D implementation is implied.
