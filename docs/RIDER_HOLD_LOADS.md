# Rider hold loads and effort — 2026-10-29

This observer links the [matched hold/transfer](RIDER_TRANSFER_REVIEW.md) posture error to signed support, whole-rider COM motion and the existing joint controller's effort. It changes no forces, gains, integration, targets or record formats. The Trail bike support panel and headless review consume the same sample observer.

## Contract

`riderLoadSample(scenario, frame)` reports world-xyz force on the rider from hands and feet, their sum, positive rider weight, net force including gravity, and mass-weighted world COM velocity. Native segment velocity uses angular xyz followed by linear xyz; only the latter contributes to COM translation. Named segment masses and attachment identities are checked, independent of array order. No saddle or additional rider external force is introduced. These interface loads are internal to the combined bike/rider system and must not be added again to its external-force budget.

For each active joint, the observer exposes the current implementation's `kp * error` and `-kd * velocity`, recorded requested torque, recorded applied torque and saturation bits. Their arithmetic residual is diagnostic: it is not silently corrected. Limits can make applied torque differ from the requested sum. These are instantaneous sample terms; they do not reconstruct integrated joint work, estimate inverse dynamics or add gravity compensation. Passive records keep the support readouts and omit active effort terms.

`summarizeRiderLoads(record)` uses the same right-continuous phase boundaries as target tracking, with the final endpoint included. It reports signed sampled ranges and the last observation of each phase. Unreached intervals have null ranges and no last observation. A small net force at one sample is not equilibrium; the COM velocity and absolute tracking error remain visible. No force-derived acceleration is presented as an independent numerical residual.

## Evidence from unchanged records

Run `node scripts/rider-hold-review.mjs artifacts/rider-transfer artifacts/rider-loads` after generating the PR64 transfer records. The script verifies each full-record SHA-256 against the source report before processing. The [compact receipt](evidence/rider-hold-loads.json) retains all eight source hashes and their final-phase observations; full phase reports remain generated artifacts. No new simulation was needed. The existing passive `scripts/rider-load-review.mjs` remains unchanged.

At 1.0 s in the unchanged-target control, with 31.25 microsecond integration and rider weight 686.4655 N:

| Bike | Hands up / feet up | Net vertical force | Rider COM vertical speed | Knee posture / damping / applied torque |
| --- | --- | --- | --- | --- |
| Full suspension | 44.05 / 632.94 N | -9.47 N | -5.34 mm/s | -136.41 / -0.56 / -136.96 N m |
| Hardtail | 55.23 / 630.98 N | -0.26 N | +0.21 mm/s | -138.83 / +0.04 / -138.79 N m |

Across the final 0.8–1.0 s interval, full-suspension sampled net force ranges from -14.88 to +7.58 N and COM vertical speed from -5.34 to +21.98 mm/s. Hardtail ranges are -0.57 to +1.73 N and -1.26 to +0.46 mm/s. At the finer 15.625 microsecond step, final full-suspension net force/speed are -8.85 N / -6.08 mm/s; hardtail -1.36 N / +0.25 mm/s. These differences remain visible; no two-step convergence or equilibrium threshold is asserted.

Across all eight records, the largest requested-torque decomposition residual is 1.43e-14 N m (rounded up). In both late hold controls the posture-error term supplies most active torque. With the current PD-only law, zero posture error and zero joint velocity would produce zero active torque. The observed offset therefore contributes directly to effort under load; this does not attribute all displacement to PD stiffness, exclude soft attachment effects, or resolve casing numerical behavior. Frame-local hip error and world COM velocity measure different quantities and are not subtracted from one another.

## Verification and next gate

All 69 local quick tests and vendor provenance checks pass on Windows / Node 24.22.0. Seven new independent synthetic tests check axis/mass weighting, gravity counted once, signed PD terms versus limited applied torque, zero-gravity/passive behavior, order/ownership, malformed data, and partial/right-continuous phase ranges. The existing support arithmetic is checked against all 808 saved samples. Browser checks now inspect effort text and compare displayed net force/COM velocity with the shared observer; browser execution/capture inspection remains deferred under the approved Edge fallback. Physics is unchanged; no new full-suite or hosted receipt is claimed. Hosted CI and Pages remain paused until deliberate resumption on or after 1 November.

The separate stability PR54 at `6ebf52a28023be7a8374903cdba3e948d71dd33f` reports progress with an Euler diagnostic but unresolved energy/loss discrepancies, so production qualification remains open. This branch neither receives nor validates that candidate.

Next rider slice: attribute the remaining kinematic error between joint-angle tracking and hand/foot attachment compliance using the recorded geometry, preserving both bikes and the same load/effort observer. This can proceed without new feedback gains. Use that evidence and the B numerical gate to define supported hold/transfer budgets, then a checkpointed support-aware phase policy shared by crouch, wheelie, endo, bunny hop, pumping and landing. Do not infer a stable support phase from small force balance or a scheduled phase label.
