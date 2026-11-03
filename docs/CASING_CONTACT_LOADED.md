# Loaded-wheel cross-check of the contact policy

This study applies the bounded contact-substep and native solver policy received by the [entry/recontact controls](CASING_ENTRY.md) to all eight supplied wheel inputs: front/rear on both bikes, with imported/zero relative rates. Each input runs for 20 ms at 1.953125, 0.9765625 and 0.48828125 µs. The 24 runs produce 16 adjacent-step comparisons on the complete common coarse grid. Results are pending at this checkpoint.

The original absolute budgets remain position 1e-7 m, velocity 1e-4 m/s, force 0.05 N, impulse 1e-5 N s, and loss/work/residual 1e-6 J each. The finer comparison must meet one tenth of each budget. Native stages, independent forces/contact law, mass, momentum and all physical guards remain required. Every run retains the cap of eight bisections and 4,096 extra accepted substeps. No material law or product default changes.

```sh
node --test --test-isolation=none test/casing-contact-loaded.test.mjs
node scripts/casing-contact-loaded.mjs artifacts/casing-contact-loaded-20ms .02
```

The runner prints accepted-case progress and writes an atomic report after every completed case. A checkpoint commits the complete JSON record plus its common-grid trajectory in little-endian float64 form, with SHA-256 hashes, shape, model/native/policy identity, inputs, compiled XML and source hashes. Repeating the same command verifies and reuses completed cases, recomputing comparisons from the saved grids. Partial files without a checkpoint are recomputed; stale or changed checkpoints are rejected. Failed cases remain failed evidence, with the accepted prefix preserved. This is case-level study resumption, not restart from an arbitrary native integration state.

Two focused tests pass: exact numeric-grid resumption and rejection of changed inputs, duration, sources, records, binary data and encoding; then complete unique matrix coverage and mandatory physical/refinement gates. The synthetic matrix in the gate test is explicitly not a physics result.

Source hashes cover the runner, translating/contact scripts, top-level runtime modules, fixtures and pinned native JS/WASM. These files stay fixed throughout the measured study. Save full records and grids under ignored artifacts; commit compact evidence with case/input/source hashes and scientific plots after receiving. Timing and extra substep counts are not real-time performance evidence.

This remains a translating, nonspinning flat-contact release of a 1.5 kg hub and 1 kg casing, not a supported whole bike or idle rider. After successful receiving, follow the [spin plan](SPINNING_HUB_PLAN.md), then receive both connected bikes, held-control/constitutive work and active rider stability. Faceted/layered terrain, component failure and pressure loss, physical calibration, browser execution, 3D and game performance retain their separate gates.
