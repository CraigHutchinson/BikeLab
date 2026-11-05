# Issue 95 — pressure, changing loaded area and bottom-out

User priority, 4 November 2026: pick up [#95](https://github.com/CraigHutchinson/BikeLab/issues/95) next and account for the compounding effect of changing loaded area, air pressure and other material contributions. Main `f90e895388443168d14f9bdbb5975712d8a2c411` has merged PR90. [PR91](https://github.com/CraigHutchinson/BikeLab/pull/91) separately owns corrected RK stages; do not duplicate or overwrite it. Commit and push this plan with implementation checkpoints.

## Received review

- Read the issue and its revised step-up comment. Its measurements are external reports, not locally reproduced or supplied calibration data. The revised comment supersedes the original claim that constant foundation necessarily underestimates late-stroke stiffness.
- The static footprint uses inward radial deformation. The moving casing has two Cartesian slides per node; `u` is local x, not inward radial compression. No production-coordinate adapter is received yet.
- Pressure currently affects assembly admission only. Existing foundation/edge laws have no inflated membrane prestress. Adding outward pressure to those springs would change unloaded equilibrium; multiplying foundation by pressure would not fix the missing load path.
- GPT-6.1 Sol read the [NASA compression derivation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/isentrophic-compression/) and [Renart/Roura-Grabulosa's tyre paper](https://arxiv.org/pdf/1902.03661). NASA supplies the ideal reversible adiabatic relation and assumptions. The tyre paper describes a prestressed membrane with limited geometry and slow plate comparisons. Neither establishes a universal MTB foundation mapping or a trail-impact exponent of 1.2.

## First implementation — prescribed geometry, pending

Implement a separately versioned, sealed fixed-mass pressure/energy kernel and a prescribed-deformation diagnostic before production coupling. Use explicit SI reference volume, ambient pressure, initial gauge pressure, fixed polytropic exponent, geometric parameters, validity envelope and provenance. No default may imply measured product calibration.

Absolute pressure is `P = (pg0 + pamb)*(V0/V)^n`; gauge pressure is `pg = P - pamb`. Use one volume function for pressure and its generalized forces: `Q = pg*dV/dq`. For inward positive compression, the gas resists the displacement. The mechanical potential includes ambient work and needs a stable `n → 1` evaluation. A prescribed polytropic mechanical potential is not the complete thermodynamic internal energy when heat transfer is unspecified.

The first illustrative strip-chamber control may use a circular segment, limited to `0 ≤ delta ≤ sectionRadius`:

```text
G(delta) = a² acos((a-delta)/a) - (a-delta)*sqrt(2a delta-delta²)
b(delta) = dG/ddelta = 2*sqrt(2a delta-delta²)
V = V0 - sum(ds_i*G(delta_i))
resistingForce_i = pg(V)*ds_i*b(delta_i)
```

This couples increasing effective area and pressure through the same geometry. For effective area `S_i=ds_i*b_i`, cross-node stiffness is `n*P*S_i*S_j/V`; the diagonal also contains the changing-area contribution `pg*dS_i/ddelta_i`. It is not equivalent to choosing an unrelated clipped-sum volume and `pg*b` force. The chord has singular slope at first engagement, peaks at `delta=a` and then narrows; do not extrapolate it to arbitrary 54 mm bottom-out. A force/deflection ratio of `2*pg` at half-section compression is a secant value, not a universal tangent foundation stiffness.

Keep casing elasticity and any insert as separately specified potentials/losses. A later progressive insert must consume real declared clearance and have nonnegative dissipated work; its parameters and engagement range need evidence. Do not turn indicative comment ranges into physical breaking thresholds.

## Receiving and delivery gates

1. Independent volume integral/gradient, pressure relation, force/energy finite differences, ambient/gauge convention, `n=1` and nearby exponents, multi-node coupling, mesh weighting, compression/unloading work and deterministic replay. Reject nonfinite input and unsupported geometry/volume before evaluating singular laws.
2. Saved complete inputs/results and a scientific plot of pressure, effective area and combined force. Separate geometric area growth from pressure growth without removing their compounded response. Record illustrative parameter provenance and units.
3. Focused tests and complete Node receiving, with blocked environment checks explicit. No production/browser agreement or calibration claim until that path is actually exercised.
4. Next connect an admissible volume/force law to Cartesian casing geometry with unloaded prestress and equal/opposite hub/frame work, before replacing the production foundation. Preserve the native and corrected contact-policy diagnostics.
5. Add a justified near-rim/insert law; receive static load/deflection at several pressures, impact/refinement and clearance, then separately sourced pinch, burst, bead-release, seal loss and material failure criteria. Service-pressure maxima are not burst thresholds. Airflow/leakage, damage and 3D lateral behavior remain unsupported until implemented.

Coordinate #92–94 with this work: keep physical stop and quality-envelope semantics distinct, do not silently relax the rigid overlap guard, and separate tyre compression from compliant soil sinkage. The first constitutive diagnostic does not authorize continued riding outside current limits.

## Checkpoint and next action

The PR90 source-bound full report, inspected visualization and Linux 419/432 receipt (same thirteen environment-blocked checks) are being archived alongside this plan. Preserve the upstream Windows 432/432 receipt and identical report hash. The pressure implementation and its receiving remain **pending** at this documentation checkpoint.

Publication recovery, 5 November: the binary blob upload stalled twice and remote lookup confirmed that blob was absent. The complete report is now lossless gzip encoded as Base64 text, with raw/compressed/encoded hashes. Decode/decompress is verified byte-for-byte; the plot reader supports this archive directly. No numerical records were dropped.
