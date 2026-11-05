# Constant-pressure bicycle membrane reference

Issue #95 now has an independent static geometry/load reference before selection of a production casing law. `scripts/lib/tyre-static-reference.mjs` implements model `bikelab-constant-pressure-membrane-reference-0.1`; the CLI saves complete inputs/results and displays progress through 200 load solves. The scientific viewer plots load/deflection, deformed cross sections and growing footprints. It does not run the solver while plotting.

This is an offline, constant-gauge-pressure, thin inextensible membrane approximation on a flat rigid plane. It is separate from the sealed polytropic strip chamber and Cartesian diagnostic. Numerical convergence does not establish tyre calibration, dynamic validity or a production replacement. No pressure, casing or insert contribution is added to the current native foundation by this work.

## Reference and source audit

Primary source: J. Renart and P. Roura-Grabulosa, *Deformation of an inflated bicycle tire when loaded*, American Journal of Physics 87, 102–109 (2019), [doi:10.1119/1.5086008](https://doi.org/10.1119/1.5086008), [author manuscript](https://arxiv.org/pdf/1902.03661), read 5 November 2026. The implementation uses the cross-section geometry and rim-stress integral of equations 7–16. The footprint integral is derived directly from width times longitudinal distance, yielding equation 20; the inconsistent printed area expression in equation 19 is not copied into the implementation. Appendix II's printed `C − 2 WC` is inconsistent with contour closure; the required term is `C − 2 WL`.

The Figure 4 caption supplies redundant dimensions that do not close:

| Quantity | Printed value | Treatment |
| --- | --- | --- |
| Rim radius `L` | 0.2825 m | Retained |
| Rim width `w` | 0.01904 m | Retained |
| Initial section radius `r0` | 0.0158 m | Retained |
| Major radius `R` | 0.2968 m | Preserved in audit; not used as an independent dimension |
| Gauge pressure `P` | 600000 Pa | Retained |
| Geometrically derived `R` | 0.2951099008719339 m | Used only in the explicitly labelled reconstruction |

The printed-minus-derived radius difference is **1.690099 mm**. At 6 mm deflection this reconstruction gives **600.309950 N** from rim stress and **660.680732 N** from pressure times footprint, versus the text's reported 659 N. Neither residual is an acceptance test. Selecting the closer estimate or changing dimensions would hide the source inconsistency. Exact Figure 4 reproduction and physical calibration remain unavailable.

The manuscript's later experimental captions/tables also contain ambiguous radius/diameter units and pressure labels; they are not silently repaired into measurement inputs. Its slow tests used two plates, a 5 N preload, wheel weight, locally ground tread and 5 mm/min displacement. A two-plate displacement is not directly a single ground-contact hub deflection. If those data are received later, compare `D(F) = db(F + mg) + dt(F) − db(F0 + mg) − dt(F0)` with explicit machine-force convention, preload, weight, tyre thickness and uncertainty. Digitized plots are not raw measurements.

## Coordinates, geometry and force conventions

All solver inputs and outputs use SI. `L` is the rim attachment radius, `w` the rim attachment width, `r0` the unloaded cross-section radius and `P` constant gauge pressure. Longitudinal `x` follows the flat plane; transverse `y` spans the tyre; `z` points upward. Positive hub deflection `d` compresses the tyre. Reported loads are positive resisting-load magnitudes, not signed generalized dynamic forces.

```text
phi0 = acos(w / (2 r0))
H0 = r0 (1 + sin phi0)
R = L + r0 sin phi0
Re = L + H0 = R + r0
C = w + r0 (pi + 2 phi0)
B = C − 2 w
N(phi) = pi + 2 phi − 2 cos phi
r(phi) = B / N(phi)
H(phi) = r(phi) (1 + sin phi)
W(phi) = w − 2 r(phi) cos phi
```

For local compression `c`, solve `H(phi) = H0 − c` by bounded bisection on `[phi0, pi]`. Height decreases monotonically on this branch. The right sidewall arc has centre `(y,z) = (W/2,r)` and angle from `−pi/2` to `phi`; reflect it for the left side. The arcs join the rim at `±w/2`, join the ground at `±W/2`, and preserve `w + 2 r (phi + pi/2) + W = C`. The permitted branch can extend beyond `phi = pi/2` without sidewall crossing or rim intrusion; tests check the actual arcs.

At longitudinal angle `theta`, use the cancellation-resistant geometry:

```text
thetaC = 2 asin(sqrt(d / (2 Re)))
x = Re sin theta
c(theta) = (d − 2 Re sin²(theta/2)) / cos theta
c(thetaC) = 0 exactly
D(theta) = r0 cos phi0 − r(theta) cos phi(theta) = W(theta)/2
Fstress = 4 L P integral[0,thetaC] D(theta) cos theta dtheta
Afoot = 2 Re integral[0,thetaC] W(theta) cos theta dtheta
Ffoot = P Afoot
```

The two approximate load estimates are accumulated separately. Their ratio is `Fstress/Ffoot = L/Re`; they are not two independent force contributions to add together. Their difference is model approximation, not quadrature error. In the illustrative MTB case the ratio is 0.847456, so the discrepancy is material even when numerical residuals are tiny.

For small deflection, differentiate the local closure to obtain `k = dW/dc` at zero. Independently integrating the limiting parabolic footprint gives `Ffoot / d^(3/2) → (4/3) P k sqrt(2 Re)`, and the stress coefficient is `L/Re` times this value. The exact limiting `4/3` comes from integrating `1 − u²` over `[-1,1]`; it is not the paper's fitted finite-load coefficient.

## Admission and numerical budgets

Configuration requires explicit provenance (`illustrative`, `source-derived` or `measured`, with a reference). Accepted numerical dimensions are `0.15 ≤ L ≤ 0.45 m`, `0.005 ≤ w ≤ 0.08 m`, `0.005 ≤ r0 ≤ 0.05 m`, `w < 2 r0`, and `10000 ≤ P ≤ 1000000 Pa`. These are software admission bounds, not product pressure limits or calibrated applicability. Report `r0/R`: it is 0.089026 for the illustrative MTB and 0.053539 for the Figure 4 reconstruction; other admitted dimensions can approach 0.25, where the thin-torus approximation is particularly questionable.

The experimental compression envelope is `0 ≤ d,c ≤ H0/2`. It limits this reference's geometry; it is **not** a tyre, insert or suspension bottom-out threshold. Unsupported geometry or unresolved positive compression rejects explicitly. No clipping permits impossible continuation.

The default uses 128 composite Simpson panels and a `1e-13 rad` bisection bracket. Options allow power-of-two panels from 16 through 4096 and angle tolerance from `2e-15` through `1e-8 rad`; roots are bounded to 64 iterations. Positive compression at or below `2 r0 * angleTolerance` is unresolved. More panels can sample a smaller contact-edge compression and therefore reject a solve that coarser quadrature admits. The domain error includes panel/index, angle, local compression and requested accuracy. This is deliberate fail-closed behavior, not a claim of monotone admission with refinement.

Budgets declared before receiving: geometry closure `2e-13 m`; root bracket `1e-13 rad` by default; default quadrature load error `1e-8 N + 1e-7 relative` against the finer reference; default-root load difference `1e-8 N`; small-deflection coefficient relative error `2e-4`. Coarse user-requested root tolerances are controls, not received default accuracy. Independent chord integration uses `2e-8 m` and finite-difference width slope `2e-6` absolute. Refining the independent chord mesh from 2048 to 4096 resolved its initial discretization failure without widening its budget.

## Receiving and reproduction

Source checkpoint: published `628f3792fbdbcec8c2fd9cdce5209db8a41c43b5`, tree `b688bf8cf115290064d93e6f87e424d7ec125dd0`, equivalent to local synthetic-history commit `e03e13d5cac1b9cb964d85a7f9a6c9b3e579a926`. All **21 focused checks pass**: nine pressure, four Cartesian and eight static-reference checks. The complete Linux in-process suite finishes **440/453**, with the same thirteen environment-blocked failures as the earlier archived Linux receipt, zero skips/cancellations. Eleven failures directly expose `spawnSync EPERM`, one exposes loopback `listen EPERM`, and the headless rider-task check parses empty subprocess output; a minimal child-process control also reports `EPERM` with empty output. Source/test/plot hashes stayed fixed during the run. Documentation was prepared concurrently. The [receiving receipt](evidence/tyre-static-reference-tests.json) and [complete logs](evidence/tyre-static-reference-logs.json.gz.b64) preserve the results. This is an exploratory in-process run, **not** a successful full suite or exact-head full attestation; the upstream Windows 445/445 receipt retains its earlier source identity.

The CLI completes **200 solves**: 124 curve states at three illustrative MTB pressures and the source-derived reconstruction, 66 quadrature/root controls, six asymptote samples, three complete footprint profiles and one labelled source comparison. Across the six refinement groups, the maximum default-versus-512-panel stress-load difference is `4.908e-7 N`; default-versus-tight-root difference is `5.003e-12 N`. Small-load ratios approach one; at `d/H0 = 1e-5` the MTB footprint ratio is 0.9999957114 and the reconstruction ratio is 0.9999957553. These receive the declared controls, not every admitted geometry.

The PNG was actually inspected: all three scientific panels are visible; a footprint legend initially overlapped its axis label and was moved clear. This is scientific-plot verification, not a browser or product-interaction receipt. The plot has no fitted tyre parameters.

[Complete report archive](evidence/tyre-static-reference.json.gz.b64) preserves the compact JSON losslessly as gzip/Base64 text; [SVG visualization](evidence/tyre-static-reference.svg) is directly viewable. Raw report SHA-256 is `2b11438110ebaa26668c77fba0db9dba4b6d6fa97821410dc92574baa74722f2`. Decode/decompress was checked byte-for-byte. To render from saved evidence without solving again:

```sh
python - <<'PY'
import base64, gzip, hashlib
from pathlib import Path
data = gzip.decompress(base64.decodebytes(Path('docs/evidence/tyre-static-reference.json.gz.b64').read_bytes()))
assert hashlib.sha256(data).hexdigest() == '2b11438110ebaa26668c77fba0db9dba4b6d6fa97821410dc92574baa74722f2'
out = Path('artifacts/tyre-static-reference-received')
out.mkdir(parents=True, exist_ok=True)
(out / 'report.json').write_bytes(data)
PY
MPLCONFIGDIR=/tmp/bikelab-mpl python scripts/plot-tyre-static-reference.py artifacts/tyre-static-reference-received/report.json
```

```sh
node --test --test-isolation=none test/tyre-pressure.test.mjs test/tyre-pressure-cartesian.test.mjs test/tyre-static-reference.test.mjs
node scripts/tyre-static-reference.mjs artifacts/tyre-static-reference
MPLCONFIGDIR=/tmp/bikelab-mpl python scripts/plot-tyre-static-reference.py artifacts/tyre-static-reference/report.json
node --test --test-isolation=none
```

Plotting requires NumPy and Matplotlib (received with Matplotlib 3.10.8); the CLI/tests use Node 24.19.0 here. The report records SHA-256 for all four source/test/plot files before and after execution. No new product/browser force path is introduced. Preserve the separate [failed Edge replay receipt](evidence/pr96-full-local-failure.json); rerunning that unchanged browser scenario is not evidence for this offline model.

Source-head hosted [Smoke 42060966038](https://github.com/CraigHutchinson/BikeLab/actions/runs/42060966038) passed; Full 42060965865 was deliberately skipped. No full hosted matrix or deployment was requested. GPT-6.1 Sol performed bounded read-only implementation and documentation review; the review's contact-edge context, default-panel check and thin-ratio caveat are included. Review is separate from numerical execution and calibration.

## Next decision and retained limits

Use this reference to compare a pressure-dependent reduced ring/foundation against an explicit casing-energy and gas-volume model. Record load, footprint and local-shape differences separately, including the reference's own approximation gap. Do not tune a force table to the convenient estimate or mix constant-pressure reference behavior with sealed-chamber thermodynamics. Choose material/rim geometry, a realizable stress-free state and unloaded pressurized equilibrium; derive forces and hub reactions from that model before production replacement. Seek measured inflated dimensions, footprint and held-out load/pressure data to distinguish material stiffness from pressure response. Then measure complete runtime cost at equal accuracy, as required by the [accuracy/cost contract](TYRE_ACCURACY_COST.md).

Insert clearance, compression energy and loss need their own law. Physical travel stops and rim/spoke damage, pinch, bead release, tubeless seal loss and leakage still require sourced limits and failure states. This flat static model does not qualify sharp/faceted impacts, rolling, traction, layered soil/mud/root contact, suspension/rider dynamics or 3D lateral/turning forces. Those remain explicit requirements for synthetic trail data and real-time game use; no admission guard is loosened by this reference. #95 stays open and PR96 remains draft.
