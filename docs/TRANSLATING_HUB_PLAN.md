# Translating hub receiving plan — 2026-11-02

This is the next bounded step after [flat fixed-hub contact](CASING_PLANE.md), researched by GPT-6.1 Sol. This document preserves the source-derived design. After workspace recovery, the [translating-hub implementation and one-/five-/twenty-millisecond receiving](CASING_TRANSLATE.md) now pass; the larger connected-bike gate remains open.

## Boundary and purpose

Release two hub translations while keeping its orientation fixed. Use the authored hub mass (currently 1.5 kg) plus the separate casing mass (currently 1 kg); do not duplicate casing mass in the hub. Keep native RK4 and separately identified flat vertex contact. No hidden holding force, effective rider mass, spin, controls or connected-bike claim.

A loaded shape imported from the bike was previously held under a different boundary condition. Releasing it can launch this light hub upward and unload contacts. That is a release experiment, not equilibrium, long-idle stability or rider recovery. Fixed orientation permits an external rotational reaction, so angular momentum conservation is not an acceptance condition here.

## Coordinates and independent operator

Let `h` be two hub-local translations, `u_i` the two relative node translations, `a_i` the node rest position, and `R` the constant planar rotation into world x/z. All lengths are metres, masses kilograms, velocities m/s and forces newtons.

```text
x_h = x_0 + R h
x_i = x_h + R(a_i + u_i)
v_h = R hdot
v_i = R(hdot + udot_i)
M = m_h + sum_i m_i

M_hh = M I
M_hi = M_ih = m_i I
M_ii = m_i I
M_ij = 0 for distinct nodes
```

For arbitrary generalized force `Q`, the independent inverse is:

```text
hddot = (Q_h - sum_i Q_i) / m_h
uddot_i = Q_i / m_i - hddot
```

Check this O(N) operator and `M a = Q` against native acceleration. At construction, compare the full compiled matrix using preallocated `mj_fullM` storage. Do not reuse the fixed-hub diagonal-mass or `nC == nv` assertions.

The existing stage observer gets accelerations from native forward dynamics and does not invert a diagonal mass matrix. Its mechanics can therefore be reused for these unlimited slides, with a new topology/physical guard. Preserve disabled sleep, no applied inputs/actuators/plugins, all-stage rebuilding, the existing state/force/warm-start budgets and transactional accepted prefixes. Reword its fixed-hub-only label only after receiving the broader contract.

## Force, power and momentum ownership

Let `f_i` be independently reconstructed local foundation plus edge force, `c_i = R^T(0,N_i)` the local normal-contact force, and `g_L = R^T(0,-g)`.

```text
Q_passive,h = 0             Q_passive,i = f_i
Q_gravity,h = M g_L         Q_gravity,i = m_i g_L
Q_contact,h = sum_i c_i     Q_contact,i = c_i
```

For an edge i to j, add `[k_e(l-l_0) + c_e ldot] e` to i and subtract it from j, with `ldot = e dot (udot_j-udot_i)`. Add each foundation force `-k_i u_i`. Edge forces must cancel in the sum.

The physical casing-on-hub force is `-R sum_i f_i`. Hub translational constraint components represent the complete wheel's external ground resultant, not contact directly on the hub. Never add that resultant to node contact forces. A later bike axle receives the physical casing-on-hub reaction, with its mass/inertia convention made explicit.

```text
T = 0.5 m_h |hdot|^2 + sum_i 0.5 m_i |hdot + udot_i|^2
U_gravity = g (m_h z_h + sum_i m_i z_i)
U_elastic = sum_i 0.5 k_i |u_i|^2 + sum_edges 0.5 k_e (l-l_0)^2
Ddot = sum_edges c_e ldot^2
P = R (M hdot + sum_i m_i udot_i)
Pdot = M (0,-g) + sum_i F_contact,i
```

Use full absolute-node kinetic energy. Keep `E-E0+D-W_contact`. Generalized contact power includes every DOF and must equal `sum_i F_i dot R(hdot+udot_i)`. Relative node velocities alone miss hub-motion contact work; summing hub and node resultants as physical forces double-counts contact.

## Compiled contact regularization: verify before parity claims

Source review predicts a change in native classification when the hub is freed. Fixed-hub node bodies qualify as `body_simple == 2`; translating-hub descendants do not. The former branch uses inverse weight `1/m_i`, whereas the general body's planar translational trace gives `2/(3m_i)`. Native default contact regularization can therefore change even with identical `solref/solimp`. This prediction is now reproduced in both the one- and five-millisecond diagnostic receipts; it does not establish physical compliance calibration.

Record and assert the actual classification, body inverse weights, constraint diagonal approximation and regularizer for both fixtures. Do not silently tune coefficients to imitate the fixed-hub response. If preserving compliance requires an explicit approximation/model choice, version and explain it separately.

The true analytic normal contact mobility for distinct vertex rows in this idealized model is `A_ij = delta_ij/m_i`. After mass/flight controls, a useful independent row-force check is `N_i=max(0,(aref_i-a_smooth,node,z)/(1/m_i+R_i))`, where `a_smooth,node,z=(R f_i)_z/m_i-g`. Verify native reference/regularizer conventions from source and compiled values before treating this scalar check as an oracle.

## Receiving sequence and fixed budgets

1. Construct and reject unsupported topology. Check compiled mass, gravity and contact metadata, ownership and source identity before stepping.
2. Common flight: undeformed nodes, zero relative rates, shared velocity. Receive exact coasting/free fall and zero damping/contact work.
3. Uniform relative oscillator: all equal-mass nodes share displacement/rate; edge lengths/rates remain unchanged. With casing mass `m_t`, total foundation stiffness `K=sum_i k_i` and reduced mass `mu=m_h m_t/(m_h+m_t)`, verify `mu uddot + K u=0`. Local COM `C=h+(m_t/M)u` follows free fall. This independently checks hub reactions, full kinetic energy and the physical damping null mode.
4. Short loaded release: begin at 1 ms for supplied wheels and imported/zero rates; use a declared timestep ladder and retain failed cases. Qualify contact activation/separation separately before extending the horizon.
5. New records/progress/visual receiver and replay, then spin and connected bike/rider work under the full correction plan.

Predeclare independent mass-entry error <=1e-12 kg, force/balance <=1e-8 N, energy <=1e-10 J and stage-impulse momentum closure <=1e-8 N s. Retain existing observer budgets and loaded state/force/impulse/work refinement budgets without post-result relaxation. At every stage, derive the moving hub's world position and absolute node velocities; check finite authored terrain, swept rim geometry, penetration, strain, deformation, movement, vertex gaps/rates, warnings and every solver island. Keep rejection state, frames and work transactional.

## Pinned primary sources

All links refer to MuJoCo commit `a892750516336d8358949f4518fcc4fbbd85beae`, matching the current pinned native release.

- [Ancestor-coupled mass construction](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_smooth.c#L1900) and [full-matrix expansion](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_support.c#L380).
- [Forward force assembly](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1004), [spring forces](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_passive.c#L679), and [edge forces](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_passive.c#L729).
- [Full kinetic energy](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_sensor.c#L1744).
- [Body classification](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/user/user_model.cc#L2937) and [inverse weights](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_setconst.c#L1228).
- [RK4 stages](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1655) and [advancement/warm start](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1463).

The complete MTB goal remains both synthetic reference data and games. This increment does not qualify faceted edges, layered ground, component failure/pressure loss, independent rider detachment, pumping/hopping, 3D turning/lateral dynamics or real-time multirate performance; those retain their existing delivery gates.
