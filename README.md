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

The [wheel-limit station](https://craighutchinson.github.io/BikeLab/wheel-limits.html) traces continuous first rim contact, including between-sample obstacles, and checks declared tubeless fit/maximum-pressure limits. It blocks incompatible or overpressure declarations and keeps blowout/fracture criteria unknown. Run `node scripts/wheel-limits.mjs [input-or-record.json]`; see [scope](docs/WHEEL_LIMITS.md) and [iteration 14 evidence](docs/ITERATION_14_EVIDENCE.md). This is geometry and service-limit assessment, not impact or damage simulation.

The [tyre-footprint station](https://craighutchinson.github.io/BikeLab/footprint.html) adds prescribed-pose radial deformation, every active local normal force and a resultant hub wrench on flat, rounded, square-step-top and two-support terrain. Its worker and headless runner share the same uncalibrated static mechanics. Run `node scripts/footprint.mjs [setup-or-record.json]`; see [model limits](docs/STATIC_FOOTPRINT.md) and [iteration 13 evidence](docs/ITERATION_13_EVIDENCE.md). Exposed sharp edges and rim strikes remain explicitly unsupported; pressure, stress, impact and traction are separate receiving work.

The bicycle station now exposes [rider travel stops and attachment loads](docs/RIDER_STOPS_LOADS.md): lower/upper compliant stops, total guide reaction, fixture wrench and corrected rear-pivot load. The experiment works on both assemblies and retains ultimate travel termination. Finer optional headless recording separates force-integral sampling error from solver timestep error; no real-time or component-strength claim follows.

The bicycle station now uses the [annotated high-eye shock layout and editable geometry](docs/GEOMETRY_CONFIGURATION.md), with settled sag/load split and a linkage-ratio plot. Earlier saved runs retain their original geometry; the new 210 × 55 mm layout is image-informed and explicitly uncalibrated.

Its [manufacturer reference catalogue](docs/GEOMETRY_CATALOGUE.md) provides eight selectable Orange, Santa Cruz and Transition configurations with source links, SI JSON export and explicit missing linkage data. Published frame charts and service drawings are collated as references; complete production-bike simulation presets still require dimensioned suspension coordinates and calibration.

The [terrain-request station](https://craighutchinson.github.io/BikeLab/terrain-request.html) receives finite-width swept geometry, 2 cm synthetic layered cells and explicit rock faces through a bounded async cache. Run `node scripts/terrain-request.mjs straight [record.json]` or pass a saved JSON to verify replay. See [R0a scope and evidence](docs/ITERATION_9_EVIDENCE.md); this data experiment computes no contact forces. The [real-image geometry review](docs/GEOMETRY_VISUAL_REVIEW.md) confirms corrected BB/frame drawing and records the remaining synthetic linkage dimensions.

The bicycle station now includes optional [progressive fork travel buffers](docs/FORK_BUFFERS.md), top-out/bottom-out experiments, engagement display and force/energy histories. Ultimate boundaries remain explicit; this does not certify impacts or component survival.

The [coupled bicycle rig](https://craighutchinson.github.io/BikeLab/bike.html) adds hardtail/full-suspension selection, two moving platens, fork/shock setup, frame pitch, axle loads, recorded replay and JSON export. Run the identical model with `node scripts/bike-rig.mjs [setup.json] [run.json]`. Select the original fixed rider or a [passive guided rider](docs/RIDER_MODEL.md) with adjustable mass partition, spring/damping and travel. See [model and scope](docs/BIKE_RIG.md) and [iteration 7 evidence](docs/ITERATION_7_EVIDENCE.md). It remains an uncalibrated planar fixture with explicit unsupported-travel termination. Further solver precision polishing is parked; the received buffers and reactions do not yet resolve anatomical contacts or component stress.

The following receipts describe earlier iterations:

Each iteration retains separate numerical and browser evidence. The rider continuation passes 95 tests on Windows/Linux plus Chromium worker/headless and interaction checks, including independent mechanics, refinement, domain and legacy-record checks. [Its evidence note](docs/ITERATION_7_EVIDENCE.md) records the tested scope and receipts. No real-bike calibration or participant evidence exists yet.

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
- [Terrain sampling contract](docs/TERRAIN_SAMPLING_CONTRACT.md): wheel swept requests, cache admission, compact layered extracts and shared soil history. Proposed design; the first receiving slice is a request/cutaway viewer, before dynamic contact.
- dist/physics.js: shared headless/browser dynamics and recording.
- dist/suspension.js: shared axial element, suspension experiment and recording.
- dist/app.js, index.html, style.css: viewer and controls.
- dist/suspension-app.js, suspension.html: suspension viewer, curves and controls.
- dist/calculation.js, worker.js: cancellable background calculation.
- dist/ui-model.js: setup round-tripping and scene bounds.
- test/physics.test.mjs: independent reference and regression checks.

## Product direction

Develop toward a highly realistic riding and bike-setup experience in which geometry, suspension, tyres, rider behaviour, braking and terrain interact coherently. Realism must be demonstrated through physical evidence, not inferred from plausible animation.

The simulation shall ultimately be fully 3D, including lateral motion, turning forces, steering, lean and coupled braking/cornering grip. The planar rigs are intermediate validation tools. The coupled hardtail/full-suspension fixture and passive guided rider are intermediate steps; the received stop/load experiments still require anatomical rider attachments and sourced component failure laws. Production-bike selection and source-backed stock setups remain planned.

Develop every visible experiment alongside its foundations. Keep physics independent of rendering, rider mechanics separate from control, and measured/fitted/illustrative parameters distinguishable. Add complexity only when a named experiment consumes it.

The [PR #5 timestep investigation](docs/TIMESTEP_RESEARCH.md) separates accumulated float32 velocity and position rounding with reproducible engine/scalar controls. The solver viewer reports outer and internal timesteps; smaller steps are not assumed more accurate. The original physical fixture and accuracy gates remain unchanged.

The [rear shock buffer iteration](docs/SHOCK_BUFFERS.md) adds configurable top/bottom buffers through actual linkage leverage, visible swing moment/axial force and energy histories. [Dynamics/configuration gaps](docs/ITERATION_10_REVIEW.md) remain explicit.
