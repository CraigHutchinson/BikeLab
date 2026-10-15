# Slice 1 evidence — loaded wheel

Historical receipt for model bikelab-wheel-0.1, 2026-10-14. Current model and verification details are in [the 2026-10-15 review](REVIEW_2026-10-15.md). The measurements and 13-test count below describe the original iteration, not the current tree.

## Delivered

Shared JavaScript physical model for browser and Node, local loopback server, headless scenario runner, editable wheel/contact parameters, three surface inputs, synchronized scene/readouts/plots, pause/reset/sample-step/scrub/speed controls, pinned setup comparison, and JSON save/recompute.

The solver uses caller-owned typed-array scratch; run signal buffers are allocated before integration. The renderer uses recorded samples, so display scheduling does not alter physics. Setup edits pause playback and disable run/save/pin until applied.

## Automated evidence

Node v24.19.0 on the current Windows host. node --test: 13 tests, 13 passed, zero skipped.

Checks cover static equilibrium at 12/95 kg, relaxation from initial displacement, closed-form ballistic motion, analytical undamped oscillation at two masses, analytical steady harmonic response including phase, conservative/dissipative/driven energy budgets, three-step convergence, unilateral lift-off/recontact, exact same-runtime replay, invalid-input rejection, forcing continuity/derivative checks and setup comparison gating.

Existing test tolerances were written before the initial numerical run. All passed on the first run. The later cross-runtime tolerance below is a separate, explicitly revised contract following observed roundoff differences.

### Default 8-second smooth bump

45 kg, 0.36 m radius, 90,000 N/m stiffness, 400 N s/m damping; 0.035 m amplitude and 2 Hz inverse bump duration.

- Peak normal load: 639.300469 N.
- Maximum compression: 0.007088015 m.
- Time without positive normal load: 0 s.
- Normal impulse: 3530.394 N s.
- Maximum absolute energy/work balance residual: 2.32e-9 J.

These are outputs of the surrogate, not measured tyre properties.

### Lift-off experiment

60 mm bump, 6 Hz inverse duration, other settings at defaults. Browser displayed peak load 4166 N, peak compression 45.5 mm, unloaded duration 1.201 s and maximum energy residual 1.84e-3 J.

Tests compare 0.5, 0.25 and 0.125 ms integration. Two finest steps agree within the preregistered 1% peak-load and impulse bounds. Sampled load-event times agree within one 5 ms recording interval. Each run meets the 0.05 J impact-case energy budget. Discontinuous transitions do not inherit the formal smooth RK4 order.

## Browser evidence

The served page returned HTTP 200. The browser displayed computed metrics and exposed functioning canvas elements. Actions exercised:

- 5 ms step moved the time readout to 0.005 s.
- Pinning 400 N s/m and applying 900 N s/m retained a compatible reference and changed the result.
- Changing excitation hid the incompatible reference and explained why.
- Editing an unapplied setup disabled run, reset, step, pin, save and timeline controls; verified from actual DOM properties.
- Quarter-speed playback advanced and Pause held the displayed time.
- Saved a browser-generated run, changed damping, then loaded the saved file; original setup and result returned.
- Browser console inspection returned no captured warnings/errors.

Observed solve times were approximately 2–8 ms for an 8-second experiment; an observed draw submission was 0.4 ms after warm-up (initial draw 2.6 ms). These are opportunistic UI observations on this host, not controlled performance measurements or GPU frame timings.

Screenshot capture repeatedly failed in the available in-app browser, including after making it visible. Therefore canvas appearance, clipping, typography and responsive layout have NOT received pixel-level visual verification. Accessibility/DOM evidence proves controls and outputs, not graphical fidelity.

## Browser versus Node

A browser-saved 900 N s/m run was recomputed with Node. First checking exact equality exposed small differences. Maximum observed discrepancies:

| Signal | Maximum absolute difference |
|---|---:|
| Time, height, compression, energy, unloaded duration | 0 |
| Velocity | 1.11e-16 m/s |
| Platen height | 8.67e-18 m |
| Normal force | 1.14e-13 N |
| Support work | 1.78e-15 J |
| Effective loss | 3.33e-16 J |
| Energy residual | 2.84e-14 J |

All summary metrics matched exactly. The source and experiment are shared, but JavaScript runtime equivalence is numerical rather than universally bitwise. The record verifier now uses an explicit 1e-10 * max(1, peak absolute reference channel value) tolerance, with matching sample counts and exact event lists. This is an engineering agreement bound, not a physical-accuracy tolerance. Same-runtime replay tests still require exact equality.

Use node scripts/verify-record.mjs <saved-run.json> to repeat the comparison. It rejects malformed/nonfinite channels and altered results.

## Remaining limits

No real tyre, pressure, tread, fork, rear suspension, rider or terrain calibration. No rolling or steering. No physical wheel-spin state. No full bicycle. No participant test. No sharp-edge contact model. No root-located contact events. The current UI parameters are illustrative, and compression beyond the surrogate domain stops a run.

Next: close native visual inspection, then implement a suspension station with independent force-curve and transient checks before assembling the whole bike.
