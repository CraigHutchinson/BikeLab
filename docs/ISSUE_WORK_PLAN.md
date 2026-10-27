# GitHub issue consolidation — 2026-10-27

Reviewed all nine open issues [#37–45](https://github.com/CraigHutchinson/BikeLab/issues?q=is%3Aissue+is%3Aopen), including their comment threads (none at review time), against merged main `bc44e90` and the in-progress [fixed-hub slice](FIXED_HUB.md), PR46. This is the current issue-to-delivery map; the older D1–D12 documents retain the wider requirements.

All nine reports originate from a native C++ port pinned to `e73f6cc`. Their numerical errors, speedups and native/WASM comparisons are **reported external evidence**, not newly verified results for current BikeLab. Where possible the mechanism was checked in current source. Reproduction must record the port revision, full inputs, native/library/compiler/FP settings, outputs and reference convergence. Do not make BikeLab's old numerical trajectory the correctness oracle when the purpose is to improve that trajectory.

## Ordered work packages

| Package | User-visible receiver and technical work | Issues and dependency | Exit gate |
| --- | --- | --- | --- |
| **A — Finish current diagnostic** | Fixed-hub viewer: both bikes/wheels, imported/zero rates, replay, contact/load/work history. Receive hosted tests and inspect actual captures. | PR46; evidence for #43/#44, policy input for #41/#45. | Exact tested tree, full tests, browser/headless records, desktop/mobile capture inspection. All physical conclusions remain bounded. |
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

**Disposition: first isolate numerical behavior (A/B), then a versioned, consumed material extension if justified.** The new fixed-hub and contact-free controls provide evidence missing at the report's older baseline. Both implicit integrators produce timestep-dependent nonuniformity even from a uniform, zero-edge-rate state. Additional damping must not hide that failure. If foundation viscosity is added, use relative internal force pairs, nonnegative loss, preserved momentum and exact disabled equivalence; test moving/spinning hubs, uniform modes and loaded both-bike perturbations. Initially use clearly labelled illustrative coefficients with no human/material calibration claim. A default-zero inert parameter without a consumed viewer/headless experiment is insufficient.

### #44 — Stiff-mode integration

[Issue](https://github.com/CraigHutchinson/BikeLab/issues/44) reports midpoint gains in a native emulation of the **bike rig**, not direct measurements of current trail-bike or fixed-hub MuJoCo. Smooth modes and buffer kinks are separate cases.

**Disposition: split the scope (B/E).** Current casing work gets the narrowly defined sparse edge-damping derivative/finite-difference check; preserve the result that full `implicit` alone does not resolve uniformity. The rig gets a separately reproduced stiff-mode/error/phase study with midpoint/trapezoid and event candidates. Measure energy/phase, buffer engagement time, peak/impulse and rollback; do not infer an acceptable larger production timestep from A-stability or a port's speedup. Any solver change requires a distinct numerical/model policy and downstream receiving.

### #45 — Canonical numerics and ticks

[Issue](https://github.com/CraigHutchinson/BikeLab/issues/45) aligns with existing canonical new-model XML, named fresh state, integer hub-command ticks and right-continuous command ownership. Current `trail-canonical.js` records part of the numerical policy; articulated/active/fixed-hub records expose it differently. The old multirate design also contains pre-actuation status text which needs reconciliation when its implementation starts.

**Disposition: unify the new-record policy contract in B; enforce it in D/E.** State model/XML quantization versus evolving-state precision, native JS/WASM hashes, host versus WASM transcendental ownership, command tick basis, hold/observation semantics, solver/error settings and promised replay tier. Do not quantize evolving state to manufacture agreement or silently upgrade legacy records.

Dyadic steps are a candidate scheduling policy, not an already selected adaptive solver. Reject/accept only at declared transactions; never cross a command tick, lose a narrow event, average across a discontinuity or let target/render cadence choose physical time. Event localization below the base tick may require a finer common clock or an explicit event substep contract; reconcile it with #37 before claiming that powers-of-two alone solve timing.

## Tracking and closure

All issues remain open. This plan consolidates them without declaring a fix, accepting the port's quantitative claims as local evidence, or changing any issue text. Later implementation PRs should name their issue, source baseline, receiving cases and exact validation receipts. Close an issue only after its actual acceptance scope is received; metadata delivery alone does not close an issue whose requested mechanics remain outstanding.

