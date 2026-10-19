# Contact-aware wheel resolution

Iteration 17 design decision, researched with GPT-6.1 Sol. This is a delivery contract, not an implemented adaptive solver. The receiving experiment is the connected hardtail/full-suspension bike and rider over square and faceted rocks. The current material mesh remains fixed during a run.

## Recommended representation

Use persistent **material arc coordinates** for tyre state, a periodic interval hierarchy for selecting contact work, and flat arrays for runtime storage. These serve different purposes; a binary tree and a circular buffer are compatible rather than competing physical models.

| Representation | Useful for | Cost / constraint |
| --- | --- | --- |
| Uniform material ring | Stable mass, strain, repeatable topology and simple array indexing | Resolves unloaded regions as finely as loaded ones |
| Periodic binary interval tree | Local error estimates, multiple separated contact regions, swept candidate search | Must update world bounds from actual deformation/rotation; tree overhead needs measurement |
| Nonuniform material ring | Concentrating deformation DOFs around anticipated high gradients | Requires measure-aware stiffness/mass, a stable timestep and conservative state transfer |
| Circular buffer of material entries | Contiguous traversal of an active arc with no physical copying | Head/index is storage only; cannot redefine material identity or erase departing history |

Index hierarchy leaves by rest material arc, e.g. `s0` in `[0, circumference)`, not by the current lowest point or world angle. The actual contact shape comes from deformed positions. Split an interval crossing the material seam into explicit ranges, or use an unwrapped start plus length. Never infer continuity from sorted world x: a wheel has upper/lower arcs and can contact two separated supports. Reverse rotation must work without reassigning identities.

An angular coordinate plus radial displacement alone cannot represent the present tangential casing deformation or future lateral modes. Keep explicit canonical rest coordinates and the necessary vector state. In 3D retain material azimuth and a width/meridional coordinate, with vector displacement, finite-width contact and camber/turning loads; the planar interval tree can later become a surface hierarchy. Preserve canonical rest coordinates in records rather than reconstructing collision-sensitive geometry with platform-dependent trigonometry.

MuJoCo already traverses a [flex BVH](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_collision_driver.c#L997). A new JavaScript tree does **not** reduce compiled solver DOFs. Its first justified use would be conservative swept activation, detailed terrain/material requests and observable candidate/active intervals. Measure native traversal first; do not duplicate it solely because a binary tree is available.

## Proposed data contract

| Entity | Persistent fields |
| --- | --- |
| Material node | Stable ID, rest arc/angle, canonical rest position, integration weight, mass, intrinsic inertia, displacement/velocity, mechanism-specific history |
| Material edge | Stable ID, endpoint IDs, rest arc interval, chord rest length, extension/viscosity coefficients |
| Hierarchy interval | Parent/children, material bounds, level, world/swept bounds, error indicators, activation state |
| Runtime mapping | Storage slot and native body/joint/flex addresses, separate from material IDs |
| Adaptation event | Simulation time, old/new topology revisions, state mapping, conservation residuals, transfer-energy change and reason |

Contact records refer to material IDs and topology revision, plus terrain feature/material identity, witness position, normal, force and supported history. Variable contact counts are ordinary variable-length arrays; they do not require remeshing. Future friction history, mud coating/mass, wear, damage and bead state stay attached to material locations as they rotate out of view/contact. Pressure belongs to the supported cavity model, not an independent scalar per active node. Terrain history remains terrain-owned and shared by both wheels.

First introduce this contract alongside existing uniform records, with explicit version/migration and full replay. Do not retroactively reinterpret existing `edge`/`vertex` native indices as stable IDs. Offline dataset labels include topology, fidelity decisions and uncertainty; game and headless execution use the same decisions and state transitions.

## Nonuniform mechanics and transfer

For the current authored spring model, a candidate measure-aware discretization is:

```
w_i = (delta_s_previous + delta_s_next) / 2
foundation_K_i = foundation_per_length * w_i
edge_k_e = extension / rest_chord_length_e
edge_c_e = edge_viscosity / rest_chord_length_e
E_foundation = sum(0.5 * foundation_K_i * |u_i|^2)
E_edges = sum(0.5 * edge_k_e * (length_e - rest_chord_length_e)^2)
```

Rest arc measure and chord rest length are distinct. [Discrete Elastic Rods, §4.2](https://www.cs.columbia.edu/cg/backup/pdfs.bak_8jvmzfsdj20ff/143-rods.pdf) motivates measure-aware discretization; this foundation ring is neither that rod model nor an inflated tyre constitutive law.

There are two immediate blockers to simply varying node spacing. Native [flex edge stiffness/damping is per flex](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_passive.c#L729), so the present uniform coefficient cannot express arbitrary `1/L0` edge coefficients. One possible later native route is a collision flex with zero native edge elasticity and per-edge spatial spring/damper tendons. Require uniform-mesh equivalence, energy-gradient and complete-wheel reaction controls before accepting that route. Secondly, arc-weight lumped masses preserve total mass but can introduce a nonzero rest COM for asymmetrically sampled circles. Verify total mass, first mass moment and spin inertia independently, or use a consistent conservative mass representation; artificial rotating imbalance must not appear as physical tyre behaviour.

Before/after every true topology change, preserve mass, COM, linear momentum and angular momentum about the same origin. Measure kinetic, elastic and gravitational energy separately. Copying positions/velocities is insufficient. Coarsening removes fine deformation/velocity modes; retain unresolved state, declare a bounded transfer loss in its own ledger, or refuse the operation. Do not hide transfer error in normal damping. Transfer contact/material history explicitly. [In-Timestep Remeshing](https://zferg.us/research/in-timestep-remeshing/) provides background on consistent temporal mappings and physical error criteria, not a drop-in implementation for this runtime.

Splitting collision children changes constraint multiplicity and effective compliance, even where their geometric union matches a parent capsule. Parent and children must not provide duplicate simultaneous support. Exclusive replacement still needs force, moment and work convergence controls. [Convergent IPC, §4](https://arxiv.org/html/2307.15908v1#S4) illustrates contact-discretization convergence concerns; it is not an engine replacement proposal.

Finer edges increase extension stiffness and reduce local node mass, tightening timestep admission roughly with minimum spacing. Recompute the bound after actual refinement. The pinned WASM exposes compilation but no supported hot `mj_recompile` path was found in the research review. Rebuilding a model is not evidence that it can preserve live state or meet a game deadline.

## Activation, scheduling and receiving gates

Activate before contact, using swept world bounds inflated by skin, geometry-error allowance and bounded relative motion over an explicit horizon. Use predicted contacts, terrain normal changes, multiple supports, deformation/velocity gradients and elastic-error indicators. Preserve sharp authored rock facets. Contact count alone is a late trigger. Refine above a high threshold; coarsen below a lower threshold with dwell time. Unloaded tyre regions still carry inertia and elastic waves and can return to contact rapidly.

Keep material resolution, contact search, terrain detail, integration timestep, diagnostic rate and display rate independent in configuration and evidence. Expensive corner/material work may run only when needed or at a different rate, but inter-rate coupling must preserve interval impulses/work and supported reaction trajectories. An asynchronous query must arrive before its conservative validity horizon expires. If it does not, retain a validated fallback or report loss of real time; never miss a rock to meet the display deadline.

Delivery order:

1. Instrument native contact cost and display persistent material IDs, candidate/active intervals and predicted activation over the connected faceted-impact experiment, without changing forces. Establish a budget on declared hardware before claiming an optimisation.
2. Validate fixed nonuniform meshes selected **between runs** against uniform controls: independent mass/COM/inertia, energy gradients, reactions, contact multiplicity, timestep and material resolution. Search refinement alone cannot repair deformation-mesh error.
3. Attempt in-run adaptation only after spin/reversal, seam crossing, unloading/recontact, separated supports, repeated switches and transfer conservation gates pass. Include complete browser/headless replay, logged decisions, sustained overload and sharp-edge controls. Keep unsupported component fracture/pressure loss explicit.

Retain the [fidelity](PHYSICS_FIDELITY.md), [layered terrain](LAYERED_TERRAIN.md), [3D](THREE_DIMENSIONAL_DYNAMICS.md) and [failure](OVERLOAD_AND_FAILURE.md) contracts. This path supports detailed reference datasets and eventual game tiers without claiming the current offline ring is real-time or physically calibrated.
