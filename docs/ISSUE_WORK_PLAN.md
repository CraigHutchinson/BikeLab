# GitHub feedback and delivery plan — 2026-11-03

**Replay diagnostic update:** [identical-input target controls](RIDER_REPLAY_DIAGNOSTIC.md) isolate host-derived target displacement differences in both 0.1 s target cases. XML and inspected native arrays match; substituting only Node target q in the diagnostic browser makes strict comparison pass. Production remains unchanged and all original failures remain open. Next specify versioned target identity and extend the diagnosis to longer/controller records before reference-rate feedback.

**Integration update:** PR60, PR61 and the complete PR62–69 rider stack are assembled with current main for the user-requested experimental merge. [Integration receipt and follow-up PR boundaries](WORKSTREAM_INTEGRATION.md) supersede the pre-integration inventory below. Integrated tests pass 349/349; geometry/terrain browser gates pass. Rider replay/tracking failures remain explicit. Current main CI policy is preserved.

## Current upstream reconciliation

This is the current ordering and delivery inventory. The detailed issue reasoning and dated checkpoints below preserve history; they do not override this section. Live GitHub review covered **25 issues (all open), 51 PRs (39 merged, 12 open drafts)**, all open-PR changed-file lists and inline review threads, the correction comment on #52, current main CI policy, and PR54's correction/spin plans. No inline review threads were returned; this is not an approval. The compact [catalogue receipt](evidence/upstream-catalogue-2026-11-03.json) records exact heads and source blobs.

Upstream main is `05cf1200f9cf28bcbe7738b3905d4b258ba333ae`: PR47/50 fixed-hub controls and PR55 local-first delivery are merged; the 1 November direct commit restores **minimal CI**, with no weekly full schedule or automatic Pages deployment. This rider stack still has the older literal pause guards. The previous blanket statement that upstream CI remains paused was stale. Repository variable values and successful hosted execution are not established by reading workflow source. See [branch versus upstream policy](CI_WORKFLOW.md).

Seven new issues, #70–76, add evidence about friction regularization, contact switching, rest conditions and wheel-tier failures. They materially change the qualification order. Their native-port measurements are reports, not newly reproduced BikeLab results. #52 also has a [correction](https://github.com/CraigHutchinson/BikeLab/issues/52#issuecomment-6594285597): the reported contact split is approximately 0.82/0.18 near the level tie, **not the entire force on the deeper node**.

### PR inventory and integration disposition

All entries below are open drafts. No merge, closure, retargeting or history rewrite is performed by this consolidation.

| PR | Upstream head | Scope and next receiving gate |
| --- | --- | --- |
| [#46](https://github.com/CraigHutchinson/BikeLab/pull/46) | `0f4a463` | Earlier separate fixed-hub implementation and issue triage, based on `bc44e909`. Overlaps the received PR47/50 path and later PR54. Audit unique nullspace evidence/docs for preservation, then propose supersession; do not merge a second fixture wholesale or delete this branch now. |
| [#54](https://github.com/CraigHutchinson/BikeLab/pull/54) | `f595805` | Independent stability/contact stream. Flat fixed-hub and translating release ladders, then six entry/recontact runs and four refinements are reported received on this branch. Latest policy still needs loaded-release cross-check, spin, both-bike held-buffer/control work, long rest, full local and pinned browser receiving. Add #73–76 law/rest comparisons before treating RK4 as a settling solution. |
| [#60](https://github.com/CraigHutchinson/BikeLab/pull/60) | `ae5fd73` | #39 geometry-label fix; focused import/export/reload and visual gate passes. Integrate against current main and verify the resulting head under current delivery policy. Open issue is not closed merely by a draft browser receipt. |
| [#61](https://github.com/CraigHutchinson/BikeLab/pull/61) | `c105637` | #40 mandatory-first terrain; focused logic passes, browser receiving and branch-specific full Node server check remain. Reuse the now-working host execution procedure; a server pass on PR69 does not certify PR61. |
| [#62](https://github.com/CraigHutchinson/BikeLab/pull/62) | `442b052` | Task-space hip/trunk preview using existing IK; starts the rider stack on main. Preparation, not supported dynamic IK acceptance. |
| [#63](https://github.com/CraigHutchinson/BikeLab/pull/63) | `9e9ddd0` | Timed targets and common bounded effort; parent #62. Both target browser records remain among the failed strict comparisons at the tip. |
| [#64](https://github.com/CraigHutchinson/BikeLab/pull/64) | `64472f7` | Matched slow transfer/control; parent #63. Relative response is demonstrated; absolute support/tracking qualification remains open. |
| [#65](https://github.com/CraigHutchinson/BikeLab/pull/65) | `ccd5742` | Hold-load and effort observation; parent #64. Observer evidence does not establish equilibrium. |
| [#66](https://github.com/CraigHutchinson/BikeLab/pull/66) | `3feee7e` | Geometric error decomposition; parent #65. Separates angle/trunk error from attachment gaps without establishing cause. |
| [#67](https://github.com/CraigHutchinson/BikeLab/pull/67) | `04725f1` | Bounded ideal-anchor static reference; parent #66. Its minimum-effort force split is a policy, not a uniquely physical soft-constraint solution. |
| [#68](https://github.com/CraigHutchinson/BikeLab/pull/68) | `123aece` | Runtime mass/geometry/gravity effort and inertia-derived feedback; parent #67. Browser UI received at #69 tip, but strict controller replay and support acceptance remain open. |
| [#69](https://github.com/CraigHutchinson/BikeLab/pull/69) | `1ad39ae` at review start | Crouch/recovery, preview module serving and starting-angle admission; parent #68. 337/337 Node tests, complete both-bike UI checks, 12/22 failed strict replay comparisons, and all eight native moving crouches fail the frozen transient tracking budget. This consolidation is a documentation follow-up on this PR. |

Preserve stack order **main → #62 → #63 → #64 → #65 → #66 → #67 → #68 → #69**. #60/#61 are independent main-based fixes; #54 remains independent. Before delivery, reconcile current main CI changes at the stack root and propagate forward without reverting them. Shared conflict surfaces include `server.mjs`, `test/pages.test.mjs`, browser checks and the plan/roadmap; #54's new server assets and #69's twelve rider assets must both survive. Passing checks on the tip are not exact-head attestations for every ancestor. If merging in order, revalidate each actual integration head; alternatively prepare an explicitly reviewed combined delivery without discarding the original evidence/history. Do not automatically mark every ancestor received from the tip's partial browser run.

### Complete open-issue disposition

These groups cover all 25 open issues exactly once. “Owner” names the workstream, not an assigned person.

| Issues | Owner / current work | Next gate or disposition |
| --- | --- | --- |
| [#37](https://github.com/CraigHutchinson/BikeLab/issues/37) | E: scalar wheel/suspension stations | Reproduce bounce/drop inputs and convergence before selecting event-aware stepping. Independent of the native casing implementation. |
| [#38](https://github.com/CraigHutchinson/BikeLab/issues/38) | F: static footprint | KKT/residual equivalence first, then measured active-set cost. Current solver already has a residual stop. |
| [#39](https://github.com/CraigHutchinson/BikeLab/issues/39) | C: PR60 | Focused browser gate passed; integration and final delivery evidence pending. |
| [#40](https://github.com/CraigHutchinson/BikeLab/issues/40) | C: PR61 | Receive delayed optional I/O, pending/ready UI, cancellation and actual host server test on this branch. |
| [#41](https://github.com/CraigHutchinson/BikeLab/issues/41), [#45](https://github.com/CraigHutchinson/BikeLab/issues/45), [#57](https://github.com/CraigHutchinson/BikeLab/issues/57) | B: replay/numerical contract; PR69 portability investigation | Identical serialized-input first-divergence trace, effective launch perturbations and separately specified sensitivity envelopes. Preserve exact same-runtime contracts and current strict budgets; record transcendental/clock ownership. |
| [#42](https://github.com/CraigHutchinson/BikeLab/issues/42), [#70](https://github.com/CraigHutchinson/BikeLab/issues/70), [#71](https://github.com/CraigHutchinson/BikeLab/issues/71), [#72](https://github.com/CraigHutchinson/BikeLab/issues/72) | B/F: friction semantics and reference | Record regularization/creep and work meaning; reproduce inclined hold and force-cone boundary classification. Exact finite solution of a regularized cone is distinct from changing to exact Coulomb stick. No rolling-resistance claim from tangential constraint work. |
| [#43](https://github.com/CraigHutchinson/BikeLab/issues/43), [#75](https://github.com/CraigHutchinson/BikeLab/issues/75) | A/B: material and rest conditions | Separate hub-relative damping from witness-law repair; distinguish casing decay from free rolling/rocking/frame drift. Held-brake test must disclose regularized creep or explicitly identify a changed lock law. |
| [#44](https://github.com/CraigHutchinson/BikeLab/issues/44) | B/E: distinct casing and bike-rig arms | Preserve PR54 derivative evidence; no claim that a full damping matrix or RK4 alone fixes rest. Rig midpoint/event study remains separate. |
| [#48](https://github.com/CraigHutchinson/BikeLab/issues/48) | B: contact versus material contract | PR54 contains interpretation docs; isolated compiled-row static/transient verification and separately versioned tread calibration remain. |
| [#49](https://github.com/CraigHutchinson/BikeLab/issues/49) | B/E: terrain/contact convergence | Square/rounded/flat ladder, event/witness and peak/impulse/work budgets. A flat vertex result does not qualify rocks. |
| [#51](https://github.com/CraigHutchinson/BikeLab/issues/51), [#53](https://github.com/CraigHutchinson/BikeLab/issues/53), [#76](https://github.com/CraigHutchinson/BikeLab/issues/76) | F: solver and wheel tiers | Require long-rest as well as corner accuracy/energy tests before cost comparisons; distinguish law changes from solver changes and bound event workload. |
| [#52](https://github.com/CraigHutchinson/BikeLab/issues/52), [#73](https://github.com/CraigHutchinson/BikeLab/issues/73), [#74](https://github.com/CraigHutchinson/BikeLab/issues/74) | A/B: PR54 contact-law qualification | Correct split wording; source-backed law × integrator controls, gap-gradient/work consistency, switch/ripple diagnostics and long fixture/free-hub/both-bike rest. Soft-minimum law is a candidate, not selected production physics. |
| [#56](https://github.com/CraigHutchinson/BikeLab/issues/56) | Delivery: PR55 plus main `05cf120` | JavaScript/WASM adaptation already exists. Reconcile stale branches and operational smoke/full evidence. Shared C++ callers and `ci:skip` are not implemented here; document those deliberate differences rather than claim the literal checklist complete. |
| [#58](https://github.com/CraigHutchinson/BikeLab/issues/58) | B: contact support validity | Reproduce saved reversed normal, extend normal checks across terrain features before interpreting contact eligibility as physical support. |
| [#59](https://github.com/CraigHutchinson/BikeLab/issues/59) | B: solver/reference accuracy | PR54's entry policy tightens Newton accuracy for a diagnosed low-force case; receive residual evidence on loaded/spinning/connected cases. Do not generalize this to a production solver fix or silently change legacy records. |

### New evidence and changed acceptance

- **#70–72:** receive the port's complete inclined-hold, coast and sliding inputs, native/build settings and node weights. Compare force/velocity/creep and signed work in the existing law before introducing another. Treat the reported 2.20 mm/s as case-specific, not a runtime constant. Derive any estimate from configured load, friction, regularizer and contact response. Classify force-cone proximity with stated units/tolerances; an engine zone label alone is not reliable stick/slip evidence.
- **#73/#74:** the reported law factorial and refinement motivate a priority causal comparison. Preserve PR54's verified derivative omission and gap/row mismatch as distinct findings; neither proves the cause of every long-run failure. Compare the unchanged switching law, derivative correction, current flat-vertex path and a separately sourced continuous edge candidate on common inputs. Vary law and integrator independently. Check gap-gradient weights, force/torque/work, tie/reversal behavior and mesh sensitivity. Do not copy the reported smoothing width or add damping to force a pass.
- **#75:** add a declared **10 s** supported-rest target alongside diagnostic frictionless/brake-free controls; report frame/hub drift, wheel rotation, casing mean/nonuniform modes, force ripple, switch count, energy/work and termination. Retain physically allowed neutral/unstable motions as such; do not require every frictionless configuration to settle. Pair fixed-hub evidence with free-hub and both-bike evidence because constraints, mass blocks and inverse weights differ. The 10 s screen does not replace the existing eventual 60 s idle/recovery gate.
- **#76:** every candidate cheap/adaptive tier must pass both rest and obstacle-domain gates. Report event/substep work and actual measured cost separately; a port's 117 s/s or 4–46 J is not a BikeLab benchmark. A finite-difference one-step spectral study is an additional diagnostic with declared perturbation size/tie treatment, not proof by itself that nonsmooth contact is stable.

### Ordered next work and acceptance boundaries

1. **Close review/delivery gaps without changing physics.** Keep #60 ready for integration validation; finish #61's host/browser gate independently. Reconcile main CI policy before integrating any stale branch. Preserve unique #46 evidence, then review its proposed supersession. This plan does not close issues or PRs.
2. **Investigate the rider replay failure with a bounded shared diagnostic.** Start from the same exported input, compare compiled targets/model attributes, then first accepted state, contact identities/normals, witness weights, solver residual and effort/work. Tie results to #41/#45/#57 and the #52/#73 hypothesis without presuming the cause. Keep all 12 failing records and unchanged tolerance. Hand a minimal reproducible case to the stability stream when contact divergence is demonstrated.
3. **Receive law and rest qualification in the independent PR54 stream.** Cross-check entry policy against loaded releases as already planned, but add the law × integrator comparison and physically specified long-rest gates before promoting a spinning/connected path as stable. Retain short entry/recontact successes as bounded evidence. Receive spin and both-bike held buffer/control work, #58 normal validity and #59 residuals before supported-control acceptance.
4. **Continue one common rider control loop.** Design/version geometry- and clock-derived reference velocity through the existing bounded effort path. Implementation can remain an isolated experiment; attributing improved tracking to the controller requires resolved portability evidence and matched support conditions. Keep runtime mass/gravity/inertia derivation, legacy replay, command ownership and frozen crouch budgets. Do not tune fixed forces/gains to compensate for contact chatter.
5. **Promote only after supported crouch/recovery passes.** Then implement explicit phase/support policies for endo/wheelie and bunny-hop preload/release/flight/landing through the shared effort layer. Independent rider ownership, saddle/retention, continuation, terrain, physical calibration and eventual 3D remain required. E/F studies are not blanket blockers to every target/UI prototype.

This reconciles the intended experience (a controllable rider on either bike) with the demonstrated mechanics (runtime-derived effort exists, but transient tracking, cross-runtime replay and long supported rest are unresolved). No solver, material or tolerance change is selected by this documentation review.

## Earlier detailed triage and evidence history

The following sections retain the original A–F reasoning and dated receipts. The current inventory and sequence above supersede obsolete “next”, pending-browser and CI-pause statements. Reports #37–45 used native-port baseline `e73f6cc`; #48–49, #51–53, #57–59 and #70–76 refer to `bc44e90` or the explicitly cited PR54 fixture seeds. Port claims still require inputs/build settings and local reproduction.

## Issue-by-issue decisions

### #37 — Event-sensitive station convergence

[Issue](https://github.com/CraigHutchinson/BikeLab/issues/37) reports 34% force / 40 mm travel / 5.6 ms contact timing on a wheel sine case, 29% stiff-drop peak error, and adaptive/event gains. Current `dist/physics.js` and `dist/suspension.js` still use fixed RK4; recorded contact transitions are not a solver that lands on every switch.

**Disposition: reproduce first, then select an algorithm (E).** Preserve the eleven port scenarios and their actual convergence sweep; establish a local finer-step/independent reference before accepting the reported percentages. Map both tyre penetration and unclamped-load switches, compression/rebound damping reversal, forcing knots and travel termination to the actual equations. Event thresholds need units and justified budgets; 1e-8 m is an external proposal, not a universal tolerance. Validate no missed/chattering events, correct unilateral forces and work. Read the chosen method's primary reference before implementing it. This analytic station problem does not imply replacing MuJoCo contact integration.

### #38 — Static footprint active set

[Issue](https://github.com/CraigHutchinson/BikeLab/issues/38) proposes an active-set periodic tridiagonal solve and reports 2.0–2.3× speedup. Current `dist/footprint.js:solveRing` cold-starts at lower bounds and performs projected cyclic coordinate minimization. It **already stops on a projected force residual**, rather than only a fixed number of sweeps.

**Disposition: evaluate after correctness baseline (F).** Do not present “add a residual stop” as an unimplemented fix. If the target is displacement accuracy, derive its relationship to residual/conditioning. Compare direct/active-set and current solver against independent KKT/complementarity, bounds and energy, including all-active/all-free, zero coupling, periodic wrap, degenerate active sets and mesh sizes. “Exact” means a finite-tolerance direct solve, not exact arithmetic or calibration. Verify contact/support decisions before measuring end-to-end JS cost with consistent warm/cold starts. This radial static QP is not the dynamic capsule casing law.

### #39 — Geometry identity from exact derived floats

[Issue](https://github.com/CraigHutchinson/BikeLab/issues/39) is confirmed: `dist/linkage.js` derives photo coordinates with `Math.hypot`; `geometryLabel` uses exact equality on those derived values.

**Disposition: next small correctness fix (C).** Prefer explicit authored provenance/preset identity with compatibility validation for new records; for existing records, define a tight documented numerical-equivalence rule if needed. Test one-ULP differences and cross-runtime serialization, plus intentionally custom near-preset geometry so a tolerance does not mislabel an edit as sourced. Do not round actual geometry or change force calculations to fix a label. The separate `geometryFor` historical-offset equality preserves old mechanics; audit it under compatibility rules rather than deleting every equality indiscriminately.

### #40 — Mandatory-first terrain publication

[Issue](https://github.com/CraigHutchinson/BikeLab/issues/40) is confirmed in `dist/terrain-request.js`: mandatory data is extracted, then optional tiles are awaited before the complete result returns and the active request slot is released.

**Disposition: high-priority terrain correctness/latency fix (C).** Publish owned mandatory coverage independently; optional work needs a bounded queue and explicit cancellation/generation semantics, error handling and cache priority. Exercise delayed/failed optional tiles, reset/supersession, eviction, admission and pending budgets. The mandatory completion must not wait for optional I/O. A finite cache/bandwidth can still be hurt by aggressive prefetch, so do not promise that any lookahead “only ever helps.” Receive the corrected pending/ready behavior in the R0 viewer and headless latency fixture; it does not implement terrain forces.

### #41 — Contact sensitivity and portability

[Issue](https://github.com/CraigHutchinson/BikeLab/issues/41) reports nanometre contact branching. Its 4.19e-7 JS comparison refers to the preserved historical `.4` guided failure. Current `.5` canonical guided inputs already use canonical construction/native shock evaluation and passed the received strict comparison. The issue therefore motivates broader sensitivity characterization, not undoing that correction.

**Disposition: add a separate sensitivity qualification (B), retain regression checks.** Same build/input/schedule replay must remain exact where currently promised. Canonical inputs and native build identity are checked independently of trajectory tolerance. For cross-runtime/model comparisons, report pre-branch numerical error, first contact-set divergence and post-branch observable/event envelopes. Exact pre-contact equality is not a universal cross-platform guarantee.

Use fixed declared perturbation families, units and observable budgets, independent validation cases and an explicit margin rationale. Verify that tiny requested offsets survive serialization/canonicalization; report effective perturbations, not values rounded away. Keep qualitative support/termination, energy, impulse, invariants and valid-domain gates separate. Never increase tolerance until a failing implementation happens to fit, or relabel a broad sensitivity envelope as physical accuracy. Dynamic IK perturbations must be physically compatible, not just arbitrary state corruption.

### #42 — Regularized brake/traction creep

[Issue](https://github.com/CraigHutchinson/BikeLab/issues/42) matches the existing native DOF friction-loss and elliptic-contact choice. Current docs disclaim exact lock; records expose spin/slip/torque/work, but their high-level scope does not uniformly provide a machine-readable brake/stick semantics field.

**Disposition: record contract first (B), new mechanics only for a demonstrated consumer (F).** New-version metadata should identify the law/native build, regularization and “exact lock not guaranteed”; report measured residual wheel speed/slip and cumulative creep under a defined hold, rather than imply a universal creep amount. Preserve old record replay. A direct bounded-row/LCP solver is a proposed different mechanics model, not a drop-in parity optimization. It needs primary-source review, unilateral/friction feasibility, coupled force/torque/work and event/rollback evidence before offering an exact-lock option.

### #43 — Hub-relative foundation damping

[Issue](https://github.com/CraigHutchinson/BikeLab/issues/43) correctly identifies zero foundation viscosity; edge viscosity does not physically damp uniform relative translation. The current diagnostics already expose mean/nonuniform motion, relative kinetic energy and damping powers; relative kinetic energy is not an independently additive world-energy component.

**Disposition: first isolate numerical behavior (A/B), then a versioned, consumed material extension if justified.** The received fixed-hub controls provide evidence missing at the older baseline. Separate PR46 reports timestep-dependent nonuniformity in a contact-free uniform-translation control under both implicit integrators; receive and independently reproduce that branch-specific result before using it as a diagnosis. Additional damping must not hide unresolved numerical behavior. If foundation viscosity is added, use relative internal force pairs, nonnegative loss, preserved momentum and exact disabled equivalence; test moving/spinning hubs, uniform modes and loaded both-bike perturbations. Initially use clearly labelled illustrative coefficients with no human/material calibration claim. A default-zero inert parameter without a consumed viewer/headless experiment is insufficient.

### #44 — Stiff-mode integration

[Issue](https://github.com/CraigHutchinson/BikeLab/issues/44) reports midpoint gains in a native emulation of the **bike rig**, not direct measurements of current trail-bike or fixed-hub MuJoCo. Smooth modes and buffer kinks are separate cases.

**Disposition: split the scope (B/E).** Current casing work gets the narrowly defined sparse edge-damping derivative/finite-difference check; receive PR46's reported full-`implicit` comparison before drawing conclusions about uniformity. The rig gets a separately reproduced stiff-mode/error/phase study with midpoint/trapezoid and event candidates. Measure energy/phase, buffer engagement time, peak/impulse and rollback; do not infer an acceptable larger production timestep from A-stability or a port's speedup. Any solver change requires a distinct numerical/model policy and downstream receiving.

### #45 — Canonical numerics and ticks

[Issue](https://github.com/CraigHutchinson/BikeLab/issues/45) aligns with existing canonical new-model XML, named fresh state, integer hub-command ticks and right-continuous command ownership. Current `trail-canonical.js` records part of the numerical policy; articulated/active/fixed-hub records expose it differently. The old multirate design also contains pre-actuation status text which needs reconciliation when its implementation starts.

**Disposition: unify the new-record policy contract in B; enforce it in D/E.** State model/XML quantization versus evolving-state precision, native JS/WASM hashes, host versus WASM transcendental ownership, command tick basis, hold/observation semantics, solver/error settings and promised replay tier. Do not quantize evolving state to manufacture agreement or silently upgrade legacy records.

Dyadic steps are a candidate scheduling policy, not an already selected adaptive solver. Reject/accept only at declared transactions; never cross a command tick, lose a narrow event, average across a discontinuity or let target/render cadence choose physical time. Event localization below the base tick may require a finer common clock or an explicit event substep contract; reconcile it with #37 before claiming that powers-of-two alone solve timing.

## New contact feedback

### #48 — Solver compliance versus tyre material

[Issue #48](https://github.com/CraigHutchinson/BikeLab/issues/48) correctly distinguishes contact regularization from a declared tread law. Current `moving-wheel.js` creates `solref=[contactTime,1]` and `solimp=[d,d,.001]`; trail-bike and fixed-hub reuse them. The equal impedance endpoints make the width irrelevant to impedance variation: it is not tread thickness. Casing foundation/edge elasticity is a separate model term. PR54's moving-wheel and trail-bike documentation proposes making this explicit; receive it with that branch.

For an isolated constant-impedance normal row, the [official scalar approximation](https://mujoco.readthedocs.io/en/3.3.7/modeling.html#solver-parameters) gives `r_ddot + 2*r_dot/tau + r/(tau²*zeta²) = (1-d)*a_unforced`. With the [pinned regularizer](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_constraint.c#L1763), `K_static = 1/[A_approx*(1-d)*tau²*zeta²]`. Thus the isolated-row static/transient coefficient ratio is 100 at d=0.99. `A_approx` is the native diagonal approximation, not universally the exact coupled inverse effective mass. The port's 2.3e6 N/m per contact and trajectory/force percentages remain unverified locally; whole-wheel critical damping does not follow.

**Next gate:** receive port fixtures/build settings and test a loaded isolated normal row across d and tau, separating settled penetration from transient response and comparing compiled native coefficients. A tread compliance must be a separately identified material model, with independent energy/storage/loss ownership and calibration. Merely altering solref or interpreting permitted overlap as a tyre property is not that implementation. Documentation addresses the immediate interpretation gap; the calibration/model work remains open.

### #49 — Sharp-rock timestep and event sensitivity

[Issue #49](https://github.com/CraigHutchinson/BikeLab/issues/49) reports square-rock hub/force differences of 7.1 mm/26%, rounded-rock 0.52 mm/5.2% and flat 0.07 mm/0.85% between 31.25 and 7.8125 µs, plus gains from locating contact and witness changes. These are port reports at bc44e90, not new BikeLab measurements. Our fixed-hub refinement independently leaves force/motion convergence unresolved, but does not reproduce those moving-rock numbers.

**Next gate:** preserve full square/rounded/flat inputs and canonical launch geometry, then run a declared timestep ladder with every-step peak loads, impulse/work, matched trajectories, termination and first contact/witness divergence. The finest available run is only a reference candidate; require further refinement or an independent reference before calling it converged. Keep discrete support and domain-stop outcomes separate from trajectory tolerance.

An event-located alternative requires explicit onset/release/witness functions, native state/history and ledger rollback, event/chatter handling, command ownership and a compatible clock contract (#45). Do not replace MuJoCo stepping or relax regression budgets based on the port's speedups alone. These contact gates inform calibration and high-fidelity rock labels while the independently bounded rider and terrain correctness work continues.


## Further native-port feedback: #51–53

These issues share the external `bc44e90` reference baseline. Their timings, speedups, accuracy and model comparisons remain port reports until reproduced locally. They extend E/F and the contact study; they do not replace A/B or add prerequisites to every IK prototype.

| Issue | Decision and receiving work | Required evidence |
| --- | --- | --- |
| [#51: explicit error-controlled nodal stepping](https://github.com/CraigHutchinson/BikeLab/issues/51) | Candidate for the moving-wheel interactive path, after reproducing nodal equations and contact events. Compare an explicit embedded method with the current native path under the same declared model; do not infer that the current implicit implementation is unnecessary from a port alone. | Primary method source; axes/mass/force mapping; independent limiting cases; contact-aware acceptance/rollback; command-tick ownership (#45); converged trajectory, peak/impulse/work and domain behavior. Measure actual local JS/WASM costs separately from numerical acceptance. |
| [#52: continuous tread loading](https://github.com/CraigHutchinson/BikeLab/issues/52) | Investigate edge-witness force jumps with #48/#49. A smoothed or distributed tread is a separately versioned contact law, with declared compliance and smoothing length, not a parity-preserving solver optimization. | Reproduce the switch in current compiled contacts and count transitions; compare level crossings, onset/release, corners and reversal. Verify force distribution, resultant/torque, energy/storage/loss and mesh/timestep sensitivity, then receive it in moving-wheel viewer and replay. Do not adopt the reported 0.2 mm band or gains without justification. |
| [#53: cheaper wheel tiers on corners](https://github.com/CraigHutchinson/BikeLab/issues/53) | Keep the converged nodal model as the candidate reference for a future bounded-cost tier. Flat-ground agreement alone is insufficient. Do not assume modal truncation works for the current foundation-only casing or add bending stiffness merely to make it work. | Independently inspect the model's mode spectrum, then compare square/rounded rocks, load transitions, contact support, impulse/work, energy creation and termination. Publish validity/domain limits and fallback semantics; qualify performance only after accuracy. No new cheap tier is selected now. |

The next physical change must identify whether it changes **the material/contact law**, **the numerical solver**, or only **the observation**. Keep these arms separate in evidence before assessing combinations. The immediate product goal remains a trustworthy rider action on both bikes, not a wholesale replacement of every solver.

## Tracking and closure

All issues remain open. This plan consolidates them without declaring a fix, accepting the port's quantitative claims as local evidence, or changing any issue text. Later implementation PRs should name their issue, source baseline, receiving cases and exact validation receipts. Close an issue only after its actual acceptance scope is received; metadata delivery alone does not close an issue whose requested mechanics remain outstanding.

## Current independent rider increment — 2026-10-29

Local-first CI adoption is received in PR55. PR60 carries #39 labels and PR61 carries #40 terrain delivery; both retain deferred browser receiving. Separate from stability PR54, [D0 task-target preparation](RIDER_TASK_TARGETS.md) now adds a sampled hip/trunk target viewer and headless input receiver. This reuses the existing analytic setup IK and fixed passive domains. It is a reviewable preparation step toward D, not completion of runtime IK, dynamic recovery or whole-path support validation. The next D1 slice binds targets to the existing bounded drive, integer command ticks and actual retained interfaces after the B dynamic-acceptance gate; no repeated-bump or supported-crouch claim is made here. Continue local verification without triggering hosted CI before deliberate resumption on or after 1 November.

## D1 mechanism and manoeuvre scope — 2026-10-29

The [timed rider target receiver](RIDER_TARGET_DRIVE.md) now connects the D0 task output to common bounded native effort with joint tracking, requested/actual hip/trunk/COM, work, integer target/hub commands and rollback. It is a launch-only mechanism probe, not accepted stable tracking; the B stability/numerical gate remains required for a controlled slow shift and recovery. User-confirmed scope includes bunny hops, endos and wheelies. The [unified control direction](RIDER_CONTROL_ARCHITECTURE.md#unified-mtb-control-direction--2026-10-29) keeps manoeuvre phase/support feedback above the shared target/effort path rather than adding a crouch-specific controller. Next: receive slow tracking, then support-aware checkpointed phase policy and individual manoeuvre gates.

## Matched rider response checkpoint — 2026-10-29

[The slower transfer/control comparison](RIDER_TRANSFER_REVIEW.md) completes eight one-second runs across both bikes and two steps. A 2 mm request produces a roughly 2 mm relative hip response, then returns within 0.2 mm of the matched hold; absolute hold error remains roughly 20–30 mm. This separates commanded response from the larger baseline error, without qualifying balance or identifying its cause. Next rider work characterizes unchanged-target hold error, signed attachment loads, effort and COM motion. Keep gains unchanged pending the B numerical gate, then declare supported hold/transfer acceptance budgets before checkpointed feedback policy. PR54 at `cb86fc9` reports a damping-derivative omission; its full-response candidate and connected qualification remain separate, unreceived work.

## Hold-load checkpoint — 2026-10-29

The [shared load/effort observer](RIDER_HOLD_LOADS.md) now relates unchanged-record posture error to signed hand/foot forces, rider COM velocity and proportional/damping torque terms. Late active torque is dominated by the posture-error term; full-suspension COM motion and step sensitivity remain visible. This is no equilibrium or causal numerical diagnosis. Next separate joint-angle tracking error from attachment compliance using recorded geometry, before defining supported-control budgets and feedback policy. PR54 at `6ebf52a` reports an Euler diagnostic with unresolved energy discrepancies; production qualification is still separate.

## Geometric error checkpoint — 2026-10-29

[Both retained chains now reconstruct hip error](RIDER_GEOMETRY_ERROR.md) from recorded joint/trunk angles and attachment endpoints. Final unchanged holds are about 20.8 mm low, with roughly 0.6 mm vertical foot gap; most of the signed geometric accounting lies in joint/trunk differences. This is not causal isolation or support qualification. Next build a fixed-anchor static support/effort reference before choosing load compensation; do not tune gains or stiffen attachments by assumption. PR54 at `4c37ba2` reports independent reference refinement while candidate qualification remains open.

## Static effort checkpoint — 2026-10-29

The [ideal-anchor static reference](RIDER_STATIC_REFERENCE.md) now selects a torque-bounded minimum-squared-active-effort force split at the requested pose. All 32 comparisons from unchanged recorded inputs are available; independent virtual-work checks cover all seven generalized equations. This policy is not a unique physical load split or soft-constraint equilibrium. Next audit site forces and joint torques in the pinned native rigid-rider model before any bounded compensation diagnostic. Connected production acceptance remains gated on numerical/support evidence.

## Major controller and issue refresh — 2026-10-30

All 18 currently open issues were refreshed. The [controller iteration](RIDER_CONTROLLER_ITERATION.md) consumes the existing D0/D1 target, work and safety path, with mass/gravity/geometry-derived effort and feedback. It adds no tyre damping, contact-law change or integration substitution. [Evidence](RIDER_CONTROLLER_EVIDENCE.md) records the complete and terminated controls; low final posture error is not a settling or manoeuvre certificate.

- **#56 / delivery:** retain local-first verification, literal hosted pause and `[skip ci]` publication. No automatic 1 November resumption, Pages deployment or full attestation. JavaScript/WASM checks remain distinct from the shared C++ workflow recommendations.
- **#57 with #41/#45 / B:** keep exact replay claims scoped to the tested WASM/JS environment. Native/WASM contact branching and launch perturbation envelopes remain explicit blockers to a universal bitwise claim. The controller's new model and serialized response policy are part of state identity; canonical model text does not solve contact sensitivity.
- **#58 / B then D qualification:** reproduce the reported reversed flex-contact normal with its source state, check normal orientation on all terrain features, and retain a diagnostic/rejection policy before expanding controller contact eligibility into a physical support predicate. Current eligibility records geometry only; it does not certify the reported contact force.
- **#59 / B:** retain per-step solver residual/tolerance evidence for cross-engine reference use. Do not tune rider gains to absorb a light-node solver error, and do not silently tighten the production solver to make an agreement claim.
- **#37–45, #48–49, #51–53:** existing A–F triage remains in force. Station/tyre laws, witness switches, event-aware stepping and reduced wheel tiers are separate changes with their own sources and convergence gates. They are not bundled into this rider implementation.

Next rider consumer: larger crouch/recovery with declared tracking/support budgets and browser interaction, then measured support transitions for one-wheel balance and hop/flight/landing through the shared effort layer. Independent rider ownership, saddle/retention semantics and 3D remain required. No GitHub issue is closed by this experimental controller.

## Quota holding checkpoint — 2026-10-30

The [larger crouch experiment](RIDER_CROUCH.md) and complete evidence summary are ready for review on a separate draft stacked on PR68. Ten runs complete; all eight moving cases fail only the frozen transient tracking budget. The next common-control investigation is reference-velocity feedback derived from target geometry and the command clock, with no gain-table tuning or manoeuvre-specific force sequence. Browser receiving, including the newly authorized #39 Edge retry, is pending at the user-requested quota checkpoint. Keep #39/#40 browser gates, PR54 stability and #56–59 delivery/contact/reference gates open; this change closes no issue. [Handoff and commands](HOLDING_STATE.md).

## Browser receiving update — 2026-11-03

The focused #39 geometry import/export/reload and visual gate passes in PR60; integration/issue closure remain pending. On PR69, the rider UI, mass edits, exports, cancellation and mobile checks complete on both bikes, and the Node suite passes 337/337. The real server test exposed and now covers twelve previously unserved rider modules. Target admission now uses the existing drive zero-displacement rule for roundoff-only derived starting angles, preserving serialized inputs and meaningful conflict rejection.

**#57 remains blocking for browser/Node numerical receiving:** 12/22 full-record comparisons exceed the unchanged 1e-9 normalized budget. [Receipts and cases](RIDER_BROWSER_RECEIVING.md) distinguish completed UI from failed replay. Next isolate compiled targets/native attributes and the first accepted state/contact/effort divergence from identical serialized inputs; do not fold a gain/tolerance change into this observation. Keep PR54, #58/#59 and #40 separate. No hosted workflow, deployment, merge or issue closure was performed.
