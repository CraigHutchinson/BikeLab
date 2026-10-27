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

Independent tests check the native edge-length derivative against local endpoint kinematics under translating/spinning hubs, elastic energy against native energy, damping power against the complete isolated-wheel native power, and the exact undamped uniform-relative-translation mode. Diagnostic enablement and recording cadence preserve mechanical state and work exactly; replay, command handling, signed frictional contact power and stopped-state observations are covered. GPT-6.1 Sol reviewed the read-only mechanics and ownership. Browser/worker records, actual desktop/mobile captures and the local probe receipt are tracked separately; no new visual receiving claim is made until those artifacts arrive.

The current model has foundation springs but no hub-relative foundation damping. Edge viscosity cannot damp motion that leaves edge lengths unchanged. A possible later extension is explicit internal foundation viscosity, with force `-c ds qdot` and loss `Σ c ds qdot²`; it requires versioned configuration, independent momentum/work/refinement checks and calibration. Do not substitute world drag, velocity clipping or hidden pinning. First use these observations to distinguish local modes, contact-set changes and numerical contact effects. Compatible perturbation recovery and feasible IK targets remain later work.
