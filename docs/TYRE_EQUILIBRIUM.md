# Fixed-bead spatial equilibrium receiving — 6 November 2026

PR98 exposed nonzero local forces despite circular-family stationarity. This increment solves the free meridian coordinates of that same energy with both beads fixed. It receives nine illustrative pressure/mesh cases, not a calibrated tyre or native runtime integration. Constant reservoir pressure, the existing convex geometry/strain admission and the illustrative biaxial energy are unchanged.

## Solve and failure contract

Only interior axial/radial coordinates are unknown. The gradient is minus the saved local force. Central differences of that analytic force at +/-1e-7 m form a dense constrained Hessian; raw antisymmetry is reported before symmetrization. Newton directions use Cholesky triangular solves, never an explicit inverse for the step. If the unshifted tangent does not factor, a bounded diagonal-shift sequence seeks a finite descent direction. Shifted positive definiteness is never used as physical stability evidence.

Backtracking accepts valid geometry/strain states satisfying Armijo sufficient decrease (coefficient 1e-4). A candidate outside the existing model domain is rejected without clipping. The solver stops explicitly on iteration limit, exhausted backtracking, unavailable finite-difference probes or no descent direction. Unknown numerical options are rejected. Zero iterations/backtracks are deliberate failure controls. Default iteration cap is 80; dense solve admission is at most 64 segments.

Convergence requires BOTH maximum free-node force <=1e-5 N and maximum force divided by nodal tributary reference area <=0.01 Pa. The area is half the sum of the adjacent reference segment areas, not total tyre area. Fixed bead coordinates remain exactly unchanged. Compression count is reported separately; a root is not automatically a valid tension-only membrane state.

One initial continuation check stalled because predicted energy change was below floating-point resolution while force was still above its gate. The fix preserves both force thresholds. Only when predicted decrease is no larger than `64*epsilon*(1+|materialEnergy|+|pressurePotential|)` may a trial use a roundoff acceptance path: energy must stay within that allowance and BOTH residual measures must reduce by more than half. History records the allowance and acceptance type. This is not strict monotone energy descent; two of the nine received cases use this path. Ordinary accepted steps still satisfy Armijo and strictly decrease the computed potential. Tiny steps without residual progress cannot claim convergence.

The method follows the descent/Armijo distinction documented in [SciPy line-search documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.line_search.html), but implements Armijo backtracking rather than SciPy's strong-Wolfe search. Cholesky's positive-definite requirement follows [LAPACK DPOTRF](https://netlib.org/lapack/explore-html/d2/d09/group__potrf_ga84e90859b02139934b166e579dd211d4.html). These sources guide the numerical contract, not physical tyre validation.

## Separate tangent stability check

After residual convergence, inspect the UNMODIFIED constrained tangent at 1e-7 and 5e-8 m steps. Record matrix infinity-norm difference, raw antisymmetry, unshifted factorization outcomes and conditioning estimate. For the finer positive matrix, triangular solves for unit right-hand sides estimate its inverse infinity norm, giving a symmetric-matrix eigenvalue lower bound `1/||H^-1||inf`. Compare it to ten times the step-difference plus antisymmetry estimate, plus a 1e-10 matrix-scale margin. Insufficient or conflicting results are **indeterminate**, not stable. These finite-difference/roundoff estimates are numerical evidence, not an interval-arithmetic proof.

The received classification is `positive-with-refinement-margin`. It concerns finite-dimensional, fixed-bead, axisymmetric perturbations only. No azimuthal buckling, global minimum, bending, wrinkling, contact or physical stability is inferred. The tests also perturb a solved state in an independent direction and verify increased potential. Initial rest shapes at positive pressure have unshifted tangents that fail the positive-definite check; regularized descent from them does not erase that finding.

## Receiving results

Complete Windows Node suite: **467/467 pass**, zero failures/skips/cancellations; [source-hashed receipt and complete normalized log](evidence/tyre-equilibrium-tests.json). Numerical source/tests stayed fixed during the run. A bounded read-only Terra numerical-method review checked descent, finite-difference and stability safeguards; final implementation and numerical tests were reviewed locally. This is not a full/browser attestation.

The [complete report](evidence/tyre-equilibrium.json) preserves nine cases: 16/32/64 segments at 80/160/240 kPa, with pressure continuation, all coordinates, forces, strains, bead loads/supports, solver histories and tangent diagnostics. All converge in 3–7 accepted steps, have zero compressive segments and positive tangents with refinement margin. Largest final force is 4.93e-6 N; largest area-normalized residual is 5.75e-4 Pa. The smallest tangent lower bound is about 1904 N/m, versus a largest numerical perturbation estimate about 1.71 N/m.

At 160 kPa the computed volumes are 4830.826, 4886.692 and 4900.734 cm³ across the three meshes. The final difference is about 0.287% of the 64-segment value. This shows refinement behavior; no physical error budget or mesh-independent acceptance is invented from it. Geometry/load data and uncertainty are still required for calibration. The [inspected plot](evidence/tyre-equilibrium.svg) shows solved meridians, residual histories and volume refinement.

Five new tests receive pressure continuation, fixed beads, energy/roundoff acceptance, separate regularization/stability, mesh and alternate-start agreement, zero-pressure rest, iteration/backtracking exhaustion, invalid constraints/options and owned deterministic output. A separate 8-segment control and a different circular start test prevent reliance on one mesh or initial state. The CLI preserves complete attempted results before asserting its receiving conditions.

## Cost and next gates

This is an offline correctness reference: finite-difference tangent construction has O(N²) work/storage and dense factorization O(N³), with allocated diagnostic arrays. No real-time or optimal-cost claim. The underlying constant-pressure segment energy is local; next derive and receive its analytic block-banded tangent against this dense reference, then measure complete equal-accuracy cost. Do not put this dense reference into the per-step production loop.

Next also receive richer pressure/geometry/material sweeps and constrained stability, then sealed-gas energy and loaded/contact behavior with source-backed physical data. A load or radius match alone cannot calibrate all material parameters. Nonaxisymmetric stability, native integration, inserts, failure/pressure-loss criteria and the existing browser/PR91 failures remain open. #95 is not closed. Deliver this bounded offline increment under the user's merge-each-iteration direction.

```
node --test test/tyre-equilibrium.test.mjs
node scripts/tyre-equilibrium.mjs
python scripts/plot-tyre-equilibrium.py
```
