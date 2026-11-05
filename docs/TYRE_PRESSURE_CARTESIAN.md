# Prescribed pressure in Cartesian coordinates

This diagnostic is the next receiving boundary for #95 and draft PR96. It does not replace the native foundation. Its named consumers are the headless `scripts/tyre-pressure-cartesian.mjs` report and the saved scientific geometry/force plot. Values are illustrative SI inputs; no tyre calibration is claimed.

## Derived force and ownership

For strip i, let q_i be its current world [x,z] position, h the current hub position, R_i a declared reference radius, r_i = |q_i-h|, e_i = (q_i-h)/r_i and delta_i = R_i-r_i. Reference arc weights remain material weights: do not recompute them from the deformed ring. Feed delta into the existing shared-volume chamber. If F_i = dU/ddelta_i = pg*S_i, the chain rule gives:

```
node force = -dU/dq_i = F_i e_i
hub force  = -dU/dh   = -sum(F_i e_i)
power      = sum(F_i e_i dot (v_i-v_h)) = -dU/dt
```

Use current directions, not undeformed spokes. Pairwise central forces conserve total force and moment about any origin. Hub reaction power is required when the hub moves. In a rotating local basis, a future native receiver must pull these world forces back through the actual joint Jacobians; applying both world reactions and generalized reactions would double-count them. This diagnostic does not write native applied-force arrays.

The pressure kernel enforces 0 <= delta <= section radius and its declared minimum volume. Expansion, collapse, excess compression and nonfinite geometry are rejected, not clamped. Floating-point poses outside that domain are rejected too. Near first engagement the pressure tangent remains singular. The adapter intentionally does not expose a Cartesian stiffness matrix; a future matrix must also differentiate the current radial directions. This allocating report API is not an integration-loop implementation.

## Prestress decision and production boundary

The existing `dist/moving-wheel.js:wheelParts` gives each node two Cartesian slide springs of stiffness foundation*ds and an edge law. The pressure surrogate instead has U=0 and F=0 at delta=0 even when initial gauge pressure is positive. It has no circumferential material stiffness: changing a node angle at constant radius costs no chamber energy. Its volume is prescribed strip displacement, not a volume reconstructed from the full casing boundary.

Therefore this mapping cannot stand in for an inflated free casing or justify removing both native springs. Adding it to the unchanged foundation would also leave an unquantified amount of pneumatic stiffness counted twice. No constant inflation force, fitted spring subtraction, prestress, or insert threshold is invented to conceal this gap.

Next balanced slice: specify a closed casing geometry and rim attachment that have an actual volume gradient, a separately declared casing energy and a measured or explicitly illustrative stress-free reference. Solve and verify the unloaded pressurized equilibrium before loading it. Receive the same equilibrium and loaded deflection in a headless fixture and visible plot, at several pressures and masses. Require finite-difference energy/volume gradients, equal/opposite frame work, mesh refinement and force balance. Only then replace the corresponding foundation contribution through a named native receiver. Insert engagement needs declared clearance, its own potential and nonnegative loss; failure thresholds need independent physical evidence. #95 remains open.

## Reproduce

```
node --test test/tyre-pressure-cartesian.test.mjs
node scripts/tyre-pressure-cartesian.mjs
python scripts/plot-tyre-pressure-cartesian.py
```

Four focused tests cover all node and hub energy gradients, rigid transforms, resultant force/moment, moving-hub power, a different-path multi-node work cycle, zero reference prestress, rejection, owned configuration and replay. The source-hashed [report](evidence/tyre-pressure-cartesian.json) and [plot](evidence/tyre-pressure-cartesian.svg) preserve the three-strip example. The rendered PNG was inspected after reducing arrow size to keep every arrowhead visible. Complete Node receiving is recorded in the current working plan; it does not establish browser/native integration or physical calibration.
