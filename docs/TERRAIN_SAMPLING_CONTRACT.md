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

### Request/cache examples

All numbers below are illustrative acceptance-fixture choices, not measured operating limits. Layer vectors and force consumers are developed in section 6.

- **Straight cache hit:** at axle `(2,0,0.36)` m, radius 0.36 m, width 0.06 m, prescribed velocity `(5,0,0)` m/s and zero angular uncertainty, take Hc=0.002 s and Hp=0.25 s. With 0.10 m retained lookbehind and 0.02 m interaction margin, the prefetch horizontal bound is x `[1.52,3.63]`, y `[-0.05,0.05]` m. A complete patch x `[1,4]`, y `[-0.2,0.2]` satisfies this prescribed-motion request. Extract ahead repeatedly from that patch without fetching source again. A deformed or uncertain envelope can require a larger bound; the displayed numbers do not certify free dynamics.
- **Turn leaves the patch:** starting with heading +x, the next predicted wheel path curves left and its finite-width/lean/slip envelope reaches y=0.24 m while the current patch ends at y=0.20 m. Keep the still-complete mandatory region; request the neighboring tiles/feature halo now. A later response for the previous straight request cannot replace the turning extract. If the mandatory swept volume reaches the missing strip before complete compatible data arrive, wait/stop before acceptance; never clamp lateral samples to the cached edge.
- **Source/state race:** front-wheel loading changes cell C from version 7 to 8 in a new committed snapshot. A pending extraction using C7 is stale for a rear-wheel request requiring C8, even if generation and source tile hash match. Unchanged neighboring cells remain reusable. The old result can neither erase the rut nor become the rear wheel's force input.

## 3. Return compact top-surface and layer data

Use a bounded structure of arrays (SoA) for extracted samples and an offset table for variable-depth spans. The following is a schema sketch for design review, not a new loader format or public function signature. Regular layouts can encode coordinates by origin/axes/spacing and row offsets; irregular corridor samples carry explicit coordinates. Dense object graphs, duplicated material objects and parsing per contact are unnecessary.

| Array/table | Meaning |
|---|---|
| Header | Request identities, source hashes/transforms, snapshot membership, physical versions, simulation interval, exact valid coverage, capabilities, layout/interpolation revision, precision/error bounds, lengths/capacities and lease lifetime |
| Coordinates N | x/y in T, sample or fragment ID, stable source-cell/feature references, layout/row offsets where applicable |
| Sampling measure N | Represented cell/fragment measure or quadrature weight, units m2 for area sampling or m for a declared planar line; coverage fraction and valid-domain mask |
| Top surface N | Top z, outward unit normal components, normal kind, surface/feature ID, exposed phase/material reference, discontinuity flags and geometry uncertainty |
| Column coverage N | Valid z interval, known-air intervals where supplied, unresolved/occluded regions, source confidence/provenance class and representation limitation flags |
| Span offsets N+1 | Monotonic offsets into M depth-span records; sample i occupies `[offset[i],offset[i+1])` |
| Spans M | Upper/lower z, span kind, stable layer/volume ID, material or composite-law reference, interface references, physical-state key/version and coverage/uncertainty |
| Interfaces | Ordered participating phases, oriented normal convention, geometry/feature reference, bonding/slip/separation law reference and state/version |
| Explicit features | Deduplicated mesh/primitive/volume references and bounded geometry, topology, outward normals, sharp edges/physical radii, material regions, support/anchorage, transform/velocity and feature revisions |
| Parameter/state tables | Shared immutable law records plus a leased read snapshot of consumed state; no private mutable copies owned by each sample |

Sampling measure is geometric quadrature, not a prediction of loaded tyre contact area, contact pressure or force. A constitutive contact model determines which part is loaded, how area is defined, and how traction is integrated. Refining samples must partition measure consistently, never replicate a whole-wheel stiffness or grip allowance. A planar probe does not acquire width or Pa merely because this schema can describe area.

Spans are ordered downward with nonnegative **vertical** thickness `upperZ-lowerZ`; this is not necessarily thickness measured along an interface normal. Distinct occupied volumes cannot overlap. Use explicit kinds for bulk material, a reinforced/composite material, known void and unknown interval. Adjacent spans meet at an identified interface; missing intervals are unknown, not automatically filled. A zero-thickness boundary is an interface, not an extra spring. Below the known depth, report unknown unless the authored model explicitly supplies continuing material/support. Above the top, known air is valid only within the source's certified geometry coverage.

A partially exposed rock crossing a cell requires boundary fragments/explicit geometry or refinement; do not average its height/material into surrounding soil. Composite fine-root reinforcement belongs to the soil law with orientation, density, anchorage and calibration references. A resolved root obstacle has its own occupied volume/support and removes displaced soil. The same roots cannot supply both explicit obstacle support and duplicated composite strength. Thin roots below resolution require an evidenced effective law or an unresolved-feature outcome.

A material name or scalar softness is not a constitutive model. A material/law record identifies its revision, exact required parameter names and units, input/state/output definitions, density, interface choices, calibration dataset, admissible load/rate/water conditions and uncertainty. Quantities may include modulus/cohesion in Pa, density kg/m3, shear displacement m, friction angle rad and dimensionless friction/porosity where the selected law actually consumes them. Pressure-sinkage coefficient dimensions depend on the law/exponent. Unknown law IDs, missing state or unsupported interfaces make the physical request unsupported; a rendering colour cannot supply defaults.

### Columns have a strict geometry boundary

Columns efficiently describe a top surface and ordered depth intervals. They do not define lateral connectivity, root sides, vertical rock faces, undercuts, overhangs, caves, detached bodies or load transfer by themselves. A vertical ray may summarize several occupied/void spans, but that summary still lacks the full 3D boundary. Retain mesh/primitive/volume geometry and an appropriate collision/constitutive consumer for these features. Mark each extract's limitations; a column-only consumer rejects a request requiring the missing geometry. Do not turn a vertical face into an interpolation ramp or treat an overhang as solid to infinite depth.

## 4. Resampling, seams and bounded work

Authoring/import preserves the source frame/datum, pixel-center versus pixel-corner convention, units/scales, nodata masks, topology, acquisition/generation provenance and immutable asset hashes. A heightmap image alone supplies neither layer thickness nor mechanical properties. Scan-derived, inferred and synthetic buried geometry remain separately labelled. The [GDAL geotransform tutorial](https://gdal.org/en/stable/tutorials/geotransforms_tut.html) makes the corner/center distinction explicit; its [raster data model](https://gdal.org/en/stable/user/raster_data_model.html#raster-band) separately describes nodata masks, scale/offset and units. These are import semantics, not a requirement to adopt GDAL at runtime.

Record cell interpolation/triangulation and the extraction method. Derive normals from the same consumed geometry. Do not interpolate across missing cells, sharp-feature IDs, material/exposure boundaries or unknown layer intersections. Preserve discontinuity/edge references and incident faces. Interpolating a top height and independently smoothing its normal can describe two different surfaces. Coarsening must report feature/error bounds and unsupported subresolution content, rather than conceal it as a smooth physical surface.

Use neighbor halos for interpolation, normals, contact search and soil coupling. Cache requests include these halos. Source cells/features have canonical ownership and globally stable IDs across tile seams. Duplicate halo features are deduplicated for contact and state writes. Shared vertices/layer boundaries agree by construction or fail seam validation; tolerance-based welding must be explicit and recorded. Crop to the requested region without capping or inventing boundary faces. Preserve the original feature geometry/parameters needed outside the clipped display fragment.

Bound spatial work independently of horizon: tiles, columns, total spans, per-column spans, explicit features/triangles, queue depth, bytes and extraction subdivisions all have limits. Reach a limit with a partial/unsupported outcome and exact missing coverage. An achieved coarse spacing cannot be labelled as the requested fine spacing. Preserve mandatory coverage or decline advancement; shorten optional prefetch first. Runtime iteration uses reusable bounded storage and indexed law/state tables.

For the first prescribed-motion extraction fixture only, proposed reviewable limits are 4096 columns, 16384 total spans, 16 spans per column, 128 explicit features, 32768 triangles, 32 MiB source cache and eight shared queued requests. These are synthetic experiment bounds to verify, not engine defaults or measured frame-time promises. Report counts, hits/misses, bytes, queue/backlog and extraction duration separately. Change them only through the fixture's recorded configuration. Later consumers must establish their own sufficient bounds and measured costs.

## 5. Persistent soil and shared wheel history

Immutable base tiles describe undeformed geometry and initial material assignments. A separate authoritative terrain-state store owns rut/deformation, compaction, shear history, displaced mass, water variables when consumed, changed interfaces, feature damage/motion and exposure. Tyre pressure/damage, carcass state and retained rotating mud belong to the tyre model. Contact history links stable participating IDs and the constitutive law, rather than a moving extract index.

For each coupled interval, both wheels read an immutable coherent snapshot. Their contact interactions and overlapping soil influence regions are solved together where mechanically coupled. Commit accepted changes atomically against expected physical versions; advance only dirty cell/feature versions, then publish a new snapshot-membership epoch. If a future reduced model uses sequential splitting instead, its fixed physical substep/commit ordering must be part of the numerical method, tested against coupled controls and recorded. Worker completion order must never decide which wheel sees a rut.

The rear wheel at a later physical time consumes the front wheel's accepted deformation. Coincident contacts at the same time require the selected coupled or explicitly split solve, not two unrelated full-support responses. Aborted/rejected steps discard trial changes. Eviction preserves dirty deltas/checkpoints; reloading a base tile cannot restore undisturbed soil. Reset explicitly chooses initial state or a saved state. Resolution changes need a supported state adapter preserving the relevant material, work and history; interpolating heights alone is insufficient.

Cache geometry and state snapshots do not compute support forces. The eventual force consumer uses the same deformed tyre shape, multiple active patches, gap directions, material/interface state and substrate geometry to distribute normal and tangential response. Cover and buried support share one load path; a full soil reaction plus a separate full rock reaction would double count support. Loads at different contacts share tyre mechanics and combined longitudinal/lateral grip, including camber, slip/reversal and interface shear. Local coordinates/forces transform to world forces and `r cross F` moments at actual application points. Record relative point velocities, equal/opposite exchanges, interval impulses, stored/lost energy and terrain motion/material-transfer work. No scalar axle-height vector can establish local stress, rim strike or 3D grip by itself.

## 6. Worked requests through to the future force consumer

These examples describe proposed receiving behavior. Numbers and material IDs are synthetic; no soil or tyre coefficients are inferred from them.

### Straight travel within a cached patch

Use the straight request in section 2: complete patch x `[1,4]`, y `[-0.2,0.2]` m, requested lead x `[1.52,3.63]`. A flat soil fixture has top z=0.02 m and a known rock interface z=-0.03 m, with known rock geometry down to -0.20 m. For three corridor samples, a compact extract can contain:

```text
topZ       = [ .02, .02, .02 ]          # m, outward normals +z
spanOffset = [ 0, 2, 4, 6 ]
materialRef= [ soil, rock, soil, rock, soil, rock ]
upperZ     = [ .02,-.03, .02,-.03, .02,-.03 ]
lowerZ     = [-.03,-.20,-.03,-.20,-.03,-.20 ]
```

All shown spans have bulk-material kind. All samples refer to the same immutable law records and their respective stable physical cells/state versions; unknown depth below -0.20 m is reported. Moving ahead inside the patch changes extraction positions while source fetch count stays unchanged. The future loaded-tyre consumer queries/distributes contact across the finite footprint, transmits soil load to the support through its chosen law, and updates shared state. The extraction viewer shows columns and geometry only; it does not display these arrays as computed contact force.

### Turn and lateral bump outside the patch

The left-curving request in section 2 reaches y=0.24 m, outside the old y=0.20 boundary. The added tile contains an off-center rounded bump at y=0.23 m. Merge matching source/neighbor data into a complete new patch before the mandatory corridor enters it; extract multiple lateral rows including lean/slip uncertainty. Their top heights/normals/material IDs differ, and the bump's feature reference survives resampling. A centerline-only request could miss it.

The future contact consumer can load an outer tyre region while the centerline remains lower, producing lateral/vertical force components and a wheel moment. It must derive these from contact geometry and mechanics; no force or lean correction is supplied by the cache. The older straight response remains superseded. If new data are late, mandatory admission stops at known coverage rather than flattening the bump. Mirroring the fixture and turn must mirror the extraction and subsequent wrench signs.

### Soil over a stepped rock, including a piercing edge

Author a rock volume spanning x `[5.8,6.4]`, y `[-0.1,0.1]`, bottom z=-0.20 m. Its crown is z=-0.03 m for x<6 and z=0.05 m for x>=6. Surrounding soil has top z=0.02 m. The geometry includes the rock's vertical step face at x=6, z `[-0.03,0.05]`, outward normal `(-1,0,0)`. Below z=0.02 this is a buried soil-rock interface; above it the face is exposed. Rock occupancy removes overlapping soil.

A corridor request spans the face, finite tyre width and required substrate depth. The shown spans are disjoint bulk materials; air and depth coverage are carried in the corresponding masks. Cache both soil/layer data and complete rock feature geometry. Three illustrative columns are `(5.98,0)`, `(6.02,0)`, `(6.02,0.12)` m:

```text
topZ       = [ .02, .05, .02 ]
spanOffset = [ 0, 2, 3, 4 ]
materialRef= [ soil, rock, rock, soil ]
upperZ     = [ .02, -.03, .05, .02 ]
lowerZ     = [-.03, -.20,-.20,-.20 ]
featureRef = stepped-rock-01             # full side geometry retained once
```

Before exposure, the cover law transfers load to the buried rock. On the exposed crown/face, direct rock contact and adjacent soil contact can coexist as distinct supported regions of one coupled tyre. The rock side normal allows an approach impact before the axle reaches the crown; interpolating only `topZ` would replace that face with a ramp. Cover deformation/exposure updates physical state, so the rear extract can differ even with identical source tiles. No independent whole-wheel soil and rock springs are added. Unsupported cover/interface or side-contact capability returns unsupported, even if the cutaway can render it.

### Seam, reversal and domain controls

| Case | Request/cache result | Extract and consumer requirement |
|---|---|---|
| Seam through the stepped face | Fetch both neighbors and feature halo; canonical feature ownership | Same face/layer IDs and normals as an untiled control; one physical contact/state contribution despite duplicated cache halos |
| Stationary steer, then reverse | Retain finite stationary sweep; prefetch behind and invalidate superseded forward extraction | Preserve tyre phase, shear reversal and rut history; no divide-by-speed, height jump or clean-soil reset |
| Known hole or bridge void | Explicit known-air/void coverage plus relevant side/underside geometry | Allow supported separation/bridging only with the complete geometry; columns alone flag unsupported overhang contact |
| Unknown scan cell or domain exit | Partial or outside-domain, with exact missing ranges | Never bridge unknown data or assume hard flat ground; hold/terminate before mandatory consumption unless a verified fallback covers it |
| Dirty tile evicted and reloaded | Reuse immutable base plus latest accepted state delta | Rear/repeated pass sees the same rut/exposure; stale asynchronous extraction cannot resurrect prior soil |

## 7. Deterministic replay and staged receiving gates

Record input motions/commands and accepted simulation intervals, asset content or immutable retrievable hashes, transforms, material/law revisions, source masks, interpolation and extraction versions, numerical precision, request bounds, snapshot membership and physical-state versions. Retain state checkpoints/deltas and stochastic seeds where used. Stable feature/contact mapping must survive tile and layout changes.

Log cancellations, clipping, fallback selection, misses/waits and effective detail schedules. Replay either preloads the immutable content or reproduces recorded availability decisions at simulation synchronization points; it cannot let new network timing change forces or accepted state. Content/version mismatches fail replay visibly. Exact floating-point replay is scoped to a declared build/runtime; cross-platform runs use stated geometric/physical tolerances and event comparisons.

| Gate | Visible receiving slice and foundation | Evidence and explicit limit |
|---|---|---|
| R0: request/cache extraction | Prescribed straight/turn/reverse wheel pose, top/down cutaway of finite swept corridor, Hc/Hp, patch boundaries, hits/misses, columns and feature normals; shared headless records | Independent plane/ramp/step intersections, corner/center import controls, off-center bump, seams/nodata/outside, bounded counts, stale/cancel/reset/lease races and deterministic replay. No dynamic contact or force arrows claimed |
| R1: loaded rigid terrain | The distributed loaded-tyre experiment consumes R0 geometry across width, including two supports and a face | Supported tyre model and physical area semantics, contact creation/removal, load/moment/work balance; refine geometry and tyre discretization independently. Backend contact limits cannot silently drop load-bearing regions |
| R2: layers and shared history | Cutaway soil-over-rock/root with persistent cover and exposure, front/rear and reverse passes | Chosen constitutive/interface laws, bare-support/deep-soil controls, coupled support without duplication, accepted/trial state separation, material/work budgets, depth/layer/state-resolution convergence and calibration envelope |
| R3: rolling 3D traction/fidelity | Same finite-width distribution feeds longitudinal/lateral/camber forces, wheel moments, soil/mud history and bounded detail selection | Combined-slip/near-zero/reversal controls, independent force/moment/work references, verified state transfers and measured costs on declared hardware before corresponding handling/real-time claims |

R0 is the next small balanced slice: an inspectable request, cached extraction and saved evidence. Implement only the request/cache fields and source representations that this named consumer uses. Do not prebuild a universal terrain plugin framework. A request overlay and layer cutaway prove data delivery; later gates receive force generation separately. Existing planar probe and flat-platen controls remain useful independent fixtures.

## 8. Primary-source constraints and open decisions

- [Project Chrono 10.0 terrain documentation](https://api.projectchrono.org/10.0.0/vehicle_terrain.html) separates height/normal/friction queries from underlying deformable contact. Its SCM section describes changed grid nodes in a hash map and bounded moving ray-casting domains. This supports investigating reusable base data and local evolving state; it does not supply arbitrary depth layers, bicycle contact calibration or this request protocol. Its rigid terrain discussion also illustrates why no-hit height-query defaults must not become BikeLab coverage semantics.
- [MuJoCo 3.16.0 pinned XML reference, mesh](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/doc/XMLreference.rst#L1312) states ordinary mesh collision uses the convex hull. The [same revision's height-field section](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/doc/XMLreference.rst#L1726) describes triangular prisms and a 50-contact heightfield/geom-pair cap, discarding excess contacts. Therefore a render mesh/heightmap import is not proof that a backend preserves faces, concavities or all distributed tyre contacts. A future adapter must demonstrate the exact geometry/contact capability it consumes; no terrain backend is selected here.
- GDAL's linked import references establish raster placement and missing-data semantics. They provide no mechanical soil parameters, hidden-feature measurement or contact model.

The request/cache/state/schema choices above are BikeLab proposals, not requirements attributed to those libraries. Before R1/R2, resolve the actual tyre compliance/contact formulation, finite-cover and interface laws, admissible deformation/support depth, spatial error budgets, side/overhang collision strategy and shared-state integration. Before a real-time claim, measure loading/extraction and coupled-solver cost distributions under admitted worst-case geometry and both-wheel activity. Preserve parameter provenance, physical uncertainty and unsupported outcomes throughout.
