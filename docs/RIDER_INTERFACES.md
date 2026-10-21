# Named rider closure loads and work

This prerequisite observes the hand/foot connects built by [native rider construction](RIDER_POSTURE.md). It implements the named observation needed to address the force-sign/work-accounting hazard identified by the [PR23 review](PR23_GAP_REVIEW.md). Connected ledger integration remains open. It does not implement a saddle, active control or moving articulated Trail bike.

## Contract and checks declared before implementation

Resolve the two connects by names and validate site-based connect type, rider-first/bike-second ordering and owning bodies. Sleeping and mocap interfaces are outside this contract. Bind an observer to one immutable model topology and one live data object; the owner must complete forward position/velocity/constraint evaluation before reading. Read fresh native arrays after native operations rather than retaining views across storage changes. Preallocate result and scratch storage; copied reports must own their arrays. The read path does not advance time, recompute forces or apply loads.

Native rows are world x/y/z, with multiplier force on the rider and its negative on the bike. Resolve rows anew by equality type and ID on each read, including disabled/reactivated connections and unrelated rows. Do not infer activation from a nonzero force. A deliberately disabled connection reports zero force/work with its actual geometry and velocities; this is diagnostic support, not a validated release law. Missing or malformed enabled row blocks must fail rather than return stale accepted loads. Failure must leave the previous published result unchanged.

At actual site positions `rR`, `rB`, velocities `vR`, `vB`, and force `F` on rider, report both wrenches about world origin, gap, signed side powers, pair power and native row power:

```
MR = rR cross F
MB = rB cross (-F)
pairMoment = (rR - rB) cross F
pairPower = F dot (vR - vB)
rowPower = sum(efc_force * efc_vel) for this named connect
```

A nonzero pair moment is possible with soft closure. It is a numerical internal-constraint contribution, not terrain torque. Keep a physical external-momentum residual and this contribution separate; a compensated balance does not establish physical conservation. Native RNE already includes these paired forces: the observer is a decomposition only.

Acceptance budgets: for dense/sparse constraints, translated/rotated carriers, nonzero site motion and intentionally open diagnostic poses, site velocity versus an independent central position difference uses 1e-6 displacement and 1e-8 m/s tolerance. Row work versus two-site work, generalized constraint power and force/moment projection use 1e-9 absolute/relative tolerance. RNE body loads are compared with independently summed point wrenches at the native subtree COM at the same tolerance. Test released/reactivated rows, unrelated equality/brake/contact rows, malformed metadata/rows, nonfinite values, result ownership and reuse, and atomic failed reads. These are instantaneous observer checks, not acceptable dynamic closure gaps or integration budgets.

Next receive these diagnostics in the moving articulated bike together with independent chassis mass/inertia, saddle routing, domain rollback and actual segment visualization. The [seated/unseated plan](RIDER_SEATED_UNSEATED.md) keeps rider intent distinct from physical saddle support.

## Current implementation and consumer

`createRiderClosureObserver(mj, model, data)` in `dist/rider-interfaces.js` binds one immutable topology and one data object. Call `read()` only after a coherent native forward evaluation, and `delete()` before disposing the native owner. Its returned object/arrays are borrowed and overwritten by the next successful read. `copyClosureReport` materializes an independent JSON-ready snapshot outside the read path. The observer owns one reusable native velocity buffer and preallocated pending/published arrays; native binding getters still create short-lived view wrappers, so this is not a zero-allocation or performance claim.

The existing native and passive CLI/browser inspections now consume this observer and expose `interfaceLoads`; their report formats advance to `bikelab-rider-native-0.2` and `bikelab-rider-native-passive-0.2`. Input posture/passive specifications remain at 0.1. Historical receipts retain their original version and source hashes. No connected scenario or saved Trail bike record changes. Browser/Node force/work/moment comparisons use the declared 1e-9 normalized budget, separately from the unchanged 1e-12 construction budget.

`active` means rows are enabled and present, not that their force is nonzero. Inactive connections retain actual site positions/velocities/gap, but have zero force/work and zero `nativeResidual` because no native residual rows exist. `otherEqualityRows` counts equality rows outside the two named connects; the observer does not claim to partition all constraint work. The future connected ledger must separately route these, saddle contact, terrain contact and brake rows. Diagnostic state copies must include runtime `eq_active`; a default-created diagnostic data object can otherwise silently re-enable a released connection. Invalid/missing enabled rows fail without publishing partial results. A caller that changes position, velocity, activation or controls must refresh the complete native state; the observer cannot detect every stale derived buffer.

## Primary implementation sources

Conventions were checked against MuJoCo 3.16.0 commit `a892750516336d8358949f4518fcc4fbbd85beae`, with independent bounded source research by GPT-6.1 Sol:

- [Connect assembly and activation](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_constraint.c#L399): world xyz rows, site1 minus site2 and disabled/sleeping omissions; the same file computes equality velocity from the constraint Jacobian.
- [Actual-site velocity](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_util.c#L1071): world-oriented angular/linear output, transformed from the body to the actual site; it does not refresh native state.
- [Native RNE point forces](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_smooth.c#L2573): opposite forces at the actual two points, already included in body loads.
- [Forward pipeline](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1957) and [integration-state fields](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/include/mujoco/mjtype.h): coherent position/velocity/force evaluation and equality-activation ownership.
