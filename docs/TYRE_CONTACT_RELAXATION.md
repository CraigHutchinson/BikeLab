# Contact phase and restricted tension relaxation - 17 November 2026

A separately versioned, explicitly uncalibrated tension-only candidate now passes the sampled **fine-mesh offline loaded gate**. It is not promoted to the native moving wheel or trail-bike. The original and endpoint laws remain available and the production default is unchanged.

## Received result and remaining limits

| Check | Result |
| --- | --- |
| Relaxed load/unload states, all meshes | 126/126 converged and locally admissible |
| Fine mesh (256/512), three pressures, two phases | 84/84 locally admissible states |
| Fine phase and mesh comparisons | 48/48 pass unchanged 1 N + 5% reaction budget |
| Fine unloading returns | 36/36 pass 1e-4 N force and 1e-8 J energy budgets |
| All unloading returns | 54/54 pass |
| Coarse comparisons involving 128 stations | 18 failures retained |

The pressures are 1.2/1.6/2.0 bar and lowering is 0/1/2/4/2/1/0 mm. At 1.6 bar/2 mm the relaxed 512-station reactions are 402.75 and 402.83 N in the two phases. The original endpoint material instead approaches approximately 476 N while retaining compressive resultants. At only 32 stations the endpoint control gives 668.77 versus 167.47 N depending on contact phase. This identifies coarse contact resolution as a distinct contributor; relaxing material does not cure coarse sampling.

The [inspected plot](evidence/contact-relaxation.svg), [summary](evidence/contact-relaxation.json), [state archive](evidence/contact-relaxation-report.json.gz.b64) and [fine-mesh receipt](evidence/contact-relaxation-receiving.json) retain failures as well as passes. The sweep intentionally exits 1 because its complete envelope includes coarse failures. The fine-mesh receipt is a bounded receiving result, not convergence for arbitrary geometry, loading, phase, material or tyre.

The archive preserves coordinates, solve histories, energies, pressure, contact forces, stability and hashes of each complete force vector (little-endian binary64). Force vectors reconstruct from the pinned evaluator; omitting their redundant arrays reduced the compressed archive from about 3.5 MB to 0.8 MB. The sweep ran at [source commit 7464f6d](https://github.com/CraigHutchinson/BikeLab/commit/7464f6d88af73c0b9267dfdf2f5862762425f453). The final implementation adds only a material-conditioning admission guard. Every force component and state scalar in all 156 control/candidate states was verified bit-identical through that guarded factory before carrying the result forward. The receipt records both identities; the original sweep source hashes are not rewritten.

## Coordinate and version contract

`RELAXED_MODEL` selects `bikelab-swept-sealed-casing-relaxed-0.1`; native consumers still select the legacy model. Endpoint and relaxed diagnostic models admit 256/512 stations; legacy geometry remains capped at its old set. Existing 16/32/64/128 canonical directions and all 162 archived legacy loaded states are unchanged. Fine diagnostic directions use trigonometric construction, with browser agreement checked separately.

The offline solver's `planeAngle` rotates the plane relative to material stations by at most half a station. Coordinates, generalized forces and tangents use the same orthogonal plane frame, explicitly reported in results. Initial guesses must use that frame. Zero phase takes the original arithmetic path. Height greater than rim radius keeps all bead vertices above the plane; the affine intermediate vertices then satisfy the crown/bead half-space constraints. These zero-thickness contact vertices are not a measured physical contact patch.

## Derivation and source limits

Primary references read: [Pipkin 1994 abstract](https://doi.org/10.1093/imamat/52.3.297), defining relaxation via convex increasing energy, and [Taylor et al. 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC7020621/), treating anisotropic wrinkling with plate structure beyond this reduction. The diagonal-slack construction below is derived for BikeLab's existing energy; it is not a transcription of a complete tensor wrinkling model.

## Derived energy and force contract

Write the parent density as W(x,y)=(Cm*x*x+2*Cc*x*y+Ch*y*y)/2. For endpoint strains ea, eb and shared hoop strain eh, the candidate density is

```
min over sa,sb,t >= 0: [W(ea+sa,eh+t)+W(eb+sb,eh+t)]/2.
```

Strains/slacks are dimensionless, rigidities and resultants are N/m, density is J/m² and multiplying by reference cell area gives joules. Added slack represents material metric hidden by the projected configuration. It is not a negative material strain or a penalty stiffness. Let x=ea+sa, z=eb+sb and y=eh+t. The derivative resultants are Nm_a=Cm*x+Cc*y, Nm_b=Cm*z+Cc*y and Nh=Cc*(x+z)/2+Ch*y. Thus density derivatives are Nm_a/2, Nm_b/2 and Nh. The existing edge/hoop chain gives negative spatial energy gradients with those factors.

For each of eight active sets, released meridional endpoints satisfy x or z=-Cc*y/Cm. If k endpoints release and hoop also releases, y=-Cc*(sum of unreleased endpoint strains)/[2*(Ch-k*Cc*Cc/(2*Cm))]. Otherwise y=eh. Feasible nonnegative slacks/resultants and complementary products select the minimum. All-released is zero strain/stress, including negative coupling. The tensile branch recovers the parent endpoint density. Boundary values are continuously differentiable in exact arithmetic, while tangents may change across active sets.

Floating-point feasibility uses a documented machine-epsilon bound and clips only resultants/slacks within that bound. Consequently complementarity and energy-gradient agreement are numerical statements within checked error, not exact arithmetic guarantees. The relaxed candidate additionally rejects numerically ill-conditioned material matrices before evaluation; old model admission is unchanged. Candidate stability remains a separate check of the unshifted geometric/gas/contact tangent, not a consequence of convex strain energy.

Shared hoop slack means the aggregate hoop resultant is nonnegative; it does not enforce two separate hypothetical endpoint hoop resultants. This coordinate-aligned model omits shear/principal-stress checks, independent transverse shape, bending and wrinkle morphology. A zero compression count is imposed by the law and cannot validate those missing mechanisms.

## Validation and next receiving work

Six new tests cover independent cyclic material minimization at 500 strain/coupling samples, complementary conditions and energy derivatives, active-set continuity, loaded spatial energy gradients, rotated-plane reflection and reaction work, fine-mesh unloaded equilibrium and the conditioning guard. The guard requires normalized determinant/trace-squared greater than sqrt(machine epsilon), with the rigidity product in normal floating-point range; this bounds roundoff amplification without inventing a physical stiffness. All original force/gas/geometry and raw/effective strain limits remain.

Complete Windows host Node suite: **503/503 pass**, zero skipped. The preceding run had five stale source-provenance failures; both logs and [receipt](evidence/contact-relaxation-tests.json) remain. All 36 spinning control results were regenerated and proved exactly unchanged before their source pins were refreshed. Focused Edge checks pass the existing worker/save/load/scrub/restore flow, six endpoint and nine relaxed browser/headless cases including active relaxation; [browser receipt](evidence/contact-relaxation-browser.json). The existing wheel screenshot and scientific plot were inspected. This is not native relaxed-candidate integration, full-browser or full-hosted acceptance.

Next balanced slice: use this fine-mesh reference to receive a practical contact representation at equal accuracy/cost, considering local refinement or a condensed reference law rather than choosing hundreds of runtime stations by default. Preserve phase and load/unload gates, inspect transverse shape limitations, and derive runtime mass/stiffness timestep admission before native loaded receiving. Then reuse the same law in trail-bike and add separately declared near-rim/insert behavior. No wrinkle morphology, pinch/burst/bead-release threshold or calibrated tyre claim follows. #95 remains open; measured calibration remains deferred per user direction.

```
node scripts/tyre-contact-relaxation.mjs   # expected exit 1 for coarse failures
python scripts/plot-tyre-contact-relaxation.py
node scripts/verify-contact-relaxation.mjs # verifies the pinned archived sweep
node --test
```

Regenerating the archive under a changed source creates new evidence; the pinned-source verifier must be reviewed and updated rather than relabeling old hashes. The final guard does not alter the sampled material or force law.
