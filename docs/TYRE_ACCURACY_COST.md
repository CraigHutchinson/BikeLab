# Tyre accuracy and computational cost contract

User direction, 5 November 2026: the model must be accurate and computationally efficient. "Optimal" is a constrained engineering choice, not an unmeasured claim. Select the least expensive formulation that meets a declared physical/numerical envelope. Current PR96 is a constitutive diagnostic, not a calibrated tyre.

## Reference findings and decision

Renart and Roura-Grabulosa, [Deformation of an inflated bicycle tire when loaded](https://arxiv.org/pdf/1902.03661), sections 2–3: a thin, inextensible truncated toroidal membrane carries pressure-induced tension; unloaded local forces balance internally. Its static small-load response is approximately proportional to deflection to the 3/2 power. Road and MTB specimens were tested after locally grinding tread. These are useful static checks, not validation of knobby-tread impacts, inserts or rolling loss.

Vu et al., [Dynamic analysis of a tire using a nonlinear Timoshenko ring model](https://past.isma-isaac.be/downloads/isma2012/papers/isma2012_0212.pdf), sections 2–4: a deformable beam ring with radial/tangential rim-attached springs includes inflation prestress. It assumes unchanged cross-sectional area and compares with Abaqus. Its automotive parameters and finite-element agreement cannot establish bicycle calibration.

Our decision from these sources: retain a reduced 2D model as the candidate runtime architecture, but implement an independent bicycle static reference before choosing the replacement constitutive law. A planar annulus times arbitrary width must not be relabelled true tyre volume. A freely inflated equilibrium requires material/rim geometry and pressure gradients, not a constant outward force added to today's springs.

## Ordered implementation

1. Independent static reference: implement the bicycle paper's cross-section solve and load/footprint integration, with explicit axis, radius, width, pressure and units mapping. Verify zero load, small-deflection asymptote, quadrature/root convergence and reproduced published conditions. Keep constant-pressure assumptions separate from PR96's sealed polytropic chamber. Render cross sections, load/deflection and footprint, saving complete inputs and source provenance. Published-figure digitization has uncertainty and must not be presented as raw measurements.
2. Choose the reduced casing law using that reference and available measurements. Compare an effective pressure-dependent ring/foundation with an explicit gas-volume plus casing-energy model. Identify which foundation contributions are material and which encode pressure; never add both for the same mechanism. Require a realizable stress-free configuration, rim attachment, unloaded prestressed equilibrium and energy-derived forces/reactions. A more detailed cross-section model is justified only if the cheaper candidate cannot meet the envelope.
3. Receive the chosen law in a headless fixture and visible native wheel. Sweep declared geometry, pressure and supported mass; derive force from pressure/geometry, weight from configured mass and gravity, and solve equilibrium from these inputs. Do not tune force tables per rider. Compare load, deflection, footprint, local shape and force balance. Use held-out pressure/load cases, not only the calibration cases.
4. Add a separately specified insert from declared clearance, potential and dissipative law. Validate impact work, unloading and refinement before extending the operating envelope. Keep pinch/burst/bead-release criteria absent until independently supported.

## Accuracy gates

Distinguish algebraic consistency, discretization error and model bias. Finite-difference energy/volume gradients, translation/rotation invariance and reaction balance establish consistency only. Mesh and timestep refinements establish numerical resolution, not physical fidelity. Static data, footprint and dynamic data are separate physical gates.

Before accepting a model, record quantities, SI units, admitted ranges, data uncertainty and pass budgets. Derive physical budgets from intended user decisions and measurement uncertainty; do not choose them after seeing residuals. Run multiple pressures and loads, near-limit admitted states and held-out conditions. Reject unsupported states explicitly. A single load-deflection curve cannot identify casing stiffness, prestress and gas geometry uniquely; use inflated dimensions, footprint and localized deformation as additional constraints.

## Cost gates

Target O(N) force work and storage with neighbour-local casing terms and one shared chamber reduction. Preserve the existing rank-one gas coupling representation instead of building a dense N-by-N matrix. Precompute material arc weights/topology, allocate scratch at construction, and avoid per-step object creation in the production receiver. Current allocating diagnostic APIs remain offline.

Compute the unloaded equilibrium at configuration changes and use it to initialize the dynamic model; never reset to it each frame. Any interpolation table must come from the same admitted physical law, retain derivative/work consistency and have a measured error bound; it is not a hand-tuned force table.

Measure complete simulated-time cost, solver steps, allocations and worst admitted-case latency across node counts and timestep refinements on the same machine and inputs, without competing heavy work. Report median/spread and warmup separately. Compare candidates at equal accuracy, including contact and stiffness-driven timestep cost; a cheap force evaluation that forces many extra substeps may lose overall. Keep rendering cost separate. No throughput or "optimal" result is claimed yet.

## Current limits and next consumer

The [first scalar screen](TYRE_CANDIDATE_SCREEN.md) now records anchored-linear, anchored-three-halves and derived-asymptote errors against the reference. It has no production casing or equilibrium receiver; retain that distinction when selecting the next implementation. Windows receiving of the static reference passes 453/453 at `6774f81` ([receipt](evidence/tyre-static-windows.json)); the older Linux and browser failures retain their source-specific scope.

PR96's strip kernel and Cartesian mapping pass analytic/Node checks but lack free-casing prestress, transverse geometry and material response. Neither is a production foundation replacement. PR91's contact-transition refinement failures remain independent and must be resolved for loaded dynamic acceptance. #95 stays open.

The [constant-pressure static reference](TYRE_STATIC_REFERENCE.md) now implements the CLI, full report and inspected scientific plot. It passes 21 focused checks and 200 load solves; complete Linux in-process Node receiving is 440/453 with the same thirteen environment-blocked checks ([receipt](evidence/tyre-static-reference-tests.json)), not a full pass. Published Figure 4 dimensions are inconsistent, so exact figure reproduction remains unavailable and the reconstruction is explicitly labelled. The two load estimates differ by L/Re, exposing model bias rather than a numerical error. Next concrete deliverable: compare reduced casing candidates using load, footprint, local shape, realizable prestress and measured inputs, before optimizing the production law.
