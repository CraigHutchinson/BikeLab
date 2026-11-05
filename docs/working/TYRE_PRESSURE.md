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

## Current receiving checkpoint — Cartesian mapping, 5 November

Latest decision: [accuracy and computational cost contract](../TYRE_ACCURACY_COST.md). First implement an independent bicycle static reference, then choose the reduced casing law against it and physical measurements. Do not claim the present diagnostic is calibrated or optimal. O(N) force/storage and preallocated runtime buffers are targets; benchmark complete simulated-time cost at equal accuracy before choosing an implementation.

Local full attempt on clean source `81ecef5` (same tree as published `2f98cc4`) finished **failed**: pinned Playwright, provenance, 445/445 Node and idle-record generation passed; Edge browser replay stopped at full-articulated-standing `frames.1.wheels.0.ground.0`, 3.651187963082947e-9 versus -2.2847596946318216e-8 N. No tolerance changed. Native production and browser source are unchanged from main f90e895; do not attribute this to the pressure diagnostic or claim a separately rerun main baseline. [Receipt and exact-byte archive](../evidence/pr96-full-local-failure.json) preserve full log, browser report, failing record and idle report. Later browser checks were not reached. PR96 stays draft; next merge task is the independent rider replay blocker, while #95 continues on the source-verified static reference.

The [radial Cartesian diagnostic](../TYRE_PRESSURE_CARTESIAN.md) now derives node forces and the hub reaction from the same pressure energy using current geometry. Four focused checks pass; the complete Windows Node suite passes **445/445**, zero failures/skips/cancellations (102.142 s; local log `artifacts/pr96-cartesian-node-suite.log`). The original nine pressure checks are included. The source-hashed three-strip report and inspected geometry/force plot are tracked. During the suite only plot scaling changed; numerical source and tests remained fixed.

This closes the diagnostic coordinate/sign/work mapping gate, not the production geometry/prestress gate. The radial strip surrogate has no reference inflation force or circumferential stiffness. Next specify closed casing geometry, rim attachment and stress-free material data, then solve/receive pressurized equilibrium before replacing the native Cartesian foundation. Insert energy/clearance/loss and physical calibration follow. Keep #95 open and PR91 separate. Full browser/native receiving and the ordinary full merge attestation remain pending; 445 Node passes are not that attestation.

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

## Kernel checkpoint — 5 November 2026

Implemented `scripts/lib/tyre-pressure.mjs` as a separately versioned prescribed strip-chamber law, with same-volume pressure/force/energy, stable small-deformation and n→1 limits, signed generalized force and rank-one cross-node tangent. The area tangent at first engagement is explicitly singular when gauge pressure is positive. Zero force at the unloaded strip is not inflated-casing prestress.

Nine focused checks and all 123 curve samples pass in the available functions JavaScript V8 runtime. The exact same check definitions are wired to a Node test adapter and CLI; **Node execution, the complete suite, plot rendering and browser receiving remain pending because the execution workspace is unavailable**. No wall-time/performance result is claimed. The independent checks cover quadrature, force/volume/energy gradients, combined pressure/area growth, cross-node symmetry, cycle work, subdivision, ownership/replay, near-zero limits and rejection.

Next restore the workspace, fetch this draft, run the nine Node checks/CLI and required full suite, render/inspect the scientific plot, and receive source-bound artifacts. Then define a geometry/prestress adapter and the separately specified casing/insert potentials and loss. PR91 remains the owner of stage-policy changes. #95 is not closed by this kernel.

Read-only GPT-6.1 Sol review of sourcefd8b119 found a weighted-volume underflow hole and a cycle check that retraced the loading path. Both are fixed: reject unresolvable weighted volume/work and unload strips sequentially along a different multi-node path. Unknown symbol/accessor configuration fields are rejected without invoking getters. The nine shared checks still pass in V8, including sixteen rejection controls; full Node/plot receiving remains pending.

## Published resume point

Draft [PR96](https://github.com/CraigHutchinson/BikeLab/pull/96) holds the new kernel. Checked source `5200268457175c02cca16e3ae37ce7949909275d`, tree `902111b7024cfc9a25d0f9cf5422bb22823f4579`; [complete V8 evidence](../evidence/tyre-pressure-v8.json) preserves all nine checks and 123 states with verified source blobs and exact repeated output. Hosted [smoke42000842012](https://github.com/CraigHutchinson/BikeLab/actions/runs/42000842012) passed; full42000842281 was deliberately skipped. No new full matrix was requested.

The remote branch contains pressure code authored after the workspace became unavailable. The preserved `/workspace/BikeLab-next` checkout may still end at local `a14e16f`; **fetch/reconcile remote PR96 before editing it**, and preserve its artifact directories. Local commit IDs use synthetic history, so do not blindly push local history over the published branch. The earlier binary archive was replaced by verified lossless Base64 text and is fully published. Node execution, pressure-plot inspection, browser receiving, physical calibration and integration remain pending.


## Receiving update — 5 November

Node/CLI and plot gates are now received: nine focused tests, 123 samples, 441/441 complete Node tests; plot legend repaired and actual PNG inspected. See [source-bound receiving](../TYRE_PRESSURE_KERNEL.md#node-and-plot-receiving--5-november-2026). Earlier workspace-unavailable statements are historical. Preserve small cross-runtime differences, including finite-difference diagnostics; no exact-replay/full-browser claim. Next implement the geometry/prestress design boundary, then casing/insert energy and loss. #95 remains open; production changes and calibration are not received. PR91 is separate and still owns the failed contact-transition screen.
