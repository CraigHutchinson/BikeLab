# Terrain sampling contract: request, cache and layered extraction

Status: proposed design, 2026-10-16. This document defines the next reviewable terrain boundary; it is not an executable API, accepted asset schema, implemented cache or dynamic-contact claim. The current [clearance probe](TERRAIN_PROBE.md) remains a bounded rigid planar geometry diagnostic. The bicycle rig still uses prescribed flat platens. The named next consumer is an instrumented terrain-request viewer and headless replay, followed separately by the [loaded tyre/distributed-contact experiment](TERRAIN_CONTACT.md#follow-up-deforming-tyre-and-distributed-contact-user-request-2026-10-16).

The intended experience is a wheel meeting the same authored surface, buried support and changed rut that the force calculation consumes. The foundation is bounded spatial extraction with explicit coverage and state ownership. A centerline height trace cannot receive that experience during cornering. The trade-off is to keep reusable tiles and compact columns for ordinary terrain while retaining explicit feature geometry wherever columns lose contact-relevant shape. [Layered terrain](LAYERED_TERRAIN.md), [3D dynamics](THREE_DIMENSIONAL_DYNAMICS.md) and [physics fidelity](PHYSICS_FIDELITY.md) remain the physical requirements.

## 1. Request the region the wheel can encounter

The dynamics owner issues one logical request per wheel and coupling interval. A request describes a swept finite-width volume, starting behind the current wheel and extending along its possible motion. It is not a query for one height under the axle or one line in the wheel heading direction. Front and rear requests can share cached source tiles; their trajectories and admissible contact regions remain distinct.

Each request contains these meanings before any future implementation fixes field names:

| Group | Required meaning |
|---|---|
| Identity | Run/reset generation, wheel ID, monotonic request sequence, request design revision, authoritative simulation time and next coupling interval |
| Source and state | Terrain asset ID/content revision, material/law revisions, requested committed terrain-state epoch, supported representations and required contact/soil capabilities |
| Frames and motion | World-to-terrain transform; current wheel carrier and spinning tyre transforms; COM/axle position, linear and angular velocity with expression frames; steer/lean/spin state and rates where used |
| Bounds | Conservative admitted motion bounds over Hc, separately from a heuristic predicted trajectory over Hp; translation, acceleration, yaw/steering-rate, lean, lateral-slip and suspension/deformation uncertainty; evidence and model/admission limits underlying conservative bounds |
| Wheel envelope | Unloaded and admitted deformed tyre envelope, finite width, rim envelope, interaction margin, permitted penetration/sinkage and substrate coupling depth; immutable shape revision and current shape-state revision |
| Coverage | Mandatory contact horizon, prefetch horizon, retained lookbehind, vertical interaction extent, intended extraction spacing/error limits and required discontinuity/feature detail |
| Resources and outcomes | Explicit byte/tile/sample/layer/feature limits, priority, cancellation identity, requested delivery deadline and permitted verified fallback ID, if any |

A missing quantity is not silently replaced by zero. An explicitly planar fixture may bound lateral motion and lean to zero and label that restriction. Free 3D riding cannot inherit that restriction.

### Two horizons, with admission before advancement

The **contact horizon Hc** covers every possible contact during the next accepted coupled physics advance, including its contact-search/deformation interaction distance. The **prefetch horizon Hp**, at least Hc, adds useful future coverage so loading/decoding/extraction can finish before it is mandatory. Hp is a scheduling choice, not permission to apply predicted future contact forces. Only the currently admitted state and chosen mechanics determine forces.

Form a corridor from the union of the transformed tyre/rim interaction envelopes over the bounded trajectory set, then inflate it by declared geometric and motion uncertainty. Include the full fore/aft tyre extent, width, camber-induced lateral footprint shift and possible separate contact patches. Keep a bounded region behind the wheel for retreat, rocking, changing footprint and local re-query; retaining that geometry is separate from retaining soil history.

Actual translational velocity controls path displacement. Wheel heading alone fails under slip; steer angle alone does not specify yaw acceleration or curvature. Predicted yaw/steering/lean changes rotate the envelope and widen the set of possible paths. Use conservative bounds when those motions are not yet resolved. At zero speed there is still a finite footprint and possible suspension, steering, lean or spin motion; do not divide by speed. Reversal swaps the useful lead direction without discarding contacts behind the wheel.

For a simple straight bound, a forward distance from the axle can be enclosed by `projected tyre reach + speedBound*Hp + accelerationBound*Hp^2/2 + margin`. A backward distance similarly includes projected reach, possible reverse travel and retained lookbehind. This scalar bound is only a diagnostic for a straight request; the authoritative geometry is the swept corridor. Turning requires oriented envelopes along the curved path and its uncertainty, not a rectangular strip around the initial centerline. Terrain/soil coupling can require a lateral and depth halo larger than visible contact.

Choose finite maximum horizons and extents from the admitted motion envelope and measured loading cost. Record requested and delivered bounds. A budget may shorten optional prefetch, with a diagnostic; it cannot clip mandatory coverage and still report success. If useful lead cannot fit the budget, wait at a supported synchronization boundary, reduce simulation pace, or report unavailable. No real-time guarantee is established by selecting an arbitrary lead distance.

Before accepting an advance, the consumer verifies both its conservative motion bounds and the actual swept interaction volume, including every intermediate solver/contact evaluation, against complete compatible coverage for the correct source/state revisions. Heuristic prefetch is never a certified bound or admission proof. If the trajectory leaves the admitted bounds, reject/refine from the last accepted checkpoint using a verified event/rollback scheme; until that exists, stop explicitly. Merely checking the endpoint can miss a brief side/edge strike.

### Frames, time and gap meaning

Use right-handed world W: x forward at the scenario origin, y left, z up; headings subsequently rotate relative to W. Terrain T has an explicit rigid transform to W, survey/datum conversion, units and local origin. Keep source coordinates and local numerical coordinates distinct. A wheel carrier frame follows steer/lean but excludes spin; the tyre frame additionally carries spin phase. Declare the transform direction, quaternion ordering and expression frame of every velocity. Transform points, vectors and normals correctly; reject unhandled nonrigid/nonuniform scale at import rather than transforming normals as points.

Layer columns are along declared terrain up `+z_T`, not along a tyre normal. For the initial contract, T is gravity-aligned and may translate/yaw; a bank is represented by geometry. Arbitrarily tilted column axes require an explicit extension and transform tests. All positions/distances are m, time s, velocities m/s, angles rad, angular velocities rad/s.

A surface normal points out of the participating solid toward free space. A contact witness gap is positive for separation in its declared normal direction and negative for admitted overlap; the contact adapter defines the actual witness construction. A vertical column depth is not a normal gap. At corners, retain incident features and normal choices; do not invent a unique smooth normal by averaging. Label face normals, interpolation normals and probe radial witness directions separately.

Static tiles have source revisions, not physical time. Deformed geometry/state snapshots have simulation time and committed state epochs; a moving feature also has a supported trajectory/velocity over the consumed interval. Wall-clock delivery timestamps are diagnostics and never substitute for simulation time.

## 2. Cache patches are reusable; wheel extracts are views

The pipeline is: authored height/mesh/volume and material records -> validated immutable source tiles and feature index -> shared cached patch plus committed state snapshot -> per-wheel bounded layer/feature extraction -> contact mechanics -> accepted shared state update. The viewer receives the same geometry and extraction identities. Physics owns advancement; a cache cannot choose material laws or silently correct wheel state.

A **tile** is a reusable source/storage unit with exact spatial coverage and content hash. A **patch** is a bounded assembled view of one or more tiles, with sufficient neighbor/feature halo. A **wheel extract** is a disposable sample layout over a request corridor. Its index positions are not persistent terrain IDs, contact IDs or soil-state storage. Moving straight within a complete cached patch extracts new views without reloading the source. Steering beyond that patch requests additional tiles/features; it does not extrapolate existing edge heights.

Key source cache entries by asset ID, tile/feature ID, immutable content hash/revision, source transform and representation/resolution. Key derived extracts additionally by request generation/sequence, requested layout, wheel/envelope revision, extraction method/error settings and referenced tile/cell physical-state versions. The shared snapshot epoch identifies a consistent membership map; it does not invalidate every cache entry when one cell changes. Reuse unchanged tiles/cells by version and rebuild only affected extracts/halos. A tile can remain cached while changed soil invalidates a derived extract. A geometry revision, material-law change or reset cannot reuse stale state implicitly.

Each response reports exact delivered coverage and masks, representation/capability coverage, source identities, extraction revision, state epoch/time, achieved spacing/error bounds, clipped optional regions and resource use. A bounding rectangle containing the request is insufficient when holes, missing neighbors or unsupported features exist inside it.

| Outcome | Meaning and admission |
|---|---|
| Complete | All mandatory geometry, layers/features, state and capability checks pass; admission still belongs to the physics consumer |
| Partial | Some region/detail/capability is absent; return usable ranges and explicit holes, never silently truncate |
| Pending | Source or extraction work is outstanding; the existing matching complete region may remain usable |
| Outside-domain | Request intersects known unauthored/out-of-scenario space; distinct from known empty air |
| Unsupported | Geometry or required material/contact mechanism cannot be represented or consumed faithfully |
| Failed | I/O, validation or processing failed; preserve the diagnostic and last valid identities |
| Cancelled/superseded | Caller no longer wants this result; it cannot replace a newer wheel extract |

Complete means complete for the declared geometry and capability request, not physically calibrated contact. Distinguish observed/inferred/synthetic data, unresolved measurements, known void and unavailable data in the masks. Missing data never means flat z=0, infinite hard bedrock or a default friction coefficient. A partial prefetch can be acceptable while mandatory coverage remains complete. Mandatory gaps require a verified explicitly selected coarse fallback covering the same space/state, or a visible wait/slow/stop before entering them. Known air permits separation only when the full swept volume is covered as air and relevant side/subsurface geometry is resolved.

### Asynchronous delivery and bounded lifetime

The requester owns cancellation and monotonic wheel sequence; the cache owns immutable entry lifetime. De-duplicate identical source fetches across wheels. A late result may populate only an identical immutable source cache entry. It cannot reconstruct an obsolete dynamic epoch, publish over a newer wheel extract, cross run/reset generations, replace newer material/geometry revisions or overwrite mutable terrain state. Revalidate physical source/state versions and immutable snapshot membership at publication and consumption; a matching generation alone is insufficient. Cancellation is best effort; correctness cannot rely on work stopping immediately.

Use bounded request queues and caller/cache-owned reusable storage. Declare view lifetime or retain an explicit snapshot lease; eviction/reuse cannot invalidate arrays still being consumed. Release stale extracts safely. Never overwrite a reader's buffer with a new wheel request. Prioritize mandatory coverage over speculative lead, and expire superseded prefetch work. An I/O timeout does not advance physical time on fabricated terrain.

### Request/cache examples for this checkpoint

All numbers below are illustrative acceptance-fixture choices, not measured operating limits. Detailed layer vectors and force consumers follow in the next design checkpoint.

- **Straight cache hit:** at axle `(2,0,0.36)` m, radius 0.36 m, width 0.06 m, prescribed velocity `(5,0,0)` m/s and zero angular uncertainty, take Hc=0.002 s and Hp=0.25 s. With 0.10 m retained lookbehind and 0.02 m interaction margin, the prefetch horizontal bound is x `[1.52,3.63]`, y `[-0.05,0.05]` m. A complete patch x `[1,4]`, y `[-0.2,0.2]` satisfies this prescribed-motion request. Extract ahead repeatedly from that patch without fetching source again. A deformed or uncertain envelope can require a larger bound; the displayed numbers do not certify free dynamics.
- **Turn leaves the patch:** starting with heading +x, the next predicted wheel path curves left and its finite-width/lean/slip envelope reaches y=0.24 m while the current patch ends at y=0.20 m. Keep the still-complete mandatory region; request the neighboring tiles/feature halo now. A later response for the previous straight request cannot replace the turning extract. If the mandatory swept volume reaches the missing strip before complete compatible data arrive, wait/stop before acceptance; never clamp lateral samples to the cached edge.
- **Source/state race:** front-wheel loading changes cell C from version 7 to 8 in a new committed snapshot. A pending extraction using C7 is stale for a rear-wheel request requiring C8, even if generation and source tile hash match. Unchanged neighboring cells remain reusable. The old result can neither erase the rut nor become the rear wheel's force input.
