# Loaded native casing and damping — 18 November 2026

This increment connects the relaxed casing's fine static reference to actual MuJoCo 3.16.0 contact and integration in an offline free-hub wheel. It identifies and tests a remedy for a damping-driven failure. It does **not** promote a production model or change the moving-wheel viewer, trail-bike, mesh caps or timestep limits. The native mesh gate remains unresolved; #95 stays open and uncalibrated.

## Experiment contract

Each arm starts from the archived 1.6 bar, 2 mm hard-plane equilibrium, with zero initial velocity and zero gravity. The hub receives a constant downward force equal to that mesh's static reaction (about 402 N). The floor touches the 8 mm capsule skin. This is a hard-contact-to-native-compliant-contact transient, not a gravity-supported rider equilibrium or a full load/unload ride.

There are 36 arms per integrator: 256/512 stations, uniform mass/inertia scales 0.5/1/2, edge viscosity 0/0.5 N s, and steps 15.625/7.8125/3.90625 microseconds. Nominal hub/tyre masses are 3/1 kg and hub spin inertia is 0.08 kg m². Duration is 20 ms, observations every 1 ms. Material constants, pressure, contact time (1 ms), impedance (0.99) and all gates are fixed between arms. Each mesh retains its own static equilibrium load: the approximately 1.23 N load difference is part of the mesh comparison, not an equal-load experiment.

The offline XML reference independently constructs the fine ring but reuses production terrain construction and the same native runtime. At supported 32/128 meshes, full native mass matrices, passive/damping forces, contact forces and accelerations agree with production modelXML. An independent edge-length derivative calculation also reproduces native damping forces. No production node limit is bypassed in the viewer.

## Failure mechanism and candidate

Euler completes 33/36 arms. Damped 512-station half-mass runs fail at 15.625 and 7.8125 us; the nominal-mass run fails at 15.625 us. Matching damping-off runs finish. The failures occur within 6–13 steps and retain their large energy residuals, rather than being classified as passed short runs.

The [versioned passive-force implementation](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_passive.c) applies edge damping as minus coefficient times edge-length rate, mapped through the length Jacobian. Here c=edgeViscosity/L has units N s/m; the configured edgeViscosity has units N s. For an ideal uniform tangential ring, the fastest decay rate is approximately 4c/m = 4*edgeViscosity*N²/(tyreMass*perimeter). Explicit damping therefore brings a step scale proportional to mass/N². This explains why the material-only mass/frequency estimate cannot admit the native step. It is a scaling argument, not an exact coupled contact threshold.

[MuJoCo's derivative implementation](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_derivative.c) includes flex-edge velocity derivatives. [Split stepping in 3.16.0](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_forward.c) honours implicitfast. The candidate changes only that native integrator, retaining the external casing force evaluated at each current-position force stage. The engine's sparse derivative can omit cross-branch terms: do not describe this as a full exact implicit solve of the coupled material/contact system.

The implicitfast candidate completes **36/36** arms and passes all **24/24** adjacent-timestep comparisons and all per-run penetration/energy gates. All **six** mesh comparisons still fail. A regression reproduces the light 512-station Euler failure and receives the same case with implicitfast at unchanged damping. These are bounded 20 ms numerical results, not universal timestep admission.

## Frozen receiving gates

The [working plan](working/TYRE_NATIVE_LOADED.md) fixed the budgets before examining the complete matrix. Common-time hub-height differences must be <=25 micrometres; pressure <=100 Pa + 1%; reaction <=1 N + 5%. Completed runs must stay below 0.5 mm penetration and energy/work residual <=0.001 J + 1% of the largest accumulated work/loss term. The numerical caps do not establish calibrated physical accuracy.

Euler fails all six finest-step mesh comparisons on hub height: peak differences are approximately 69–95 micrometres. Pressure and reaction comparisons pass. Thus removing damping instability alone cannot select a production mesh. These transients are short and not established settled native equilibria; investigate contact compliance, longer settling and equal-load comparisons before choosing a reduction.

Energy accounting includes native kinetic energy, casing material plus gas potential, trapezoidal native contact work and damping loss, and exact constant-load hub work. Vertical momentum is independently summed from native body velocities and compared with integrated ground impulse plus external hub load. Residuals are diagnostics, not hidden correction forces. Full-step or real-time cost was not measured in this concurrent diagnostic session.

## Evidence and next slice

Complete Windows Node suite: **510/510 pass**, no failures/skips ([receipt](evidence/native-loaded-tests.json)). Three new tests receive native fixture parity, independent damping forces, fine loaded accounting and the integrator regression. Runtime/browser assets are unchanged; no new browser/full-hosted pass is claimed.

The Euler [receiving report](evidence/native-loaded-receiving.json) and compressed archive retain every scalar observation and all coordinate hashes, with initial/final recorded coordinates. Full coordinate histories can be regenerated; their complete local report hashes are retained. The [implicit receiving report](evidence/native-loaded-implicit-receiving.json), compressed counterpart and [inspected plot](evidence/native-loaded.svg) preserve the candidate result. Archive metadata explicitly corrects an inherited `params.gravity` value to the actual XML gravity of zero; failed attempted time is also separated from the preceding accepted time. Trajectories are unchanged. Exact original source strings are preserved for the archived Windows sweep where later harness revisions improve reporting. Recording arrays and scalar slots are preallocated outside the integration loop. A [post-refactor replay](evidence/native-loaded-recording-replay.json) matches all 108 recorded scalars and six coordinate hashes exactly across two 2 ms prefixes. This is not a rerun of the full matrix. Partial early failures must not be replayed as completed trajectories.

Next receive native settled/equal-load mesh and contact-time refinement, then a practical equal-accuracy runtime reduction and measured complete-step cost. Expand pressure, phase, geometry and mass cases before admission. Follow with the actual moving-wheel viewer's relaxed model/replay and browser agreement, trail reuse and explicit near-rim/insert handling. Retain historical rider/browser failures separately. Do not close #95 on the strength of this offline receiving.

```
node --test test/tyre-native-loaded.test.mjs
node scripts/tyre-native-loaded.mjs
node scripts/receive-tyre-native-loaded.mjs
node scripts/tyre-native-loaded.mjs --implicit
node scripts/receive-tyre-native-loaded.mjs --implicit
python scripts/plot-tyre-native-loaded.py
node scripts/verify-tyre-native-recording.mjs
```

The receiving commands deliberately exit nonzero for retained failed gates. A completed sweep command only means its requested experiments ran and their source hashes remained stable.
