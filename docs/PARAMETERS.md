# Parameters and evidence

Status: planning catalogue with implemented illustrative wheel and axial suspension fixtures. See SUSPENSION_MODEL.md for every consumed suspension input, SI bounds, default/preset values and uncertainty limitations. No measured bike dataset is included yet. Do not treat illustrative defaults as real-bike specifications. Lateral/turning contact, camber, full inertia and controller calibration requirements are specified in THREE_DIMENSIONAL_DYNAMICS.md.

## Provenance required for every physical parameter

Record quantity, internal SI unit, display unit, value/range, provenance class, source and date, applicable component/setup, uncertainty where known, and how it was obtained. Provenance classes: measured, manufacturer-supplied, derived, fitted or illustrative.

A fitted value also needs the experiment used for fitting and a different experiment reserved for validation. Avoid tuning and validating against the same trace.

## Production-bike catalogue

User requirement, 2026-10-14: support selecting off-the-shelf bikes, including Santa Cruz, Trek, Scott and other manufacturers. This is planned scope; no specific model specifications have been researched or added yet.

Selection identifies manufacturer, model, model year, frame size and build/trim. Include hardtail and full-suspension entries. Record wheel-size configuration and geometry adjustment positions where applicable so a model name cannot silently stand for several different bicycles.

Keep three layers distinct:

1. Stock specification: versioned frame geometry and factory component configuration, with sources.
2. Simulation calibration: mass distribution, inertia, suspension/contact curves and other physical parameters, each with its own evidence and uncertainty.
3. User setup: rider characteristics, tyre inflation, suspension adjustments and compatible component changes, saved as overrides without overwriting the stock baseline.

The experience should allow selecting a stock bike, inspecting its specification and modelling confidence, adjusting its setup, restoring stock configuration and comparing bikes under identical rider and test conditions. Rider-dependent setup values must be labelled rather than presented as universal factory settings.

Use the appropriate suspension mechanism for each bike. Do not relabel the initial single-pivot reference as a production bike whose linkage it does not represent. A partially specified entry must show its approximations and unsupported behaviours.

Start with a small, source-backed catalogue when the whole-bike rig can consume it. Expand based on data availability and validation, without limiting the design to the initial brands. Saved runs must retain the catalogue revision and effective setup so later specification updates do not change old experiments.

## Parameter groups

| Group | Inputs to collect | Derived values/checks | Initial use |
|---|---|---|---|
| Wheel station | Effective supported mass (kg), unloaded radius (m), radial force curve (N versus m), damping law | Static equilibrium, admissible compression and loaded radius | Slice 1; illustrative inputs allowed with labels |
| Experiment | Profile displacement (m), wavelength (m) or excitation frequency (Hz), speed (m/s), phase, duration (s) | Platen velocity/acceleration and feasible forcing range | Slice 1 onward |
| Whole-bike mass | Component masses (kg), centres of mass (m), inertias (kg m^2) | Total mass, aggregate COM/inertia and static axle loads | Slice 3 |
| Frame geometry | Reference point coordinates, wheelbase, BB location, fork axis/offset, grips and saddle | Derived angles, clearances and assembly consistency | Slice 3 |
| Fork | Stroke (m), spring force curve, damping force curves, friction, end stops | Sag and usable travel; force direction from fork axis | Slice 2 |
| Rear suspension | Pivot/shock coordinates, rear-member mass/inertia, shock stroke/force curves | Axle path, leverage versus travel, singularities and travel bounds | Slice 3 |
| Tyre setup | Pressure (Pa), casing/profile, rim width, size, compound, tread and insert | Validated radial/tangential curve selection or fit | Fidelity extension; pressure is not an independent fake grip slider |
| Rider | Total and segment masses, segment lengths/inertias, joint ranges, posture, passive stiffness/damping | Reachability and supported load distribution | Fixed mass in Slice 3; articulation in Slice 4 |
| Rider control | Action limits, response delays, target posture, controller parameters | Command saturation and controller work | Slice 4 onward, after passive tests |
| Brakes/drive | Applied torque (N m), wheel/crank inertia, ratio and freewheel state | Torque balance, power and wheel slip | Slice 5 |
| Terrain material | Material identity and calibrated contact properties | Applicability to tyre, wetness, load and slip range | Slice 5/6 onward |

## Acquisition order

1. Use analytical, illustrative parameters to verify the loaded-wheel solver. Keep these fixtures independent of future marketing or brand specifications.
2. Select one actual hardtail or full-suspension bicycle for geometry and mass measurement. Choose the second required variant when access/data permit.
3. Acquire fork/shock manufacturer information and, where available, measured force curves. Adjuster clicks alone are not a damping curve.
4. Measure a tyre's load/deflection at known pressure, rim, tyre and temperature before claiming a calibrated pressure response.
5. Measure repeatable stationary sag and controlled low-energy responses before comparing trail recordings.
6. Use held-out conditions to determine whether a calibration transfers beyond its fitting experiment.

## Initial telemetry

All channels carry a unit and simulation timestamp. Derived signals identify the calculation/filter used.

- Prescribed platen displacement and velocity.
- Wheel/carriage vertical displacement and velocity.
- Tyre compression and normal force.
- Contact/separation events and invalid-state events.
- Kinetic, gravitational and elastic energy; dissipated energy and support work.
- Solver step and run validity status.

For the whole bike add front/rear travel and travel velocity, axle loads, frame pose/pitch, fixture reactions and rider motion. For rolling/3D add wheel angular speed, slip, steering/lean, brake/drive torques and contact tangential forces.

## Useful comparison metrics

Define each metric over a stored analysis window, excluding settling only when declared. Candidate metrics: peak/RMS frame or rider acceleration, peak tyre force, contact-loss duration, maximum suspension travel, bottom-out count, settling time and frequency response.

These metrics describe particular tests. They must not collapse into a universal 'best bike' score: comfort, grip retention, travel usage and control effort can trade off.

## Unresolved calibration questions

- Which real hardware is accessible for measurement?
- Are manufacturer or independent dynamometer curves available with reuse rights?
- What sensors and sampling accuracy are available?
- Which parameter uncertainties dominate the intended comparisons?
- What bounds should the UI enforce from actual component specifications?

No unavailable measurement should be replaced by an apparently precise invented value.
