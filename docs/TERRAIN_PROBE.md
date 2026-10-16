# Spatial clearance probe

This receiving geometry fixture implements the first prerequisite for T0 and the candidate-solver experiment. It does **not** complete the dynamic spatial-contact gate. Use Spatial terrain in the laboratory navigation, or:

```sh
node scripts/probe-terrain.mjs
node scripts/probe-terrain.mjs profile.json
node scripts/probe-terrain.mjs profile.json -0.2 0.36 0.36
```

The optional numbers are centre x, centre z and radius, all metres. With no arguments the square reference and `[-0.2,0.36]`, radius `0.36`, are used. Exit 0 means a geometry query was available, including negative clearance; 2 means the requested query is outside the model's domain; 1 means invalid input/I/O. Exit 0 is not an impact-safety or physical-validation result. Reports go to stdout; there is no output-file overwrite action.

## Authored profile and saved evidence

The viewer accepts full profile JSON through the editor or Load profile JSON. It retains the current circle position when a profile changes; controls mark edits until applied. A rejected edit retains the last applied drawing, disables report saving and shows an error. Restore applied setup restores the applied profile **and** circle position. Late file reads cannot overwrite a newer edit. A preset replaces profile/position edits with the preset and last applied circle position.

Example flat fixture:

```json
{
  "format": "bikelab-profile-1",
  "units": "m",
  "axes": "x-forward,z-up",
  "solid": "below",
  "interpolation": "linear",
  "source": {"kind": "illustrative", "description": "Synthetic rigid flat control."},
  "points": [[-1, 0], [1, 0]]
}
```

Points are ordered `[x,z]` pairs. x must be nondecreasing; equal x retains a vertical face. Consecutive vertical edges cannot reverse/overlap. Segments must be at least 1 micrometre long. The profile must span x, contains 2–2048 vertices and uses coordinates within ±1000 m. Radius is 0.01–2 m. Source kind is `illustrative`, `measured` or `synthetic`, with a 1–1000 character description; that label records author provenance, not independently verified accuracy. All fields are required and unknown fields are rejected. The JSON/file limit is 256 KiB (UTF-8). Overhangs, meshes, layers and material laws are unsupported.

Save probe report exports the complete profile, prescribed position/radius, model version, tie tolerance, availability and computed geometry. Its `profile` property is the standalone profile accepted by the editor/CLI; the entire report is not a profile file. To reproduce an exported report headlessly, use `probe(report.profile, report.setup)` from `dist/terrain.js`; loading a profile alone does not verify previously saved evidence. Profile feature IDs are zero-based indices scoped to that exact profile, not persistent scanned-trail IDs.

The flat control is z=0. The square is 0.2 m wide and 0.1 m tall with explicit vertical faces. The rounded control samples a 0.1 m radius semicircle at 32 equal angular segments; it has the same footprint/maximum height as the square, not the same area or curvature. No smoothing, collision margin or guessed corner radius is applied. Changing subdivision changes the approximating geometry and is recorded in the full point list/source description.

## Query meaning

The projection method and sign mapping are documented in [the pre-implementation review](ITERATION_4_REVIEW.md), based on Eberly's primary derivation. `distance` is minimum Euclidean centre-to-boundary distance; `gap=distance-radius`. Positive is separation, zero contact, negative overlap of the prescribed circular outline. This overlap is not a deformation/stress prediction and is not advanced through a dynamics solver.

For each nearest boundary witness the normal is a unit vector from terrain point toward circle centre. At a corner this radial approach direction need not equal either face normal. Ties within 1e-10 m retain distinct features; shared vertex indices are emitted once. The witness set is **not all potential deformed-tyre contacts** or a full contact manifold. In particular, it supplies no rule for distributing load among different penetrations. Subdividing a face must not multiply future stiffness.

The full horizontal circle footprint must remain inside the authored x extent; no endpoint extrapolation is allowed. A centre inside the solid-below region, or within 1e-10 m of its boundary, returns unavailable without gap/witness fields. The latter avoids an undefined normal. On-boundary/buried admission is separate from negative clearance for an exterior centre. This conservative fixture is unsuitable for deep penetration recovery or tunnelling detection. A swept query/event detector is still needed before dynamic impacts.

The viewer fits circle and terrain at equal x/z scale and draws nearest points, unit-direction arrows and a scale bar. An arrow's drawn length is fixed for legibility, not a force or a physical normal displacement. Synchronous queries are bounded by the vertex limit; no live multirate scheduler or deadline guarantee is claimed.

## What remains

Force/work transfer, finite-area tyre deformation, pressure, component stress/failure and suspension stop impacts require the models and tests in [TERRAIN_CONTACT.md](TERRAIN_CONTACT.md) and [OVERLOAD_AND_FAILURE.md](OVERLOAD_AND_FAILURE.md). Keep admissible travel and explicitly stop unsupported post-failure states. The current suspension station's stop behaviour is unchanged.

The authoring format intentionally consumes only rigid planar geometry. Future layered mud/root/rock material laws must follow [LAYERED_TERRAIN.md](LAYERED_TERRAIN.md): separate cover/tyre/substrate deformation, root support/reinforcement, shared soil history and retained tyre material. This probe does not turn a point cloud or ML detail into physical evidence. Future 3D meshes, lateral/combined-slip traction and adaptive fine contact remain separate receiving gates.

Explicit follow-up: the [loaded tyre/distributed-contact experiment](TERRAIN_CONTACT.md#follow-up-deforming-tyre-and-distributed-contact-user-request-2026-10-16) will replace nearest-witness interpretation with a supported deformation/load-sharing model and visualization of all active regions. Local grip must consume that distribution. This probe remains a rigid geometry diagnostic.

The [request/cache/layer contract](TERRAIN_SAMPLING_CONTRACT.md) defines the next terrain-data slice: finite swept wheel coverage, off-patch acquisition, compact depth spans and explicit side geometry. Its R0 viewer will show extraction and cache state before forces are introduced.
