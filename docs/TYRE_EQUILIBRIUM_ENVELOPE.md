# Equilibrium coverage and compression boundary — 6 November 2026

The broader grid confirms numerical agreement but does **not** receive the whole sampled material envelope. All 108 cases converge with both the dense and analytic solvers at unchanged force budgets. Only 72 pass every current receiving gate; 36 produce compressive hoop resultants. All 36 are in the sampled negative-coupling material set, and all still have a positive constrained tangent with the existing refinement margin. Numerical stability of this quadratic energy does not establish a tension-only membrane state.

The analytic route and 64-segment cap remain unchanged, and the dense route remains the default. The finding is a material/model acceptance boundary, not evidence that the analytic solver disagrees. Do not remove these cases, clip compressive stresses, flip coupling signs or loosen the acceptance test to obtain an all-green sweep. Nor does this finite grid justify a universal ban on negative coupling.

## Reproducible grid

Every combination is attempted: three geometries, three materials, two meshes (16/32 segments), three gauge pressures (40/160/320 kPa), and two starts (stress-free and a small asymmetric perturbation). There are 108 cases, 216 equilibrium solves and 54 comparisons between starts. This is deterministic coverage of illustrative parameters, not statistical confidence, calibrated tyre properties or proof over a continuous parameter interval.

| Geometry | Rim radius (m) | Bead half-width (m) | Reference height (m) |
| --- | ---: | ---: | ---: |
| compact | 0.200 | 0.010 | 0.035 |
| reference | 0.311 | 0.015 | 0.050 |
| wide | 0.360 | 0.025 | 0.065 |

| Material | Meridional rigidity (N/m) | Hoop rigidity (N/m) | Coupling rigidity (N/m) |
| --- | ---: | ---: | ---: |
| negative-coupling | 100000 | 60000 | -15000 |
| reference | 200000 | 100000 | 20000 |
| hoop-dominant | 150000 | 240000 | 0 |

The circular fixture now consumes explicit rim radius and bead half-width, preserving previous defaults. Reference contours use the existing circular-section geometry. The asymmetric start uses `x'=x+0.005*z` and `z'=z*(1+0.005*sin(pi*i/segments))`; both beads stay exactly fixed because their reference height is zero. All initial states pass the existing convexity and strain admission. Material positive definiteness is necessary but does not ensure tensile stress at the solved state.

## Findings and saved evidence

- Largest dense/analytic coordinate disagreement: **9.34e-16 m**, below the 2e-9 m comparison budget.
- Largest rest/asymmetric-start disagreement: **8.53e-12 m**, also below that budget.
- Largest analytic final force: **9.34e-6 N**; largest reference-area residual: **9.61e-4 Pa**. Existing gates remain 1e-5 N and 0.01 Pa.
- All 108 analytic equilibria pass the separate unshifted, two-step finite-difference tangent inspection. This concerns finite-dimensional axisymmetric perturbations only.
- The 36 excluded cases contain 6–32 compressive segments; the smallest hoop resultant is about **-2258 N/m**. Their explicit rejection reason is `compressive-resultants`. The other 72 have no compressive segments.

The [summary](evidence/tyre-envelope.json) includes every attempted case, both solver statuses/residuals/stress minima and all alternate-start comparisons. The [gzip/base64 archive](evidence/tyre-envelope-report.json.gz.b64) preserves the complete configurations, initial/final coordinates, forces, stresses, histories and stability diagnostics for both solvers. `archiveSha256` in the summary identifies the decompressed UTF-8 JSON bytes, including the final newline. Source hashes identify the normalized published source. The [inspected plot](evidence/tyre-envelope.svg) deliberately displays rejected cases alongside their small residuals and negative hoop stresses.

The sweep CLI exits **1**, after saving all evidence, because 36 cases fail model receiving. That result must not be described as a passing envelope sweep. The software regression tests instead verify that these states are correctly rejected despite convergence/stability, alongside input ownership/admission and a deliberately nonconvergent soft-material control. Software-suite evidence is in the [test receipt](evidence/tyre-envelope-tests.json); it is distinct from the failed model-envelope gate.

```
node --test test/tyre-envelope.test.mjs test/tyre-tangent.test.mjs test/tyre-equilibrium.test.mjs
node scripts/tyre-envelope.mjs
# Expected exit 1 for the recorded grid; report is saved before rejection.
python scripts/plot-tyre-envelope.py
```

To decode the tracked full archive with Python, use `gzip.decompress(base64.b64decode(path.read_bytes()))`, verify its SHA-256 against `archiveSha256`, then parse the returned JSON bytes. The report must contain all 108 rows and 54 start pairs; do not discard rejected rows.

## Next implementation and limits

Keep material acceptance explicit in future consumers: convergence, coordinate parity, tensile resultants and constrained stability are separate outcomes. The current quadratic model allows compression; a tension-field/wrinkling model is not implemented, and these cases cannot be accepted as tension-only casing behaviour. Physical material data and richer stress/shape receiving are needed before changing that model.

Next implement sealed-gas energy using a declared reference volume, initial absolute pressure, ambient pressure and exponent. Reuse the pressure-energy convention already received by the prescribed-deformation kernel. For the spatial casing, derive `Fpressure=pg(V)*grad(V)` and `Hpressure=-pg(V)*H(V)+(n*Pabs/V)*grad(V)*grad(V)^T`; validate the global rank-one term and reference-volume/ambient signs independently. Do not reuse a purely banded constant-pressure tangent for this coupled system. Keep gas reference volume distinct from stress-free material geometry and avoid assigning pressure twice. The next slice needs equilibrium plus energy/force/tangent checks at held-out pressures and an inspected plot.

Loaded shape/contact, calibrated material data, azimuthal stability, native integration, preallocated runtime scratch, inserts and failure/pressure-loss criteria remain open under #95. Existing rider browser replay and PR91 contact-refinement failures are unchanged; no new browser/full attestation or production performance claim. This bounded diagnostic finding is delivered under the user's merge-each-iteration instruction without claiming that every receiving gate passed.
