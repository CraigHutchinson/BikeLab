# Fixed-hub casing control

The [late-window comparison](TYRE_WINDOW.md) found that fresh reconstruction reproduced the inspected whole-bike tyre motion closely. This control removes hub motion, suspension and rider feedback while retaining the ring and flat frictionless contact. It is a different mechanical boundary, not a continuation of the bike or a solved equilibrium.

Open `tyre-fixture.html` to select front/rear seeds from both bikes, retain the imported hub-local node velocities or set them to zero, change the integration step and inspect accepted casing/contact/history samples. The four built-in seeds come from the accepted 9.98 s starts in PR36. Saved inputs contain every node position/rate, the full hub world transform, ring/profile/gravity settings and source identifiers. The worker reports accepted-step progress; cancellation includes pending file reads. Saved fixture records replay through the same headless runner. Source-window file import verifies the complete source model identity before extraction; it does not independently prove that an externally supplied snapshot was dynamically admitted.

```sh
node scripts/tyre-fixture.mjs
node scripts/tyre-fixture.mjs saved-window.json rear
node scripts/tyre-fixture.mjs saved-fixture-record.json
node scripts/tyre-fixture-review.mjs artifacts/tyre-fixture
node scripts/tyre-fixture-moment-review.mjs artifacts/tyre-fixture
```

CLI progress goes to stderr and the complete record to stdout. Exit codes are 0 completed, 2 supported-domain stop, 1 invalid input. The review runs four seeds × imported/zero rates × three timesteps and saves complete records, hashes, sampled motion/contact statistics and matched-time refinement differences. Its committed [receipt](evidence/tyre-fixture.json) references the complete [built-in inputs](../dist/tyre-fixture-examples.json) and exact control overrides.

## Mechanics and transfer

The hub body has no joints and is fixed to the world by topology. No state is reset to enforce the clamp after a step. Each casing node retains the existing two local slide coordinates, mass/inertia and foundation springs; `wheelParts()` and `terrainParts()` retain the existing edge spring/viscosity and contact construction. Their canonical numeric attributes match the source bike. The captured binary64 hub world position and quaternion are preserved without another decimal quantization. World gravity remains unchanged. Dynamic mass is the casing mass only; the fixed hub is not counted as a moving mass.

The adapter reconstructs the complete source bike and applies the compatible accepted-start scalar state without integrating it. It resolves the selected hub and every named node coordinate. Source and fixture node masses/inertias, spring references/stiffness, node damping and edge coefficients are checked; initial world node geometry and compiled edge rest lengths must agree within 1e-10 m. The four built-in transfers have exactly equal initial node positions and rest-length discrepancies below 2.3e-16 m. These checks establish mapping fidelity, not identical contact solutions under different boundary conditions.

Retaining local node rates intentionally removes the hub's contribution to world point velocity. The fixed fixture therefore has different kinetic energy and momentum from the source wheel. Zero-rate controls keep the same deformation and stored energy; they are not static solves. Both controls use fresh native history/time and zero cumulative work. Model identity binds the new topology, native build, physical coefficients and admission limits; it excludes the timestep/recording schedule and initial rates. A bike state identity cannot be used as a fixture state identity.

`source.recordSha256` hashes UTF-8 `JSON.stringify(sourceRecord)` with no trailing newline. It is distinct from an original file-byte hash. Complete source provenance and fixture input identity serve different purposes. Editing an exported seed creates an authored derivative; the source identifier alone is not proof that the edited state still matches the original wheel.

The initial slice admits only flat, frictionless terrain. Duration is 20–100 ms, timestep 7.8125–62.5 µs subject to the existing stiffness/contact-time bounds, recording cadence 125 µs–5 ms, and at most 300 intervals. Longer source windows/cadences are rejected explicitly. All existing rim, casing, penetration, self-crossing, per-step motion, strain, displacement, nonfinite and native-capacity guards remain. A rejected candidate restores q/v/warm start/time before committing any work or sample. Limits are model-support boundaries, not strength or blowout criteria.

## Force and energy accounting

SI axes are x forward, y left, z up. For each node with constant hub rotation matrix R, world acceleration is `R × [ü, 0, v̈]`. Summing `m a − Fground − m g` gives the inferred clamp force. Independent checks compare this translational balance with native passive forces. No free-system momentum conservation is asserted: the clamp supplies external impulse.

An independent contact-force sum found that the moment of nodal generalized forces differs from the moment of the native forces at their actual contact points. The pinned engine's [`mj_elemVertWeight()`](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_util.c) uses normalized inverse-distance weights, while [`mj_contactJacobian()`](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_constraint.c) evaluates weighted body Jacobians at the common contact point. Translating nodes with blocked rotation do not expose all rotational reaction information through their two generalized forces.

The record therefore retains `nodalGroundMoment`, actual contact-point `ground[2]`, and their signed `contactMomentDifference`. The clamp moment is reconstructed from angular balance by adding this difference to the raw nodal balance. The interpretation is an additional reaction associated with blocked rotation, not a measured bearing torque or demonstrated angular-momentum defect. The sampled difference reaches 1.212 N m across the 24 controls; it must not be dismissed as negligible. Independent inverse-distance reconstruction, initially covered by four coarse seed tests and then checked against all 24 saved records, predicts it within 4.44e-10 N m (declared budget 1e-8 N m). The planar contact-point projection and 1e-8 N active-contact threshold are part of that test budget. Do not apply this correction to the moving-bike observer, whose spin coordinate supplies rotational information absent here.

The residual is `E − E0 + dampingLoss − signedContactWork`. Native E already contains casing gravity, kinetic energy and foundation/edge storage. Trapezoidal endpoint quadrature is unchanged. The stationary clamp has zero work; no corrective torque or extra energy is applied. Signed contact work includes soft-contact storage/release and is not all dissipation. Relative-speed energy agrees with translational casing kinetic energy under this fixed-hub boundary. Native joint/body semantics and passive-force storage were checked against the [joint reference](https://mujoco.readthedocs.io/en/3.3.7/XMLreference.html#body-joint) and [computation reference](https://mujoco.readthedocs.io/en/stable/computation/index.html#passive-forces); runtime verification uses the pinned 3.16.0 build.

## Results and remaining gates

All 24 local controls complete 20 ms. For retained rates, maximum energy residuals refine as follows:

| Seed | 31.25 µs | 15.625 µs | 7.8125 µs |
| --- | ---: | ---: | ---: |
| Full front | 0.001480 J | 0.000414 J | 0.000136 J |
| Full rear | 0.0000408 J | 0.0000194 J | 0.00000925 J |
| Hardtail front | 0.001561 J | 0.000462 J | 0.000149 J |
| Hardtail rear | 0.0000339 J | 0.0000155 J | 0.00000772 J |

Motion occurs with the hub fixed, including in zero-rate controls. At the finest step, sampled peak node speeds span approximately 0.024–0.053 m/s for retained rates and 0.024–0.045 m/s for zero rates. Contact switching remains and is not uniformly monotonic under refinement. On the full-front retained-rate fine/finest pair, matched node-0 velocity differences still reach 0.0411 m/s and vertical force differences 28.6 N; reduced residuals do not establish converged trajectories or loads. These observations show that rider/suspension feedback is unnecessary for short-window activity. They do not establish a self-sustaining oscillation, a unique contact-law defect or physically calibrated decay: the zero-rate states still begin with loaded deformation and are not equilibria.

Six focused checks pass: strict input ownership/admission, both-bike/wheel source mapping, independent stored/kinetic/gravity energy and contact force/moment checks, tilted-hub spring recurrence, imported/zero controls, exact replay and rejected-state rollback. The full local suite passes 44 files; the same eleven subprocess/loopback-restricted files fail. GPT-6.1 Sol reviewed mechanics, mapping, native contact moments and lifecycle, identifying fixes for metadata admission, pending-read cancellation, stale startup errors and mobile aspect ratio. Hosted Ubuntu and Windows [run 40564995337](https://github.com/CraigHutchinson/BikeLab/actions/runs/40564995337) each passed all 270 tests. Its browser run stopped before this station at an obsolete ten-link expectation; the added station also exposed inconsistent navigation across pages. All eleven menus and the browser expectation are corrected, with navigation consistency checked during the static dependency test. New worker records and actual screenshot inspection remain pending; no visual or real-time qualification is claimed yet.

Next receive the actual viewer and complete worker records, then measure longer isolated decay at the existing timesteps before proposing a constitutive damping change. Compatible whole-bike perturbation recovery and the 60 s idle gate remain open. Active COM regulation/IK targets, saddle support, detachable rider integration, pump/hop manoeuvres, physical damage/pressure loss, layered terrain and 3D handling remain in the broader roadmap.
