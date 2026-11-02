# Translating tyre contact entry — 2026-11-02

The planned synthetic drop exposes a failed receiving gate that the earlier unloading/separation controls did not exercise. The unchanged fixed-step model completes all three 20 ms runs, but **both timestep comparisons fail**. The [baseline receipt](evidence/casing-entry-baseline.json) preserves the full input, source/case hashes, summaries and failures at remote `7693df1`.

The control has 64 undeformed casing nodes, zero relative rates, an unrotated hub 10 µm above flat ground, common downward velocity 0.1 m/s and gravity 9.80665 m/s². Hub and casing masses remain 1.5 and 1 kg. Donor provenance identifies parameter lineage, not an observed bike state. Before contact, the exact gap is `10e-6 - 0.1*t - 9.80665*t²/2`, reaching zero at approximately 99.5144 µs.

Across the existing 1.953125/0.9765625/0.48828125 µs ladder, the two maximum velocity discrepancies are 3.48013e-4 and 1.73985e-4 m/s; contact-work discrepancies are 1.94372e-6 and 9.52424e-7 J. The second comparison must meet one tenth of the original budgets. Native/reconstructed stages agree exactly; small work residual alone does not qualify convergence. These drops enter contact but do not fully separate/recontact within 20 ms.

Native contact excludes nonadhesive rows at nonnegative gap. Just inside, the reference damper produces finite upward force for a closing vertex. This discontinuity makes fixed-step RK4 depend on event phase even when its smooth-force/stage reconstruction is correct. Intermediate RK states are predictors: stage 2 and 3 share a time but differ in position even under constant gravity. Their contact toggles must not be counted as physical cycles or compared to exact ballistic positions at those times.

## Predeclared correction experiment

Add a separately identified diagnostic policy that retains the native contact law and RK4, but bisects a candidate step when active vertex identity changes across its four reconstructed stages or actual endpoint. Predeclare at most eight bisections, and at most 4,096 extra accepted substeps over a run. Keep the original external/output clock and all original refinement, force, energy, momentum, geometry and rollback budgets. No default product policy changes.

Each accepted substep must receive the same native/stage comparison and independent physical checks. Discarded predictor/contact trials contribute no work, impulse or accepted maxima. A failed macro interval restores its initial integration state, warm start and all accepted records/ledgers. Bisection is a bounded numerical control, not continuous collision detection or proof that all possible hidden contact excursions are found. Work-cap exhaustion must terminate honestly.

Record accepted endpoint contact cycles separately from ordered stage observations. Receive initial free flight only over steps whose complete stage set remains contact-free. Bracket the analytic first-touch time using accepted endpoints, retaining stage contact disagreements as numerical evidence. Then run the same three-level comparison, preserve failures, and design a separately recorded recontact control if this input still contains no cycle.

The correction is implemented in a separate `bikelab-translating-hub-contact-rk4-diagnostic-0.1` model. Twelve focused tests pass: the eight prior translating tests plus contact-free recovery, trace/replay independence, analytic entry/refinement, rollback after an accepted interior substep and low-force Newton receiving. The two-control, three-step 20 ms ladder is running; no aggregate result is claimed yet. Keep [the broader correction plan](CASING_FIX_PLAN.md), [spinning-hub plan](SPINNING_HUB_PLAN.md), physical failure boundaries and eventual connected bike/rider/3D goals open.


## Low-force Newton stopping

The separate recontact control begins with 50 µm compliant overlap and common upward speed 0.05 m/s, zero relative displacement/rates and the same gravity/material. This is a controlled upward release, not a settled support state. The original native tolerance `1e-10` fails the unchanged `1e-8 N` independent Newton-balance guard at approximately 26.37 µs: residual `3.17e-6 N`. A forensic `1e-12` override also fails; `1e-14` completed the short probe but does not supply an absolute force-error guarantee. The [probe note](evidence/casing-entry-solver.json) distinguishes these exploratory measurements from final-source receiving.

The pinned [Newton termination code](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_solver.c#L2995) may exit after an iteration on scaled improvement or Newton decrement, without requiring the independent force-balance threshold. Its initial certificate is gradient-gated, but the later decrement branch is not. A small cost/decrement therefore does not imply our absolute force accuracy.

The new diagnostic policy records native solver tolerance `1e-20` in its identity and XML. This is a numerical-accuracy choice, not a changed contact/material law. The original absolute balance/force guards remain mandatory at every observed stage and accepted substep; no solver tolerance is presented as a universal force-error guarantee. Legacy fixed-step records retain their original native solver setting.

Contact traces use little-endian float64 rows: one initial endpoint, then four ordered RK predictors and one accepted endpoint per committed substep. The sidecar specifies all columns, row count and SHA-256. Failed macro intervals erase their complete trace/work/state prefix, while attempted warning and work diagnostics remain separately identified. Progress remains on accepted macro intervals. The finer-step cost is bounded and reported; this is not a real-time benchmark.
