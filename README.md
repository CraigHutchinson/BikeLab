# BikeLab

A mountain-bike simulation sandbox aimed at the Gran Turismo of MTB: convincing riding, meaningful bike setup and detailed trails, developed through verified laboratory building blocks.

## Online laboratory

[Open BikeLab](https://craighutchinson.github.io/BikeLab/) · [Source and Actions](https://github.com/CraigHutchinson/BikeLab)

GitHub Pages serves the static files in dist/. Simulation and saved-file processing run in your browser; there is no application backend.

The Pages workflow runs the complete test suite on Windows and Linux with Node 24, plus Chromium interaction and browser/headless agreement checks. Successful main pushes publish the tested revision automatically. Pull requests run the tests without deploying; workflow_dispatch can redeploy main. Official actions are pinned to commit revisions. See [deployment notes](docs/DEPLOYMENT.md).

## Run the laboratory

Requires Node.js (tested with v24.19.0). No package installation or build step. The solver trial and bicycle rig include pinned, locally served Rapier and MuJoCo WASM runtimes, licences and dependency notices.

```powershell
cd BikeLab
node server.mjs
```

Open http://127.0.0.1:4177 in a browser. Stop the server with Ctrl+C.

The loaded-wheel station has adjustable supported mass, radius, radial stiffness/damping, and flat/bump/sinusoidal surface input. Run, pause, step, scrub and slow playback inspect the same recorded experiment. Pin a setup to compare identical forcing; save JSON records or load their setup to rerun. Run and solver settings expose duration, integration/recording intervals and initial lift. Calculations run in a cancellable worker. Warnings identify coarse resolution and significant energy-balance error; they do not certify arbitrary setups.

The wheel is constrained to vertical motion. Tyre contact is an illustrative clipped spring/damper surrogate. It is not a calibrated tyre, a suspension model or a complete bicycle.

The **suspension station** adds fork-scale and shock-scale fixtures, preload, independent compression/rebound damping, spring and damper curves, release/moving-base experiments and saved-run comparisons. It uses an uncalibrated axial coil/viscous-damper law. A trial outside stroke stops with the last valid samples and an explicit travel-limit diagnostic; end-stop impacts are not simulated. See [the model and parameter bounds](docs/SUSPENSION_MODEL.md).

The **spatial terrain probe** adds editable ordered profiles with vertical faces, flat/rounded/square controls, nearest boundary points, approach normals and circle clearance. It is a geometry fixture for solver evaluation; it applies no forces or stresses. Use `node scripts/probe-terrain.mjs` for the same headless report. See [input conventions and limits](docs/TERRAIN_PROBE.md).

The **Solver trial** station runs a pinned Rapier 3D prismatic assembly against an analytical spring/damper reference. Tilt, transverse load and a three-axis torque probe test constraints; saved-world restart is checked alongside replay and per-channel error plots. The default moving case fails the fixed accuracy gate, while the static preset passes. This is a first solver feasibility arm, not engine selection or a whole bicycle. See [the trial contract](docs/SOLVER_TRIAL.md) and [iteration 5 evidence](docs/ITERATION_5_EVIDENCE.md). Run `node scripts/trial-solver.mjs [setup.json]` for a complete headless report (exit 2 means unmet gates).

## Inspect numerical agreement

In the suspension station, use **Use reference setup** to select fixed support and equal compression/rebound damping. The independent analytical trace and per-channel error measurements appear for supported interior-travel runs. Unsupported setups show why no reference comparison is available. This checks the synthetic equations, not physical fork accuracy.

Run the same comparison headlessly with `node scripts/compare-suspension.mjs`, or supply a partial setup JSON file. See [architecture review](docs/ITERATION_3_ARCHITECTURE.md) and [current evidence](docs/ITERATION_3_EVIDENCE.md).

## Check or record

```powershell
node --test
node scripts/scenario.mjs
node scripts/scenario.mjs setup.json run.json
node scripts/scenario.mjs --suspension
node scripts/scenario.mjs --suspension suspension-setup.json suspension-run.json
node scripts/verify-record.mjs run.json
```

The optional setup file is a JSON object of SI overrides; see DEFAULTS and validate in dist/physics.js or dist/suspension.js. Missing fields use defaults only for these intentional CLI overrides. Unknown fields and malformed setups fail. Output must be a new file; existing evidence is never overwritten. Saved run files require the complete setup. The verifier detects the station from the model identifier. A suspension scenario exits 2 if stroke limits interrupt it (its partial evidence is still saved), 1 for input/I/O failure, and 0 for completion. Read the model note before changing solver settings.

Same-runtime replay is reproducible. Browser and Node recordings are checked for numerical agreement, not promised to be bit-identical across JavaScript runtimes.

## Current evidence

The [coupled bicycle rig](https://craighutchinson.github.io/BikeLab/bike.html) adds hardtail/full-suspension selection, two moving platens, fork/shock setup, frame pitch, axle loads, recorded replay and JSON export. Run the identical model with `node scripts/bike-rig.mjs [setup.json] [run.json]`. See [model and scope](docs/BIKE_RIG.md) and [iteration 6 evidence](docs/ITERATION_6_EVIDENCE.md). It is an uncalibrated planar fixture with a fixed rider and explicit unsupported-travel termination. Further solver precision polishing is parked; the next dynamics slice is rider compliance.

The following receipts describe earlier iterations:

64 automated tests pass on Windows and Linux, including spatial geometry, independent analytical-reference verification and coarse-step failure/refinement. Chromium checks exercise both dynamic stations and the spatial terrain probe, real worker cancellation, setup changes, comparison gating, playback/pause/step, browser save/load and stroke-limit handling. Browser-exported wheel, fork-scale, shock-scale and stopped runs agree numerically with Node. Captured desktop/mobile screenshots have now been inspected, closing the earlier screenshot gap for these checked states. No real-bike calibration or participant evidence exists yet.

The continuation reviews main 672e5e7 and adds independently checked spatial geometry; see [iteration 4 review](docs/ITERATION_4_REVIEW.md) and [solver research](docs/SOLVER_RESEARCH.md). The [iteration 4 evidence receipt](docs/ITERATION_4_EVIDENCE.md) records complete-suite CI, browser/headless geometry agreement and inspected desktop/narrow views.

See [the prior-iteration review](docs/ITERATION_2_REVIEW.md) and [Slice 2 evidence](docs/SLICE_2_EVIDENCE.md) for scope, receipts and remaining limits. [The first hardening review](docs/REVIEW_2026-10-15.md) and [original Slice 1 evidence](docs/SLICE_1_EVIDENCE.md) remain historical receipts.

## Design and implementation map

- [Physics fidelity architecture](docs/PHYSICS_FIDELITY.md): detailed references, real-time abstractions, parallel comparison and state-preserving model swaps; next-iteration review brief.
- [Layered terrain and traction](docs/LAYERED_TERRAIN.md): mud over roots, soil history, tread contamination and scanned/generated trail detail; staged requirements, not implemented physics.
- [Component inventory](docs/COMPONENTS.md): hardtail/full-suspension systems and staged fidelity.
- [Rig contracts](docs/RIG_DESIGN.md): bodies, constraints, contact, rider and experience.
- [Parameters](docs/PARAMETERS.md): units, sources, calibration and uncertainty.
- [Roadmap](docs/ROADMAP.md): received slices and validation gates.
- [Stack and model decision](docs/STACK_DECISION.md): primary references, equations and numerical assumptions.
- [Suspension model](docs/SUSPENSION_MODEL.md): signed forces, support work, travel limits and presets.
- [3D dynamics requirements](docs/THREE_DIMENSIONAL_DYNAMICS.md): lateral/turning forces, steering/lean, combined slip and independent handling gates.
- [Overload and failure requirements](docs/OVERLOAD_AND_FAILURE.md): travel limits, end-stop load paths, component strength/damage, rim/spoke failure and tubeless air loss. These physical failure models are planned; current out-of-stroke runs stop explicitly.
- [Terrain/contact and real-time requirements](docs/TERRAIN_CONTACT.md): spatial ground profiles, square-edge versus rounded contact, local load/stress limitations, on-demand detail and validated multiple physics rates. These extend beyond the current flat-platen model.
- dist/physics.js: shared headless/browser dynamics and recording.
- dist/suspension.js: shared axial element, suspension experiment and recording.
- dist/app.js, index.html, style.css: viewer and controls.
- dist/suspension-app.js, suspension.html: suspension viewer, curves and controls.
- dist/calculation.js, worker.js: cancellable background calculation.
- dist/ui-model.js: setup round-tripping and scene bounds.
- test/physics.test.mjs: independent reference and regression checks.

## Product direction

Develop toward a highly realistic riding and bike-setup experience in which geometry, suspension, tyres, rider behaviour, braking and terrain interact coherently. Realism must be demonstrated through physical evidence, not inferred from plausible animation.

The simulation shall ultimately be fully 3D, including lateral motion, turning forces, steering, lean and coupled braking/cornering grip. The planar rigs are intermediate validation tools. Next: enumerate whole-bike DOFs/constraints and evaluate multibody solver technology before implementing a hardtail and a full-suspension bicycle responding to the same road input. Production-bike selection and source-backed stock setups remain planned.

Develop every visible experiment alongside its foundations. Keep physics independent of rendering, rider mechanics separate from control, and measured/fitted/illustrative parameters distinguishable. Add complexity only when a named experiment consumes it.

The [PR #5 timestep investigation](docs/TIMESTEP_RESEARCH.md) separates accumulated float32 velocity and position rounding with reproducible engine/scalar controls. The solver viewer reports outer and internal timesteps; smaller steps are not assumed more accurate. The original physical fixture and accuracy gates remain unchanged.
