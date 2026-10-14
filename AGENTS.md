# BikeLab working rules

This repository is separate from Sub0Llm. Do not modify neighbouring repositories as part of ordinary BikeLab work.

Develop end-user experiments and physical foundations together. Each slice needs a working visual consumer, a headless path, independent verification and an honest evidence note. Preserve the hardtail/full-suspension goal.

Before editing, inspect current repository status and the roadmap/evidence documents. Coordinate overlapping work; do not run hardware performance experiments concurrently with unrelated workloads.

Use SI internally. Record parameter provenance and uncertainty. Treat illustrative values and simplified models as uncalibrated. Derive geometry-dependent behaviour where the mechanism is explicitly represented; do not count the same effect twice.

Read actual primary references before implementing numerical algorithms or externally sourced models. Map signs, axes, units and force conventions explicitly. Keep numerical correctness, convergence, physical calibration, native rendering/input checks and participant feedback as separate evidence.

Keep dynamics independent of rendering and simulation clocks independent of display timing. Allocate solver scratch and recording storage outside integration loops. Validate inputs, unilateral contact, constraints and energy/work budgets.

Run node --test after physics changes. Recheck browser/headless agreement when numerical behaviour changes. Verify UI interactions for interface changes; do not call failed screenshot capture visual verification.

Before substantive C++ authoring, read cpp-write; before merging substantive C++, apply cpp-review. No C++ stack has been chosen for later slices.

Research delegation preference: bounded data gathering to Sonnet/Terra when available. If those classes are unavailable, say so and work locally. This does not authorize installs or contended measurements.

Do not publish or deploy this local sandbox merely because it has a browser interface.
