# Iteration 3 reference-comparison evidence

Baseline: merged PR #1 at fdeb07c. Architecture review: [ITERATION_3_ARCHITECTURE.md](ITERATION_3_ARCHITECTURE.md), committed before implementation.

## Delivered scope

The suspension station compares supported fixed-base, equal-damping runs against an analytical oscillator reference. White dotted compression/force traces and maximum/RMS compression, velocity and force errors are displayed. A labelled action selects fixed support and matches rebound to compression damping; it is disabled for unapplied edits. Unsupported conditions give a reason and no pass.

The worker returns a separate comparison sidecar. No reference force is applied to the numerical candidate. Saved simulation records and the force laws are unchanged. The CLI `node scripts/compare-suspension.mjs [setup.json]` produces a versioned report with complete setup, sampling grid and thresholds. Its built-in fixture has equal damping; an explicitly supplied file is used as supplied, so `{}` retains the station's asymmetric default and reports unavailable. Exit codes: 0 pass, 2 failed/unavailable comparison, 1 malformed input or I/O failure.

## Numerical and software evidence

55 local Node tests pass, none skipped. The reference itself is checked against independently written conservative/critical/overdamped trajectories, initial conditions, finite-difference ODE residuals, near-critical continuity and strong damping. Comparisons cover multiple masses/stiffness scales and timestep refinement, explicit unsupported states, deliberately perturbed channels, malformed grids, nonfinite/overflowed reports and CLI outcomes. Worker tests verify matching and stale sidecars.

For the default compatible fixture (45 kg, 9 kN/m, 50 N preload, equal 350 N s/m damping, 4 s, 0.5 ms integration / 5 ms recording), local maximum errors were:
- compression: 9.14845e-13 m;
- compression velocity: 1.21845e-11 m/s;
- axial force: 8.16669e-9 N.

Preregistered maximum limits are 1e-6 m, 1e-4 m/s and 0.1 N at the recorded times. These results are floating-point/numerical agreement for the synthetic law; they are not physical calibration, continuous peak/event error bounds or whole-bike real-time performance. No speedup or LOD-performance result is claimed.

## Hosted, browser and visual evidence

Implementation head dc62b3a passed [CI run 38737392555](https://github.com/CraigHutchinson/BikeLab/actions/runs/38737392555): 55 tests on both Windows and Linux plus Chromium/browser-headless checks. The durable [browser report](evidence/iteration-3-browser.json) records five exported runs, eleven screenshots and no captured console/page errors.

The browser checks cover the actual module-worker sidecar, reference-compatible setup action, unavailable state, dirty-edit gating, two reference overlays, save/load reconstruction, displayed metric agreement with Node, and a valid coarse-step failure followed by a passing half-step refinement. They preserve the previous wheel/suspension checks.

Inspected the final implementation's reference desktop, 390 px mobile and coarse-failure screenshots. The panel, units, maximum/RMS values, applicability messages and white dotted overlays are readable. Initial screenshot review exposed a minimum plot range and rounded tick labels that hid tiny motion; the final plot now scales to the data and uses range-appropriate precision. The high-stiffness failure screenshot visibly reports approximately 0.303 N maximum force error. A 0.25 ms step passes the same declared limits after the 0.5 ms step fails.

CI retains screenshots and exports in browser-evidence for 14 days; scripts/browser-check.mjs regenerates them. Headless Chromium visual/interaction evidence is distinct from native Windows display/input, physical calibration and participant feedback. The receipt commit changes documentation/report data only; exact-head CI remains required before merge.

## Final code review

Enumerated comparison consumers: worker, Calculation callback, suspension viewer, CLI, existing oscillator tests, dedicated oracle tests and browser checks. The wheel viewer ignores the new optional callback argument; existing force laws and saved-run schemas are unchanged. Transfer buffers are deduplicated because candidate/reference time samples share one buffer.

Reviewed state ownership, cancellation/stale results, finite bounded inputs, sample-grid alignment, critical/overdamped conditioning, conservative travel eligibility and report serialization. Fixed a missing-sidecar UI fallback and rejected overflowing malformed comparison differences. No remaining blocker was identified for this bounded comparison slice.

The next receiving physics work remains coupled multibody/contact evaluation and the hardtail/full-suspension rig, leading toward an actual setup/ride/replay experience. Reference shadowing, live physics LOD swaps, layered mud/root mechanics, full 3D riding and real-bike fidelity remain unimplemented.
