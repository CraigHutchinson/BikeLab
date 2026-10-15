# Layered terrain, traction and tyre contamination

Status: required design and acceptance contract added in PR #1 on 2026-10-15. No layered-soil, slip, root, contamination, scan-import or ML physics is implemented by this change. The current stations remain the loaded wheel and axial spring/damper. This contract extends [spatial contact](TERRAIN_CONTACT.md), [3D dynamics](THREE_DIMENSIONAL_DYNAMICS.md) and [overload/failure](OVERLOAD_AND_FAILURE.md).

## Decision and first consumer

Integrate the data boundaries and experiments now. Implement them in staged spatial-wheel and rolling-contact experiments, before claiming realistic off-road traction. A surface-name-to-friction lookup cannot be the whole terrain model. The first consumer is a wheel crossing a finite mud/loam cover over an embedded root, with a cutaway view of soil, root and tyre deformation and separate normal/tangential load paths.

The rider should eventually encounter the same hidden obstacle and persistent rut that the solver uses. Inspection mode can reveal the substrate; ordinary trail rendering need not reveal buried features. Show measured, inferred and synthetic geometry/materials distinctly in the laboratory.

## Separate physical responsibilities

| Entity | Owns | Required exchanges |
|---|---|---|
| Geometry asset | Undeformed surfaces, layer volumes/boundaries, embedded features, frames and spatial IDs | Candidate contact geometry; collision and rendering share the same revision |
| Material definition | A named, versioned constitutive law and parameter set with units, provenance and applicability | Stress/deformation and internal-state rules; not a visual colour or universal friction number |
| Layer and interface | Finite thickness, lateral extent, composition and bonding/sliding/separation relationships | Load transmission, layer depletion/exposure and inter-layer shear |
| Embedded rock or root | Shape, orientation, support/anchorage, compliance and failure policy | Local reactions and any deformation, pull-out, movement or fracture |
| Soil state | Elastic/plastic deformation, compaction, shear history, displaced material, water state when consumed | Persistent ruts, berms, changed layer boundaries and root exposure |
| Tyre state | Casing/tread mechanics and retained coating or packed tread voids | Contact geometry, traction response, pickup/transfer/shedding and associated mass/work |
| Contact solver | Coupled tyre/material/interface response at actual contact regions | One consistent force/moment/energy exchange, including mixed-material patches |
| Asset streaming | Immutable base tiles and versioned state deltas | Stable IDs, deterministic loading, saved deformation and bounded active working set |

Keep material properties, initial conditions and evolving state separate. Water content, saturation and pore pressure are different quantities; define which a selected law consumes. Likewise, dry bulk density, porosity and compaction are related rather than independently random sliders. Represent unresolved quantities explicitly. A descriptive tag such as loam, sticky mud or dusty hardpack selects an authored recipe, not validated numerical properties by itself.

## Mud over a root: required mechanics

1. A finite deformable cover lies above and around an explicitly located root. The wheel first loads the cover; soil compression and shear transmit reactions to the root and surrounding support even before the root is exposed. Do not wait for visual root contact to make the substrate mechanically relevant.
2. Resolve tyre deformation separately from soil deformation. A law fitted to the total tyre-plus-soil sinkage cannot also be applied as independent tyre and soil compliance without double counting.
3. The cover may compact, flow or shear depending on its supported law, water state and history. It can cushion part of an encounter, but must not be assumed always to reduce the peak load. Speed, thickness, confinement and drainage affect the response.
4. A rooted woody feature is not automatically rigid because it is large. Diameter, unsupported span, orientation, wood condition, anchorage and surrounding soil determine bending/support. A rigid root is an explicit bounded approximation, with evidence for the tested load range.
5. Fine fibrous roots can be represented initially as a calibrated reinforced-soil composite: orientation/density, tensile mobilisation, anchorage and pull-out/failure matter. This is distinct from resolved obstacle contact. Do not count the same root network both as additional composite strength and as explicit reinforcement.
6. When cover moves or wears away, transition from tyre-soil contact to a mixed soil/root patch and possibly direct root contact. Interfacial soil-root sliding can limit traction before either bulk material fails. Preserve displaced material, traction history and stored energy through the transition.
7. Root and rock shapes may share geometry for controls, but material, compliance and support remain separate. Wet wood, dry wood, bare rock and coated rock need evidence for their respective interface laws; a universal friction ordering is not prescribed.

The whole load path is coupled. Do not add a full rigid-root reaction to an independent full soil-support reaction for the same occupied region. Embedded-feature volume displaces soil; contact partitions and coupling must prevent double occupancy and duplicated load/traction capacity.

## Slip, shear and carried contamination

Normal deformation changes patch size and which layers carry load. Tangential loading may mobilise tyre-interface slip, bulk soil shear, root-soil interface slip and material displacement. A tyre law must account for those distinct mechanisms and transient history, including reversal, braking, drive, camber and lateral slip. Soil rolling/compaction resistance is not automatically rubber sliding friction.

Use one supported combined tangential response for each coupled patch. A simple friction ellipse may be a reduced approximation on a declared surface; it is not assumed to describe yielding layered soil. No multiplication of total grip by contact-point count or independent full longitudinal/lateral grip budgets. At zero/reversing speed, use documented relative contact velocities and a supported slip/adhesion transition; avoid dividing by an unboundedly small speed.

Mud pickup, tread packing and shedding require state attached to the rotating tyre, not just the terrain tile beneath it. Track a supported distribution around/across the tyre or justify a calibrated aggregate. Carry that state onto the next root/rock/dry section and through contact loss. Clean/dirty tyres can therefore encounter the same ground differently. Tread void capacity, coverage and layer thickness are distinct; all need bounds.

A later transfer law must account for removed soil, retained coating and deposited/shed material, plus moisture when modelled. Include carried mass/inertia and transfer momentum/work when material amounts affect dynamics, or quantify the neglect in the approximation envelope. Shedding cannot create material, refill a depleted layer or erase dissipated work. Unsupported adhesive tensile contact must not be silently added to the present unilateral contact model.

Dry crumbly soil and dust need grain/aggregate breakdown, loose surface material and transport where they affect traction. Visual dust particles may remain cosmetic; they must not secretly alter grip. Material recipes should allow independent controlled variations in moisture, packing, fines and tread state with physically compatible bounds. Do not assert a monotonic wetness-to-grip curve across all soils.


### Deformation, spin and retained mass

Mud release must respond to tread/carcass deformation and unloading as well as wheel rotation/acceleration. Material can remain as small masses between blocks, including within the contact region. A reduced model may carry bounded mass/packing by rotating angular sectors, with declared width resolution; a uniform aggregate is acceptable only where its error is measured. Include carried inertia/imbalance or quantify neglect, and distinguish wheel-attached material from soil still bearing against the tread. Release depends on retention/adhesion, cohesion, confinement and water state; a universal RPM-to-clean switch is not supported.

Use stationary compression/unloading, unloaded spin and combined rolling controls to isolate mechanisms. Preserve material, momentum/work accounting and release state through the transition to deposited or shed material. The [system-wide fidelity contract](PHYSICS_FIDELITY.md) defines detailed references, cheaper approximations, parallel/shadow comparisons and verified state transfers. Physics LOD must preserve coating and soil history.

## Data-oriented authoring contract

Author reusable material/law records and spatial fields, then compile them into bounded tile/feature tables for simulation. The eventual runtime should query immutable parameters and update preallocated state, rather than parse JSON or allocate a new material object per contact. No executable user expressions are needed for initial recipes.

| Record | Minimum meaning before its first runtime consumer |
|---|---|
| Asset manifest | Schema revision, immutable content hashes, units, local frame and survey transform/datum, extent, acquisition/generation metadata and licence |
| Geometry fields | Surface and layer-boundary coordinates in m; interpolation and masks; support for non-height-field features; uncertainty and unresolved/occluded regions |
| Layer table | Stable IDs, material references, bounded volume/thickness fields, initial state, interface references and explicit ordering/overlap policy |
| Material/law table | Law ID/revision, required parameter names/units, fitted dataset/revision, admissible conditions and uncertainty; unknown or incompatible law IDs rejected |
| Feature table | Stable geometry ID, material, world transform, embedding/support conditions, resolved-versus-composite representation and failure policy |
| Interface table | The two participating phases/materials, friction/adhesion/shear-transfer law, separation conditions and matching evidence |
| Initial state | Soil compaction/shear/water state and tyre contamination, with explicit clean/undisturbed reset semantics |
| Run state | Changed soil/feature/coating state, time, constitutive histories, damage, content revisions, stochastic seeds and effective detail schedule |

Required SI meanings include density in kg/m3, thickness/length in m, stress/modulus/cohesion in Pa, force in N, displacement-based shear scales in m and angles in rad. Law-specific parameters must declare dimensional conventions: an empirical pressure-sinkage coefficient's units can depend on its exponent. Do not equate soil cohesion with tyre adhesion. External degree-based angles need explicit conversion.

This is an illustrative **authoring sketch**, not an accepted file format or runnable scenario. Dimensions are synthetic fixtures, not measurements. The future loader must reject it until all referenced geometry, laws and initial state have been supplied and validated.

```json
{
  "designRevision": 1,
  "id": "mud-over-root",
  "provenance": "synthetic acceptance-fixture sketch",
  "frame": "local-x-forward-y-left-z-up",
  "targetDetailSpacingM": 0.01,
  "layers": [
    {
      "id": "cover",
      "materialRef": "measured-or-illustrative-wet-loam",
      "geometryRef": "finite-cover-volume-around-root",
      "coverAboveRootCrownM": 0.015,
      "interfaceRef": "loam-to-root"
    }
  ],
  "features": [
    {
      "id": "root-01",
      "geometryRef": "transverse-root-shape",
      "nominalDiameterM": 0.06,
      "materialRef": "wood-with-declared-condition",
      "supportRef": "anchored-root-and-surrounding-soil"
    }
  ],
  "initialStateRef": "undisturbed-soil-clean-tyre",
  "requiredCapabilities": ["finite-layer-deformation", "embedded-feature-coupling"]
}
```

Compile-time/import validation must catch unknown keys, missing references, incompatible units/laws, negative thickness, invalid fractions, nonfinite fields, ambiguous intersections, duplicate IDs and inconsistent initial state. Define zero-thickness removal, empty tiles, domain exits and unsupported combinations explicitly. Provide a capability report before the run; missing soil or adhesion capability must not silently become rigid ground with default friction.

Spatial variation needs correlation lengths, directionality, joint parameter constraints and reproducible seeds. Independent white-noise friction at each centimetre is not a physically justified surface. Distinguish parameter uncertainty from real spatial variability. Save generated field content or an immutable generator/runtime and seed sufficient to reproduce it, not merely a user-facing preset name.

## Scanned trails and 1–2 cm detail

Treat 0.01–0.02 m as a target spatial sampling scale where justified, separately from survey accuracy, minimum resolved feature size, tyre/contact discretisation and integration timestep. Features smaller than the grid may require explicit geometry, a calibrated effective law or an explicit unresolved-feature limitation. Refine feature radius/contact area and timestep independently.

Preserve original LiDAR/photogrammetry data, acquisition conditions, point density, registration uncertainty, coordinate/datum transform, classification confidence and processing history. A bare-earth DEM can discard riding-relevant roots, rocks and vegetation. Optical surface scans alone do not measure buried roots, layer thickness or mechanical strength: use separate measurement or labelled inference, and retain unknown regions.

ML-generated detail is synthetic conditional detail unless independently measured. Store the generator/model revision, conditioning assets, seeds, masks and final generated asset hashes. Keep original observations and generated residual detail separate. Do not invent a buried root and label it scanned, or use plausible texture as evidence for cohesion, moisture or friction. Validate generated geometry/material correlations against held-out trail measurements and compare multiple plausible realisations. Rejected or uncertain generated regions must be visible to the author.

Use tiled immutable base data with sparse persistent deformation/state deltas, predictive loading and local coordinates for numerical precision. A 10 km by 2 m corridor at 1 cm spacing has about 200 million surface cells, before layers or state; uniformly detailed full-trail dynamics is not the starting implementation. Determine active-region size from swept contact, soil/feature coupling range and margins, not only the visible tyre footprint.

Tile seams, changing resolution and eviction/reload must preserve geometry, mass, moisture where consumed, history, root anchorage and tyre contamination. Front and rear wheels operate on shared evolving terrain, including the front wheel's rut. Do not regenerate an undisturbed tile when it re-enters view. Render detail may differ from collision detail only with documented mechanical error bounds. Compare active-region/adaptive runs against a converged larger always-detailed domain.

## Staged delivery and acceptance

| Gate | Visible consumer and foundation | Required evidence |
|---|---|---|
| T0: spatial rigid controls | Wheel over flat, round and finite-radius edged fixtures; contact/force overlay | Existing spatial-contact geometry, normals, moments and convergence gates |
| T1: finite cover over support | Cutaway wheel/root fixture with independent tyre/soil compression, layer boundaries and reaction paths | Homogeneous-soil and bare-root controls; no doubled support; load/unload work, plastic state, thickness/mesh/timestep convergence |
| T2: rolling layered traction | Driven/braked/oblique wheel over covered root, with slip, shear and force plots | Zero/reversing speed, mixed-material patches, combined-slip response, repeated passes, front/rear shared ruts and held-out calibration |
| T3: carried material and roots | Clean/packed tread comparisons through mud-to-root-to-dry transitions; reinforced-soil and supported-root controls | Transfer mass/work accounting, pickup/shedding, contact loss, root bending/pull-out or explicit unsupported stop, state save/reset/replay |
| T4: detailed trail ingestion | Scan/ML provenance view, generated-detail toggles and tiled trail replay | Independent scan accuracy; generated-vs-observed distinction; seam/eviction/resolution invariance; performance on declared hardware |

T1 starts with a declared reduced soil law and rigid buried feature if that approximation is justified. It does not require full particle/fluid simulation, but it must demonstrate how cover and substrate share load. T2/T3 are prerequisites for corresponding realistic off-road traction claims. T4 does not waive those physics gates.

Prime the regression family with bare root, equal-shaped rock, homogeneous deep soil, several finite covers, a well-supported versus compliant root, reinforced versus unreinforced soil, and clean versus coated tyres. Vary cover depth, water/packing state, load, pressure/tread, approach angle and speed only within evidenced law envelopes. Include thin/vanishing cover, complete exposure, unresolved fine roots, patch boundaries, reverse passage, repeated loading and two wheels on the same rut. Predetermine tolerances for force/impulse, sinkage, tangential response, work/material budgets and event timing. Do not prescribe a universal force or grip ranking.

Required observations: normal/tangential wrench and slip, tyre/soil/root deformation separately, loaded/exposed phase IDs, cover thickness, soil plastic/shear history, coating coverage/material transfers, energy/work and uncertainty. Compare synthetic reference solutions first, then controlled physical fixtures with measured layer/root/tyre conditions. Trail footage and plausible animation alone do not establish physical fidelity.

## Primary evidence and applicability

These sources constrain the design; they do not validate a BikeLab terrain implementation or select its solver.

- [Chrono 10.0 terrain documentation](https://api.projectchrono.org/10.0.0/vehicle_terrain.html) describes SCM node deformation, pressure-sinkage behaviour, position-dependent soil parameters and separate granular/FEA models. Its documented SCM callback varies parameters across the terrain plane; that alone is not evidence of arbitrary depth-layer and buried-root coupling. Candidate evaluation must demonstrate those mechanisms and bicycle tyre/camber compatibility.
- [NASA terramechanics white paper, Li and Bingham (2022)](https://ntrs.nasa.gov/citations/20220010732) distinguishes soil compression/bulldozing resistance and available tractive force. Lunar rover soil values are not wet forest-soil or bicycle-tyre calibration.
- [Hales et al. (2009), root reinforcement](https://research.fs.usda.gov/treesearch/33750) reports measured root distributions/tensile strength and spatial variability of root cohesion. It supports treating roots and their environment explicitly; slope-scale results do not establish tyre-scale transient reinforcement, a diameter-only stiffness rule or BikeLab coefficients.
- [Schwalbe Dirty Dan product description](https://www.schwalbe.com/dirty-dan-11654177) identifies mud-specific tread and self-cleaning as design concerns. Manufacturer descriptions motivate contamination/tread experiments; they do not supply a quantitative transfer or traction law.
- [USGS LiDAR deliverables requirements](https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-deliverables) distinguish density/spacing assessment, accuracy evidence and derived DEM products. BikeLab's 1–2 cm target is not a statement that an arbitrary LiDAR dataset has centimetre accuracy or resolves buried features.

Open research: a calibrated finite-layer load-transfer law, bicycle-relevant combined slip on deformable soil, wet wood/rock interface data, soil-root reinforcement at contact scale, mud retention/shedding and physically constrained generated terrain. Resolve each against a named experiment before adding its runtime settings.
