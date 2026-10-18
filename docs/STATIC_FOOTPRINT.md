# Static distributed tyre footprint (D1a)

`bikelab-static-radial-ring-0.1` is a separate, prescribed-pose, uncalibrated planar experiment. Open `footprint.html` or run `node scripts/footprint.mjs [setup-or-record.json]`. The default is flat ground at 15 mm nominal indentation. Built-in examples include a sampled rounded rock, shallow loading on a square step's top, two rounded supports, and explicitly unsupported sharp-edge/rim-strike poses. The bicycle rig still uses its previous lumped moving-platen contact.

## Mechanical contract

Hub x is forward, height z is upward, and positive rotation/moment My is nose-down, consistent with the bike rig. Radius and rim radius are metres. All ring nodes have only an inward radial displacement u; radial guides transmit transverse reactions to the imposed hub. Circumferential smoothing couples adjacent displacements. There is no tangential casing degree of freedom, inflation, finite width, area, stress, material hysteresis, gravity, wheel inertia or rolling.

For n uniform material nodes, reference arc spacing ds = 2πR/n, foundation k in N/m² and smoothing T in N:

`E(u) = ½ k ds Σ uᵢ² + ½ T/ds Σ (uᵢ₊₁ − uᵢ)²` (joules, periodic indices).

Each outward ray finds its first entering intersection with the authored solid-below profile. The bound is `lowerᵢ = max(0, R − distanceᵢ)`. Solve the strictly convex quadratic energy subject to `u ≥ lower`. Exact cyclic coordinate minimization uses diagonal `k ds + 2T/ds`. Stop when the maximum diagonally scaled projected residual is below 1e−7 N; reject after 30000 sweeps. This is a bound-constrained static solve, not a transient contact integrator. Positive k guarantees uniqueness; arc weights prevent resolution from multiplying stiffness.

At an active node, the inward radial multiplier is `λᵢ = ∂E/∂uᵢ`, in N. For outward radial unit vector e and terrain outward normal n, physical normal force is `Nᵢ = λᵢ/(−n·e)`. Report `Fᵢ=Nᵢn` at the deformed node. Ground resultant is the sum, and hub moment is `My=Σ[(zᵢ−h)Fxᵢ−(xᵢ−cx)Fzᵢ]`. Holding force/moment is its negative. These mappings agree with `−∂E*/∂(cx,h,rotation)` away from feature/active-set transitions. They do not imply measured tyre stiffness or a contact pressure distribution. Changing mesh rotation exposes discretization phase; it is not a rolling simulation.

The original checkpoint used the opposite scalar moment convention; this receiving version names the corrected field `momentY`. Primary contact conventions and review are linked in [iteration 13 review](ITERATION_13_REVIEW.md). The energy above is an authored illustrative surrogate; those references do not calibrate it as a tyre.

## Geometry, bounds and unsupported states

Accept the existing explicit profile schema: ordered [x,z] points, linear interpolation, SI units, solid below, provenance and at most 2048 points. Equal x preserves a vertical face. No extrapolation, overhang, soil layers or arbitrary unordered cloud is inferred. `solveFootprint(params, profile)` uses the supplied profile verbatim; the result owns a clone. `terrainSegments` controls built-in arc generation only; an imported profile is authoritative until a built-in example is selected.

Accepted setup ranges: x ±0.45 m; h 0.1–0.7 m; R 0.25–0.45 m; rim 0.15–0.4 m with more than 20 mm radial clearance; k 50000–1000000 N/m²; T 0–200 N; rotation ±π rad. Tyre nodes are 64/128/256/512/1024. Arc subdivisions are 32/64/128/256/512. Defaults are R=.36 m, rim=.29 m, k=300000 N/m², T=30 N, 512 nodes and 128 arc segments. All are illustrative. A request outside these bounds is an input error; an admitted setup may still return unsupported geometry.

Reject hub burial, out-of-domain tyre envelope, exact rigid-rim contact/penetration, required radial displacement reaching the rim, failed convergence, active ambiguous corner normals and `−n·e < .05`. The independent rigid-circle rim query checks between tyre rays. Maximum-principle smoothing cannot exceed the largest prescribed radial bound. Never continue through rim contact with an invented deformation or strength.

Connecting straight chords between ring nodes can cut across convex terrain even when all nodes are feasible. Partition chords at terrain x breakpoints, include one-sided vertical-face checks, and reject contour intrusion above 0.2 mm. This is an explicit geometric admission tolerance, not a contact penalty or calibrated compliance. Finer resolution is useful for smooth surfaces but does not guarantee monotonic admissibility near sharp corners. Unsupported results carry the setup/profile/reason and available diagnostics, with no deformed outline or loads. The viewer then shows only undeformed/rim reference circles.

The square-step-top example is not a sharp-corner solution. Receiving an exposed corner needs an explicit normal-cone/feature constraint or a justified feature-aligned mesh with consistent nonuniform energy weights. Finite edge radius and supported local mechanics are prerequisites for peak-stress predictions.

## Replay and viewer

Saved records retain complete settings, profile, units/provenance, status, nodes, local normals/forces and resultant/energy diagnostics. Imports require the exact model and all settings, then recompute outputs instead of trusting stored forces. CLI accepts a partial setup with declared defaults or a complete saved record; exit 0 means solved, 2 unsupported, 1 invalid. File inputs are limited to 2 MiB. Results are deterministic for the same supplied geometry and settings; browser/Node agreement has a numerical gate.

The worker owns each solve. Edits, cancel, supersession and page hiding invalidate in-flight work; export is disabled until an applied result exists. Restore returns to the last applied setup. All active nodes are drawn and listed; local arrow lengths use a common displayed scale, whereas the resultant arrow shows direction with its magnitude in the readout. Whole-wheel and contact-detail views preserve equal geometry scale. The render path does not change the mechanics.

## Receiving and follow-up

Independent tests enumerate small quadratic active sets, check feasibility/complementarity, compare minimized-energy derivatives with Fx/Fz/My, integrate conservative holding work, and refine tyre and terrain separately. Flat separation, mirrored/two-support loading, segment subdivision, rim/domain/corner rejection and owned complete replay are included. [Iteration 13 evidence](ITERATION_13_EVIDENCE.md) distinguishes numerical, browser and physical evidence.

D1a is the beginning of distributed contact. D1 still needs corners and physically supported tyre construction; D2/D3 add dynamic wheel/whole-bike motion. D4/D6/D7 add shear, finite-width 3D lateral/turning and layered material response. Rim/spoke/bead failure, tubeless leakage, mud retention, scanned/ML terrain provenance and measured adaptive/multirate operation remain explicit requirements in the [connected delivery plan](DYNAMICS_DELIVERY_PLAN.md).
