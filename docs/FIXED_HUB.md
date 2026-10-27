# Next rider slice review and fixed-hub casing control

Reviewed 2026-10-27 against merged main `bc44e90` (PR36). PR34 already supplies bounded joint effort; setup IK already exists. Runtime IK remains the next rider capability, but it is not the next acceptance claim. Terra independently checked the roadmap and evidence; the primary agent checked the implementation and the pinned native source.

## Decision

Top-down, the intended experience is a rider who can hold, shift weight and recover on both bikes, with visible intended and actual posture. Bottom-up, the 10 s drive holds rider posture but tyre motion persists; the uninterrupted/fresh comparison rules out restart as its explanation in the inspected windows. A reachable joint target cannot establish usable support or reliable recovery.

The bounded prerequisite is therefore one fixed-hub loaded-casing experiment. This removes rider, suspension and moving-hub feedback while retaining the same ring and contact coefficients. It is now implemented in [the viewer](../dist/fixed-hub.html) and [headless engine](../dist/fixed-hub.js). It is a diagnostic fixture with a separate identity, not a substitute bike or an equilibrium initializer. No production damping, contact or integrator setting changes.

## Contract and receiving

The input names a full compatible source state, front/rear wheel, imported/zero local rates and a 20–100 ms aligned observation schedule. The adapter reconstructs every named source joint against the full source identity and native build, without integration. It then extracts the native hub position/quaternion and selected node positions/rates. The selected casing must independently pass its geometric, strain, displacement, speed and solver guards. This checks source compatibility and selected-wheel admission; it does not recertify arbitrary supplied whole-bike states as accepted equilibria.

The jointless hub is welded to the world. Canonical source coefficients and reference geometry are reused through `wheelParts` and `terrainParts`; there are no new constitutive laws. Its native transform is retained without JS trigonometric reconstruction. Node world geometry is checked against the source before the first accepted frame (budget 1e-10 m). Imported rates remain **hub-local**: removing hub translation/spin deliberately changes world velocities and the physical boundary. The zero-rate arm retains exactly the same positions and stored energy. Fresh warm start and zero accumulated ledgers are explicit; fixing the hub applies no simulated arrest impulse.

Only casing mass is dynamic. Energy includes its native elastic, kinetic and gravity terms. The ledger is E − E0 + viscous loss − signed contact work; a stationary fixture has zero work. Fixture force on casing is the summed foundation force, and its moment is about the fixed hub with +y convention. Independent mass-times-acceleration balance includes gravity, native nodal ground forces and fixture reactions. The hub's own weight and rider/bike loads are not part of this fixture reaction.

The native distributed force mapping can produce a different moment from force arrows placed at the reported contact points. Records expose both `ground` (nodal application) and `contactWrench` (displayed contact points), with `contactMomentDifference`; their difference is not silently used to conceal a physical balance error. Ground force components agree independently. Neither set of arrows establishes calibrated contact pressure.

The viewer supplies both preserved late-window bike seeds, wheel/rate/timestep selection, contact drawing, scrub, speed history and previous compatible control overlay, record import/export, progress and cancellation. Trail-bike final records can also feed the adapter. Bundled seeds are exact copies of PR36's complete fresh-window inputs; they carry their original source identity and provenance. CLI reproduction:

```sh
node scripts/fixed-hub-review.mjs artifacts/fixed-hub
node scripts/fixed-hub-nullspace.mjs artifacts/fixed-hub-nullspace
node --test test/fixed-hub.test.mjs
```

## Evidence and next decision

[24 controls](evidence/fixed-hub.json) cover both bikes, both wheels, imported/zero rates and 31.25 / 15.625 / 7.8125 µs steps from identical source positions. All complete. Initial geometry transfer is exact in this runtime; maximum force/moment balance residuals are below 1e-8 in SI units. In the final 5 ms of the finest runs, sampled peak node speeds range from about 0.018 to 0.053 m/s. Activity can occur without whole-bike feedback, including from zero node rates. This does not establish indefinite persistence or a unique cause. The altered fixture also changes effective inertia and native matrix sparsity.

Maximum energy residuals decrease with timestep in all eight controls. For full/front/imported they are 0.001480, 0.0004135 and 0.0001359 J; for hardtail/rear/imported, 0.00003392, 0.00001550 and 0.000007725 J. A 20 ms window is not a stable-idle or long-term decay test.

An independent contact-free uniform-translation check exposed a more specific numerical question. With gravity zero and edge viscosity disabled, the fixture follows the analytical undamped foundation oscillator with refining position/energy errors. With the original edge viscosity 0.5, initial edge rates and viscous force are zero, but uniform translation develops nonuniform motion after one step under both `implicitfast` and `implicit`. [The preserved matched control](evidence/fixed-hub-nullspace.json) records:

| Integrator | First-step nonuniform RMS at 31.25 µs | At 15.625 µs | At 7.8125 µs |
| --- | ---: | ---: | ---: |
| implicitfast | 3.992e-4 m/s | 1.026e-4 m/s | 2.602e-5 m/s |
| implicit | 5.647e-4 m/s | 1.451e-4 m/s | 3.680e-5 m/s |

The fixture has 128 velocity coordinates, 128 mass entries and 256 derivative entries. The edge force is based on the full relative edge velocity, while the implicit velocity derivative is stored/projected through sparse topology. This is a source-informed hypothesis about the numerical operator, not proof of a defect or the unique cause of loaded-tyre motion. Merely switching to `implicit` does not fix this control. The loaded JS/WASM hashes exactly match the vendored build.

**Next bounded check:** evaluate the actual sparse damping operator on uniform translation and independently compare its force derivative to finite differences, then run a matched loaded fixture and connected-bike perturbation if a correction is justified. Do not add foundation damping to cover this up. Do not widen physical guards or claim equilibrium. This is a concrete receiving failure, so revisiting numerical integration is justified; stop broad solver research at this discriminating test.

**Then receive runtime IK:** slow support-retaining hip shift/crouch on both bikes, unchanged passive references and bounded effort, requested/feasible/actual posture and COM, reach/branch rejection, torque/power saturation and signed work. Require compatible perturbation recovery before calling it stable or extending to repeated bumps. IK target generation can be prototyped independently, but its dynamic acceptance remains subject to these controls. Saddle support, detachable actor integration, 3D and real-time execution keep their separate gates.

Five focused tests pass, covering admission/topology/identity, both-bike/wheel geometry and replay, independent force and oscillator controls, observation cadence, rollback, source ownership and the trail adapter. The full local suite passes **270 tests, zero failures**. Local Edge launch and in-app loopback access were blocked by the host environment; they are not counted as browser verification. Hosted browser/headless and screenshot receiving is pending at this checkpoint.

## Primary sources

The pinned MuJoCo source is `a892750516336d8358949f4518fcc4fbbd85beae`, matching vendored provenance:
- [Jointless bodies](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/doc/XMLreference.rst#L2422): “If no joints are defined, the body is welded to its parent.”
- [Edge passive force](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_passive.c#L729): damping uses edge velocity and projects through its Jacobian.
- [Velocity derivative](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_derivative.c#L3193): flex-edge damping contributes the Jacobian outer product.
- [Implicit integration](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1824): `implicit` uses the D layout; `implicitfast` gathers derivatives into the lower M layout. The measured fixture fails uniformity under both, so M projection alone is not an established explanation.

