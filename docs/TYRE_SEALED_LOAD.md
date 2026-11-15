# Loaded sealed casing receiving — 15 November 2026

**The current swept model fails loaded mesh refinement. Do not promote it into trail-bike on the strength of its unloaded tangent or short-drop tests.** This increment adds a reproducible, independently checked imposed-height diagnostic and records the failure. It changes no production force law, native timestep, material constant or historical record identity. The existing experimental viewer now states the failed loaded gate explicitly.

## Boundary and independent checks

At prescribed hub height h, minimize the existing material-plus-sealed-gas potential U(q) over the 2N hub-relative Cartesian tread coordinates. The contact boundary is a flat plane acting on the **zero-thickness swept surface**, without the native capsule skin, soft contact, gravity, damping or inertia. It is a distinct diagnostic; matching its results to native contact remains unreceived.

For a transverse vertex, `z_world = h + (1-alpha)*L*ez + alpha*qz`, with alpha in [0,1]. Since h>L, every fixed bead is above the plane, and a crown vertex has alpha=1. Thus the full swept surface is nonpenetrating exactly when every crown satisfies `qz+h >= 0`: all other vertices are convex combinations of a bead and crown, and each triangle is linear. Duplicate transverse constraints are unnecessary. This does not establish nonintersection for arbitrary deformations; the casing's own geometry/strain guards remain active.

With `f=-grad U`, stationarity is `f+J^T lambda=0`, gaps are nonnegative, lambda is nonnegative, and lambda*gap=0. An active crown has `lambda=-fz`; total upward reaction is their sum. Tests separately check this reaction against `-d min(U)/dh` using converged solutions at two height differences, and against the sum of gas and material vertical forces. Contact geometry and force meaning follow the [COMSOL contact formulation](https://doc.comsol.com/6.4/doc/com.comsol.help.sme/sme_ug_modeling.05.142.html). The recorded active vertex span is a mesh-dependent longitudinal span, **not physical footprint width or area**. The affine transverse reduction cannot establish an actual flattened tread patch.

The bounded offline solver uses reduced Newton directions, projected Armijo search and a projected-gradient fallback, following the general projection/reduced-space approach in [Hager and Tarzanagh](https://arxiv.org/html/2011.01201v2), equations 3–8. This is not a port of their complete NPASA algorithm or its convergence theorem. The shared dense factor/solve routines were extracted without changing the earlier meridian solver. The solver allocates offline; none of this work enters the integration loop.

Acceptance requires KKT force residual <= 1e-5 N and nonpenetration within 1e-12 m. A shifted factor can propose a step, but final stability uses unshifted tangents at 1e-7 and 5e-8 m. Strictly active reactions fix a vertical coordinate; weak reactions leave it free, a conservative superset of the feasible critical cone that includes release directions. The reciprocal inverse infinity norm must exceed the finite-difference/skew error estimate with the existing tenfold margin. Positive tangent, tensile resultants and solver convergence are **local admission only**, not mesh convergence.

Near a root the line search permits an energy roundoff allowance only when the positive predicted decrease is below it, the energy remains within it, and the unchanged KKT residual falls by at least half. Its scale includes absolute pressure times reference volume and triangle count, because gas energy subtracts two separately accumulated volumes. It is a conservative diagnostic allowance, not a proved floating-point error bound; it never relaxes the force, geometry or material gates. Tests cover the formerly stalled unloading steps, deterministic replay and alternate initial states.

## Results and receiving failure

The [summary](evidence/sealed-load.json), [complete compressed report](evidence/sealed-load-report.json.gz.b64) and [inspected plot](evidence/sealed-load.svg) retain 18 configurations: 32/64/128 circumferential stations, 8/16 transverse segments and 1.2/1.6/2.0 bar. Each follows 0→1→2→3→4→3→2→1→0 mm prescribed lowering. Continuing the mathematics through rejected compression states is explicitly diagnostic, not admitted tyre motion. No state is silently removed from the archive.

All 162 solves converge; maximum KKT residual is 6.07e-6 N. Load/unload reaction disagreement is at most 1.04e-5 N. Nevertheless, 50 states have compressive resultants, and 48 of 105 mesh comparisons exceed the declared numerical reaction budget of 1 N plus 5% of the larger reaction. This budget is an engineering receiving target, not measured physical accuracy. The sweep writes the complete failure evidence and returns a failing receiving status.

At 1.6 bar and eight section segments:

| Stations | Reaction at 1 mm | Reaction at 2 mm | Reaction at 3 mm | Compression at 3 mm |
| --- | ---: | ---: | ---: | ---: |
| 32 | 38.68 N | 77.59 N | 117.43 N | 0 cells |
| 64 | 29.00 N | 379.28 N | 732.74 N | 16 cells |
| 128 | 144.60 N | 451.57 N | 801.96 N | 32 cells |

All these tangents pass the local numerical stability check. That does not rescue the loaded model. Transverse 8→16 refinement changes much less than circumferential refinement; the plotted active-set/mesh response warrants investigation before mass-dependent dynamic admission or wider runtime use. No calibrated stiffness or damage claim follows.

## Next corrective slice

1. Inspect active-node transitions, local station strains, gas/material energy and low tangent modes. The current cell averages two meridional strains before squaring: opposite variations cancel in that term. This is a candidate unresolved mode, not an established explanation for the entire refinement error.
2. Compare a consistent alternative quadrature without changing material constants or adding arbitrary stabilization. Preserve old record replay under a new model identity if the force law changes. Receive gradients, unloaded equilibrium, loaded convergence and mesh comparison before adopting it.
3. Only after that gate passes, derive runtime stiffness/mass timestep admission, receive the native imposed-height/load path, reuse it in trail-bike and add separately declared near-rim/insert behaviour. Keep physical pinch/burst/bead criteria unavailable without supporting evidence.

A preliminary local quadrature probe replaced `Cm*((ema+emb)/2)^2` by `Cm*(ema^2+emb^2)/2`, and used each endpoint meridional resultant for its edge derivative. It preserved the uniform unloaded state but did **not** receive the model: at 1.6 bar, 1 mm reactions were about 336 N (32) and 169 N (64); at 2 mm they were 669 N and 415 N, with compression. This is an unverified candidate probe, not a production change or a solution. The equations and observations are retained here so the finding is not lost; broader verification is still required.

Commands:

```
node --test test/tyre-sealed-load.test.mjs test/tyre-equilibrium.test.mjs test/tyre-sealed.test.mjs
node scripts/tyre-sealed-load.mjs
python scripts/plot-tyre-sealed-load.py
```

#95 stays open. Calibration remains explicitly deferred per the user's instruction. Historical rider browser and PR91/contact gates are separate and unchanged.

Software verification: complete local Node suite **491/491 pass**, zero skipped, 103.439 seconds. [Receipt](evidence/sealed-load-tests.json) and [complete output](evidence/sealed-load-node.txt) are tracked. Focused Edge 158.0.4370.21 viewer/worker checks pass; the updated limitation and plot were visually inspected. [Browser receipt](evidence/sealed-load-browser.json) retains source/screenshot hashes. These passes verify the diagnostic and preserved runtime, not the failed loaded-model gate.
