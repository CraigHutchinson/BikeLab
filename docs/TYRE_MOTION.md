# Short tyre motion diagnostic

PR34's rider remains bounded over 10 s, while local tyre rates persist. Its 0.05 s recording interval cannot resolve the roughly 130 Hz isolated foundation frequency scale `sqrt(foundation * 2πR / tyreMass) / (2π)`. That scale is an indication, not an eigenanalysis of the contacting bicycle. Different endpoint phases can produce nonmonotonic speeds under timestep refinement.

This slice adds observation, not a revised tyre law. After an active run, **Inspect tyre motion** imports its final physical state for a 20 ms probe sampled every 125 µs. It retains the integration step and holds the last accepted hub-drive/brake command. Time, native warm start and work ledgers reset. The probe is explicitly a fresh run, not an uninterrupted continuation; it cannot alone establish long-term decay, stable idle or behaviour unchanged by the restart.

The panel and history channels show front/rear local node motion, a node-0 trace, edge damping and contact power. Node 0 starts at the reference ring's bottom and rotates with the wheel. Maximum speed/acceleration identify a node and are spatial maxima at the displayed sample. Nonuniform RMS removes mean local node translation. Velocities are relative to the rotating hub, not world point velocities. The recorded `relativeSpeedEnergy` is `Σ m |v_local|² / 2`, a mode diagnostic; cross terms prevent treating it as an independently additive part of total kinetic energy.

Foundation storage uses native joint stiffness and spring references; edge storage uses native edge stiffness and rest lengths. Damping powers use native node damping and `flexedge_velocity`. They are nonnegative constitutive losses already included in the existing ledger, and are never added again. Normal/tangent powers use native contact rows and retain their sign: soft-contact work includes storage and release. Contact count shares the existing force threshold of 1e-8 N. Complete records preserve contact edges/vertices and force histories for comparison.

The ordinary active model and all legacy outputs remain unchanged. Opt in with top-level `diagnostics: "bikelab-tyre-motion-0.1"` in an active scenario. Diagnostic records use `bikelab-trail-bike-tyre-motion-0.1`; legacy discriminators reject the new setting. Observation configuration does not change physical identity. No controller, native coordinate, force, rest pose or physical limit is modified. Storage is allocated before integration and observations occur only at accepted recording endpoints. Changing rider coupling removes the diagnostic mode.

Headless receiving:

```sh
node scripts/tyre-motion-review.mjs saved-active-run.json artifacts/tyre-motion
node scripts/tyre-motion-review.mjs saved-active-run.json artifacts/tyre-motion-fine 0.000015625
```

The review retains the source record hash, original endpoint time, complete imported scenario/state, source hashes, complete probe record hash and sampled ranges/contact-set changes. Keeping the original input state identical while changing the integration step distinguishes refinement from comparing different end-state phases. The 20 ms window remains too short to qualify long-term damping or a 60 s idle gate.

The [local receipt](evidence/tyre-motion.json) preserves eight completed probes and runnable inputs in `docs/evidence/tyre-motion-inputs/`. To reproduce one without regenerating the preceding 10 s, pass its parsed JSON directly to `run` from `dist/trail-bike.js`; the native build and physical identity are checked. Record hashes include a trailing newline. The six same-seed probes use 31.25, 15.625 and 7.8125 µs steps on both bikes; two additional probes use independently evolved fine-step endpoints.

| Same coarse endpoint | 31.25 µs | 15.625 µs | 7.8125 µs |
| --- | ---: | ---: | ---: |
| Full: maximum energy residual / J | 0.001381 | 0.000419 | 0.000139 |
| Hardtail: maximum energy residual / J | 0.001446 | 0.000413 | 0.000128 |
| Full: sampled front contact-set changes | 20 | 2 | 0 |
| Hardtail: sampled front contact-set changes | 8 | 0 | 2 |

Rear motion/contact switching persists. Local front acceleration reaches about 3700 m/s² in some cases and does not refine monotonically; this is a low-mass casing coordinate, not rider acceleration. Matched-time front node-0 velocity RMS differences decrease between the two refinement pairs, but remain about 0.016/0.018 m/s on the finest pair. Rear force differences do not uniformly decrease. Thus decreasing total energy error does not establish complete-state or peak/contact convergence. The independently evolved fine seeds change both the initial state and preceding history and are sensitivity controls, not isolated short-window refinement. Cause remains unresolved; no damping/contact law changed.

Independent tests check the native edge-length derivative against local endpoint kinematics under translating/spinning hubs, elastic energy against native energy, damping power against the complete isolated-wheel native power, and the exact undamped uniform-relative-translation mode. Diagnostic enablement and recording cadence preserve mechanical state and work exactly; replay, command handling, signed frictional contact power and stopped-state observations are covered. GPT-6.1 Sol reviewed the read-only mechanics and ownership. Browser/worker records, actual desktop/mobile captures and the local probe receipt are tracked separately; no new visual receiving claim is made until those artifacts arrive.

Five focused checks pass. Full local `node --test` passes 42 files with the same eleven subprocess/loopback files blocked by EPERM. Both original PR34 browser records remain byte-identical on replay. The implementation is pushed as `70c960f` in [draft PR35](https://github.com/CraigHutchinson/BikeLab/pull/35); hosted run 40467149012 passes 261 tests on each OS; browser receiving remains pending. The browser receiver exercises both probes, complete records, plot selection, mode cleanup and 390/320 px panels. Local computation is not a performance qualification.

The current model has foundation springs but no hub-relative foundation damping. Edge viscosity cannot damp motion that leaves edge lengths unchanged. A possible later extension is explicit internal foundation viscosity, with force `-c ds qdot` and loss `Σ c ds qdot²`; it requires versioned configuration, independent momentum/work/refinement checks and calibration. Do not substitute world drag, velocity clipping or hidden pinning. Next receive an uninterrupted high-rate endpoint window against this fresh-state probe, then a loaded-wheel control to distinguish intrinsic contact/casing activity from bike/rider excitation. Compatible perturbation recovery and feasible IK targets remain later work.
