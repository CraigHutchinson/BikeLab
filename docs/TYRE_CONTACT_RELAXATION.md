# Contact phase and restricted tension relaxation â€” working plan, 17 November 2026

Status: implementation and receiving in progress. No runtime promotion or #95 closure.

Controls now rotate the imposed plane relative to the fixed material stations; solver coordinates and force gradients use the same orthogonal plane frame. Zero phase preserves the prior arithmetic. Endpoint-only diagnostic meshes extend to 256/512 stations; legacy/runtime admitted geometry is unchanged. Coarse phase dependence is large, while the preliminary 512-station endpoint reactions agree within 0.6 N at 1.6 bar/2 mm. Compression remains.

A separately identified relaxed candidate minimizes the endpoint quadratic energy over nonnegative endpoint meridional slacks and one shared hoop slack. Enumerating eight KKT active sets gives a conservative gradient without penalty constants. It assumes coordinate-aligned relaxation, not a full wrinkling tensor. Existing raw-strain/geometry limits remain; effective strains are also bounded. Zero resultant is part of this constitutive assumption, not evidence of physical accuracy.

Primary references read: [Pipkin 1994 abstract](https://doi.org/10.1093/imamat/52.3.297), which defines relaxation through convex increasing energy, and [Taylor et al. 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC7020621/), which treats anisotropic wrinkling with bending/plate structure beyond this reduction. The local diagonal-slack construction is derived here; it is not a transcription of a full tensor formulation. No wrinkle angle, wavelength, amplitude or measured tyre law is claimed.

Next receiving: source-bound load/unload at three pressures, two contact phases and 128/256/512 stations; energy gradients and independent material minimization; pressure/volume and contact plots; full local suite; focused browser numerical comparison and existing wheel flow. Retain all failures. If phase/refinement and local stability receive, assess runtime cost and transverse shape limits before native/trail/near-rim integration. Calibration stays deferred per user direction.

## Derived energy and force contract

Write the parent density as W(x,y)=(Cm*x*x+2*Cc*x*y+Ch*y*y)/2. For endpoint strains ea, eb and shared hoop strain eh, the candidate density is

```
min over sa,sb,t >= 0: [W(ea+sa,eh+t)+W(eb+sb,eh+t)]/2.
```

Strains/slacks are dimensionless, rigidities and resultants are N/m, density is J/m² and multiplying by reference cell area gives joules. Added slack represents material metric hidden by the projected configuration. It is not a negative material strain or a penalty stiffness. Let x=ea+sa, z=eb+sb and y=eh+t. The derivative resultants are Nm_a=Cm*x+Cc*y, Nm_b=Cm*z+Cc*y and Nh=Cc*(x+z)/2+Ch*y. Thus density derivatives are Nm_a/2, Nm_b/2 and Nh. The existing edge/hoop chain gives negative spatial energy gradients with those factors.

For each of eight active sets, released meridional endpoints satisfy x or z=-Cc*y/Cm. If k endpoints release and hoop also releases, y=-Cc*(sum of unreleased endpoint strains)/[2*(Ch-k*Cc*Cc/(2*Cm))]. Otherwise y=eh. Feasible nonnegative slacks/resultants and complementary products select the minimum. All-released is zero strain/stress, including negative coupling. The tensile branch recovers the parent endpoint density. Boundary values are continuously differentiable in exact arithmetic, while tangents may change across active sets.

Floating-point feasibility uses a documented machine-epsilon bound and clips only resultants/slacks within that bound. Consequently complementarity and energy-gradient agreement are numerical statements within checked error, not exact arithmetic guarantees. The relaxed candidate additionally rejects numerically ill-conditioned material matrices before evaluation; old model admission is unchanged. Candidate stability remains a separate check of the unshifted geometric/gas/contact tangent, not a consequence of convex strain energy.

Shared hoop slack means the aggregate hoop resultant is nonnegative; it does not enforce two separate hypothetical endpoint hoop resultants. This coordinate-aligned model omits shear/principal-stress checks, independent transverse shape, bending and wrinkle morphology. A zero compression count is imposed by the law and cannot validate those missing mechanisms.
