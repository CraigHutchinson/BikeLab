# Translating-hub correction — 2026-11-02

**The hub now moves in the diagnostic, and the full coupled mass/force/work checks pass.** The one-, five- and twenty-millisecond ladders each complete all 24 loaded releases and pass all 16 predeclared timestep comparisons. Eight focused tests now cover analytic motion, native contact coefficients, physical force ownership, strict admission, rejected-step restoration and the independent normal-force law. This is a separate experiment after the [fixed-hub plane result](CASING_PLANE.md); the complete bike and rider remain unchanged.

![Twenty-millisecond translating hub, separation and independent normal-force errors](evidence/casing-normal-20ms.svg)

The final PNG was inspected for SI units, hub displacement, the distinction between ground resultant and casing-on-hub force, declared refinement budgets, compiled coefficients, contact removal/separation and independent normal-force errors. This is an executable scientific consumer of saved records, not product browser receiving. The [receipt](evidence/casing-translate.json) preserves all eight inputs, 24 case hashes/summaries, compiled metadata, comparisons and source hashes verified before and after the study. Repeated inputs and compiled models are deduplicated in the receipt; raw case hashes still describe the complete original records.

## What moves and what is independently checked

The new diagnostic `bikelab-translating-hub-rk4-diagnostic-0.1` adds two hub-local slides while keeping orientation fixed. The hub retains its authored 1.5 kg and the casing its separate 1 kg. There is no hidden bike/rider mass or holding force. Releasing a previously loaded shape changes the boundary: its stored elastic energy can raise this light hub. It is not an idle or equilibrium test.

For hub translations `h` and relative node coordinates `u_i`, physical node velocity is `R(hdot+udot_i)`. The independently assembled mass blocks are `M_hh=M_total I`, `M_hi=m_i I` and `M_ii=m_i I`. The guard verifies the full compiled matrix, then checks the coupled Newton equations without treating the relative nodes as independent fixed-hub masses. Kinetic energy uses absolute velocities; momentum uses the complete wheel. Native-stage contact impulse closes the linear momentum balance, including gravity.

Internal foundation and edge forces, elastic energy and edge damping are reconstructed from geometry. Ground force is summed once over vertices. The physical casing force on the hub is the opposite of the summed internal node forces; hub generalized contact components represent the complete wheel's ground resultant and must not be added again. All generalized velocities participate in signed contact work. World contact velocities, forces, energy and native RK4 stages have independent checks.

An exact common-velocity/free-fall test uses rotated local axes. A separate uniform relative oscillator uses reduced mass `m_h*m_t/(m_h+m_t)` and total foundation stiffness; its COM follows free flight. Edge damping cannot remove this uniform relative mode, so the test deliberately preserves it. Material damping must be separately justified, not inserted to hide a numerical defect.

The initial one-millisecond ladder uses 1.953125, 0.9765625 and 0.48828125 µs. Refinement includes generalized components **and absolute world hub/node vector errors** at every common endpoint. The finer halving must fit one tenth of the original loaded budgets. Largest observed discrepancies are 6.25e-17 m, 7.67e-14 m/s and 5.76e-10 N; maximum work residual is 1.96e-14 J. These are bounded numerical observations, not comparable physical-accuracy claims. All one-millisecond cases retain their initial five front or six rear contact rows; the longer unloading check below now receives contact removal.

## Contact regularization changes with topology

The source prediction in the [translating-hub plan](TRANSLATING_HUB_PLAN.md) is now reproduced in the pinned runtime. Fixed-hub node bodies use the simple-body inverse weight `1/m_i=64 kg^-1`. Once the hub translates, they use the general planar trace average `2/(3m_i)=42.6666667 kg^-1`. With the same time constant and impedance, the native row regularizer changes from approximately `0.646464646` to `0.430976431 kg^-1`.

The diagnostic records both compilations explicitly; it does not claim unchanged normal compliance, silently retune the material or reinterpret existing records. The true normal contact mobility remains `1/m_i`. The source-derived scalar normal-force/reference-acceleration check below now runs at every observed native RK4 stage and accepted endpoint. The native normal-contact law itself is still uncalibrated.

## Independent normal-row oracle

`bikelab-flat-normal-oracle-0.1` independently reconstructs the pinned native normal law. For an instantiated frictionless vertex row, using upward world z, nodal mass `m_i`, independently reconstructed internal force `f_i`, constant impedance `d`, contact time `tau` and authored damping ratio one:

```text
v_i = [R(hdot + udot_i)]_z
r_i = vertex_z - flex_radius - ground_height
aref_i = -2 v_i/(d tau) - r_i/(d tau²)
regularizer_i = [2/(3 m_i)] (1-d)/d
smooth_i = (R f_i)_z/m_i - g
N_i = max(0, (aref_i - smooth_i)/(1/m_i + regularizer_i))
```

The true contact mobility is `1/m_i`; the approximate native inverse weight belongs only in the regularizer. Reference/smooth acceleration is in m/s², regularizer in kg^-1 and force in N. No native `efc_aref`, `efc_R` or force is used to construct the prediction. The guard then compares them with predeclared thresholds of 1e-7 m/s², 1e-12 kg^-1 and 1e-7 N. Existing force ownership and coupled Newton budgets remain 1e-8 N. These are receiving thresholds, not source-proven bounds on Newton solver error or physical accuracy. The model must retain RK4, approximate contact diagonals, constant authored impedance, positive contact time above the native reference-safety floor, zero inclusion margin and no adhesion.

Activation follows native contact existence and exclusion; this oracle does not independently certify that collision detection cannot omit a penetrating vertex. Only instantiated active rows use this formula. Absent or excluded vertices predict zero force regardless of closing speed. Instantiated rows whose unilateral solution is zero still receive the oracle. Tests place an undeformed wheel 10 µm above ground with common downward velocity 0.1 m/s: the ungated formula would request an upward force, but the actual constraints and contact force remain zero. A separate synthetic detection gap creates an owned, excluded contact and receives the same boundary. Penetrating approach and separation test positive and zero-force active rows; varying contact time/impedance and corrupting derived native coefficients checks parameter handling and independence.

Primary source review used MuJoCo `a892750516336d8358949f4518fcc4fbbd85beae`:

- [Active normal row construction](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_constraint.c#L1427), [inverse-weight approximation](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_constraint.c#L1680), [regularizer and spring/damper coefficients](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_constraint.c#L1924).
- [Reference acceleration](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_constraint.c#L3189) and [unilateral constraint response](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_constraint.c#L3287). RK4 has no discrete-integrator velocity shift or implicit row factor.
- [Contact exclusion](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_collision_driver.c#L1863) and [plane-flex detection distance](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_collision_driver.c#L1975). Detection uses inclusion margin plus gap; the synthetic detection test therefore adds gap only, leaving inclusion margin zero.

## Limits, receiving and continuation

Every stage derives the moving hub position for finite terrain, rim, penetration, strain, displacement and movement checks. Vertex identity, normal, gap/rate, unilateral force, solver islands and warnings remain guarded. A rejected stage restores all coupled coordinates, warm start and accepted frame/work/momentum history. Attempted warnings and solver bookkeeping are retained as diagnostics and are not resumable integration state; restoration does not let those counters erase the accepted result.

The [normal-oracle receipt](evidence/casing-normal.json) records eight passing focused tests and their exact sources. The [20 ms receipt](evidence/casing-normal-20ms.json) freezes the measured implementation at remote `e8137a1`. All 24 cases complete and all 16 refinements pass on 10,241 common endpoints each. Every case reaches zero contacts; the finest saved records first show full separation between 13.875 and 15.125 ms (saved every 0.125 ms, not exact event-time estimates). None recontacts during this horizon. Largest refinement discrepancies are 1.34e-10 m, 1.14e-7 m/s and 7.08e-8 N. Maximum work residual is 3.82e-13 J and momentum closure error is 2.69e-13 N s; native/reconstructed stages agree exactly. Maximum independent normal force, reference acceleration and regularizer errors are 5.68e-10 N, 9.01e-13 m/s² and 1.12e-16 kg^-1, respectively.

The CLI prints accepted-step progress and writes complete records. Unsupported initial geometry or input is rejected before running; unsafe subsequent states terminate at the accepted prefix. This does not model fracture, spoke failure, bead unseating or pressure loss, and does not continue through impossible geometry.

```sh
node --test --test-isolation=none test/casing-translate.test.mjs
node scripts/casing-translate.mjs artifacts/casing-translate .001
MPLCONFIGDIR=/tmp/bikelab-matplotlib XDG_CACHE_HOME=/tmp/bikelab-plot-cache python scripts/plot-casing-translate.py artifacts/casing-translate
```

The [five-millisecond receipt](evidence/casing-translate-5ms.json) freezes the measured source at remote `3a20d0d` before further guard changes. All 24 cases complete and all 16 comparisons pass on 2,561 common endpoints each. Rear cases shed two rows (six to four); front cases retain five. Largest discrepancies are 2.83e-11 m, 5.05e-8 m/s and 2.16e-9 N; maximum work residual is 8.84e-14 J. This receives bounded unloading/contact removal, not complete separation and recontact. The [five-millisecond figure](evidence/casing-translate-5ms.svg) was generated and inspected. The independent normal-row oracle is implemented after that frozen receipt; longer runs must carry the new source hashes. Receive controlled first contact and recontact next; keep longer horizons, spin, connected bikes, active rider stability and product browser receiving open. Fixed orientation permits an external rotational reaction, so angular momentum conservation is not claimed. Preserve the [complete correction sequence](CASING_FIX_PLAN.md), physical failure boundaries, eventual 3D lateral/turning dynamics and measured multirate/game performance gates.
