# Translating tyre contact entry — 2026-11-02

The planned synthetic drop exposes a failed receiving gate that the earlier unloading/separation controls did not exercise. The unchanged fixed-step model completes all three 20 ms runs, but **both timestep comparisons fail**. The [baseline receipt](evidence/casing-entry-baseline.json) preserves the full input, source/case hashes, summaries and failures at remote `7693df1`.

The control has 64 undeformed casing nodes, zero relative rates, an unrotated hub 10 µm above flat ground, common downward velocity 0.1 m/s and gravity 9.80665 m/s². Hub and casing masses remain 1.5 and 1 kg. Donor provenance identifies parameter lineage, not an observed bike state. Before contact, the exact gap is `10e-6 - 0.1*t - 9.80665*t²/2`, reaching zero at approximately 99.5144 µs.

Across the existing 1.953125/0.9765625/0.48828125 µs ladder, the two maximum velocity discrepancies are 3.48013e-4 and 1.73985e-4 m/s; contact-work discrepancies are 1.94372e-6 and 9.52424e-7 J. The second comparison must meet one tenth of the original budgets. Native/reconstructed stages agree exactly; small work residual alone does not qualify convergence. These drops enter contact but do not fully separate/recontact within 20 ms.

Native contact excludes nonadhesive rows at nonnegative gap. Just inside, the reference damper produces finite upward force for a closing vertex. This discontinuity makes fixed-step RK4 depend on event phase even when its smooth-force/stage reconstruction is correct. Intermediate RK states are predictors: stage 2 and 3 share a time but differ in position even under constant gravity. Their contact toggles must not be counted as physical cycles or compared to exact ballistic positions at those times.

## Predeclared correction experiment

Add a separately identified diagnostic policy that retains the native contact law and RK4, but bisects a candidate step when active vertex identity changes across its four reconstructed stages or actual endpoint. Predeclare at most eight bisections, and at most 4,096 extra accepted substeps over a run. Keep the original external/output clock and all original refinement, force, energy, momentum, geometry and rollback budgets. No default product policy changes.

Each accepted substep must receive the same native/stage comparison and independent physical checks. Discarded predictor/contact trials contribute no work, impulse or accepted maxima. A failed macro interval restores its initial integration state, warm start and all accepted records/ledgers. Bisection is a bounded numerical control, not continuous collision detection or proof that all possible hidden contact excursions are found. Work-cap exhaustion must terminate honestly.

Record accepted endpoint contact cycles separately from ordered stage observations. Receive initial free flight only over steps whose complete stage set remains contact-free. Bracket the analytic first-touch time using accepted endpoints, retaining stage contact disagreements as numerical evidence. Then run the same three-level comparison, preserve failures, and design a separately recorded recontact control if this input still contains no cycle.

Implementation and receiving of this correction are pending at this checkpoint. Keep [the broader correction plan](CASING_FIX_PLAN.md), [spinning-hub plan](SPINNING_HUB_PLAN.md), physical failure boundaries and eventual connected bike/rider/3D goals open.
