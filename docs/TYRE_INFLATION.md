# Bounded axisymmetric inflation diagnostic

This increment receives a volume/energy and equilibrium calculation in one coordinate, section height H above a fixed rim. It is not the complete casing-equilibrium gate. Its consumers are an offline CLI and inspected scientific plot; production assets are unchanged. Geometry and effective material rigidity are explicitly illustrative.

## Geometry and energy

Let L be rim attachment radius and b half the bead width. For H >= b, a circular major arc above the bead chord has radius r=(H²+b²)/(2H), centre height c=(H²-b²)/(2H), phi=atan2(c,b), and t=pi/2+phi. The rim closes the cross section with a zero-thickness cylindrical band; no detailed rim profile is represented.

```
A = r² t + b c
M = c A + 2 b³/3
V = 2 pi (L A + M)
s = 2 r t
Umaterial = (2 pi L) C (s-s0)² / (2 s0)
Upressure = -p (V-V0)
Qmaterial = -(2 pi L) C (s-s0) s' / s0
Qpressure = p V'
```

M is the radial first moment of section area, so the volume uses actual revolution geometry rather than an arbitrary area-times-width approximation. The [Pappus derivation](https://web.mae.ufl.edu/uhk/PAPPUS.pdf) supports the centroid relation; tests independently integrate radial disks. Geometry derivatives are analytic. The given stress-free height fixes s0 and V0 before applying pressure; no force offset is fitted to manufacture equilibrium.

C has units N/m and is an **effective meridional rigidity referenced to rim circumference**, not a calibrated shell modulus. This energy assumes uniform integrated contour extension. It omits independent circumferential strain, anisotropy and local strain variation. The circular-arc restriction does not enforce local membrane equilibrium. The earlier bicycle reference supports the geometric context but does not validate this new extensible material ansatz.

Pressure is constant gauge pressure from a reservoir, not sealed gas. Total potential is Umaterial+Upressure and Q=-dU/dH. At the rest shape material force is zero while pressure force is nonzero; inflation is solved by a bounded sign bracket. The solver reports stationarity only. Its height bracket target is 1e-13 m, capped at 64 iterations, and it rejects absent restoring brackets. The received examples independently check positive scalar curvature and higher potential at perturbations of +/-1 micrometre. This is local stability along H only. At arbitrarily large H the negative constant-pressure potential can dominate this material energy; no global stability or outside-domain extrapolation is claimed.

## Evidence and limits

Complete Windows Node receiving passes **457/457**, zero failures/skips/cancellations; [source-hashed receipt and complete log](evidence/tyre-inflation-tests.json). Four new focused checks pass. Numerical source/tests stayed fixed during the run; plot zoom and documentation were prepared concurrently. No new full/browser attestation is claimed. The geometry/energy derivation received a bounded read-only Terra review; numerical checks and final code review were performed locally.

Four focused tests cover independent volume quadrature, analytic volume/contour gradients, complete energy-gradient force, pressure-sweep stationary states and local scalar stability, stress-free zero pressure, ownership and invalid/unbracketed input. Budgets are 2e-9 m³ for independent quadrature, 1e-9 for geometry derivatives, 2e-5 N for energy finite differences and 2e-6 N for equilibrium residuals. These are numerical budgets, not physical uncertainty estimates.

At illustrative 80/160/240 kPa, with L=0.311 m, bead width=0.03 m, rest height=0.05 m and C=200000 N/m, solved heights are 50.588614 / 51.189636 / 51.803550 mm. Residual magnitudes are below 8.3e-7 N. Both opposing generalized component forces and material strain are saved. These generalized forces are not single-node loads or rim-reaction distributions. The [complete source-hashed report](evidence/tyre-inflation.json) contains three equilibria and 303 sampled states; the [plot](evidence/tyre-inflation.svg) zooms the local branch so the minima and zero crossings are visible. No wall-time or optimal-performance claim.

```
node --test test/tyre-inflation.test.mjs
node scripts/tyre-inflation.mjs
python scripts/plot-tyre-inflation.py
```

Next add a realizable biaxial material/reference geometry and spatial degrees of freedom, derive local force and rim reactions from their energy, and test nonaxisymmetric stability. Then receive loaded shape/footprint and compare candidates at equal accuracy. Do not inject this scalar balance as prestress into the existing pressure-dependent foundation. The full casing-equilibrium gate, calibration, inserts and #95 remain open; the existing browser replay and PR91 contact-refinement failures are unchanged. Deliver this bounded offline step under the user's instruction to merge each reviewable iteration while retaining these limits.
