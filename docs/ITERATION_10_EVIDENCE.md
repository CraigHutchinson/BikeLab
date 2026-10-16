# Iteration 10 evidence

Reviewed main de785d2 and preserved the full four-variant baseline before editing. All 118 baseline tests passed. [Scope and gaps](ITERATION_10_REVIEW.md) preregistered the receiving budgets; [model contract](SHOCK_BUFFERS.md) explains signs, units and limits.

The full local suite passes 126 tests without skips. New checks independently verify geometry derivatives, native compressed Jacobian agreement, frame-motion invariance and passive virtual work; four fixed/passive-rider top/bottom scenarios across three steps; hardtail dormant invariance; cadence-independent summaries; weak/unbuffered termination and historical record migration. GPT-6.1 Sol independently reviewed the force/work mapping and found no blocking issue; its additional frame-motion test suggestion was received.

[Measured numerical receipt](evidence/iteration-10-shock-buffers.json): all old recorded channels match exactly at 801 samples in each of four bike/rider variants. Twelve coupled runs meet the 1% work-scale residual gate. Finest-pair peak differences range from 0.0122% to 0.1052%; maximum shock-travel difference is 0.00894 mm, below 2%/0.2 mm limits. These are numerical budgets for the prescribed presets, not validation of the entire parameter range or physical calibration. Solver precision work remains parked.

The full real-worker browser suite passed with no console/page errors. [Browser receipt](evidence/iteration-10-browser.json) covers both shock presets against headless channels, setup reload, engagement text, hardtail/dormant controls, resizing/page lifecycle and 390/320 px layouts. Top-out desktop and 320 px captures were opened and inspected: shock engagement/highlight, signed force, torque/total-force readouts and energy histories render; mobile wraps without horizontal overflow. These are headless captures, not participant or native-device evidence.

Reproduce numerical receiving runs with node scripts/shock-buffer-evidence.mjs; an optional second argument supplies a preserved pre-change baseline JSON for exact old-channel comparison. Run node --test and node scripts/browser-check.mjs for the full suites. Hosted exact-head checks and post-merge Pages/live verification are recorded in the PR.

Next bike-focused slice: expose derived sag, load split and linkage behaviour as configuration diagnostics, then introduce sourced geometry/mass inputs and verified rider attachment loads. No real bike catalogue, tyre-pressure mapping, failure thresholds or free-riding/3D handling is claimed here.
