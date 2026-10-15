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

## Subsequent closure during this iteration

The socket limitation was avoided by running the repository's PR workflow on GitHub Actions, not by changing local sandbox policy. CI run 38721420155 passed all 47 tests on Linux and Windows, plus actual Chromium interactions and browser/headless exports. All eight captured screenshots were downloaded and inspected, including the wheel's desktop/high-lift/mobile states. This closes the earlier screenshot gap for those states. The review findings above describe the pre-implementation decision point; the final evidence and remaining limitations are in SLICE_2_EVIDENCE.md.

## User addendum: travel, high-impact loads and breakage

Review requirement: suspension must respect its physical top-out/bottom-out limits. A high impact must resolve through stop reactions, admissible deformation and, when component capacity is exceeded, physical failure rather than impossible travel or intact geometry. This includes rim damage/fracture, individual spoke failure and tubeless pressure loss caused by rim/bead-seat deformation.

**Current disposition:** the station already rejects out-of-stroke trial states, retains the last valid samples and reports travel-limit. Its boundary tests cover both exits, inward/outward boundary motion, state rollback and step refinement. This enforces the bounded model's stroke but does not compute end-stop impact loads or predict which component breaks. Existing successful test/visual evidence must not be read as validation of crash survivability.

**Open requirement before high-impact capability can be accepted:** establish end-stop/load-path behavior and the failure basis for every active component. [Overload and failure contract](OVERLOAD_AND_FAILURE.md) supplies the review matrix, data/provenance requirements, coupled rim/spoke/seal/pressure behavior, post-failure handling and acceptance gates. No arbitrary universal breaking force is approved. Bottom-out can be survivable; a rim strike or lateral overload can cause damage before bottom-out. Damage must be determined from the supported component criterion and load path.

## User addendum: spatial rock contact and adaptive computation

A square rock edge is not equivalent to a rounded obstacle or flat support of the same height. Review input support for spatial profile vertices/height samples with coordinates, 3D surfaces or well-defined contact candidates. Contact location, normal, patch/deformation and moment arm must drive loads and the failure assessment. Preserve front-face/edge geometry and multiple contacts; a single under-axle height cannot determine local stress.

Fine contact/impact computation should activate only where needed and may use a separate physics rate to support real-time execution. Require predictive feature/contact detection, explicit fidelity/error criteria, conservative force/impulse/work exchange, consistent state transfers and persistent pressure/damage state. Compare adaptive runs against a converged always-detailed reference, then measure real-time costs under repeated/simultaneous impacts. Budget pressure must not suppress failures or permit overtravel/tunnelling.

**Current disposition:** the time-driven flat platen is not a spatial obstacle model, and the current solver has no adaptive multirate contact. [Terrain/contact and real-time contract](TERRAIN_CONTACT.md) defines inputs, stress limitations, switching/rate synchronization, geometry/timestep convergence and performance gates. These are required future capabilities, not claims supported by the existing 47-test receipt.
