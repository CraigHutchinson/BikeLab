# PR23 major iteration: received increments

The major iteration starts from c83b41c. Existing rider tests and geometry portability evidence remain controls.

## Complete fresh state

The opt-in `initialization` selects articulated record 0.2. `launch` retains authored launch inputs; `state` accepts only gravity, duration, dt and sampleDt in motion, plus complete named scalar coordinates/rates. Supplied state is a fresh run, not continuation: time, warm seed and cumulative work reset; stored energy remains. Native geometry, physical configuration, admission limits and vendored JS/WASM hashes are bound by SHA-256. Timestep and command/recording schedules are run controls, so the same physical state can be used for refinement or changed commands. Gravity is physical and bound. Unknown or missing joints/types, unsupported fields, nonfinite/out-of-range coordinates/rates, wrong model identity and existing geometry limits reject admission. Slide bounds are 10 m and 10 m/s; hinge bounds are 100 rad and 100 rad/s. These broad engineering bounds do not replace component guards or first-step resolution rejection.

New-version numeric XML attributes use 12 significant decimal digits; spring references within 1e-12 rad of zero are zero. This explicitly changes the model definition before native compilation, not the replay tolerance. Legacy records retain their construction path. Imported state resolves separate native qpos and DOF addresses. All mapping validates before writes and both hand/foot closures stay active. Final state is captured with its actual rates. UI exposes the canonical state experiment, fresh restart from its final state and record export/import; it does not label supplied state equilibrium.

Validation: 10 focused tests pass (existing connected rider plus complete-state tests), including both bikes, exact replay, cadence independence, fresh ledgers, named mapping and negative admission. Full suite and browser portability still required after the connected iteration.

## Remaining major-iteration gates

Receive coupled loaded reference states, finite unilateral saddle contacts and separate work/load classification, visible separation/recontact, broader controls and complete review. The initializer alone is not merge readiness. Numerical stationarity, physical calibration and real-time throughput remain separate claims.

## Independent restart review, 2026-10-22

The cloud checkout synchronized published head `c79b202` exactly. The user's later equilibrium/saddle experiments may remain on another machine; they are not in this published checkpoint. Keep their candidates unavailable for equilibrium until every model coordinate, including tyre nodes, meets stationarity gates. A small net rider force is insufficient. This continuation leaves that solver and saddle implementation separate.

The published head's [CI run](https://github.com/CraigHutchinson/BikeLab/actions/runs/39805321197) passed the existing browser checks but failed one of 216 tests on each OS: the asset scanner mistook UI prose containing `from` for an import. Commit `48b44b2` restricts the scanner to module declarations and explicitly requires the new state module; the focused asset test passes. Those browser checks did not exercise the new state experiment/restart controls.

GPT-6.1 Sol identified an exportability failure, reproduced locally: an admitted separated state at −10 m/s heave under gravity 15 m/s² stays physically supported by the domain guards but exceeds the initializer's speed bound before final export, which previously threw. New-format runs now apply the same scalar coordinate/rate limits as runtime domain guards after existing component checks and roll back rejected steps. These engineering bounds are not component strength limits. Legacy formats are unchanged. Four focused state tests pass, including both-bike exact-boundary stops, nonzero accepted prefixes, owned final state and replay.

The UI now retains supplied-state provenance on initial rejection and restores launch controls immediately when leaving supplied-state mode without overwriting unrelated pending edits. A separate browser check exercises canonical launch, fresh restart, stored energy and zeroed ledgers, export/reimport, rejection, mode conversion/restore and narrow layouts on both bikes with the existing articulated 1e-9 normalized comparison budget. Hosted results and actual capture inspection are still pending for this increment.

The separate [short 2D trail experiment](TRAIL_SECTION.md) adds an editable bump/crest/drop fixture for the existing guided-rider consumer. It leaves equilibrium and saddle development to the other checkout and records individual wheel unloading/recontact without assuming a completed both-wheel jump. Both-bike refinement and hosted receiving checks are pending at this implementation checkpoint.
