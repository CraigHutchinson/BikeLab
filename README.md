# BikeLab

A mountain-bike simulation sandbox, starting with an instrumented virtual laboratory.

## Online laboratory

[Open BikeLab](https://craighutchinson.github.io/BikeLab/) · [Source and Actions](https://github.com/CraigHutchinson/BikeLab)

GitHub Pages serves the static files in dist/. Simulation and saved-file processing run in your browser; there is no application backend.

The Pages workflow runs the complete test suite on Windows and Linux with Node 24, plus Chromium interaction and browser/headless agreement checks. Successful main pushes publish the tested revision automatically. Pull requests run the tests without deploying; workflow_dispatch can redeploy main. Official actions are pinned to commit revisions. See [deployment notes](docs/DEPLOYMENT.md).

## Run the laboratory

Requires Node.js (tested with v24.19.0). No package installation or build step.

```powershell
cd BikeLab
node server.mjs
```

Open http://127.0.0.1:4177 in a browser. Stop the server with Ctrl+C.

The loaded-wheel station has adjustable supported mass, radius, radial stiffness/damping, and flat/bump/sinusoidal surface input. Run, pause, step, scrub and slow playback inspect the same recorded experiment. Pin a setup to compare identical forcing; save JSON records or load their setup to rerun. Run and solver settings expose duration, integration/recording intervals and initial lift. Calculations run in a cancellable worker. Warnings identify coarse resolution and significant energy-balance error; they do not certify arbitrary setups.

The wheel is constrained to vertical motion. Tyre contact is an illustrative clipped spring/damper surrogate. It is not a calibrated tyre, a suspension model or a complete bicycle.

The **suspension station** adds fork-scale and shock-scale fixtures, preload, independent compression/rebound damping, spring and damper curves, release/moving-base experiments and saved-run comparisons. It uses an uncalibrated axial coil/viscous-damper law. A trial outside stroke stops with the last valid samples and an explicit travel-limit diagnostic; end-stop impacts are not simulated. See [the model and parameter bounds](docs/SUSPENSION_MODEL.md).

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

47 automated tests pass on Linux and Windows. Chromium checks exercise both stations, real worker cancellation, setup changes, comparison gating, playback/pause/step, browser save/load and stroke-limit handling. Browser-exported wheel, fork-scale, shock-scale and stopped runs agree numerically with Node. Captured desktop/mobile screenshots have now been inspected, closing the earlier screenshot gap for these checked states. No real-bike calibration or participant evidence exists yet.

See [the prior-iteration review](docs/ITERATION_2_REVIEW.md) and [Slice 2 evidence](docs/SLICE_2_EVIDENCE.md) for scope, receipts and remaining limits. [The first hardening review](docs/REVIEW_2026-10-15.md) and [original Slice 1 evidence](docs/SLICE_1_EVIDENCE.md) remain historical receipts.

## Design and implementation map

- [Component inventory](docs/COMPONENTS.md): hardtail/full-suspension systems and staged fidelity.
- [Rig contracts](docs/RIG_DESIGN.md): bodies, constraints, contact, rider and experience.
- [Parameters](docs/PARAMETERS.md): units, sources, calibration and uncertainty.
- [Roadmap](docs/ROADMAP.md): received slices and validation gates.
- [Stack and model decision](docs/STACK_DECISION.md): primary references, equations and numerical assumptions.
- [Suspension model](docs/SUSPENSION_MODEL.md): signed forces, support work, travel limits and presets.
- [3D dynamics requirements](docs/THREE_DIMENSIONAL_DYNAMICS.md): lateral/turning forces, steering/lean, combined slip and independent handling gates.
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
