# Iteration 8 review and receiving scope

Reviewed latest main 30b81657d5a5f1631525ee5a5240fd8c0c2c6ad9 (merged PR #7), the rider/model/geometry changes, previous evidence, current viewer, worker, CLI, records and tests. All 97 baseline tests pass locally; main Pages run 38880028159 succeeded. No open PR or local changes were present. Captured all existing channels for fixed/passive hardtail/full runs before editing.

The passive rider correctly splits mass/inertia, resolves its added coordinate by name, applies its native spring only once and includes COM/work changes. Frame landmarks are separated from physics and reflect corrected bottom bracket geometry. Stop integration must preserve these paths, rather than add a second frame reaction or silently move ultimate bounds. Older complete records need an explicit no-buffer migration; unknown fields must still reject.

## Next bounded dynamics feature

Receive fork top-out and bottom-out buffers in the existing coupled rig: selectable progressive spring and compression-only damping in an interior zone near each end of the existing 0–160 mm stroke. Show signed buffer force, stored energy/dissipation and engagement in replay. Add a repeatable top-out experiment whose unbuffered control terminates, and compare identical forcing with buffers enabled. Test both bike variants and rider modes. This is a first supported compliant stop experiment, not completion of shock/rider stop models or high-impact component qualification.

Use an explicitly illustrative quadratic spring F=k*d²/b, potential U=k*d³/(3b), and closing-only damper Fd=c*max(dDot,0)*d/b. The top force acts toward increasing fork compression, bottom toward decreasing compression. Native qfrc_applied receives the single generalized force; its internal frame reaction comes through the articulated system. Add stored energy and damper loss once. Forces are held for each integration step, consistent with the existing explicit coupling. No rigid clamp, coefficient of restitution, damage, new hidden damping or expanded stroke.

Continue through buffer engagement only while every ultimate domain check passes. A buffer too weak to arrest motion still stops at the last accepted endpoint. This remains discrete endpoint protection, not a continuous-event or perfectly rigid-stop guarantee. Further solver precision work stays parked unless the receiving budgets fail.

## Gates before results

- Existing recorded channels unchanged with buffers disabled, in all four assemblies/modes; all baseline tests retained.
- Law: independent potential gradient, continuous engagement, sign symmetry, no attraction across a gap, nonnegative damper loss, F*qdot = -dU/dt-loss. Independent one-coordinate impact momentum/energy checks at two masses.
- Coupled runs: both variants, both rider modes, finite nonnegative contact and accepted stroke bounds. Visible top/bottom engagement, peak forces at integration endpoints and energy/loss recorded independently of sample cadence.
- Supported buffer scenario refinement at 0.125/0.0625/0.03125 ms: finest two peak buffer forces within 2%, matched fork travel within 0.2 mm, and energy residual below 1% of max(1 J, support work magnitude, dissipated energy). Stop errors are not judged against micrometre carriage gates.
- Ultimate-bound fallback and inadequate-settling rejection stay active. Same worker/headless path and saved reconstruction; all complete v0.1/v0.2 records explicitly migrate without buffers.
- Full Windows/Linux CI, browser/headless parity, UI controls/save-load/cancellation/mobile and inspected screenshots before merge/deploy.

Next balanced extension after this slice: rear-shock buffers through actual linkage geometry, then rider attachment limits and observable load paths; source-backed component failure and tyre/terrain models remain separate requirements.
