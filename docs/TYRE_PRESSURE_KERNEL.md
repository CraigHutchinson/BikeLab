# Prescribed pressure/material kernel — issue 95

A new experimental chamber law couples pressure and changing loaded area through one volume function. It is independent of PR91 and changes no existing wheel, contact or rider behavior. Model identity: `bikelab-prescribed-strip-pressure-0.1`.

The first implementation is deliberately a prescribed compression diagnostic. It does not replace the production foundation, establish inflated-casing equilibrium, predict bottom-out or supply failure thresholds. The moving casing's `u` coordinate is Cartesian x, not the static footprint's inward radial deformation.

## One geometry for volume and force

For a circular strip of section radius a, inward compression delta and material arc weight ds:

```text
G(delta) = a² acos((a-delta)/a) - (a-delta)*sqrt(2a delta-delta²)
b(delta) = dG/ddelta = 2*sqrt(2a delta-delta²)
S_i = ds_i*b(delta_i)
V = V0 - sum(ds_i*G(delta_i))
Pabs = (pg0 + pamb)*(V0/V)^n
pg = Pabs - pamb
F_i = pg*S_i          # positive resisting magnitude
Q_i = -F_i           # generalized force; compression is positive inward
```

Thus area growth and pressure rise multiply. Compressing another strip raises pressure and force at an unchanged strip. The resisting-force tangent is a rank-one shared-pressure term plus a local changing-area term:

```text
K_ij = (n*Pabs/V)*S_i*S_j + delta_ij*pg*ds_i*b'(delta_i)
```

The generalized-force Jacobian has the opposite sign. The representation stores one coupling coefficient and one area/diagonal term per strip; it does not allocate a dense matrix. This complexity statement is not a real-time benchmark.

In the illustrative three-strip control, uniform compression from 5 to 15 mm grows effective area by **56.67%** and gauge pressure by **1.1167%**, producing **58.4194%** more force. These are prescribed chamber numbers, not measured tyre stiffness.

The mechanical potential is the integral of pressure above ambient over displaced volume. Its n=1 limit uses the logarithm; the implementation uses `log1p`, `expm1` and a small-loss series to retain work at tiny compression. Intermediate fixed n defines a reversible prescribed mechanical path. No temperature, heat flow, air leakage or gas-mass evolution is modeled.

## Admission and limitations

All configuration is explicit: reference volume, ambient and initial gauge pressures, exponent, minimum volume fraction, section radius, arc weights and provenance. Numeric bounds are this diagnostic's envelope, not manufacturer service/strength limits. Measured input provenance does not calibrate the law.

Only **0 <= delta <= a** is admitted. The circular chord has a singular area slope at zero, a maximum width at delta=a, and narrows beyond that. No extrapolation to a 54 mm rock strike is allowed. At zero compression with positive pressure the force tangent is reported unavailable; at exactly zero gauge pressure its limiting force tangent is zero. Half-section compression retains shared-pressure stiffness even though the local width derivative is zero.

Force and energy at zero compression are zero because this is a constrained strip surrogate. A freely inflated tyre needs casing prestress and a consistent geometry adapter. Internal gas acts outward on a casing; do not apply these signed compression-coordinate forces directly to the moving model's Cartesian slides.

Expansion, excess compression, gas volume below the declared fraction, unresolvable weighted volume/work, malformed settings and nonfinite values fail closed. Reference pressure is not burst pressure. Rim strike, pinch, bead release, casing/rim/spoke damage, inserts and pressure loss remain unsupported. Existing production guards are unchanged.

## Evidence and references

Nine shared check definitions cover independent geometry quadrature, pressure and ambient-work integration, n=1 and nearby exponents, energy/volume finite differences, cross-node tangent/symmetry, compounded response, compression/unloading work along different multi-node paths, subdivision, replay/ownership, tiny compression and rejection. The diagnostic also builds 123 complete states at initial gauge pressures 120, 160 and 200 kPa; all inputs are illustrative.

These checks and samples passed in the **functions JavaScript V8 runtime** while the execution workspace was unavailable. The Node test adapter, CLI, full suite and scientific plot have **not yet been run** for this kernel. This is partial receiving only; no browser, calibration, performance or production integration claim.

Primary sources read before implementation:
- [NASA, isentropic compression](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/isentrophic-compression/): absolute-pressure compression relation and adiabatic assumptions. It does not establish n=1.2 as an MTB impact value.
- [Renart and Roura-Grabulosa, 2019](https://arxiv.org/pdf/1902.03661): a prestressed membrane model and slow tyre comparisons under stated geometric assumptions. This kernel is not an implementation of their full membrane model.
- [Issue95 and revised external study](https://github.com/CraigHutchinson/BikeLab/issues/95): motivation and outstanding data. External step-up loads do not establish local calibration or component damage thresholds.

The circular-strip potential and its derivatives above are the explicit diagnostic derivation. In particular, an unrelated clipped-sum volume must not be combined with this chord force.

## Resume and reproduction

```sh
node --test test/tyre-pressure.test.mjs
node scripts/tyre-pressure.mjs artifacts/tyre-pressure
python scripts/plot-tyre-pressure.py artifacts/tyre-pressure/report.json
node --test
```

The CLI reports progress through all checks and curve samples. When subprocess isolation is blocked, the complete in-process suite is exploratory and must retain its blocked checks.

Next: receive Node/plot artifacts, then unloaded prestress and a Cartesian geometry/force adapter, separately specified casing/insert energy and loss, static load-deflection at several pressures, impact refinement and evidence-based failure criteria. [Tracked working plan](working/TYRE_PRESSURE.md) preserves scope, current blockers and next actions.
