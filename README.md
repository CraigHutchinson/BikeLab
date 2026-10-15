# BikeLab

A mountain-bike simulation sandbox, starting with an instrumented virtual laboratory.

## Run the first prototype

Requires Node.js (tested with v24.19.0). No package installation or build step.

```powershell
cd D:\Craig\GitHub\BikeLab
node server.mjs
```

Open http://127.0.0.1:4177 in a browser. Stop the server with Ctrl+C.

The loaded-wheel station has adjustable supported mass, radius, radial stiffness/damping, and flat/bump/sinusoidal surface input. Run, pause, step, scrub and slow playback inspect the same recorded experiment. Pin a setup to compare identical forcing; save JSON records or load their setup to rerun. Run and solver settings expose duration, integration/recording intervals and initial lift. Calculations run in a cancellable worker. Warnings identify coarse resolution and significant energy-balance error; they do not certify arbitrary setups.

The wheel is constrained to vertical motion. Tyre contact is an illustrative clipped spring/damper surrogate. It is not a calibrated tyre, a suspension model or a complete bicycle.

## Check or record

```powershell
node --test
node scripts/scenario.mjs
node scripts/scenario.mjs setup.json run.json
node scripts/verify-record.mjs run.json
```

The optional setup file is a JSON object of SI overrides; see DEFAULTS and validate in dist/physics.js. Missing fields use defaults only for these intentional CLI overrides. Unknown fields and malformed setups fail. Output must be a new file; existing evidence is never overwritten. Saved run files require the complete setup. Read the model note before changing solver settings.

Same-runtime replay is reproducible. Browser and Node recordings are checked for numerical agreement, not promised to be bit-identical across JavaScript runtimes.

## Current evidence

31 automated tests pass after the full prior-iteration review. Browser controls, setup changes, comparison gating, playback/pause/step and browser save/load were exercised. A browser-exported run was compared with the headless solver. Screenshot capture failed in the available browser tooling: pixel-level visual QA remains open. No real-bike calibration or participant evidence exists yet.

See [the current review](docs/REVIEW_2026-10-15.md) for findings, fixes and readiness. [Original Slice 1 evidence](docs/SLICE_1_EVIDENCE.md) is retained as a historical receipt.

## Design and implementation map

- [Component inventory](docs/COMPONENTS.md): hardtail/full-suspension systems and staged fidelity.
- [Rig contracts](docs/RIG_DESIGN.md): bodies, constraints, contact, rider and experience.
- [Parameters](docs/PARAMETERS.md): units, sources, calibration and uncertainty.
- [Roadmap](docs/ROADMAP.md): received slices and validation gates.
- [Stack and model decision](docs/STACK_DECISION.md): primary references, equations and numerical assumptions.
- dist/physics.js: shared headless/browser dynamics and recording.
- dist/app.js, index.html, style.css: viewer and controls.
- dist/calculation.js, worker.js: cancellable background calculation.
- dist/ui-model.js: setup round-tripping and scene bounds.
- test/physics.test.mjs: independent reference and regression checks.

## Product direction

Develop toward a highly realistic riding and bike-setup experience in which geometry, suspension, tyres, rider behaviour, braking and terrain interact coherently. Realism must be demonstrated through physical evidence, not inferred from plausible animation.

Next: close visual inspection, then the fork/shock station. The first complete-bike milestone remains a hardtail and a full-suspension bicycle responding to the same road input. Reassess multibody solver technology before that milestone.

Develop every visible experiment alongside its foundations. Keep physics independent of rendering, rider mechanics separate from control, and measured/fitted/illustrative parameters distinguishable. Add complexity only when a named experiment consumes it.
