# Iteration 6 evidence

Baseline reviewed: ed17ec7936c5bbe99ec7b0754bf095b13ece50f9, after PR #5 was merged and deployed. The user's direction parks solver precision polishing and proceeds to coupled dynamics. See ITERATION_6_REVIEW.md and BIKE_RIG.md for the decision and boundaries.

## Received implementation

`bike.html` provides actual 3-coordinate hardtail and 4-coordinate single-pivot assemblies, two prescribed platen inputs, editable masses/spring/damping values, geometry-driven shock leverage, replay, synchronized load/travel plots, saved-setup reconstruction and explicit last-valid-state termination. `scripts/bike-rig.mjs` receives the same physics. MuJoCo 3.16.0 is pinned with SHA-256 artifact checks, upstream licence and bundled dependency/runtime notices. Existing stations and their numerical gates are retained.

## Checks completed locally

- 88/88 unfiltered Node tests on Windows, Node 24.19.0; no skips. Thirteen new checks cover independent static load/fork force balance, actual native joint count and linkage geometry, finite-difference shock virtual work, both assemblies at multiple mass/spring scales, unilateral loads, travel bounds, energy/work accounting, refinement, reproducibility, recording-cadence invariance, input/record validation and artifact integrity.
- Full browser suite passed using isolated headless Edge 156.0.4314.8 and the real module worker under `/BikeLab/`. Both 801-sample bike exports match the headless path with maximum absolute channel differences below 1.6e-11, against a declared 1e-8 tolerance. These are numerical comparisons, not claims of bit identity across runtimes.
- UI checks cover both variants, disabled irrelevant shock controls, step/play/pause/scrub, export/import, dirty state, empty input, cancellation, wrong-model rejection, unsettled setup, travel termination and page lifecycle/320 px/390 px resize recovery. Desktop, mobile and stopped-run screenshots were captured. Full-suspension desktop, hardtail mobile and stopped-state images were visually inspected; geometry, contact plate positions, legends and controls were legible in these states.
- Browser checks discovered an exact MIME-type requirement for streaming WASM. The preview server now serves `application/wasm` without a charset suffix; a server regression covers it. No page/console errors remain.

Nominal independent static checks: front/rear hardtail loads 352.787/520.005 N; full suspension 350.100/522.692 N. Both sum to the 89 kg total weight. Fork compression is 32.927/32.075 mm respectively. Maximum energy/work residual is 0.00381 J hardtail and 0.00180 J full suspension, below the declared 0.02 J nominal gate. Refinement 0.25 to 0.0625 ms stays within 1% peak load and 0.1 mm suspension-travel differences. These tolerances are specific to the nominal smooth experiment.

An 80 mm, 0.2 s bump on the 200 N·s/m fork-damping hardtail stops at a trial time 1.150250 s with last valid time 1.150125 s. It does not continue through top-out. Zero fork damping in the tested setup rejects as insufficiently settled rather than being mistaken for an excitation-time failure.

Machine-readable local receipt: ITERATION_6_RECEIPT.json. Regenerate raw screenshots/exports with `node scripts/browser-check.mjs`; output defaults to ignored artifacts/browser. CI retains the complete browser-evidence artifact. Exact-head hosted checks and deployment are required before merge/delivery; their run links are recorded in the PR.

## Review and remaining scope

The review covered force sign/lever-arm mapping, body/DOF ownership, repeated-run resource cleanup, finite/bounded inputs, rollback to the last accepted state, recording independence, worker cancellation/stale-file handling, WASM path/MIME/integrity/licensing and responsive UI. Findings fixed include WASM MIME, lost select value on setup import, incomplete saved setups, empty numbers silently becoming zero, visually disconnected shock mounts and fork-axis drawing alignment.

This is an uncalibrated fixture with locked longitudinal translation and wheel spin, fixed rider and illustrative mass/inertia. No real-time budget, real-bike transient match, native end stops, physical failure, spatial/layered terrain or 3D handling has been established. Fixture wrench telemetry and continuous event location are still follow-ups. Solver perfection remains parked; the next balanced dynamics slice is passive rider compliance with explicit attachment/load/work paths and comparison against this fixed-rider baseline.
