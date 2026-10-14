# Rig and model contracts

Status: mixed implementation/design contract. The first loaded-wheel station is implemented; see STACK_DECISION.md for its equations and SLICE_1_EVIDENCE.md for verification. Whole-bike and later sections remain proposed.

## Coordinates, units and time

Use SI internally: metres, kilograms, seconds, radians, newtons and newton-metres. The UI may show millimetres, degrees and tyre pressure in familiar units, with conversion at the boundary.

Use a right-handed world frame: x forward, y left, z up. Gravity acts along negative z. In the first planar whole-bike model, translation occurs in x/z and rotation about y. Display nose-up pitch with an explicit sign conversion because positive right-handed rotation about y is nose-down for a forward-pointing x axis.

Use a fixed simulation step selected by convergence tests. Render at an independent cadence; interpolation must never feed back into dynamics. Pause and single-step advance the simulation clock consistently. Retain both simulation timestamps and run metadata.

## Two experiments, two meanings

### Independent wheel excitation

A front and a rear support surface have separately prescribed vertical motions. Initially smooth platens represent contact excitation; they do not pretend to reproduce an exact rotating drum or tyre patch.

Purpose: isolate front/rear suspension response, phase relationships and rider coupling. Display platen motion and restraint reactions alongside bike response.

### Travelling profile

One spatial road profile is sampled by both wheel contacts as it moves relative to the bike. Derive encounter positions from current contact/axle geometry and the configured motion. A simple wheelbase/speed delay is a useful fixed-geometry diagnostic, not the general contact algorithm during suspension motion and pitch.

Purpose: compare bikes over the same obstacle sequence. Ground excitation is displacement/geometry, not an extra force applied to the frame.

## Restraints and omitted freedoms

The first loaded-wheel station constrains a wheel/carriage to vertical motion. It does not simulate rolling, steering, wheel spin or a complete bicycle. A visible guide identifies the restraint.

For the planar whole-bike vertical rig:

- Remove lateral translation, roll and steering explicitly as planar assumptions.
- Keep frame heave and pitch free.
- Use an explicit horizontal fixture to prevent the bicycle drifting out of the rig; show its attachment and record reaction forces.
- Select the fixture attachment during the whole-bike design pass and quantify its effect with a comparison run. It is not yet specified or validated.
- Treat driven road speed as an experiment input. It is not evidence that a free bike would reach or maintain that speed.
- Keep rolling/braking dynamics out of this experiment until wheel spin and longitudinal contact are implemented.

The freely moving planar road mode is a later model configuration. Fixed restraints and prescribed speed must not conceal energy or momentum transfer.

## First station: bodies and state

A wheel/carriage body with specified effective mass moves vertically above a prescribed platen. Its state comprises vertical position and velocity; the platen position/velocity comes from the experiment. Gravity and unilateral tyre contact determine vertical forces.

Begin with an explicitly simplified elastic/damped radial tyre response. The unloaded radius defines a geometric contact reference. Contact must not pull the wheel toward the surface. Separation and recontact must remain possible. The exact contact law and integration method require primary-source review and independent tests before implementation.

Show the tyre as an undeformed outline plus a deflection indicator first. Any later animated deformation must agree with contact depth and must be labelled if it exaggerates scale.

## Whole-bike bodies and joints

| Assembly | Proposed representation | Important boundary |
|---|---|---|
| Main frame, cockpit and fork upper | One planar rigid body initially | Mass/inertia aggregation documented; no steering in this mode |
| Fork lower and front axle carrier | Body connected by a prismatic fork joint | Spring/damper/end-stop forces act along the fork axis |
| Front wheel | Wheel/contact assembly attached to carrier | Spin becomes an active DOF in the rolling slice |
| Hardtail rear axle/wheel carrier | Rigid frame attachment | No rear suspension coordinate |
| Full-suspension rear member | Planar body with explicit pivot | Shock force acts at actual attachment coordinates |
| Rear wheel | Assembly at rear axle | Contact and later spin independent of front wheel |
| Fixed rider | Added mass/inertia with specified location | Explicitly not a human dynamics model |
| Articulated rider, later | Pelvis, torso and simplified paired leg/arm chains | Planar aggregation and contact assumptions documented |

Before building the whole-bike solver, enumerate generalized coordinates and independent constraints for each variant. Reject impossible assembly geometry, duplicated constraints and zero/negative physical mass or inertia. Do not commit a generic multibody API before the reference assemblies consume it.

## Force and energy accounting

Every internal component applies equal/opposite actions to its connected bodies. Include moments from off-centre application points. Calculate tyre damping from relative motion at contact, not simply wheel world velocity.

Record kinetic energy, gravitational potential, elastic stored energy, dissipated energy and work by prescribed supports/fixtures where applicable. A driven rig can add energy; therefore conservation checks must include external work. With forcing removed, use separate conservative and dissipative reference cases.

Parameter changes invalidate a run's fixed configuration. Default interaction: changing a physical parameter stops the run, resets to a documented initialisation procedure and starts a new result. Live adjustment may be added later only with explicit event recording.

## User experience

Layout:

1. Left: bike/station selection, setup, rider and disturbance controls.
2. Centre: visible mechanism, ground/platens and restraints; side view first.
3. Bottom: synchronized travel, force and acceleration plots.
4. Right: run summary, model assumptions, parameter provenance and comparison selection.

Minimum controls: run, pause, reset, single-step, playback speed and camera reset. Simulation speed and display playback speed must be distinguished. Each control must affect an implemented quantity; later features appear in the plan rather than as inert UI knobs.

A comparison retains both setups and the exact scenario. Plot both traces on the same axes and optionally overlay bike poses at the same simulation time. Never compare different forcing or settling procedures without showing the difference.

## Data contracts to implement only as consumed

- Setup: typed physical parameters, geometry and provenance.
- Scenario: forcing, duration, initialisation and recorded commands.
- State snapshot: timestamp, body poses/velocities and component observables.
- Run record: setup/scenario copies, solver settings, build identifier, events and signals.
- Result: metrics, validity status, failed checks and limitations.

The viewer reads state; it does not own physics. A headless runner and interactive view must produce numerically matching underlying results for a prescribed scenario. Same-runtime replay is exact; cross-runtime checks use the declared tolerance in SLICE_1_EVIDENCE.md. Cross-runtime or cross-platform bitwise determinism is not promised.
