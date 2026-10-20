# Rider posture construction prerequisite

`dist/rider-posture.js` constructs a feasible planar five-group rider posture and its aggregate mass properties. This is the first implementation increment after the [iteration 20 review](ITERATION_20_REVIEW.md). It does not change the connected simulation, create native constraints, simulate limbs, apply rider forces or receive any [manoeuvre stretch goal](RIDER_MANOEUVRES.md).

Run `node scripts/rider-posture.mjs` for the default report, or pass a JSON specification filename. The report's `spec` is the complete canonical input for a repeatable construction. In JavaScript, `validatePosture` checks and copies the schema; `constructPosture` additionally checks geometric reach/conditioning and returns the owned, frozen report. Construction has no integration loop or rendering dependency.

## Versioned specification

The format is `bikelab-rider-posture-0.1`. New construction allows omitted top-level fields to use defaults. An explicit unsupported or undefined format is rejected. This is a separate specification, not a new Trail bike record version; old connected scenarios are unaffected.

| Field | Meaning and admitted range |
| --- | --- |
| `riderMass` | Total rider mass, 20–100 kg |
| `hip`, `hand`, `foot` | Two-component frame-local `[x,z]` locations, each coordinate within ±2 m |
| `trunkPitch` | Rotation about +y from local +z, within ±π radians |
| `kneeSide`, `elbowSide` | +1 or -1 chooses the joint side of the directed proximal-to-distal line in the x/z plane |
| `minBendSine` | Lower bound for absolute sine of each two-link bend, default 0.05, admitted 0.001–0.95 |
| `segments` | `trunk`, `thighs`, `shanksFeet`, `upperArms`, `forearmsHands` |

Each supplied segment is complete: `massFraction`, `length` in metres, `comFraction` along its proximal-to-distal axis, and three `inertiaPerMass` values in m². The latter are central principal moments divided by segment mass, along local x/y/z. Segment local +z runs from proximal to distal; y stays the planar rotation axis.

Mass fractions must sum to one within 1e-12 and are not silently renormalized. Fractions are 0.001–1, lengths 0.1–1.2 m, COM fractions 0–1, and principal inertia per mass 1e-6–1 m². Inertias must also satisfy the physical triangle inequalities. These are bounded engineering input domains, not anatomical validity or injury limits. Positive inertia does not establish a measured human mass distribution.

The default mass fractions, lengths and attachment points are illustrative. Default central moments come from solid-cylinder proxies: transverse `I/m=(3r²+L²)/12` and axial `I/m=r²/2`, with COM at the midpoint. Paired limbs are each one aggregate body, not two bodies with duplicated mass. User segment replacements must specify their own complete geometry, COM and inertia; changing length does not infer new measured properties. No anthropometric coefficient table has been imported.

## Geometry and inertia conventions

Hip position and trunk pitch locate the shoulder. Each limb pair then solves the intersection of two circles with its specified lengths: for endpoint separation d and lengths a/b, the distance along the endpoint line is `(d²+a²-b²)/(2d)`, and the perpendicular distance is `sqrt(a²-along²)`. The chosen side selects the bent joint. Reject unreachable, coincident, straight or nearly folded configurations before returning a posture. The sine guard is equivalent to bounding each two-link endpoint Jacobian determinant relative to `a*b`; it is not a native closed-loop rank/conditioning certificate.

Angles follow `R_y(theta)`: a local +z segment points along `(sin(theta), cos(theta))` in the x/z plane. Hip/knee/shoulder/elbow outputs are relative angles wrapped to [-π,π]. Each body's COM is located from its actual endpoints. The full central inertia is rotated into frame axes, then transported to the aggregate COM with the parallel-axis theorem. Returned tensors are row-major 3×3 values in kg m² and retain xz products of inertia.

`closure.hand` and `closure.foot` measure endpoint reconstruction error from the solved angles. `conditioning` reports each bend sine and its configured lower bound. Neither field measures native constraint drift, joint stress, grip or pedal retention. Native joint construction, compatible initial velocities, attachment/saddle contact routing, work ledgers and dynamic acceptance remain next.

## Independent checks

Five focused tests cover exact 3–4–5 triangle configurations and both bend branches; unreachable and nearly straight/folded limbs, including unequal lengths; invalid/sparse/versioned data and immutable ownership; full aggregate COM/inertia against an equivalent six-point-mass representation of each body; and rigid coordinate transforms, mass scaling and changed mass distribution.

Run `node test/rider-posture.test.mjs` directly or include it in `node --test`. These checks verify this construction layer only. They do not claim anatomical realism, native constraint stability, complete rider dynamics, visual inspection or real-time performance.

The first implementation passes all five focused tests and a CLI export/specification round trip with identical report bytes. GPT-6.1 Sol independently reviewed the geometry, mass ownership and inertia formulas and found no consequential correctness issue. Full local suite execution encounters existing sandbox restrictions on process spawning and loopback listening; complete hosted results are tracked on [PR #23](https://github.com/CraigHutchinson/BikeLab/pull/23). The preview-server allowlist includes the new module.

The hosted browser check imports the same construction module through the Pages-style path and compares complete default and changed-mass/opposite-branch reports to Node with a 1e-12 normalized tolerance. It also checks unreachable-pose rejection. This verifies cross-runtime construction and asset loading, not a rendered or dynamically articulated rider.

## Native tree and initial closure inspection

`node scripts/rider-posture.mjs --native [posture-spec.json]` now compiles the same posture into five native bodies and reports actual body endpoints, COMs, full central tensors and named hand/foot site gaps/Jacobians. Its version is `bikelab-rider-native-0.1`; the complete canonical input is retained in `spec`. It performs a forward evaluation only, without stepping time. The carrier is a declared 12 kg planar fixture, not either connected bike, and its mass is excluded from the reported rider aggregate. This command isolates the initialization blocker before connecting a new closed-chain rider to suspension and deformable tyres; it is not a separate simulation station.

`dist/rider-native.js` exports `riderParts` for the native body, frame sites and equality fragments. All seven coordinates are deviations from the constructed pose, initially zero. Relative body quaternions carry the solved physical angles. The trunk x/z slides precede its pitch hinge and use inverse-rest-rotated axes to remain aligned with the parent frame. Hip, knee, shoulder and elbow hinges act about +y. Each segment COM and principal inertia belongs to its body exactly once. No guide spring, joint spring/damper, stop, motor or saddle is added in this prerequisite.

The hand and foot connects put the rider site first and the carrier site second, so gap and Jacobian signs are rider minus carrier. The report uses the public dense site-Jacobian API even though the fixture deliberately uses sparse constraint storage, matching the storage regime of the larger wheel-connected model. Equality residual rows are resolved by named equality IDs. Tests also force dense storage; no persistent row-number assumption is made.

Three native tests supplement the five construction tests. They cover both bend branches, a second rider mass, a changed trunk COM/inertia and a near-straight limb just inside the minimum bend guard; compare native geometry and full tensors; prove rank four with analytic limb minors and two zero y rows; compare every Jacobian column with independent central differences; check nonzero translated/rotated rigid launches; and compare a locked five-body tree with one matched aggregate body in mass matrix, bias and energy. Budgets are declared in the [iteration review](ITERATION_20_REVIEW.md#native-construction-gates-declared-before-receiving-the-implementation). This is initialization evidence only. A feasible non-singular pose does not establish stability, collision clearance, anatomical admissibility or interface-force accounting during motion.

The pinned source conventions are [MuJoCo reference-pose kinematics](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_smooth.c#L99), [connect semantics](https://github.com/google-deepmind/mujoco/blob/3.16.0/doc/XMLreference.rst#L4467), [site Jacobian API](https://github.com/google-deepmind/mujoco/blob/3.16.0/include/mujoco/mujoco.h#L530), [native constraint storage](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_constraint.c#L206) and [full inertia format](https://github.com/google-deepmind/mujoco/blob/3.16.0/doc/XMLreference.rst#L2120). GPT-6.1 Sol checked the conventions independently. Closure regularization remains a numerical fixture choice rather than calibrated tissue compliance.
