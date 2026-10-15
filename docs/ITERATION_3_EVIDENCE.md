# Iteration 3 reference-comparison evidence

Baseline: merged PR #1 at fdeb07c. Architecture review: [ITERATION_3_ARCHITECTURE.md](ITERATION_3_ARCHITECTURE.md), committed before implementation.

## Delivered scope

The suspension station compares supported fixed-base, equal-damping runs against an analytical oscillator reference. White dotted compression/force traces and maximum/RMS compression, velocity and force errors are displayed. A labelled action selects fixed support and matches rebound to compression damping; it is disabled for unapplied edits. Unsupported conditions give a reason and no pass.

The worker returns a separate comparison sidecar. No reference force is applied to the numerical candidate. Saved simulation records and the force laws are unchanged. The CLI `node scripts/compare-suspension.mjs [setup.json]` produces a versioned report with complete setup, sampling grid and thresholds. Its built-in fixture has equal damping; an explicitly supplied file is used as supplied, so `{}` retains the station's asymmetric default and reports unavailable. Exit codes: 0 pass, 2 failed/unavailable comparison, 1 malformed input or I/O failure.

## Numerical and software evidence

54 local Node tests pass, none skipped. The reference itself is checked against independently written conservative/critical/overdamped trajectories, initial conditions, finite-difference ODE residuals, near-critical continuity and strong damping. Comparisons cover multiple masses/stiffness scales and timestep refinement, explicit unsupported states, deliberately perturbed channels, malformed grids, nonfinite/overflowed reports and CLI outcomes. Worker tests verify matching and stale sidecars.

For the default compatible fixture (45 kg, 9 kN/m, 50 N preload, equal 350 N s/m damping, 4 s, 0.5 ms integration / 5 ms recording), local maximum errors were:
- compression: 9.14845e-13 m;
- compression velocity: 1.21845e-11 m/s;
- axial force: 8.16669e-9 N.

Preregistered maximum limits are 1e-6 m, 1e-4 m/s and 0.1 N at the recorded times. These results are floating-point/numerical agreement for the synthetic law; they are not physical calibration, continuous peak/event error bounds or whole-bike real-time performance. No speedup or LOD-performance result is claimed.

Browser/CI evidence is pending for this working revision; update this receipt after the exact revision's checks and screenshot inspection.
