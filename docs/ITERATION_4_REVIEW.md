# Iteration 4: merged baseline review and spatial fixture

Baseline: main 672e5e74adeeaa968a4620724e7380052ac35d51 (PR #2), reviewed 2026-10-15. The local snapshot tree was checked against upstream efd4280be9d4f4c5ca7d05e2181ea68c0eb3667d before implementation.

## Prior work reviewed

Reviewed the merged architecture, layered-terrain/fidelity contracts, analytical reference implementation, worker sidecar/transfer ownership, viewer overlays and configuration gating, CLI, tests, browser checks and iteration 3 evidence. The previous iteration records Windows/Linux and Chromium evidence; it does not claim physical calibration. The candidate force laws and saved schemas were unchanged by that merge.

The reference uses well-conditioned repeated-root/strong-damping limits, conservative travel eligibility and recorded-time error limits. Unsupported moving-base/asymmetric-damping/stopped runs cannot receive a pass. A reference setup action changes the setup explicitly. No blocker was found in this bounded reference comparison.

Local review exposed a test-diagnostic weakness: spawnSync can report an error even with a misleading zero status in this restricted environment. Assert process creation success before interpreting CLI output/exit codes. Do not skip these tests or treat local child-process/socket restrictions as product test passes; use unrestricted CI for the complete suite and browser evidence.

The layered-terrain document already includes finite loam/mud cover over supported roots, reinforced soil versus explicit woody features, tyre coating/packing history, combined traction and scanned/generated provenance. Carry those requirements forward rather than inventing an unused material schema. The component failure and 3D contracts remain mandatory. Current suspension stops on an attempted stroke exit; it does not break parts or simulate stop impulses.

## Bounded receiving decision, before code

Add a shared browser/headless **spatial geometry probe** to supply the first concrete spatial fixture for multibody/contact evaluation. Use a rigid circular wheel outline and a finite, ordered planar polyline. Retain vertical faces. Inspect flat, rounded-polyline and square obstacles, editable SI points, nearest boundary locations, approach normals and circle clearance. This is the geometry prerequisite of T0, not the complete dynamic T0 acceptance experiment. No solver selection or whole-bike implementation is implied.

Use the point-to-segment projection derived in [David Eberly, Distance Between Point and Line, Ray, or Line Segment](https://www.geometrictools.com/Documentation/DistancePointLine.pdf), read before implementation. For endpoints A/B and centre C, t=clamp(dot(C-A,B-A)/dot(B-A,B-A),0,1), Q=A+t(B-A). Minimise |C-Q| over all segments. Clearance is that distance minus the circle radius. For an exterior centre and nonzero distance, the approach normal points from Q toward C. Shared endpoint witnesses are deduplicated; distinct co-nearest points are retained. This is a clearance witness set, not a finite contact manifold, force/pressure distribution or corner stress law.

Declare metre coordinates, x-forward/z-up axes, linear interpolation, solid below the profile and illustrative/measured/synthetic provenance. Reject ambiguous ordering, degenerate or reversing vertical edges, unknown fields/unsupported geometry and unbounded input. Do not extrapolate beyond the authored domain: require the entire horizontal circle footprint inside it. A buried centre or a centre on the boundary returns unavailable. A negative clearance is geometric overlap of the prescribed outline, not admissible dynamics or measured tyre compression.

Keep this receiving fixture separate from the existing temporal platen force law. Do not apply a complete tyre spring independently at each point. No soil stiffness, friction, damage thresholds, adaptive rate or live physics swap is introduced. The future solver must prevent invalid motion, transfer actual point loads/work and stop unsupported failure states.

Preregister geometry gates: analytic flat/inclined face/corner results within 1e-10 m and unit normals within 1e-12; preserve vertical faces, co-nearest witnesses and subdivision-invariant clearance; compare sampled circular obstacles with their independent circle-circle distance and the polygon sagitta bound. Verify input limits, domain edges, buried/boundary centres, JSON round trips, visible invalid-input handling and browser/headless agreement. No performance or physical-fidelity claim follows from these gates.

Candidate solver research will compare actual upstream capabilities with the full-bike coordinate, constraint, contact, overload and layered-terrain requirements. A capability matrix narrows candidates; executable coupled trials remain necessary before selection. Keep native/3D extensibility and the eventual setup/ride/replay experience explicit.
