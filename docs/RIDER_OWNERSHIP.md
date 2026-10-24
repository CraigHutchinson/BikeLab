# Independent rider, bike and attachment ownership

User requirement, 2026-10-24: the rider model must be separate from the bike, able to detach and be reused between bikes. This is a required D5/shared-execution contract. It is a design for the next increments, not a claim that release or independent rider sessions are implemented.

## Current boundary and reusable work

The posture/passive modules already separate much of the rider's segment geometry, mass/inertia and joint laws. Articulated mode also assigns chassis mass independently of rider mass. Preserve that work.

The runtime assembly is still coupled in ways that prevent the requested ownership:

- `validateConnectedRider()` puts chassis properties inside the `articulated` rider wrapper.
- `rider-native.js` generates both rider bodies and frame-local `bike_hand`/`bike_foot` sites from one posture specification. Native names are reserved globally for a single assembly.
- `bikeAssembly()` inserts those fragments under the frame. Relative rider coordinates and baked posture are expressed against that construction. A native child body with joints is not inherently welded to its parent; this is an ownership/coordinate dependency, not proof that release is physically impossible in such coordinates.
- `createConnectedRider().observe()` rejects either released closure. The current admitted state/recorder expects both hand and foot interfaces active.
- Fresh-state identity binds the complete bike/rider/native model. Importing that whole joint list onto another bike is correctly rejected; it is not a portable rider instance or a continuation capsule.

See [source](../dist/rider-connected.js), [native construction](../dist/rider-native.js), [assembly](../dist/bike-assembly.js) and [state identity](../dist/trail-initial-state.js). Disabling the existing release guard alone would not receive detachment.

## Required ownership

Rider and bike should be independent actors in a shared coupled physics world, with external interfaces exchanging equal/opposite forces and work. No body mass belongs to both actors, and destroying or selecting a bike must not implicitly destroy, resize or reset its rider.

| Owner | Configuration and state it owns |
| --- | --- |
| Rider definition | Versioned anthropometry, segment mass/COM/inertia, joint references/domains/passive laws, contact surface definitions, actuation capacities, reusable controller definition/parameters and provenance; no chassis mass or a particular bike's handlebar/pedal coordinates |
| Rider instance | Stable actor ID; world pose/velocity, joint state, passive/actuator/controller history and rider energy/work; alive and observable with zero bike attachments |
| Bike definition/instance | Bike geometry, masses/inertias, suspension/wheels/drive/brakes and damage state; named local handlebar, pedal and saddle sites/surfaces with their actual bodies and transforms |
| Interface manager | Rider-side and bike-side references, grasp/retention/contact law, supported capture/release criteria, active/contact/slip state, paired forces/impulses/work and failure/unsupported events |
| Scenario/controller | Actor selection, initial placement, intended mount/posture/grip/pedal action and time-stamped commands; intent does not assert actual attachment or saddle support |
| World/session | Shared time, coupled advancement, collision/contact ownership, accepted-state rollback, deterministic identities and checkpoint/disposal of the participating actors/interfaces |

Names here describe responsibilities, not an accepted new JSON schema or plugin API. Reuse existing modules and introduce only the boundary required by a concrete two-bike/detachment consumer. Separate ownership must not create independently stepped rider/bike solvers with unaccounted force delay.

Rider intent/targets may use a separate lower update rate while coupled bodies and contact still advance at the admitted physics step. [The multirate contract](MULTIRATE_EXECUTION.md) distinguishes planning, feedback, actuator dynamics, mechanical integration and observation; it defines deterministic clocks, work and rollback requirements. Independent ownership is compatible with shared fast dynamics and does not authorize freezing the attached rider during impacts.

The first native representation should admit rider motion without relying on a bike's transform or lifetime. Separate world-level actor roots are a suitable construction to evaluate; any backend representation must satisfy the same independent world-state, disposal and conservation tests. Keep full world frames/inertia semantics so planar actors can later extend to 3D. No silent conversion of frame-relative scalar coordinates into world coordinates or quaternion state is allowed.

## Reuse and attachment behavior

**Reuse between scenarios:** select the same immutable rider definition for a hardtail and a full-suspension bike, including bikes with different fit geometry. Bike-specific setup solves or authors a reachable initial posture from the bike's sites. It must preserve body lengths/mass/inertia and law identity, and report incompatible reach/bend/domain/collision conditions instead of stretching the rider. Repeated instantiation creates independent mutable state; one rider's motion cannot alter another instance or the shared definition.

**Detachment during a run:** each hand/foot interface can be released independently where its law permits; saddle contact can separate naturally. Preserve actor world pose/velocity and identity through the event. A release without a modeled impulse must not reset momentum. Any interface stored energy, dissipation, release impulse or actuator work must have an explicit owner. Released constraints provide no residual grasp/retention load; later ordinary collision contact may still transmit force.

**Recontact and mounting:** actual geometry, relative velocity and the chosen contact/retention law decide whether contact supports, slips or captures. A target to hold the bar is not permission to snap a distant hand onto it. Flat pedals require unilateral support and bounded friction; retained pedals and hand grasps need explicit retention/release behavior. Saddle support remains finite and compression-only in the first model. Catching/regrasping can exchange impulse/work, which must be reported rather than concealed by pose projection.

**Changing bikes during a run:** this additionally requires release from bike A, independently evolving rider/bikes, reach/contact admission to bike B, and state/history continuity. It is a later gate than choosing another bike at setup. An explicit between-run reset may initialize a new pose; a live transfer cannot teleport or erase controller, energy or damage history. Do not label reuse of a configuration as a completed runtime transfer.

Fully detached motion should be received first in a supported airborne/free-flight fixture. Ground impact, rider/bike collision, walking, crashes and injury are separate mechanisms; missing collision support must produce an explicit boundary, not a falling rider passing through a visible solid object. Active internal rider motion can change shape/relative attitude but cannot supply external impulse to an isolated actor.

## Accounting, identity and replay

Report rider and bike mass/COM/momentum separately and their combined totals. Hands, feet and saddle are internal only when considering the complete participating actor set; their reactions are external to either actor considered alone. Ground, other objects and other actors must have explicit ownership. Revisit subtree/root diagnostics when actor topology changes: existing frame-subtree loads cannot automatically be called bike-only loads, and rigid contacts already included by native RNE must not be added twice.

Two concrete migration hazards in `trail-bike.js` need independent controls. Gravity moment currently combines total mass with the frame subtree COM; that ceases to represent all actors if the rider moves to a separate native root. The recorder accepts only wheel-flex ground contacts, while the frictionless-row work classification cannot distinguish new rider/saddle/grasp contact by row type alone. Resolve current actor/contact ownership before adding those pairs, sum gravity over the correct actor set, and compare separate rider/bike and combined wrenches without inventing extra reactions. The current interface observer already reports disabled closures with zero force; production admission and accounting, not just observation, must support the new modes.

Store stable actor/interface IDs separately from native addresses. Define portable rider-definition identity, compatible rider-state identity and combined world/model identity separately. A reusable rider does not make arbitrary whole-world checkpoints compatible across different bikes. Explicitly map supported rider state using physical coordinates and transforms, reject incompatible bodies/laws, and keep all legacy record meanings unchanged.

Continuation must retain interface activation/retention, controller state, event tick, accumulated work and the required native history. An interrupted or rejected capture/release transaction restores actor states, interface state, commands and accounting together. Record actual support/release state separately from requested intent. A body may be detached yet touching a bike; one boolean cannot describe every interface.

## Small implementation and acceptance sequence

1. **Portable definition and explicit bindings:** separate chassis/site configuration from rider parameters, introduce stable actor/interface ownership, and preserve legacy adapters. Reuse one rider definition on both bikes with changed fit geometry; verify no mass duplication, parameter mutation, hidden reach correction or changed historical record behavior. Design this before adding more bike-specific fields to the saddle/controller contracts.
2. **Independent unbound actor:** construct/observe the rider without a bike and alongside a bike with interfaces disabled in a new supported mode. Verify total mass/COM/inertia, world velocities, gravity/ballistic COM motion, angular momentum about COM and internal joint work/loss. Under uniform gravity with no contact, moving the detached bike must not drive the rider. Preserve the separate requirements for 3D.
3. **Supported attachment transitions:** receive hand-only, foot-only and fully released states, finite saddle separation and constrained recontact/capture on both bikes. Check equal/opposite reactions, zero released-interface forces, momentum/work, contact-row creation/disappearance, event-time refinement and rollback at a command boundary. Retain the old always-attached model as a control, rather than weakening its guards.
4. **Persistence and visible consumer:** save/replay actual actor/interface transitions through the persistent session; show independent rider/bike trajectories, support states and loads in Trail bike. Exercise detach, pause/resume, cancellation, stale snapshots and recontact with headless/browser comparisons and inspected captures. Disposal must not free a still-owned actor or leak native buffers.
5. **Runtime transfer and broader motion:** receive mounting a second compatible bike only after the first four gates, with both bike actors retained and no implicit reset. Then extend to sourced grip/pedal release, individual limbs, bike/rider/environment collision and controlled manoeuvres within supported domains.

Finite saddle compression/cycle work can continue on the current model while this boundary is introduced, but its new contact observer must use explicit actor/interface ownership. Independent detachment is not a prerequisite for proving one passive saddle cycle; it is a prerequisite for claiming a reusable independently moving rider or general release/bail-out behavior. Active posture design and long-running session ownership must consume this boundary from the start.
