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
