# Rider geometry error accounting — 2026-10-29

The [hold-load review](RIDER_HOLD_LOADS.md) found large posture-error effort but did not distinguish actual joint/trunk geometry from compliant attachment displacement. This observer reconstructs hip error through both retained chains using the existing recorded angles, geometry and endpoint positions. It changes no targets, gains, constraints, forces or native records.

## Geometric identity and conventions

All output vectors are frame-local x/z in metres. Native world endpoints are transformed with the saved frame origin and positive-y pitch. A segment at angle a contributes `(length*sin(a), length*cos(a))`, matching `rider-posture.js` and the native rider construction. The leg offset from hip to foot uses trunk + hip angle and trunk + hip + knee. The hand offset uses the trunk, trunk + shoulder, and trunk + shoulder + elbow. Subtracting an offset from its endpoint reconstructs the hip.

For either chain, `H(q,t)` is the hip reconstructed from the authored anchor and joint angles q / trunk angle t. The ordered identity is:

- Joint tracking: `H(actual joints, target trunk) - H(target joints, target trunk)`.
- Trunk tracking: `H(actual joints, actual trunk) - H(actual joints, target trunk)`.
- Attachment gap: actual rider endpoint minus actual bike endpoint, rotated to frame coordinates.
- Anchor offset: actual bike endpoint in frame coordinates minus authored anchor.
- Target closure: `H(target joints, target trunk) - requested hip`.
- Reconstruction residual: recorded actual hip minus hip reconstructed from actual rider endpoint and angles.

The six signed vectors sum to recorded actual hip minus requested hip. Joints are varied first and trunk second: changing that order redistributes their individual terms because the geometry is nonlinear. Vector magnitudes are not additive. This is an accounting identity, not independent causal effects or a prediction of what changing attachment stiffness would do. The arm and leg chains give alternative decompositions of the same hip error; never add them together.

The small anchor, target-closure and reconstruction terms remain visible rather than being discarded. This distinguishes data/convention consistency from task tracking and attachment gaps. No IK re-solve, projection, mass change or counterfactual dynamics is performed. This receiver is for the current planar timed-target records with retained hand/foot attachments.

## Observed result

The extended `scripts/rider-hold-review.mjs` checks each source record hash and adds geometry maxima and the final decomposition alongside the existing load report. Reproduce with `node scripts/rider-hold-review.mjs artifacts/rider-transfer artifacts/rider-loads`. The [compact receipt](evidence/rider-geometry-error.json) records all eight unchanged PR64 source hashes and geometric results. The existing Trail bike active panel displays the signed vertical leg-chain terms while scrubbing.

Final unchanged-target holds at 1 s, 31.25 microsecond steps (vertical components):

| Bike | Hip error | Joint term | Trunk term | Foot gap |
| --- | --- | --- | --- | --- |
| Full suspension | -20.830 mm | -16.862 mm | -3.336 mm | -0.632 mm |
| Hardtail | -20.888 mm | -16.934 mm | -3.355 mm | -0.599 mm |

The corresponding hand gaps are -0.115 mm and -0.133 mm; the arm-chain joint/trunk terms differ while reconstructing the same hip error. At 15.625 microseconds the full-suspension leg terms are -16.863, -3.336 and -0.632 mm; hardtail -16.934, -3.355 and -0.599 mm. Those close geometric values do not establish force, energy or dynamic convergence.

Across all 808 saved samples, both chains' largest reconstruction residual is 5.31e-13 m (rounded up). Anchor offsets are below 2.01e-16 m, target closure below 3.95e-16 m and summed accounting discrepancy below 1.06e-16 m. These are reconstruction checks on the recorded states, not physical accuracy bounds. Attachment gaps are small compared with the final hip error; actual relative joint/trunk geometry accounts for most of that error under this explicit decomposition. It remains possible for attachment laws to influence the dynamics that produced those angles.

## Verification and next receiving slice

All 77 local quick tests and vendor provenance checks pass on Windows / Node 24.22.0. Eight new synthetic tests use hand-computed geometries: exact closure, pure attachment translation, known joint/trunk rotations, rigid world transforms, named endpoint ordering, explicit data/target residuals, invalid input, and cancellation between joint/trunk terms. The synthetic straight-chain fixtures test arithmetic only, not admitted dynamic postures. All eight saved native records are postprocessed without rerunning or mutating physics. Browser receiving now checks the new text and numerical hip error, with existing desktop/mobile panel captures; execution remains deferred under the approved unavailable-Edge fallback.

The numerical stream remains separate: PR54 at `4c37ba20ec2eae3048fcc0e4dbc6f5bc20c14d1b` reports an independent refined reference but still rejects promotion of its Euler candidate. No candidate or scientific qualification from that branch is received here. Hosted CI and Pages stay paused until deliberate resumption on or after 1 November. No new full-suite, browser or physical-calibration claim is made.

Next independent rider slice: establish a fixed-anchor static support/effort reference at the requested pose and compare the effort required under gravity with the existing PD-only hold. This directly informs whether a bounded load-compensation term is justified, without blindly increasing gains or stiffening attachments. Choose and verify the force/torque solution and any redundancy policy before adding runtime control. Connected supported hold/transfer acceptance still depends on the B numerical gate. The reference is intended for the shared manoeuvre controller; crouch, wheelie, endo, bunny hop, pumping and landing retain their own support, flight and receiving requirements.
