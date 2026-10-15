# Slice 2 evidence — axial suspension

2026-10-15. Implementation receipt: ccf298c06cb5de90c13c69b7ffba772ee963c9ee, model bikelab-suspension-0.1. Subsequent documentation records these results. [CI run 38721420155](https://github.com/CraigHutchinson/BikeLab/actions/runs/38721420155) ran the implementation at the pull-request merge revision. [Prior baseline review](ITERATION_2_REVIEW.md), [model decision](SUSPENSION_MODEL.md), [primary-source research](SUSPENSION_RESEARCH.md) and [3D requirements](THREE_DIMENSIONAL_DYNAMICS.md) are separate records.

## Delivered and tested

- Browser/headless preloaded axial coil with independent viscous compression/rebound coefficients; editable fork-scale and shock-scale fixtures, fixed/sine/bump base input and explicit initial state.
- Visible guided spring/damper mechanism, synchronized compression/force plots and spring/damper curves using the authoritative element evaluator. Pause, sample-step, scrub, speed, pin/compare, save and setup-rerun controls.
- Transactional travel-domain termination. Rejected trial stages cannot change the last accepted state. Partial evidence is retained, including one-sample runs and a final endpoint off the recording grid. No unmodelled end-stop impulse or clamped rebound.
- Complete setup/version validation, bounded recording, immutable defaults, precision-preserving UI conversion, cancellable worker reuse, independent analysis path and record verification including diagnostics/status/termination.
- Continued wheel station, unchanged force law, project-relative dependency checks and explicit local-server asset allowlist.

The full node --test suite passes **47 tests on both Ubuntu and Windows with Node 24**, none skipped. The local socket-independent subset passed 46 on Node v24.19.0; local HTTP/Chromium were sandbox-blocked, so their successful verification came from GitHub Actions. The browser job used Playwright 1.56.1 and Chromium 141.0.7390.37. No hardware performance conclusion is drawn from UI solve-time labels.

## Independent numerical evidence

The research note declared the engineering tolerances before implementation. Tests cover equilibrium and settled displacement at 12/45/95 kg, conservative/underdamped/critical/overdamped analytical trajectories at two mass/stiffness scales, unequal damping on independent half-cycles, signed-force power balance, positive dissipation, driven support work, harmonic amplitude/phase, three-step convergence, both stroke exits and extreme inputs.

Full analytical displacement errors must be below 0.1% of perturbation amplitude; velocity uses the corresponding natural-frequency scale. Conservative/damped residuals must be below 0.01% of mg stroke, moving-base residuals below 0.1%. Moving-base position agrees within 0.1% of base amplitude after the declared 8 s settling window. These thresholds establish numerical agreement with the synthetic equations, not physical fork/shock accuracy.

Default fixed-base 4 s fixtures, 0.5 ms integration:

| Metric | Fork-scale fixture | Shock-scale fixture |
|---|---:|---:|
| Independent static sag | 43.477694 mm | 11.554523 mm |
| Maximum compression | 75.000000 mm | 25.000000 mm |
| Minimum compression | 38.600186 mm | 10.397954 mm |
| Maximum signed axial force | 725 N | 590 N |
| Dissipated energy | 4.471451 J | 1.988589 J |
| Maximum energy balance residual | 4.73e-10 J | 3.51e-9 J |

For a 2 mm, 2 Hz sine base with equal 450 N s/m damping, integration steps 0.5/0.25/0.125 ms give force impulses 1765.624980238667 / 1765.624980238611 / 1765.624980238613 N s. Maximum energy residuals are 4.72e-10 / 2.95e-11 / 1.85e-12 J. Initial preload/displacement dominate this case's 725 N peak; full trajectories are compared too, so a constant initial peak alone is not the convergence evidence.

Travel-limit cases test outward motion from exactly zero/full stroke, inward motion from both boundaries, final valid-state retention and event-step refinement. The recorded attempted-step interval is not a root-located impact time. Extreme parameters either remain finite within stroke or end explicitly; the setup time-scale guard rejects excessively coarse configurations.

## Browser/headless and interaction evidence

The actual worker/module path was served over HTTP under a /BikeLab/ prefix. CI exercised wheel stepping, reference compatibility, save/load and high lift; suspension stepping/scrubbing, quarter-speed play/pause, reference gating, invalid-edit retention/discard, wrong-station imports, actual cancellation after dispatch, one-sample top-out and the shock preset. No page/console errors were captured. Mobile/narrow checks found no horizontal page overflow.

Browser-exported wheel, default suspension, immediate top-out and shock records were recomputed with Node. All suspension channel differences were zero in these checks. The wheel's largest force discrepancy was 1.1368683772161603e-13 N; its largest energy-residual discrepancy was 2.842170943040401e-14 J. All channels, metrics and event/termination checks passed the existing scaled 1e-10 agreement contract. Exact equality observed here is not a cross-runtime guarantee. The wheel and suspension exports were also verified again in the local Node runtime.

The machine-readable report is retained in [evidence/iteration-2-browser.json](evidence/iteration-2-browser.json). The CI browser-evidence artifact contains that report, four exported JSON runs and eight screenshots; CI retains artifacts for 14 days. Run scripts/browser-check.mjs to regenerate them.

## Visual inspection and prior gate closure

The eight captured PNGs were downloaded from CI and visually inspected, not merely counted:

- Wheel desktop at a bump/comparison cursor and a separated 200 mm initial-lift state: wheel/platen, guide, force indicator, graph cursor and readouts visible; high lift fits the scene.
- Wheel 390 px layout with advanced settings: controls, plots, comparison actions and warnings remain visible without horizontal overflow.
- Suspension desktop initial release and comparison at 0.5 s: spring/damper are visibly parallel, carriage/stroke indication agree with compression, both force branches and current curve markers are visible, and pinned traces share axes.
- Suspension immediate top-out: one-sample plots remain visible, Run is disabled, signed -600 N force is shown and both partial time window and unsupported-impact warning are explicit.
- Suspension shock preset at 390 and 320 px: controls and all four plots remain accessible; readout units wrap at narrow widths without overlapping neighboring values.

This closes the earlier missing-screenshot gate for the inspected states in headless Linux Chromium. It is not a native Windows display/input, all-browser, accessibility audit or participant evaluation. Historical Slice 1 receipts remain unchanged; their failed captures describe the earlier environment.

## Readiness and remaining limits

The bounded synthetic suspension station now has a visual consumer, a headless consumer, independent numerical tests and inspected replay evidence. Fork/shock hardware calibration, real friction/air/stop curves, linkage leverage and full-bike dynamics remain unimplemented. No real-product accuracy is claimed. 3D lateral/turning dynamics is explicitly required but planned; the next work package is whole-bike DOF/constraint enumeration and multibody solver evaluation before hardtail/full-suspension assembly.

Subsequent user requirement: physical overload/failure handling is mandatory before high-impact continuation is accepted. Current stroke-bound tests verify explicit termination only; they do not verify bottom-out reactions, rim/spoke strength, tubeless leakage, damage propagation or post-failure motion. See the [review addendum](ITERATION_2_REVIEW.md#user-addendum-travel-high-impact-loads-and-breakage) and [component failure contract](OVERLOAD_AND_FAILURE.md). No physical failure thresholds were introduced in this documentation addendum.

Spatial rock/ground geometry, local contact-stress prediction and adaptive/multirate real-time contact are also required by the user and remain unimplemented. The platen bump does not distinguish square edges from rounded rocks, and current solve-time labels do not demonstrate real-time handling of those contacts. [TERRAIN_CONTACT.md](TERRAIN_CONTACT.md) defines the separate correctness, adaptation and hardware-performance gates.
