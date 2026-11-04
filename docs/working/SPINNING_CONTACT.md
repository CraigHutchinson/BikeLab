# Spinning contact working plan — 4 November 2026

This is a tracked, provisional continuation plan for [draft PR90](https://github.com/CraigHutchinson/BikeLab/pull/90). Commit and push changes to this plan alongside draft implementation checkpoints. It supplements the [received diagnostic](../SPINNING_GAP.md) and [broader spin plan](../SPINNING_HUB_PLAN.md); it is not evidence that pending work passed.

## Saved checkpoint

- Base main: `3b8081e9fc70b025eecc1d7c246be52cace820b9`. PR54 has merged and PR46 is closed as superseded; preserve their historical evidence and accepted limitations.
- Diagnostic source: `f2cd86e751be369e9f8d1e436951580d5a5805cb`; evidence/plot/plan checkpoint: `47fc35e5cabec634ad4dc4f88d5c2e5d73dd6e50` on `codex/spinning-gap-isolation`.
- Thirty-six prescribed states and four focused tests pass. The complete local in-process suite is 409/422, with the same thirteen environment-blocked subprocess/loopback checks as preceding main. This is not full attestation.
- [Full report](../evidence/spinning-gap.json), [test receipt](../evidence/spinning-gap-tests.json), inspected SVG, runner and plotting script are tracked. Ignored raw logs/PNG duplicate or support the published evidence; they are not the sole copy of the plan or numerical result.
- GPT-6.1 Sol reviewed signs, mass/inertia, inverse, bias and row law. Its regime-admission and second-contact finite-difference findings were addressed. Production physics, existing assertions and budgets are unchanged.

## Established finding

The zero-material, flat-vertex probe keeps world node positions and translational velocities fixed while varying spin. Native normal force changes with the convective contribution to physical gap acceleration. The independent mass, bias, Jacobian, mobility, force, power and finite-difference checks explain that change. Positive-force rows satisfy `physical_gap_acceleration + regularizer*force - aref = convective_z`. Inactive rows retain their separate unilateral/admission conditions.

This isolates a mechanism in the pinned solver. It does not select a universal tyre contact law, correct production stepping, qualify a spinning trajectory, or establish stable bike/rider support.

## Target intervention checkpoint — 4 November

The diagnostic-only `spinning-gap-target.mjs` now re-solves the 36 original states plus 12 labelled closing/opening velocity controls. All 48 pass with 1,248 native constraint re-solves. The original native outputs reproduce exactly on this runtime. Corrected forces agree across matched spin/angle states within the original force budget; closing/opening cases exercise nonzero signed power. No production code or baseline receipt changed.

Four new focused tests pass alongside the four baseline tests. The implementation verifies unchanged physical state, contact identities, full mass matrix, smooth dynamics, Jacobian and regularization. Five explicitly reseeded warm-start modes and repeated/restored target sequences pass; this is seed/order independence, not trajectory warm-start ownership. Deliberately missing/no-op solve APIs, state edits and coefficient edits fail closed. The WASM does not expose `qM`; exact mass snapshots use the available `mj_fullM` API.

Source checkpoint `728b68d4891796f8640cc2c65d651249458252e7` receives the [complete report, inspected plot and result](../SPINNING_GAP_TARGET.md). The full in-process suite is **413/426**, with exactly the same thirteen environment-blocked checks as the baseline; [test receipt](../evidence/spinning-gap-target-tests.json) records counts and hashes. No full attestation. Next begin the separate RK stage pilot below, pushing this plan with each draft increment.

### Received source/API boundary and next stage pilot

`mj_fwdConstraint` and `mj_referenceConstraint` are exposed. Source and the native reference-rebuild control confirm that the isolated target is overwritten when normal references are rebuilt. No JavaScript control/passive callback setter was found. `mj_step1/2` is not an RK4 substitute.

GPT-6.1 Sol's pinned-source review found an important endpoint contract: native RK4 leaves `qacc` at the fourth-stage acceleration and `mj_advance` copies it into `qacc_warmstart`; the weighted acceleration is passed separately for state advancement. All four stage solves retain the incoming warm-start. No endpoint forward is performed, so force/contact caches describe stage four, not the accepted endpoint. Preserve this distinction explicitly.

The next proposed pilot is a separately versioned, restricted scalar slide/hinge RK4 driver. Build four stage states explicitly, use native forward evaluation and target re-solve at each stage, and record target/force/acceleration/power. First receive uncorrected parity against native RK4, including endpoint and warm-start state, and transactional rollback. Then receive corrected contact-free ballistic controls before loaded trajectories. Use separate data for endpoint observation. The actual WASM does not expose `mj_copyData`. Proposed rollback therefore uses separate accepted/trial `MjData` slots, with only explicitly admitted integration inputs copied into reset trial data; failed trials never mutate the accepted slot. Admit only the exact scalar slide/hinge topology and zero-input, no-actuator/history/plugin/sleep probe. Receive state ownership and failure paths before extending that contract. Stage implementation and trajectory receiving are still **pending**.

## Next implementation increment

1. Re-read remote main, PR90 and reviews before editing. Preserve concurrent rider work and existing evidence identities. Use small commits and push this working plan with them.
2. Inspect the pinned native call order and actual WASM exports for reference construction and constraint solving. Record which stage hooks are available; do not assume a JavaScript callback exists.
3. First test the proposed `aref - convective_z` target as an explicitly identified prescribed-state intervention. Re-solve from identical native state, preserving row identity and regularization. Require invariant physical normal response across matched spin signs/orientations, independent force/work checks and unchanged absent/excluded/zero-force admission. Keep the unmodified baseline alongside it.
4. Only after that control passes, specify a separately versioned stage policy. The correction must precede every affected constraint solve, including every RK stage. An observer-only correction or a once-per-macro-step patch is insufficient. Record stage/rollback and native-state ownership before implementing trajectories.
5. Receive zero-spin recovery, exact zero-material ballistic and supported centrifugal controls, then loaded spin with linear/angular momentum, work and refinement. Preserve node rotational inertia, physical axle torque, accepted-state rollback and every travel/rim/casing/domain limit.
6. Feed the qualified mechanism into both bikes, keeping continuous buffer forces distinct from held rider/drive commands. Physically specified rest/braking, 10 s rest and eventual 60 s active-rider idle/recovery remain independent gates.

The prescribed-state target adjustment is implemented only in the separate diagnostic. The trajectory stage architecture remains a **proposal**, not an implemented production fix. No integration timestep, force budget, comparison tolerance or production model identity is to be changed merely to make an existing case pass.

## Pending delivery and parallel work

- PR90 is draft. Routine smoke is requested through the existing workflow; no additional full matrix or deployment was requested. Record actual remote results before calling any check passed.
- Legacy macOS diagnosis remains unresolved. Full run [41706182290](https://github.com/CraigHutchinson/BikeLab/actions/runs/41706182290) contains macOS artifact `13266925433` and Linux artifact `13265558819`. The connector returned download references, but the network-enabled shell download was cancelled; no local cross-platform comparison was completed. Use fresh authorized artifact access and the tracked `compare-legacy-replay.py`; do not change historical hashes to hide the failure. These CI artifacts have finite retention.
- The separate longer rider controller diagnosis still fails after target-table substitution. Follow [its latest evidence and passive-law/identical-state effort gate](../RIDER_REPLAY_DIAGNOSTIC.md#longer-controller-receiving--3-november-2026). Do not conflate it with the legacy macOS rig failure or this spinning contact control.
- Browser receiving, calibrated material/failure and pressure loss, layered/faceted terrain qualification, live rider ownership, persistent execution, supported crouch/pump/wheelie/hop/endo, 3D lateral/turning physics and measured game/reference-data fidelity remain in the main plan.

## Reproduction

```sh
node scripts/spinning-gap-target.mjs artifacts/spinning-gap-target
python scripts/plot-spinning-gap-target.py artifacts/spinning-gap-target
node --test test/spinning-gap.test.mjs test/spinning-gap-target.test.mjs
```

When subprocess isolation is unavailable, `node --test --test-isolation=none` gives an exploratory complete-suite result, not a substitute for required HTTP/browser/platform coverage. Keep its failures explicit. A plotting cache can use a writable `MPLCONFIGDIR`; rendering the saved evidence does not rerun the physics.
