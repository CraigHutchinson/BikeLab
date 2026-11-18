# Equal-load native contact study - 18 November 2026

The native mesh discrepancy persists when both meshes carry the same load. The offline receiver now accepts a separately recorded constant hub load instead of always using the initial hard-plane equilibrium reaction. That load owns applied force, external work and vertical momentum accounting; omitted input preserves the prior behaviour exactly. Production assets and limits are unchanged.

Eight implicitfast runs combine 256/512 stations, 1/0.5 ms contact time and 7.8125/3.90625 us steps. Every run uses the same 400 N downward hub load, nominal 3 kg hub/1 kg tyre/0.08 kg m² hub inertia, 0.5 N s edge viscosity, 1.6 bar initial pressure, zero gravity and the archived 2 mm hard-plane starting shape. Duration is 100 ms, with 1 ms observations. The initial static reactions remain separately recorded (approximately 401.52/402.75 N); they no longer determine the applied load.

## Results under unchanged budgets

| Check | Result |
| --- | --- |
| Completed with energy/penetration gates | 8/8 |
| Adjacent timestep comparisons | 4/4 pass |
| Finest-step mesh comparisons | 0/2 pass |
| Sampled final 20 ms qualifies as settled | 0/8 |

At the finest step, peak 256-to-512 hub-height differences are **83.19 um** at 1 ms contact time and **76.20 um** at 0.5 ms, against the unchanged 25 um budget. Pressure and reaction comparisons pass their existing budgets. This rules out the previous approximately 1.23 N applied-load difference as a sufficient explanation of the mesh failure; it does not isolate a unique remaining cause.

Halving contact time reduces late penetration from roughly 0.105 mm to 0.026 mm. It does not remove the hub-motion discrepancy. Contact-time comparisons are sensitivity measurements of a changed contact model, not interchangeable timestep refinements. No contact parameter is promoted or tuned to erase the failed mesh gate.

Settlement was specified before the sweep: over the final 20 ms, hub-height span <=5 um, maximum body translational speed <=1 mm/s, and reaction error <=1 N + 1% of load. These are sampled diagnostic criteria, not physical calibration. All eight fail at least one condition. Do not report their endpoint heights as settled load-deflection measurements.

A separate native forward evaluation at each final geometry sets **all velocities to zero**. It finds nonzero hub and internal generalized-force residuals: maximum internal components range from approximately 0.091 to 0.826 N. This confirms those shapes are not static equilibria under the native contact model. These zero-velocity accelerations are diagnostic recomputations, not the original trajectory accelerations; small node masses can magnify them.

## Evidence and validation

The [receiving report](evidence/equal-load-receiving.json), [rest-residual report](evidence/equal-load-rest-residual.json), [inspected plot](evidence/equal-load.svg) and compressed history retain failures. The history keeps all scalar observations and coordinate hashes plus initial/final coordinates. Full coordinate histories are reproducible from the source-bound runner, and the complete local report hash is retained.

Complete Windows Node suite: **511/511 pass**, zero failures/skips ([receipt](evidence/equal-load-tests.json)). The new test verifies that configured load, initial reaction, work and momentum remain distinct and rejects invalid loads. [Default-path replay](evidence/equal-load-default-replay.json) retains 108 exact scalar matches and six coordinate hashes over two 2 ms prefixes. These checks do not turn the failed numerical mesh/settlement gates into passes. No browser or full-hosted pass is claimed; this increment changes the offline reference only.

## Next receiving

The [MuJoCo 3.16.0 constraint implementation](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_constraint.c) and [solver parameter documentation](https://github.com/google-deepmind/mujoco/blob/3.16.0/doc/modeling.rst) explain why native softness must remain separate from tyre stiffness. For a stationary active frictionless row, constant impedance d, positive time constant T, damping ratio one and inactive floors/refsafe changes, the relation reduces to f = -r / (Ahat_ii * (1-d) * T²), where r is signed penetration and Ahat_ii is the native inverse-inertia diagonal approximation. It is not generally the exact coupled inverse-mass diagonal. At fixed row force this introduces mass dependence; halving T predicts quarter depth only while force distribution and inertia factors remain comparable. The observed penetration change is consistent with that relation, not proof of a physical ground law.

Receive a native zero-velocity static residual and equilibrated starting state, including the actual regularized contact law and its configured-mass dependence. Compare that equilibrium against the hard-plane reference, then perturb/release it to separate discretization error from persistent transient motion. Require an independent force-balance check and contact/mesh refinement before describing it as a native equilibrium. Do not invent material damping or relax budgets solely to make the 100 ms trajectories settle.

Production mesh selection, complete native cost, relaxed-model viewer/browser replay, trail integration and near-rim/insert handling remain ahead. #95 stays open and explicitly uncalibrated.

```
node scripts/tyre-equal-load.mjs
node scripts/receive-tyre-equal-load.mjs
node scripts/diagnose-tyre-equal-load.mjs
python scripts/plot-tyre-equal-load.py
```

The receiving command exits **1** for the preserved two mesh and eight settlement failures. The completed sweep and passing software tests are separate evidence.
