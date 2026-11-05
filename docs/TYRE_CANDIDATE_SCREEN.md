# Scalar screening before casing selection

This is an offline comparison against the independent constant-pressure membrane reference, not a completed comparison of dynamic casing implementations. It adds no production force law. Inputs are two illustrative geometries with different rim-width/section-radius ratios, three pressures and seven deflections from 1% to 50% of unloaded section height. A 10% deflection anchor supplies two fitted controls; the other six depths are held out. Complete inputs, source hashes and all 42 rows are in [the report](evidence/tyre-candidate-screen.json); [the inspected plot](evidence/tyre-candidate-screen.svg) displays the 160 kPa rows. The three pressure curves have the same normalized error because this reference is exactly linear in pressure; they are not independent shape evidence.

| Scalar control | Construction | Maximum absolute relative load error, held-out depths |
| --- | --- | --- |
| Linear | F(d_anchor)/d_anchor times d | 204.03% |
| Anchored three-halves power | F(d_anchor)/d_anchor^1.5 times d^1.5 | 23.53% |
| Derived small-load limit | Geometrically derived coefficient times d^1.5 | 29.12% |

These are model-to-model discrepancies, not physical error budgets or calibration results. The reference's own rim-stress versus pressure-footprint discrepancy remains separate. No new pass tolerance was chosen from these residuals. Relative error at zero load is deliberately excluded. The linear control's large low-load error is consistent with its different exponent, not a numerical solver failure. A fitted three-halves coefficient improves this screen but still differs substantially at large compression. A force curve alone supplies neither local shape nor prestress, tangential response or rim reactions.

## Candidate decision

Do not promote a constant spring or an anchored power law to the production foundation based on a match at one load. Retain the power-law limit as a small-load control. A precomputed cross-section approximation is still a candidate for speed, provided it preserves geometry, derivatives and work within a declared domain; this screen has not implemented or timed it.

The actual casing comparison still needs two energy-based candidates: an effective rim-attached ring with separately identified material/pressure contributions, and a cross-section-aware gas/casing model. Both must use the same declared geometry, mass, gas state and material provenance. Receive unloaded inflation before adding ground load. Do not assign arbitrary spring rest lengths just to cancel an arbitrary pressure force: the reference configuration and material energy must be realizable and documented.

For each candidate, declare V(q), U_casing(q), any rim-attachment energy and gas potential. At the requested pressure solve the free-coordinate equilibrium gradient of total potential equal to zero with rigid-body freedom explicitly constrained. Show individual pressure and material forces as well as their residual, rim reaction and force/moment balance. Check the equilibrium is stable against admitted perturbations; a small residual alone is insufficient. Then apply configured mass/gravity and compare load, footprint and shape, retaining numerical refinement separately from physical uncertainty. Compute the equilibrium on configuration changes, not as a per-frame reset.

Only after these accuracy gates should equal-accuracy complete runtime cost choose between candidates. O(N) storage/force work and preallocated runtime buffers remain targets, not measured claims. Insert clearance/loss, pressure-loss and damage laws remain later work. #95 stays open.

## Reproduce

```
node scripts/tyre-candidate-screen.mjs
python scripts/plot-tyre-candidate-screen.py
```

The CLI checks anchor agreement, finite results, the reference approximation ratio and pressure-scaling invariance. The plot reads the saved report without solving again. No new browser behavior is introduced; the existing articulated-standing replay blocker is unchanged.
