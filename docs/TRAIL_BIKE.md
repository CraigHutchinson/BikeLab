# Connected trail bike

The Trail bike station receives the spatial wheel model into a single moving hardtail or full-suspension bike, including the existing passive guided rider. It is the connected consumer for subsequent traction and rider work, with the earlier stations retained as diagnostic controls. `dist/trail-bike.js` runs identically in the module worker and `node scripts/trail-bike.mjs [scenario-or-record.json]`. Exit 0 means completion within declared numerical/model limits, 2 means an explicit support stop or rejected launch/assembly, and 1 means invalid input or execution failure.

## Model and configuration

The freely translating frame has world x/z slides and a pitch hinge about +y. A fork slide follows the configured head angle. Full suspension uses the shared single-pivot arm and native spatial shock tendon; the hardtail fixes the rear carrier to the frame. Each carrier has a freely spinning hub, 64 default casing nodes with planar displacement, and native capsule-edge ground contacts. Fork, shock and rider guide retain their progressive compliant buffers and ultimate travel boundaries. Ground contact has only a normal component: forward velocity is an initial condition, not prescribed motion, and wheel spin does not impose rolling speed.

The versioned `bikelab-trail-bike-0.1` record owns a complete `scenario` with `bike`, `wheel`, `motion`, `profile` and `assembly`. Partial overrides are accepted for a new run. Saved records require every configuration field and the terrain profile; replay recomputes physics and does not trust supplied frames. All quantities are SI. Wheel arrays are front then rear. Named native bodies/joints/flexes and compiled address tables determine ownership; standalone-wheel coordinate offsets are never assumed.

| Default partition | Mass | Pitch/spin inertia |
| --- | ---: | ---: |
| Frame + rider | 82 kg | 8 kg m2, split by mass for the compliant rider |
| Front carrier | 0.5 kg | 0.01 kg m2 |
| Rear carrier | 1.5 kg | 0.02 kg m2 about carrier COM at axle |
| Each rotating hub | 1.5 kg | 0.04 kg m2 |
| Each casing | 1 kg | 0.123936 kg m2 in its undeformed state |

Total default mass is 89 kg. Each wheel's rigid-spin inertia is 0.163936 kg m2: hub inertia plus `tyreMass * ((radius - skin)^2 + skin^2/2)`. Carrier and hub inertia do not include casing inertia a second time. The old lumped wheel inertia is not retained; it was smaller than the new ring contribution. Changing hub/tyre mass changes the total mass explicitly. These quantities are illustrative, not measured production-bike configurations. Wheel radius remains the shared 0.36 m geometry; other sizes and independent front/rear wheel specifications are follow-ups.

Launch configuration supplies frame position/velocity, pitch offset/rate, wheel spin relative to carriers, suspension compression/angle and rider displacement. The initial pitch aligns the axle heights before the authored pitch offset. Rear clearance is relative to the zero-height datum, not a terrain-following placement service. No hidden equilibrium settling or artificial post-launch support is applied. The free-flight control disables buffers, gravity and initial spring compression. Imported/custom terrain still undergoes all initial contact and travel checks.

## Contact and support boundary

Only continuous profiles with segment slope magnitude at most 0.25 and successive tangent changes at most 0.08 rad are admitted. The built-in bump is a synthetic 15 mm polynomial crown across 0.8 m. Terrain and casing resolutions are independent; collinear terrain subdivisions are canonicalized before collision construction. This receives a smooth rigid-ground subset of D3, not the unresolved sharp-face/temporal-contact portions of D2.

The solver rejects unsupported pitch, ultimate fork/shock/rider travel, wheel proximity, authored-domain exit, rim contact, excessive overlap, ring strain/displacement, self-crossing, unresolved per-step movement, native iteration exhaustion and nonfinite state. A failed step restores position, velocity, warmstart and time to the last accepted state. The event records attempted time and available attempted geometry diagnostics; unevaluated quantities remain null, not stale prior values. No failed endpoint enters the visible trajectory or integrated work/impulse. A rejected initial state produces no fabricated frame.

There is no tyre/ground traction, braking, pedalling, pressure-derived casing law, anatomical rider contact, frame/fork obstacle collision, 3D steering/lean, soil deformation, mud, damage or pressure loss. A stopped overlap/rim/travel boundary is not a physical crash or failure result. Discrete geometric checks plus the narrow near-rim cast do not constitute complete continuous collision detection. Physical accuracy and real-time execution remain unqualified.

## Forces, moments and work

Each recorded wheel contains every active normal contact, the deformed casing polyline, hub pose, ground wrench at the axle, parent-on-wheel bearing wrench, world momentum and COM. Front/rear contact identity follows native flex IDs. A ground resultant is distinct from a bearing load. The renderer uses these recorded casing positions and loads, with a tracking camera on narrow displays and a route-wide desktop view; bike tubes illustrate shared joint geometry and the orange rider marker denotes a guided mass, not an anatomical body.

Node slide forces project from hub-local coordinates to world x/z. Hub-spin generalized constraint force gives ground My about that hub. The free-root travel/heave/pitch components provide an independent whole-bike ground wrench, transported to world origin for the impulse ledger. Independent contact-list sums verify both attribution and moment transport.

MuJoCo 3.16 postconstraint RNE skips flex contacts. At the same origin, the aggregate parent-on-subtree correction is `rawRNE - omittedFlexGroundWrench`. It is used only for complete wheels and ancestors containing complete wheels. Internal ring-edge and foundation actions cancel within those cuts; this does not establish individual casing/spoke stresses. Native tendon forces are already represented. The additional generalized shock-buffer force is removed through its equivalent shock-eye force when isolating rear-pivot bearing loads. A full-suspension pivot has free y rotation; a hardtail's fixed attachment can carry My.

The diagnostic RNE pass owns separate native data, receives the same state/warmstart/applied forces, and is checked against the integration data's acceleration and constraint force. Observation cadence must not alter the integration trajectory. World body velocities are evaluated at inertial COMs, including inherited frame/arm rotation. The planar angular term uses Iy; future 3D dynamics require the rotated inertia tensor.

Native energy already includes gravity, kinetic energy, tyre foundation/edges, fork, shock and rider springs. Add only custom buffer potential. Native damping work already includes suspension, rider and casing damping; add only custom buffer loss. The balance is `E - E_initial + dampingLoss - signedConstraintWork`. Stationary ground contributes no prescribed-support work. Soft-contact constraint work can store/release energy and is not labeled entirely as dissipation. Total ground impulse and gravity moment are integrated at every accepted physics step; output samples are for inspection and require separate quadrature refinement if used to reconstruct impulses.

Root/fork/rear wrenches are parent-on-subtree at the corresponding body origin. The compliant rider guide wrench is at the rider COM; for fixed rider there is no separate rider body/reaction and the field is the near-zero free-root control. Exported momentum and impulse use the world origin. Maximum sampled root/bearing residuals are explicitly sampled diagnostics, not maxima over every integration step.

## Primary implementation references

The pinned engine sources establish conventions, not physical calibration:

- [Joint transforms](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_smooth.c#L99) and [contact Jacobians](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_constraint.c#L1248): generalized force projection and contact side signs.
- [Postconstraint RNE](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_smooth.c#L2303): omitted flex contacts, represented spatial tendon forces and subtree accumulation.
- [Flex passive forces](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_passive.c#L669): internal equal/opposite edge actions.
- [Object velocity](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_util.c#L996): BODY uses `xipos`, the inertial COM.
- [Energy](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_sensor.c#L1604): native spring, gravitational and kinetic terms.

[Iteration 16 evidence](ITERATION_16_EVIDENCE.md) separates numerical controls, browser receipt and unresolved calibration. [The delivery plan](DYNAMICS_DELIVERY_PLAN.md) retains the connected game/data destination and subsequent work.
