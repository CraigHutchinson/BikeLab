# Analytic constant-pressure tangent — 6 November 2026

This increment receives an analytic banded route for the offline fixed-bead solver introduced in PR99. It evaluates the SAME membrane and constant-pressure potential; no fitted forces, changed residual gates or production physics are introduced. The existing finite-difference route remains the default reference. The comparison CLI explicitly consumes `tangent: 'analytic-banded'`.

## Derivation and storage

For an edge with local coordinates `(x,z,u,v)`, length `l`, direction `t`, reference length `l0`, reference revolution radius `R0` and area `A0`, define:

```
gm = (-tx,-tz,tx,tz)/l0
gh = (0,1,0,1)/(2*R0)
B = (I - t*t^T)/(l*l0)
H(em) = [[B,-B],[-B,B]]
H(material) = A0 * [Cm*gm*gm^T + Cc*(gm*gh^T + gh*gm^T)
                    + Ch*gh*gh^T + Nm*H(em)]
```

The last term is geometric stiffness from current meridional stress, not an optional material constant. Hoop strain is affine and has zero second derivative. For polygon volume, `C=x*v-u*z`, `w=L/2+(z+v)/6`, `gC=(v,-u,-z,x)`, `gw=(0,1/6,0,1/6)`. Only `HC[0,3]=1` and `HC[1,2]=-1` plus symmetric entries are nonzero. Thus `H(pressure)=-2*pi*p*(w*HC+gC*gw^T+gw*gC^T)`. This sign follows `potential=E-p*(V-Vrest)`; the Hessian is `-dF/dq`, in N/m.

Each edge contributes only to adjacent nodes. Omitting fixed bead rows/columns leaves a block tridiagonal matrix, scalar half bandwidth three with interleaved axial/radial coordinates. Bead-adjacent contributions to free-node diagonals remain; the rim closure has only constrained endpoints. Lower row storage is `bands[4*i+i-j]=H[i,j]`, with four allocated entries per free coordinate, including unused edge slots. Assembly, factorization and triangular solves have O(N) work/storage at this fixed bandwidth. Force and history reports still allocate: this is not an integration-loop implementation.

[LAPACK DPBTRF](https://netlib.org/lapack/explore-html/dc/d58/group__pbtrf_gafd2c3ba375ecee6dba1fba62696993e0.html) documents positive-definite band Cholesky and nonpositive-minor failure. Our scalar recurrence uses row-based storage, NOT LAPACK's column-based layout or blocked BLAS implementation. The original scaled pivot rejection, diagonal shift search, descent requirement, backtracking and roundoff-residual acceptance remain unchanged. A shift never establishes stability. Final stability is still independently assessed using unshifted dense force differences at two scales.

**Sealed gas is not purely banded.** Pressure depending on total volume adds global coupling (a rank-one pressure derivative term). The current band structure applies only to constant reservoir pressure. Preserve that distinction when receiving sealed-gas energy; do not discard the global term to retain this solver.

## Evidence and limits

The [complete comparison](evidence/tyre-tangent.json) contains both solvers' coordinates, forces, strains, histories, numerical stability diagnostics, configuration, source hashes and six rotated timing samples per method per case. Nine 16/32/64-segment cases at 80/160/240 kPa all converge, retain tensile resultants and pass the existing unshifted stability inspection. Maximum coordinate disagreement is 3.47e-17 m against a 2e-9 m comparison budget. This is agreement between implementations of the same model, not physical accuracy.

At 64 segments the tangent contains 504 allocated band entries versus 15,876 dense entries. In this Windows/Node sample at 160 kPa, median complete solves were approximately 0.31 ms banded and 24.33 ms dense. Six warmed samples alternate method order; timings precede the full test run. These are descriptive local measurements, with no controlled thermal/hardware isolation, no production throughput claim and no timing CI gate. The exact counts and asymptotic reduction are stronger evidence than this single-machine timing ratio.

The [inspected plot](evidence/tyre-tangent.svg) compares whole-solve time, coordinate agreement and tangent storage. Four new tests check all constrained force derivatives at two steps over multiple meshes, both signs of material coupling and asymmetric compressed states; independently reconstruct shifted/unshifted linear systems; compare twelve pressure/mesh equilibria; and cover failure, admission and ownership. The existing five equilibrium tests remain unchanged. Complete suite results and normalized log are linked from the [test receipt](evidence/tyre-tangent-tests.json).

A bounded read-only derivation review confirmed pressure signs, geometric stiffness, band mapping and the sealed-gas limitation. Local implementation review checked boundary assembly and failure paths. No new browser/full attestation: production assets are unchanged and the known rider replay and PR91 refinement failures remain unresolved. Deliver this reviewable offline increment under the user's merge-each-iteration instruction; #95 remains open.

## Next receiving slice

Expand geometry/material/pressure and alternate-start sweeps before choosing the analytic route as the general default or increasing the diagnostic mesh cap. Receive sealed-gas energy, pressure-volume force and rank-one tangent coupling against independent derivatives, then loaded shape/footprint/contact. Calibrated material data, nonaxisymmetric stability, native integration, preallocated runtime scratch, inserts and failure/pressure-loss behaviour remain separate gates.

```
node --test test/tyre-tangent.test.mjs test/tyre-equilibrium.test.mjs
node scripts/tyre-tangent.mjs
python scripts/plot-tyre-tangent.py
```
