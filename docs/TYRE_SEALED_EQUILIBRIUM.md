# Sealed spatial casing receiving — 6 November 2026

User direction: continue toward resolving #95; no measured tyre data are available, so keep the implementation explicitly uncalibrated. This increment receives sealed gas in the spatial cross-section and removes the duplicate pressure-energy implementation. It does not yet replace the production wheel foundation. The [closure plan](working/ISSUE_95_RESOLUTION.md) names the actual runtime consumer and remaining gates.

## Shared gas and reference state

`tyre-gas.mjs` owns the common gas law consumed by the original prescribed strip chamber and the spatial meridian. The strip retains its compression-only domain and signed-loss input, preserving tiny prescribed compression without subtracting nearly equal volumes. The spatial gas accepts both compression and expansion inside explicit minimum/maximum volume fractions. Gas reference volume is declared independently of stress-free material geometry. `gaugePressure` in a sealed configuration is the pressure at that gas reference volume, not necessarily the final unloaded pressure.

Let `P0=pg0+pa`, `z=(V0-V)/V0`, `l=-log1p(-z)`. Then `P=P0*exp(n*l)` and `pg=pg0+P0*expm1(n*l)`. Mechanical potential relative to `V0` is

```
U = pg0*V0*z + P0*V0*(l*exprel((n-1)*l)-z)
exprel(x) = expm1(x)/x, exprel(0)=1
```

The small-|z| excess uses the existing series, extended to signed z. This preserves the n=1 limit and avoids near-reference cancellation. Expansion can give negative potential relative to V0 and negative gauge pressure; neither is silently clamped. This reversible polytropic path is not a temperature/heat-transfer or leakage model. [NASA's reversible compression/expansion derivation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/isentrophic-compression/) establishes the adiabatic endpoint and assumptions; intermediate n remains an explicitly chosen path approximation.

## Forces, global coupling and numerical safeguards

With `g=grad(V)`, the spatial gas force is `pg*g`. The complete potential tangent is

```
H = Hmaterial - pg*H(V) + c*g*g^T
c = n*Pabsolute/V
```

The first two terms remain banded; the last couples every free coordinate. Ambient pressure enters pg but not the absolute-pressure derivative c. `tangentParts` returns the band and rank-one parts together. Calling `tangentBands` on a sealed model throws, preventing accidental omission of the global term.

For a shifted positive band B, two triangular solves implement the [Sherman-Morrison identity](https://nhigham.com/2020/09/29/what-is-the-sherman-morrison-woodbury-formula/): `x=B^-1 F`, `y=B^-1 g`, `d=x-y*c*(g^T x)/(1+c*g^T y)`. No dense outer product or explicit inverse is formed. Reject nonfinite corrections or denominator below one. Independently multiply the full shifted system and require residual <= `1e-12 + 1e-10*(normBound*maxAbs(d)+maxAbs(F))`; a rejected direction tries the next bounded shift.

Requiring the band itself to factor can conservatively shift a full tangent that the rank-one term would already stabilize. This affects step generation, not acceptance or stability claims. Final stability still uses the UNMODIFIED full force derivative at two finite-difference scales. Force/area convergence, Armijo/roundoff safeguards, model strain/geometry admission and the 64-segment cap are unchanged. This remains an allocating offline solver, not the production integration loop.

## Receiving

Five new tests cover gas pressure/energy quadrature and derivatives on both sides of V0, exact/near-one exponents, zero gauge pressure, shared-law agreement, ownership/domain rejection, all-node spatial energy gradients including beads, full constrained tangents including distant coupling, independently multiplied rank-one systems, dense/analytic equilibrium parity and sealing an already inflated state without changing its pressure. Existing prescribed-pressure checks remain unchanged.

The [saved summary](evidence/tyre-sealed.json), [full compressed report](evidence/tyre-sealed-report.json.gz.b64) and [inspected plot](evidence/tyre-sealed.svg) receive 18 configurations: 16/32/64 segments, 80/160/240 kPa reference gauge pressure, n=1/1.4. All converge with tensile resultants and positive full constrained tangents with refinement margin. Maximum method disagreement is 2.24e-15 m; maximum analytic force is 6.57e-7 N and force/reference area 3.80e-5 Pa. The analytic path takes 5–7 accepted steps. The example specifies gas inventory at the stress-free volume, so free inflation lowers pressure: at 64 segments and reference 160 kPa, final pressure is about 150.414 kPa for n=1 and 146.975 kPa for n=1.4. Separate tests use the inflated reference volume and recover 160 kPa.

The archive is gzip/base64 text; its decompressed JSON SHA-256 is in the summary. It retains complete attempted states/histories and 243 gas-curve samples. [Test receipt](evidence/tyre-sealed-tests.json) records complete local Node results and the actual scope. Source-hash manifests for affected diagnostic CLIs now include the extracted gas dependency. Prior archives remain historical, unchanged.

The read-only derivation review checked expansion signs, the low-rank solve and coordinate mapping. A cross-section revolved about the axle cannot represent a localized footprint. Production moving-wheel nodes have two wheel-plane Cartesian slides, not meridian coordinates; their foundation is still unchanged. The 36 compression exclusions from PR101 remain a separate material gate. No physical calibration, new browser/full attestation, loaded-contact, pinch or burst acceptance is claimed.

```
node --test test/tyre-sealed.test.mjs test/tyre-pressure.test.mjs
node scripts/tyre-sealed.mjs
python scripts/plot-tyre-sealed.py
```
