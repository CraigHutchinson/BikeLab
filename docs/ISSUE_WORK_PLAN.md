# GitHub feedback and delivery plan — 2026-10-28

This plan consolidates issues [#37–45](https://github.com/CraigHutchinson/BikeLab/issues?q=is%3Aissue+is%3Aopen), [#48](https://github.com/CraigHutchinson/BikeLab/issues/48) [#49](https://github.com/CraigHutchinson/BikeLab/issues/49) and [#51–53](https://github.com/CraigHutchinson/BikeLab/issues?q=is%3Aissue+is%3Aopen). It adapts the documentation in [PR46 at `0f4a463`](https://github.com/CraigHutchinson/BikeLab/blob/0f4a4636e7d1db0455379752001585bfbba7318b/docs/ISSUE_WORK_PLAN.md); that branch's separate runtime investigation is not merged or treated as received here. Current work builds on PR47 and the received PR50 controls.

This consolidates the detailed triage from draft [PR54 at `a5ea4be`](https://github.com/CraigHutchinson/BikeLab/pull/54), which remains unmerged. Its 5 s implementation, source-specific findings and documentation changes are proposals/evidence on that branch, not received mainline behavior. PR46's separate fixture implementation also remains unmerged; use the received PR47/50 fixture as the product path.

**Current rider package: [geometric error accounting](RIDER_GEOMETRY_ERROR.md), building on hold loads and separate from stability PR54.** [Local-first CI](CI_WORKFLOW.md) is adopted. All projects avoid needing hosted CI until 1 November 2026; retain missing hosted/browser gates and do not close A or release work on skipped checks. C fixes remain in draft PR60/61; D0/D1 preparation and mechanism receiving remain in draft PR62/63. No hosted resumption is scheduled.

Reports #37–45 describe a native C++ port pinned to `e73f6cc`; #48–49 and #51–53 use `bc44e90`. Port percentages, speedups and native/WASM comparisons are external reports until reproduced with complete inputs, revisions, compiler/FP settings and converged references. Current source confirms constant-impedance soft normal contacts, zero foundation damping, exact derived-coordinate label comparisons and awaited optional terrain work. Numerical identity, convergence, physical calibration and speed remain separate gates. No issue is closed by this plan.

## Ordered work packages

| Package | User-visible receiver and technical work | Issues and dependency | Exit gate |
| --- | --- | --- | --- |
| **A — Finish current diagnostic** | Fixed-hub viewer and 5 s every-step measurements: receive new interval/dense-window records and captures; preserve the received PR47/50 controls. | PR47/50 and the longer study; evidence for #43/#44, policy input for #41/#45. | Exact tested tree, full tests, browser/headless records, desktop/mobile capture inspection. All physical conclusions remain bounded. |
| **B — Numerical and record contracts** | Inspect the uniform-casing derivative failure; compare sparse operator against independent force finite differences. Publish a compact numeric-policy and limitations contract for each new model/record. | #43/#44 dependency; #41/#45; metadata part of #42. | Explain the bounded control or retain an explicit supported error envelope; no hidden damping/integrator switch. New schema policy consumed by replay and viewer; legacy bytes/semantics retained. |
| **C — Small observable correctness fixes** | Stable provenance labels in geometry viewer; mandatory terrain coverage delivered as soon as ready with bounded optional prefetch. | #39 then #40; independent of rider numerical research. | Preset/custom/round-trip/ULP label tests; latency-controlled terrain tests, cancellation/staleness/ownership/budgets and visible waiting state. These are not prerequisites for a planar flat-ground IK prototype. |
| **D — Receive the next rider action** | Compatible perturbation/recovery, then a slow retained-support hip shift/crouch with task IK and bounded effort on both bikes. | B is the dynamic-acceptance prerequisite; #43 may supply a justified material extension after numerical isolation. | Requested/feasible/actual posture and COM, reach/domain rejection, torque/power/work, deterministic targets and rollback; no snapping or forced COM. A complete calibrated tyre or all other issues are not required first. |
| **E — Station reference accuracy** | Converged loaded-wheel/suspension references and event/switch diagnostics; compare adaptive/event or midpoint candidates only where applicable. | #37; separate bike-rig arm of #44; clock contract from #45. | Independent limiting solutions, timestep/refinement and event timing, displacement/force/impulse/work budgets across supplied scenarios. Keep station/native solver models distinct. |
| **F — Targeted improvements** | Static footprint direct solver study; optional exact brake/stick model only when creep blocks a receiving case. | #38; later mechanics part of #42. | Verified KKT/contact/support outcomes and actual JS performance; exact-lock path has independent rest/reversal/release/over-capacity, countertorque and work gates with a separate model identity. |

B and C are separate bounded packages and can be interleaved; terrain or station work must not indefinitely defer the connected rider. E/F are not blanket prerequisites for runtime IK. After D, continue the existing saddle/release/reattachment, independent rider actor, persistent session, 3D handling, layered terrain and measured real-time plan.

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
