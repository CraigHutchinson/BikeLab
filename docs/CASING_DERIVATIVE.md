# Contact-free casing derivative qualification

On 2026-10-29, the current fixed-hub implementation independently reproduced PR46's uniform-motion failure and isolated its immediate numerical cause. **The pinned native passive damping force retains neighbouring-node coupling, but the implicit derivative omits sibling-node entries.** An independent reconstruction of the retained operator predicts the first native step to roundoff. This establishes the cause of the isolated fixture's loss of uniformity; it does not establish the unique cause of loaded contact activity or qualify a production correction.

This continues package B in the [issue plan](ISSUE_WORK_PLAN.md), after the [five-second settling controls](TYRE_FIXTURE_SETTLING.md). No production physics, native binary, damping coefficient, timestep admission or guard has changed. PR54's corrected browser receiver remains pending under the [CI pause](CI_WORKFLOW.md).

## Reproduction and visible consumer

```sh
node scripts/casing-derivative.mjs artifacts/casing-derivative
node --test --test-isolation=none test/casing-derivative.test.mjs test/tyre-fixture.test.mjs test/tyre-fixture-observation.test.mjs test/tyre-fixture-ui.test.mjs
```

The study prints progress for eighteen cases and saves `report.json` plus `inviscid.json` and `viscous.json`. **Exit 2 means the diagnostic completed but the native derivative did not qualify**, not that the output is missing. Unexpected execution/assertion errors exit 1. Tests pass by verifying the independent force reference, identifying the pinned approximation and predicting its actual effect; they do not turn the failed derivative qualification into a physics pass.

Load either complete record in the existing `tyre-fixture.html` viewer to replay the corresponding 20 ms control. Both records are produced by the guarded production runner and complete 640 accepted steps without contact. The viscous control ends with 0.110377 m/s nonuniform RMS velocity; the zero-viscosity control remains at approximately 5.9e-15 m/s. The study checks those observations against its separate native trajectory. These new controls have not received browser execution or actual capture inspection in this environment. The eighteen bare-native audits are distinct from those two guarded viewer records.

The inputs are explicitly authored derivatives of the existing full-front seed: hub fixed at [0, 0, 1] m with identity rotation, gravity zero, 1 mm uniform local x displacement and 0.01 m/s uniform x velocity. The original source fields identify lineage, not an unchanged captured bike state. The casing uses the existing 0.36 m outer radius, 0.008 m skin, 1 kg tyre mass, foundation 300000 N/m² and extension 500 N. Edge viscosity is 0 or 0.5 N s; the compiled per-edge damper divides it by reference chord length, giving N s/m. No reference-bike or material calibration follows.

## Independent checks

At fixed positions, an edge with unit direction `e` and endpoint velocities `v_i`, `v_j` has length rate `e · (v_j − v_i)`. Its generalized damping derivative is `D_e = −c J_eᵀ J_e`, with endpoint Jacobian blocks `−e` and `+e`. The full operator is symmetric negative semidefinite and annihilates uniform x and z translation. The audit constructs it directly from node geometry, independently of the native edge Jacobian.

For each case, central differences of every component of `qfrc_damper` at velocity increments 1e-4, 1e-5 and 1e-6 m/s recover that full matrix. The largest error across all eighteen cases is **7.81e-11 N s/m**. The diagnostic's fixed comparison budget is 1e-7 N s/m; it is a numerical check, not a physical-accuracy tolerance. Undeformed and locally deformed shapes, 32/64/128 nodes and both implicit modes are covered. Disabled viscosity gives zero derivatives and independently follows the uniform foundation-oscillator recurrence.

The public WASM does not expose `mjd_smooth_vel`. The audit therefore copies `qDeriv` immediately after the first `mj_step`, when it describes the pre-step state, then restores the same positions/rates before finite differences. It asserts the required topology: one closed-ring flex, sibling bodies, an unrotated fixed hub, x/z slide axes, interleaved coordinates, no actuators/tendons/joint damping, coincident body origins/vertices and diagonal mass. Initial constraints and contacts are absent. Uniform baseline acceleration is checked before attributing nonuniform motion to integration; the deliberately deformed arm is not used for that assertion.

## What the sparse operator loses

At 64 nodes there are 128 velocity coordinates, 256 stored derivative entries and 128 reduced mass entries. The geometric operator has **512 nonzero entries outside the derivative pattern**, all coupling different nodes. Its largest omitted entry is **14.4396 N s/m**. Stored entries agree with the geometric derivative within 1.07e-14 N s/m for this control; the worst retained-entry error over the full study is 2.84e-14 N s/m.

For unit x or z translation, the actual damping force is zero and the full operator's residual is below 1.8e-15 N in the default mesh. The stored operator instead produces a maximum component of **28.8792 N**. Retaining self blocks while omitting the cancelling neighbour blocks destroys the translational null mode.

`implicit` retains each node's x/z 2×2 block but lacks the sibling blocks. In this fixture, `implicitfast` projects further into the diagonal reduced mass pattern, also dropping intra-node x/z entries. The audit independently solves the retained 2×2 blocks of `(M − h D) Δv = h f` and predicts the native first-step velocity with a worst error of **6.94e-18 m/s**. This is a one-step audit, not an alternative simulator.

First-step nonuniform RMS velocity, m/s, from the 64-node uniform control with edge viscosity 0.5 N s:

| Integrator | 31.25 µs | 15.625 µs | 7.8125 µs |
| --- | ---: | ---: | ---: |
| implicitfast | 3.99231e-4 | 1.02624e-4 | 2.60226e-5 |
| implicit | 5.64654e-4 | 1.45136e-4 | 3.68017e-5 |

These reproduce the separately reported PR46 values through the current implementation. Disabling edge viscosity leaves first-step nonuniformity around 1.4e-17 m/s. Switching to `implicit` does not restore missing neighbour coupling. More ring nodes also do not remove this numerical issue: at the coarse step, first-step nonuniformity grows from 1.027e-4 to 1.375e-3 m/s between 32 and 128 nodes under `implicitfast`. This is a matched numerical study, not a hardware benchmark or a general convergence claim.

## Primary source and evidence

Actual source read at the vendored MuJoCo **3.16.0** commit `a892750516336d8358949f4518fcc4fbbd85beae`:

- [Passive edge force](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_passive.c#L729) applies full relative-edge damping through its Jacobian.
- [Derivative accumulation](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_derivative.c#L1019) and its `mjd_passive_vel` caller form edge outer products in the existing D layout.
- [D sparsity construction](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_io.c#L731) includes DOF ancestry; sibling nodes are not ancestors of each other.
- [Sparse accumulation](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_util_sparse.c#L356) updates common indices only, omitting absent columns.
- [Implicit integration](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1824) uses that D layout for `implicit` or gathers it into reduced M storage for `implicitfast`.

The [receipt](evidence/casing-derivative.json) contains all eighteen inputs, matrix comparisons, first-step predictions, endpoints, source hashes and viewer-record hashes. Twelve focused tests pass with no failures/skips. Numerical study hashes were checked against the final source. GPT-6.1 Sol independently reviewed the source mechanism and audit assumptions. No hosted run, full local attestation, new browser receiving or performance measurement is claimed.

## Next bounded decision

This replaces the earlier sparse-derivative hypothesis with a reproduced explanation for the fixed-hub null-mode failure. It does not close #43/#44, certify loaded motion or establish stable rider support.

The [separate Euler trial](CASING_EULER.md) now retains the uniform mode and active edge damping, with independent oscillator, force and modified-energy checks. Its damping-dependent rest-shape bound rejects one coarse high-viscosity step; the finer high-viscosity controls still have substantial energy-plus-loss discrepancies. It is not promoted to production. Next isolate trajectory/loss-quadrature error with a finer diagnostic reference. A fully coupled implicit alternative needs the complete operator and compatible state/rollback semantics. Do not write larger sparse arrays into the existing native allocation, silently patch records or add foundation damping to mask this error.

Only after that isolated candidate passes should it receive loaded fixed-hub and connected-bike perturbation/refinement, command timing, work/impulse and physical-limit checks, plus complete viewer/headless replay. Continue toward supported rider posture changes and recovery on both bikes; long idle, pumping/hops, detach/reattach, damage, layered terrain, eventual 3D and measured game execution remain distinct gates.
