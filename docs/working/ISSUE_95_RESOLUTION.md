# Issue 95 resolution contract — 6 November 2026

User explicitly asks to work toward resolution, and confirms no measured load/deflection data are available: keep the model uncalibrated. This is permission to implement a declared illustrative model, not permission to call it physically validated. Do not close #95 while its runtime wheel still uses an unrelated constant foundation.

## Received foundations

Same-volume gas pressure/energy, prescribed changing contact width, Cartesian virtual-work mapping, independent approximate static reference, spatial meridian material/pressure forces, unloaded constant-pressure equilibrium, analytic banded tangent, broad geometry/material/start coverage and now sealed-gas global coupling are received. The 36 negative-coupling compression exclusions remain visible. These are numerical/model-building receipts; they do not add up to production integration.

## Next actual consumer

The smallest vertical slice is a distinct, explicitly uncalibrated sealed-casing mode in the existing moving-wheel model and viewer, followed by reuse in trail-bike. Retain old model/version records; do not silently reinterpret foundation recordings.

1. Construct a closed swept surface from the received cross-section and circumferential tread nodes. Use an affine map from each tread node's two hub-relative Cartesian coordinates to its transverse vertices, with zero displacement at rim beads and full displacement at the crown. Retain stress-free material measures separately from the inflated embedding.
2. Use consistently oriented triangles, including rim closure, to derive volume and its analytic gradient. Differentiate through the affine map to the actual slide coordinates. Do not substitute a meridian force or arbitrary width-times-planar-area surrogate without stating a new model. Reject invalid geometry; positive total volume alone is insufficient.
3. Receive neighbour-local material cell energy and gradients, preserving the existing meridional/hoop strain meaning in axisymmetry. Inspect tangential stability; if a missing shear/bending mode prevents receiving, address that model requirement rather than inventing a stiffness to pass. Solve the discrete reduced surface's own unloaded equilibrium; the continuous meridian solution is only an initial guess.
4. Replace foundation with this material-plus-gas energy in that mode. Apply internal generalized forces at every required native force stage. In hub-relative slide coordinates, internal energy has zero derivative with respect to global hub translation/spin; do not additionally apply an opposite hub generalized force and double-count reactions. Verify native work/momentum and stage timing.
5. Receive a flat-fixture imposed hub-height load/unload sequence at 1.2/1.6/2.0 bar. Record pressure, volume, contact width/footprint, deflection, force components and rim clearance, with force/energy gradients, mesh/timestep refinement, deterministic replay and browser agreement. Show those channels in the actual wheel viewer. No calibrated physical error claim without measurements.
6. Reuse the same pressure-aware law in trail-bike; derive supported load from configured mass/gravity. Keep contact/refinement and rider replay failures explicit. Add a separately declared insert/near-rim potential with dissipative work before claiming insert behaviour; service maxima do not establish burst or bead-release thresholds.

## Closure boundary

#95's implementation can be resolved only once pressure, geometry-dependent response, unloaded prestress and declared near-rim handling reach the actual wheel/trail consumers with numerical and browser receiving. Calibration may remain explicitly deferred per user direction; it must not be fabricated. Physical pinch/burst/bead-release predictions require their own supported criteria and stay unavailable. Air leakage/damage evolution and general 3D riding are outside the current fixed-mass planar receiver.

Merge reviewable increments after each iteration, but keep this contract and the remaining work current on main. A merge, positive tangent, or passing software suite is not completion of a failed physical/model gate.

## 15 November receiving increment

The opt-in moving-wheel consumer now has closed swept volume, membrane/gas force gradients, discrete inflation equilibrium and split Euler native forces. Focused free-flight/drop/replay/refinement tests and Edge worker/UI receiving pass; see [runtime evidence and limitations](../TYRE_SWEPT_RUNTIME.md). Steps 1–4 have a bounded first consumer; this does not finish loaded stability or steps 5–6. The next slice is imposed load/unload and loaded mesh/stability/admission checks before trail and near-rim integration. No calibration or #95 closure is claimed.

## Loaded gate failure, 15 November

The [static imposed-height sweep](../TYRE_SEALED_LOAD.md) converges at all 162 samples, but 50 develop compression and 48/105 mesh comparisons fail. A positive local tangent is insufficient. Correct the discretization/model after active-set and strain-mode investigation before proceeding with native loaded receiving or trail reuse. The proposed quadrature change is only an unsuccessful preliminary probe, not an adopted fix. Runtime timestep admission, native load/unload, inserts and calibration remain pending.

## Endpoint candidate, 16 November

The [versioned endpoint-energy formulation](../TYRE_CASING_MODES.md) removes the identified strain-averaging deficiency without new material constants, while preserving all archived legacy force states exactly. It is not promoted: 19/30 loaded refinement comparisons still fail and 45/81 states are compressive. Next investigate contact resolution and transverse section freedom or a supported wrinkling law; do not tune away these failures. Native loaded receiving, timestep admission, trail/inserts and calibration remain pending.

## Sampling separation, 16 November

The [independent sampling sweep](../TYRE_CASING_RESOLUTION.md) isolates transverse discretization: all six section-refinement comparisons pass while all six circumferential comparisons fail at 1.6 bar/2 mm. All final states remain compressive. Next test contact-phase sensitivity and finer circumferential resolution before selecting a richer shape or supported wrinkling model. Runtime, native loaded, trail/insert and calibration gates remain unchanged.

## Fine-mesh restricted relaxation, 17 November

The [contact-phase and relaxed reference](../TYRE_CONTACT_RELAXATION.md) passes the bounded fine-mesh loaded gate: 84 locally admissible states, 48 phase/refinement comparisons and 36 returns at 256/512 stations. All 126 sampled candidate states are locally admissible, but 18 coarse comparisons fail. This selects a numerical reference, not a production default. Next receive practical contact accuracy/cost, transverse limitations and runtime timestep admission, then native imposed loading and trail/near-rim integration. Calibration remains explicitly deferred and #95 stays open.

## Kernel cost reference, 17 November

The [cost measurement](../TYRE_CASING_COST.md) receives a source-bound force-only baseline and profile. Fine accuracy alone does not choose a runtime mesh: next derive timestep admission from configured coupled mass/stiffness and receive full native loaded cost/refinement. No material/runtime law changed; trail, near-rim and calibration gates remain.

## Coupled mass/frequency, 17 November

The [mass-aware diagnostic](../TYRE_MASS_FREQUENCY.md) receives configured hub/tyre/spin coupling against native mass matrices and supplies 162 frozen internal frequency estimates. This completes the internal inertial component of timestep analysis only. Actual damping/contact/nonlinear native refinement and end-to-end cost remain required before changing runtime admission or mesh defaults. Trail, near-rim and calibration gates remain.

## Native receiving checkpoint, 18 November

The [72-case native comparison](../TYRE_NATIVE_LOADED.md) identifies three Euler damping failures and receives implicitfast without changing viscosity/material constants. Its 36 runs and 24 timestep comparisons pass, but all six mesh comparisons fail on hub motion. Full local Node 510/510 passes. Next settled/equal-load/contact-time refinement before production mesh selection, native cost or viewer/trail/near-rim promotion. Preserve the frozen 25 micrometre budget. Physical calibration remains deferred.

## Equal-load receiving, 18 November

The [equal-load study](../TYRE_EQUAL_LOAD.md) removes the mesh-dependent applied-load difference. Eight 100 ms runs pass energy/penetration and all four timestep comparisons, but both mesh comparisons and all eight sampled settlement tests fail. Native forward evaluations with velocities zeroed also show nonzero residual forces. Full local Node 511/511 passes. Next receive the actual regularized native static equilibrium and perturb/release refinement, without adding invented material damping or widening gates. Runtime/trail/near-rim integration and calibration remain ahead.
