# Contact entry, recontact and spinning-hub receiving — 2026-11-02

**Spinning contact update, 4 November:** PR90 is merged. The [native-stage evidence](SPINNING_RK4_STAGE.md) records 576 exact-parity steps, six independent ballistic controls and all 14 focused tests. Linux in-process receiving is 419/432 with thirteen environment-blocked checks; the preserved upstream Windows receipt passes 432/432 and has identical report bytes. Scientific visualization is received; browser/macOS follow-ups remain. PR91 owns corrected stages. User-priority [issue 95 pressure/material work](working/TYRE_PRESSURE.md) is next.

The [translating diagnostic](CASING_TRANSLATE.md) now passes the 20 ms ladder: 24 completed cases, 16 refinements, independent normal-law checks and complete separation. No case recontacts. This document preserves GPT-6.1 Sol's read-only source research for the next increment; spinning trajectory implementation or receiving is not claimed.

## Translating contact entry and recontact — received 2026-11-03

The [completed contact activity](CASING_ENTRY.md) now passes six 20 ms runs, four refinements and 16 focused tests. It required a separately identified bounded substep policy and tighter native Newton accuracy; the original fixed-step entry failure remains saved. The sequence below records the receiving design that was exercised. The [loaded release cross-check](CASING_CONTACT_LOADED.md) now passes all 24 runs and 16 refinements with 20 combined focused tests. The next increment is the prescribed-state gap-acceleration isolation below.

Original receiving design:

1. Start an undeformed ring 10 µm above a flat plane with common downward speed 0.1 m/s, zero relative rates and authored gravity. Before first contact, receive exact common free fall and zero contact force/work. The analytic lowest-point gap is `gap0 + vz0*t - g*t²/2`; bracket first activation against its zero using actual stage times. Save force, gap, contact identity and impulse across entry. Do not replace a missed discontinuity with a relaxed force budget.
2. Receive unloading, full separation and subsequent recontact in one bounded drop/rebound control. Declare initial conditions, timestep ladder, geometric/force/work budgets and horizon before comparison. If the proposed horizon contains no recontact, record that outcome and design a separately identified control; duration alone is not evidence of a cycle.
3. Distinguish contact existence from positive force: an instantiated unilateral row may carry zero force before geometrical separation. Retain the absent/excluded fast-closing controls and independent saved geometry checks. Native collision activation still needs its own receiving.
4. Archive complete inputs, failed and successful cases, source/case hashes, common-grid refinements, exact replay, progress and scientific plots. Preserve all physical guards and last accepted state on rejection. This remains an uncalibrated wheel experiment, not bike/rider equilibrium or real-time receiving.

## Spin coordinates and inertia

Use a separate model identity with flat frictionless vertex contact, native RK4 and no applied inputs initially. World x is forward, z upward, and positive spin is about +y. Define `S(x,z)=(z,-x)`: a point on the right moves downward under positive spin.

Keep the two hub slides **before** the hinge in XML. Slides remain in the fixed initial frame `R0`; relative nodes use `R=R0 RotY(theta)`. With hub coordinates `h`, relative node coordinates `u_i`, rest positions `a_i`, `b_i=a_i+u_i`, and `t_i=S b_i`:

```text
x_h = x0 + R0 h                 V = R0 hdot
x_i = x_h + R b_i
v_i = V + R(udot_i + omega t_i)
a_i = A + R(uddot_i + alpha t_i + 2 omega S udot_i - omega² b_i)
```

Every node has authored rotational inertia `I_i,y=m_i*skin²/2` and no independent rotational joint. All node bodies therefore rotate with the hub. Use `J0=I_h,y+sum I_i,y`, distinct from node-center orbital inertia. Omitting node rotational inertia changes energy, angular momentum and the physical hub torque.

## Independent coupled operator and physical forces

Let `C=R0ᵀR` and `M_total=m_h+sum m_i`. The mass blocks are:

```text
M_hh = M_total I                 M_h,theta = sum m_i C t_i
M_h,i = m_i C                    M_theta,theta = J0 + sum m_i |b_i|²
M_theta,i = m_i t_iᵀ             M_ii = m_i I
M_ij = 0 for distinct nodes      symmetric transpose blocks implied
```

Compare `mj_fullM` at multiple angles and deformed states, with separately declared kg, kg m and kg m² tolerances. For arbitrary generalized force `Q`, an O(N) inverse-mass check is:

```text
A = (R0 Q_h - R sum Q_i)/m_h
alpha = (Q_theta - sum t_i·Q_i)/J0
uddot_i = Q_i/m_i - Rᵀ A - alpha t_i
```

Apply it to full smooth plus constraint force, including independently checked bias. The translation guard's constant mass and gravity-only bias assumptions do not apply during spin.

Reconstruct local foundation/edge force `f_i` independently. With no applied inputs:

```text
m_i a_i = R f_i + m_i(0,-g) + (0,N_i)
m_h A = m_h(0,-g) - R sum f_i
J0 alpha = -sum t_i·f_i
```

Generalized passive forces remain zero on hub slides and hinge; relative-node components receive `f_i`. Physical casing-on-hub torque is `-sum t_i·f_i - (sum I_i,y)*alpha`, including the reaction that rotates node bodies. Keep physical axle force/torque distinct from whole-wheel generalized contact components.

## Work and momentum

```text
T = 0.5 m_h |V|² + 0.5 J0 omega² + sum 0.5 m_i |v_i|²
P = m_h V + sum m_i v_i
cross_y(r,f) = r_z f_x - r_x f_z
H_y = J0 omega + m_h cross_y(x_h,V) + sum m_i cross_y(x_i,v_i)
```

Retain independently reconstructed elastic/gravitational energy and edge damping. Contact power must satisfy full generalized `Qcontact·qvel = sum N_i*v_i,z`. Integrate linear and angular external impulse at every RK stage. Angular forcing includes gravity `g*(m_h*x_h,x + sum m_i*x_i,x)` and ground moment `-sum x_i,x*N_i`. Declare torque/angular budgets with correct SI units; do not relabel translational tolerances.

## Spinning contact: native agreement and physical acceleration are separate

The translating scalar oracle cannot be copied unchanged. Define:

```text
convective_i = R(2 omega S udot_i - omega² b_i)
smoothRow_i = (R f_i)_z/m_i - g - convective_i,z
N_i = max(0, (aref_i - smoothRow_i)/(1/m_i + regularizer_i))
```

Native `efc_b` uses `J*qacc_smooth-aref`; physical node acceleration also includes `Jdot*qvel`. Pinned native reference code subtracts that correction for connect/weld equalities, not contact rows. The equation above predicts the **native row law**. It does not, by itself, prove that the physical normal gap acceleration follows the intended constitutive law under rotating coordinates. Receive prescribed spin/relative-rate states and compare both quantities before selecting a physically defensible spinning contact policy. Any correction needs an explicit model identity and supported stage evaluation; do not hide it in the observer or call native agreement physical calibration.

Analytic point-contact mobility remains `A_ij=delta_ij/m_i`: a node point force cancels in both hub inverse equations. General node translational inverse weight therefore predicts `2/(3m_i)` and the same frictionless regularizer as translation. Verify actual body classification, inverse weights, row diagonals and regularizers before accepting this prediction. Preserve absent/excluded contact gating and full physical limits.

## Spin receiving sequence

1. Zero-spin recovery against the translating controls with declared tolerances.
2. Explicitly identified test-only zero-stiffness/damping ballistic control: hub/node centers follow exact free flight while angle advances uniformly. Invert those world paths to obtain exact relative coordinates; this exposes Coriolis and centrifugal mistakes.
3. Centrifugal equilibrium using existing material. For a symmetric ring of rest radius `r0`, equal node masses, per-axis foundation stiffness `kn` and native edge stiffness `ke`, set `kr=kn+4ke*sin²(pi/n)` and `rho=kr*r0/(kr-m_i*omega²)`. Initialize `u_i=(rho-r0)*a_hat_i`, zero relative rates and shared spin. Require `kr>m_i*omega²` plus all strain/displacement limits. Then `f_i=-m_i*omega²*rho*a_hat_i`, constant spin/radius, hub free flight and zero edge damping provide an exact control.
4. Prescribed contact states with nonzero spin and relative rates; receive gap rate, convective row law, physical acceleration and coefficient independence.
5. Both spin signs, imported/zero rates and zero-spin controls in a short loaded ladder. Receive linear/angular momentum, work, refinement, progress, replay and transactional rejection before increasing duration or connecting bikes.

The current stage observer rejects hinges. Native scalar hinge and slide positions both use ordinary addition, so a precisely admitted one-hinge topology is plausible; version it, update indexing/angular ledgers, and preserve full stage/warm-start/rollback checks. No ball/free-joint generalization is implied.

Connected-bike buffers remain a separate gate. The current trail model samples progressive buffer forces/Jacobians into `qfrc_applied`; native RK4 holds them without a supported callback. The WASM exposes `mj_resetCallbacks`, but no JS control/passive setter has been established. Recomputing buffers only in an observer would cease to reconstruct native `mj_step`. Receive an explicit stage policy for continuous buffers, and retain exact held torque work `tau_held*Deltaq` and accepted command ownership for rider/drive controls.

### Prescribed-state gap-acceleration isolation

GPT-6.1 Sol's additional primary-source review on 2026-11-03 confirms the coupled inverse and native row equation above. The inverse returns **coordinate** accelerations; reconstruct world acceleration with the convective term. The predicted exact point mobility `1/m_i` remains distinct from native's approximate diagonal `2/(3m_i)`.

After the loaded contact-policy cross-check, begin with a separately identified test-only zero-material prescribed-state probe. Hold world node positions and velocities fixed, vary zero/positive/negative hub spin, and set `udot_i=Rᵀ(v_i-V)-omega*t_i`. Include relative rates that exercise the Coriolis term. With nonzero edge damping, those changed relative rates could change physical damping, confounding this isolation; zero material is an explicit test control, not a production change.

At each admitted state, compare independently reconstructed mass/inverse/bias, actual contact Jacobian and gap rate, `J*qacc`, physical gap acceleration, native force and regularization. For `c=convective_i,z`, `p=(R*f_i)_z/m_i-g` and `r=regularizer_i`, a positive-force row must satisfy:

```text
J*qacc_smooth = p-c
N_native = (aref-p+c)/(1/m_i+r)
gap_acceleration = p+N_native/m_i
gap_acceleration+r*N_native-aref = c
```

For a law defined using physical gap acceleration, the row target would instead need `aref-c`, evaluated before each constraint solve. This is a prospective model decision, not an implemented correction. Native agreement alone cannot close that decision. Check zero-force/excluded rows separately from positive-force rows; the equality above is not a unilateral complementarity condition for inactive rows.

Primary source: the [reference correction traversal](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_constraint.c#L860) applies to equality constraints, with connect/weld handling; the [frictionless diagonal approximation](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_constraint.c#L1674) uses body inverse weight. This review ran no new spinning dynamics or performance experiment.

## Pinned primary references

All links use MuJoCo `a892750516336d8358949f4518fcc4fbbd85beae`:

- [Joint ordering and kinematics](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_smooth.c#L108), [ancestor mass assembly](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_smooth.c#L1900).
- [Foundation springs](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_passive.c#L679), [edge forces](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_passive.c#L729), [body inverse weight](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_setconst.c#L1246).
- [Constraint RHS](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1228), [reference acceleration and equality correction](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_constraint.c#L3189).
- [Scalar position integration](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_support.c#L723), [native RK stages](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1664).

Local authored inertia comes from `wheelParts` in `dist/moving-wheel.js`; connected force sampling is in `dist/trail-bike.js`. Keep the complete [correction sequence](CASING_FIX_PLAN.md): both bikes, independent active rider, long-idle recovery, physical travel/failure bounds, faceted/layered terrain, eventual 3D lateral/turning dynamics, and separately measured multirate game/reference-data performance.
