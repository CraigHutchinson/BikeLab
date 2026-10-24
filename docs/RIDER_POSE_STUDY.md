# Rider pose review and geometry study

Reviewed 2026-10-24 against merged main `0d0fe423fe3b2db698a02747262ffbc7b546bd57`. The Trail bike page now has an independent **Rider poses · standing and sitting study** panel. It compares solved segment geometry, whole-rider COM and unchanged default passive joint domains. This is a construction preview, not a sit/stand controller or a replacement for the moving articulated renderer.

## What the human model supports

| Capability | Current state | Consequence for sitting and standing |
| --- | --- | --- |
| Hip, knee, shoulder and elbow articulation | Five rigid groups, seven relative scalar coordinates, four independent planar closure directions | The body can change shape; hands and feet are currently bilateral point attachments |
| Configurable starting pose | Hip x/z, trunk pitch, limb lengths, bend branches, hand/foot anchors and segment mass/inertia | Different starting geometries are expressible and constructible; changing a baked reference pose creates a different physical state identity |
| Passive joint response | Fixed rest angles, spring/damper coefficients and bounded domains | The default standing example is a sag transient, not a maintained standing equilibrium; deeper poses may correctly fail the default laws |
| Saddle support | Not received on main | Low hip position does not classify the rider as supported or seated |
| Active posture change | Not implemented | No commanded stand/sit transition, muscle activation or work budget is claimed |
| Anatomy and collision | Paired limbs aggregated; illustrative cylinder mass/inertia | No separate left/right legs, crank/ankle motion, head/pelvis body or limb/frame collision; this is not calibrated human anatomy |

The separately pushed [`codex/rider-saddle-followup` checkpoint](https://github.com/CraigHutchinson/BikeLab/blob/a6ac1249e8dbc7f3737fa8dde4cc8a8c717f5f29/docs/RIDER_SADDLE_CHECKPOINT.md) must be preserved. Its finite-contact implementation still has a failed separation/recontact refinement control and needs the newer main state/force/UI contracts. Do not merge it wholesale or treat low net rider force as all-coordinate equilibrium. See [saddle plan](RIDER_SADDLE_PLAN.md), [equilibrium plan](RIDER_EQUILIBRIUM_PLAN.md) and [seated/unseated research](RIDER_SEATED_UNSEATED.md).

## Visible, headless and export contract

The four illustrative examples preserve the same 70 kg body, segment lengths/mass/inertia, bend branches and hand/foot attachments. Only hip x/z and trunk pitch change. Values are authored demonstrations, not manufacturer geometry or measured rider poses. In the existing frame-local convention, x is forward, z is up, and positive trunk pitch rotates from +z toward +x.

| Example | Hip x / z (m) | Trunk pitch (rad) | Whole-rider COM x / z (m), rounded | Within default passive domains |
| --- | --- | ---: | --- | --- |
| Reference unseated | −0.15 / 0.25 | 0.55 | 0.038854 / 0.357611 | Yes |
| Taller unseated | −0.13 / 0.29 | 0.60 | 0.061175 / 0.383164 | Yes |
| Bent-leg hover | −0.20 / 0.17 | 0.75 | 0.027837 / 0.271898 | No |
| Low-hip seating intent | −0.22 / 0.07 | 0.65 | −0.000939 / 0.208471 | No |

The two lower poses are reachable with bent limbs but outside the deliberately narrow passive envelope. The panel retains them as geometry, lists joint angles and limits, and reports the existing compiler's rejection reason. It does not recenter spring rest angles, widen domains or infer a contact force from pose. A pass only means initial default-passive configuration admission; it does not prove equilibrium, collision clearance, anatomical validity or a supported trajectory. The taller pose is only a modest extension; fully extended/singular knees remain rejected.

The SVG uses equal x/z scale and displays solved endpoints, fixed attachments and aggregate COM separately from the hip. Grey reference geometry uses the same body and attachments. There is no fictitious saddle surface; the bicycle drawing's seat-tube top is not a physical saddle location. Comparison coordinates and COM differences are also available as text.

The panel is independent of the applied scenario, rider coupling, playback and worker. Hip/pitch edits hide the previous result and disable export until a successful preview. Invalid, blank, unreachable or ill-conditioned input remains rejected. A valid geometry can be exported even when the default passive laws reject it. The saved complete `bikelab-rider-posture-0.1` specification is accepted by the existing construction CLI:

```sh
node scripts/rider-posture.mjs bikelab-rider-posture.json
node scripts/rider-posture.mjs --native bikelab-rider-posture.json
```

`--passive` instead expects a passive wrapper with `posture` and explicitly chosen `joints`. Do not supply a bare pose as a Trail-bike record or a complete dynamical state. The public `inspectRiderPose(input)` module accepts the existing configurable posture specification; the visible study keeps default body properties and anchors for comparison. It shares `constructPosture` and `compilePassiveRider` with headless/native paths and owns immutable reports.

## Small next dynamics increments

1. Receive finite unilateral saddle compression, separation and recontact on both bikes. Preserve actual paired application points, internal work routing, contact ownership, guards and timestep/regularization sensitivity. Seating intent and measured saddle support are separate channels. Pedal/hand/saddle loads must emerge from dynamics, not a prescribed weight fraction.
2. Introduce an independent target/intent command with bounded internal joint torque, rate, power and signed actuator work. Keep one continuous physical state. Never rebuild reference geometry or teleport qpos to implement a live pose change. If rest angle or stiffness varies, include parameter work: for `U = 0.5 k (q − r)^2`, the explicit parameter power is `−k (q − r) rDot + 0.5 kDot (q − r)^2`. Do not call this passive damping or count it twice with torque work.
3. Validate the whole supported transition path, not merely its endpoints: reach/bend branch and conditioning, closure, unilateral support, load transfer, all-coordinate state/energy, ultimate limits and rollback. Receive stand→sit→stand on both bikes with complete replay and inspected geometry. Coupled equilibrium remains a separately qualified initial condition.
4. Use the same bounded actuation for pump timing, absorption/resistance, wheelie/manual, bunny hop and endo experiments. Retain [manoeuvre gates](RIDER_MANOEUVRES.md), component travel/failure/blowout limits, and later 3D lateral/turning dynamics. Extend to individual limbs/crank/ankle contact only with explicit mass/force ownership and sourced parameters. Shared synthetic-data/game execution still needs measured latency and fidelity tiers; this geometry panel adds no real-time evidence.

## Evidence at first push

Fourteen focused tests pass locally: the three new controls plus existing posture/passive/static-asset checks. Every example's native endpoints, attachments, COM and full inertia agree with constructed geometry; independent segment-length and weighted-COM controls preserve body properties. Rejected domains retain original laws, invalid geometry throws, and round-trip ownership is checked. No production integration, force law or record format changed.

GPT-6.1 Sol performed a read-only review without running tests/measurements. Its requested pitch convention, successful custom-input export and deterministic in-flight worker precondition were incorporated. The new browser check covers both bike modes, all examples, complete browser/Node pose reports at the unchanged 1e-12 construction budget, exact saved applied records before/after editing, stale/invalid preview gating, a custom export and worker completion. It captures desktop plus 390/320 px panels. These checks and visual inspection are **pending hosted execution at this checkpoint**: this cloud session rejects local loopback with `listen EPERM`. Do not label uninspected captures as visual acceptance.
