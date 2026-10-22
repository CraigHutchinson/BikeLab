# PR23 major iteration: received increments

The major iteration starts from c83b41c. Existing rider tests and geometry portability evidence remain controls.

## Complete fresh state

The opt-in `initialization` selects articulated record 0.2. `launch` retains authored launch inputs; `state` accepts only gravity, duration, dt and sampleDt in motion, plus complete named scalar coordinates/rates. Supplied state is a fresh run, not continuation: time, warm seed and cumulative work reset; stored energy remains. Native geometry, physical configuration, admission limits and vendored JS/WASM hashes are bound by SHA-256. Timestep and command/recording schedules are run controls, so the same physical state can be used for refinement or changed commands. Gravity is physical and bound. Unknown or missing joints/types, unsupported fields, nonfinite/out-of-range coordinates/rates, wrong model identity and existing geometry limits reject admission. Slide bounds are 10 m and 10 m/s; hinge bounds are 100 rad and 100 rad/s. These broad engineering bounds do not replace component guards or first-step resolution rejection.

New-version numeric XML attributes use 12 significant decimal digits; spring references within 1e-12 rad of zero are zero. This explicitly changes the model definition before native compilation, not the replay tolerance. Legacy records retain their construction path. Imported state resolves separate native qpos and DOF addresses. All mapping validates before writes and both hand/foot closures stay active. Final state is captured with its actual rates. UI exposes the canonical state experiment, fresh restart from its final state and record export/import; it does not label supplied state equilibrium.

Validation: 10 focused tests pass (existing connected rider plus complete-state tests), including both bikes, exact replay, cadence independence, fresh ledgers, named mapping and negative admission. Full suite and browser portability still required after the connected iteration.

## Remaining major-iteration gates

Receive coupled loaded reference states, finite unilateral saddle contacts and separate work/load classification, visible separation/recontact, broader controls and complete review. The initializer alone is not merge readiness. Numerical stationarity, physical calibration and real-time throughput remain separate claims.
