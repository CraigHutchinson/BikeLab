# Spatial axisymmetric membrane energy and forces

This offline diagnostic replaces the single section-height coordinate with individual axial/radial meridian points. It adds separate meridional and hoop response, exact polygon-of-revolution volume gradients, local nodal forces and fixed-bead support signs. It does **not** yet solve free-node equilibrium or change production forces. The material is illustrative, uncalibrated and restricted to axisymmetry.

## Discrete contract

Points (x,z) run counterclockwise from right bead through the crown to left bead, closing with the rim chord. x is axial; z is radial height above fixed rim radius L. Each material segment retains its reference length l0, mean radius R0 and reference area A0=2 pi R0 l0. For current length l and mean radius R:

```
em = l/l0 - 1
eh = R/R0 - 1
Esegment = A0 (Cm em² + 2 Cc em eh + Ch eh²) / 2
Nm = Cm em + Cc eh
Nh = Cc em + Ch eh
V = 2 pi sum_edges [(xi zj - xj zi) (L/2 + (zi+zj)/6)]
potential = sum(Esegment) - p (V-Vrest)
force_i = -dE/dqi + p dV/dqi
```

Cm, Ch and Cc are declared effective rigidities in N/m. Require Cm>0, Ch>0 and Cc²<Cm Ch. The segment area and hoop strain use midpoint quadrature; refinement remains necessary. Engineering strain is small-strain illustrative membrane behavior, not a cord/rubber constitutive fit. Pressure is constant reservoir gauge pressure; sealed gas is a separate energy law. The closure edge contributes pressure work but no casing material energy.

The polygon volume follows area and radial first-moment integration, consistent with the [revolution-volume reference](https://web.mae.ufl.edu/uhk/PAPPUS.pdf) used by the preceding inflation diagnostic. The [bicycle membrane paper](https://arxiv.org/pdf/1902.03661) motivates distinguishing meridional and circumferential tension; it does not validate this discrete constitutive law or its parameters. Geometry, forces and energy here are derived directly, not fitted to its load curve.

At held bead coordinates, `beadLoads` is force exerted by the model on the support; `supportForces` is its negative, the force needed to hold the bead. They are generalized axisymmetric forces, not a full Cartesian hub wrench. All closure derivatives are retained, including in bead finite-difference checks. Axial translation is invariant and all axial forces sum to zero. Radial translation relative to a fixed axis is physical deformation: radial generalized forces need not sum to zero. An entire azimuthal ring's outward directions cancel as vectors; a meridian radial sum must not be labelled net world vertical force.

## Admission and limitations

Require a strictly convex counterclockwise profile, positive revolution radii and nonzero edge lengths; reject reversed, degenerate and multiple-winding profiles. Convexity and total turn are checked in linear work. Rest beads lie on the rim plane. Current bead coordinates may be perturbed for derivative checks, but no constraint solver is implicit in evaluation. Strain magnitudes above 0.2 reject; this is a software envelope, not a physical limit. Configurations and returned values are owned.

The quadratic law can carry compression and therefore suppress physical wrinkling. Report compressive stress-resultant segments explicitly; positive strains alone do not prove tensile resultants when coupling is present. Do not accept a compressed state as a tension-only membrane solution. There is no bending, shear, cord recruitment, thickness evolution, contact, tread, insert or azimuthal/nonaxisymmetric behavior. Positive-definite material energy is not pressure-loaded structural stability. The evaluator performs O(N) work/storage but allocates diagnostic outputs; production scratch and performance receiving remain ahead.

## What the receiving experiment shows

Complete Windows Node receiving passes **462/462**, zero failures/skips/cancellations; [receipt and complete normalized log](evidence/tyre-meridian-tests.json). The module, fixture and tests stayed fixed during the run; CLI bracket and plot changes were verified separately. A bounded read-only Terra derivation review checked energy, volume, support signs and limitations. Final code/gradient checks were performed locally. No new full/browser attestation is claimed.

The CLI finds a stationary shape only within the family of circular profiles, using **this same spatial energy**, then evaluates all free-node residuals. It checks the virtual work along the circular-height direction against the potential derivative. It does not use PR97's different scalar material energy as an equilibrium oracle.

| Segments | Circular-family height (mm) | Restricted force magnitude (N) | Maximum free-node residual (N) | Maximum residual/reference area (kPa) |
| --- | --- | --- | --- | --- |
| 16 | 51.055611 | 7.73e-8 | 236.88 | 13.046 |
| 32 | 51.064649 | 2.98e-8 | 121.01 | 13.287 |
| 64 | 51.066911 | 3.42e-8 | 60.95 | 13.348 |

Smaller per-node forces under refinement do not establish equilibrium: the residual per reference area remains nonzero. This is a concrete reason to solve spatial degrees of freedom next. The first CLI bracket at 60 mm exceeded the unchanged strain envelope and was rejected; the received bracket is 50–53 mm. No domain limit or force budget was widened.

Five focused tests verify all node volume/energy derivatives including beads, stress-free material, axial invariance, support signs, volume/material refinement, a separately consumed hoop term, invalid inputs, compression reporting and ownership. Budgets: volume derivatives 2e-10 m², energy derivatives 2e-4 N, axial balance 1e-10 N; polygon volume at 256 segments within 3e-7 m³ of the independent circular result. The CLI's restricted-force budget is 2e-5 N and its virtual-work derivative budget is 2e-4 N. These are numerical checks, not physical accuracy estimates.

[Complete report](evidence/tyre-meridian.json) saves configuration, points, strains, component forces, support signs, residuals and source hashes. The [inspected plot](evidence/tyre-meridian.svg) shows only free-node arrows and normalizes residuals by reference area to avoid a misleading mesh-convergence impression. No equilibrium, calibration or optimal-runtime claim.

```
node --test test/tyre-meridian.test.mjs
node scripts/tyre-meridian.mjs
python scripts/plot-tyre-meridian.py
```

Next: a safeguarded fixed-bead equilibrium solve with explicit rejection, local residual and energy descent checks; examine the constrained tangent for stability and compressive resultants; continue across pressure and mesh. Then compare loaded shape/footprint and physical data. Keep nonaxisymmetric stability, production integration, inserts and calibration distinct. #95 and the prior browser/PR91 failures remain open. Merge this offline increment under the user's per-iteration delivery direction with those gates preserved.
