# Terrain sampling request: first checkpoint

User direction, 2026-10-16: define the simulation engine's terrain request first, then its cache/extraction path and efficient layered response. Push this work incrementally in its own PR. GPT-6.1 Sol is developing the detailed contract; this checkpoint captures the scope before the design is finalized.

The request must cover terrain starting just behind the wheel and ahead of it according to velocity, turning and the actual finite contact envelope. Cornering and lateral displacement can move the required region beyond a cached height patch. Straight riding can extend lookahead on demand; off-patch requests must acquire newly needed data without silently extrapolating the old patch.

Trace authored trail heightmap/geometry and material/layer data through immutable spatial cache patches, shared evolving soil/deformation state and per-wheel extracted samples into contact/force calculation. Define request identity, coordinates, time/generation, required versus prefetched coverage, cancellation, stale results, cache revisions, seams and bounded work. Missing required data must remain explicit, never become fabricated flat/hard ground.

Sketch an efficient vector/array representation for top surface and variable-depth layers at each sample, with material/constitutive references, softness/compliance meaning and units, boundaries and exposed geometry. Soil over rock and a concealed rock edge just piercing the surface are required examples. Vertical columns must state their limits and retain explicit geometry for faces/overhangs that a single height cannot express. Thin root reinforcement is distinct from a load-bearing buried root body.

The force consumer must retain distributed deformable-tyre contact, local normals/load/material, resultant moments and a shared traction budget. A nearest-point probe or array of independent whole-wheel springs is insufficient. Connect representation and cache ownership to persistent deformation, front/rear soil history, retained tyre mud and supported fidelity-tier transfers.

Next checkpoints: (1) request/corridor and cache handshake; (2) layer/vector layouts and source translation with worked examples; (3) review corrections and staged receiving checks. This PR is design work, not a claim that a terrain cache or deformable contact solver is implemented.
