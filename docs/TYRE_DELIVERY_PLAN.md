# Pressure-aware tyre delivery plan

**25 November checkpoint.** The [static pressure footprint](PRESSURE_FOOTPRINT.md) delivers #113 for three pressures and the seven prescribed flat-plane equilibria. Next is #112: establish native stationary force balance and verify perturb/release and mesh refinement before #114 moving-wheel integration. #117 awaits measurements. Earlier dated plans below describe the preceding checkpoints.

Current decision: 18 November 2026, replacing the all-or-nothing tracking boundary of #95 at the user's request. Close #95 as **superseded**, not as completed physics. Preserve its original report and downstream findings; the open obligations now have separate issues and explicit closure tests. No model, budget, default or failure threshold changes in this planning increment.

## What is already delivered

The shared gas/volume/material implementation, discrete inflated reference, bounded relaxed static reference, native mass diagnostics, source-bound numerical evidence and an earlier opt-in experimental sealed moving-wheel consumer are on main. The earlier consumer uses the averaged-strain law; the loaded relaxed candidate is not yet promoted. Generic static footprint and trail consumers still use the foundation law. The complete software suite at PR111 passed 511/511 on Windows; that is prior evidence, not a new test run or acceptance of failed model gates.

The [equal-load receiving](TYRE_EQUAL_LOAD.md) retains two mesh failures and eight unsettled cases. The [native matrix](TYRE_NATIVE_LOADED.md) retains the Euler damping failures alongside the passing implicitfast timestep comparisons. These findings remain attached to the native delivery rather than becoming prerequisites for every independent static feature.

## Independently closable deliveries

| Issue | Deliverable | Closure boundary | Dependencies |
| --- | --- | --- | --- |
| [#113](https://github.com/CraigHutchinson/BikeLab/issues/113) | **Next product increment:** bounded flat pressure-aware static footprint/load-deflection consumer | Shared law, received flat envelope, pressure/volume/load/shape display, worker/browser/headless agreement, versioned save/load/replay and measured calculation cost | Existing static reference; independent of native settling |
| [#112](https://github.com/CraigHutchinson/BikeLab/issues/112) | Native stationary equilibrium and loaded acceptance | Independently verified force balance, contact/mesh refinement, perturb/release and an explicit admitted envelope | Reconcile applicable #48, #52/#73/#79 and #75 findings |
| [#114](https://github.com/CraigHutchinson/BikeLab/issues/114) | Relaxed pressure-aware moving-wheel runtime | Versioned actual viewer/worker, mass-aware admission, load/unload/flight/drop and replay, complete native cost | #112; preserves old models |
| [#115](https://github.com/CraigHutchinson/BikeLab/issues/115) | Hardtail and full-suspension trail reuse | Shared wheel law, configured bike/rider mass contract, load transfer/landing, work/momentum and browser replay | #114; #116 only for claimed near-rim cases |
| [#116](https://github.com/CraigHutchinson/BikeLab/issues/116) | Declared near-rim/insert stage | Progressive potential, dissipative ledger, engagement/unload/refinement, bounded failure/unsupported-state handling | #114; coordinate reuse with #115 |
| [#117](https://github.com/CraigHutchinson/BikeLab/issues/117) | Measured calibration and supported prediction | Named tyre/rim data, independent validation, uncertainty and evidence for any claimed failure thresholds | Blocked on measurements; does not block labelled illustrative delivery |

Each issue closes on its own recorded evidence. Closing #113 does not mean native contact is fixed; closing #114 does not mean trail reuse or inserts exist. Calibration must not silently become a prerequisite for uncalibrated implementation, or silently be claimed by a numerical test.

## Why the next increment changes

The catalogue already contains the regularizer/material distinction (#48), continuous edge/contact concerns (#52/#73/#79), material damping (#43), rest-fixture requirements (#75), and long-run rest/cost concerns (#74/#76). In particular, the downstream #75 report warns that frictionless/brake-free rest need not settle. It would be unsound to demand settling from the current frictionless fixture as a universal test of pressure-casing correctness. These older-law findings guide the experiments; they are not automatically proven for the new relaxed material.

Keep #112 as a bounded native acceptance task. Do not make fixing every contact, rest, rock, rider and calibration issue a hidden condition of #113. Existing #49/#51/#53 still govern relevant dynamic accuracy/cost questions; #92/#93/#94 still govern quality/stop and terrain-compliance policy. They are linked, not duplicated or closed by this split.

## Next concrete PR: #113

Reuse the received hard-plane solver and the existing membrane/gas implementation in a worker-backed flat static consumer. The first UI can prescribe pressure and lowering and report the balancing fixture load; target-load inversion is additional receiving, not an implicit promise. Start from the illustrative section and the already tested 1.2/1.6/2.0 bar and 0–4 mm load/unload states, then admit only inputs whose numerical/geometry gates are actually received. Do not claim an interpolated or precomputed plot is a newly solved configuration.

Keep the surface genuinely bounded: flat plane only, explicit unsupported geometry/strain/near-rim responses, cancellation/stale-result protection, reproducible versioned inputs and visible uncalibrated status. Preserve legacy footprint records. The existing 256/512 static comparison is the accuracy reference; choose production resolution or reduction only after complete calculation cost and equal-accuracy receiving. Do not assume a dense offline solver is already suitable for interactive use.

A reviewable merge includes the real static consumer, its source-bound numerical checks, browser interactions/replay, latency evidence and an updated remaining-work list. Merge preparation can proceed without resolving the independent native dynamic contact model. If one of #113's own acceptance gates fails, retain that failure and keep #113 open.

## Preserve the original #95 obligations

| Original concern | Where it is now tracked |
| --- | --- |
| Pressure linked to changing geometry, material response and consistent gas energy | Merged shared foundations; user-facing static #113 and moving-wheel #114 |
| Existing footprint and moving-wheel foundation consumers | #113 and #114; no silent reinterpretation of old records |
| Connected bike/rider support from configured mass and gravity | #115 |
| Near-rim progression, insert and crush response | #116 |
| Live pressure used consistently by service/validity checks | #114/#115; service maxima remain distinct from ultimate strength |
| Pinch, burst, bead release, damage and leakage claims | #116 preserves unavailable/boundary behaviour; #117 supplies evidence before any prediction; general air-flow/damage evolution remains outside the fixed-mass scope |
| Measured multi-pressure validation | #117, explicitly deferred because data are unavailable |

Administrative closure of #95 is not removal of any failed gate or unfinished obligation. Do not mark it `completed`, and do not create already-completed replacement issues merely to inflate closure counts.
