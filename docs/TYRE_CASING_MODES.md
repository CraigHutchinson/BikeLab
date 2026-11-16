# Swept casing strain-mode correction — 16 November 2026

The loaded mesh failure has an identified contributor: averaging adjacent meridional strains before evaluating energy suppresses alternating station deformation and hides compression at individual edges. A separately identified **endpoint-energy candidate** now removes that averaging deficiency using the existing material constants. It is tested and retained, but **not promoted into moving-wheel or trail-bike**, because loaded refinement and compression gates still fail.

## Diagnosis and exact correction

At 1.6 bar, 32 stations and 1 mm hub lowering, the original model's first seven radial displacements are approximately `[-1.000, +0.790, -0.627, +0.496, -0.394, +0.313, -0.249] mm`. Only the lowest crown is in contact. At 64 stations, neighbouring crowns enter contact earlier and suppress this alternating deformation; a converged reaction is therefore strongly mesh-dependent.

For one cell, let ea and eb be its two endpoint meridional strains, eh its midpoint hoop strain, and A its reference area. The previous energy uses em=(ea+eb)/2:

```
Uold = A/2 * (Cm*em² + 2*Cc*em*eh + Ch*eh²)
Unew = A/2 * (Cm*(ea²+eb²)/2 + 2*Cc*em*eh + Ch*eh²)
Unew - Uold = A*Cm*(ea-eb)²/8
```

This is an exact algebraic difference, not an added tuning spring. Each meridional edge now uses its own resultant `Nm_a=Cm*ea+Cc*eh` or `Nm_b=Cm*eb+Cc*eh`; the hoop resultant is unchanged. Endpoint strain bounds and compression checks likewise use both values. The independent station diagnostic reconstructs meridian lengths from bead-to-crown vector norms and section differences, separately from force accumulation.

At uniform radial inflation ea=eb, so the correction energy and first derivatives vanish in exact arithmetic. Tests check agreement within floating-point bounds. Alternating deformation has a changed tangent: at 32 stations and 1.6 bar its normalized directional stiffness rises from about 4,501 to 337,686 N/m. This is a directional Rayleigh quotient checked at two perturbation scales, not a computed eigenvalue or proof of continuum stability. The local alternating pattern disappears in the sampled endpoint solution, as shown by the [inspected comparison plot](evidence/casing-modes.svg).

[Abaqus's primary integration discussion](https://docs.software.vt.edu/abaqusv2026/English/SIMACAEBMKRefMap/simabmk-c-linbending.htm) distinguishes reduced-integration zero-energy patterns, artificial hourglass control and possible locking with fuller integration. Those are useful cautions, not proof that this custom swept membrane is a standard finite element. We changed energy quadrature, not shear/bending physics or calibrated material properties.

## Version and compatibility

`createSweptCasing(configuration)` retains `bikelab-swept-sealed-casing-0.1`. The explicit second argument `ENDPOINT_MODEL` selects `bikelab-swept-sealed-casing-endpoint-0.1`; unknown identities reject. The offline imposed-height solver consumes this through `options.casingModel` and emits its own distinct endpoint identity. The sweep records the selected model with every configuration. The production wheel still selects the legacy model; there is no new UI default or silently reinterpreted saved recording.

Every force component and state scalar in all 162 archived legacy loaded states is reproduced **exactly** by the default model. Six new tests independently verify the added energy identity across resolutions and coupling signs, all-coordinate total/material/gas energy derivatives, uniform equilibrium, alternating displacement response, separate candidate identity, reaction by height-energy difference, and endpoint compression rejection. Per-step surface and force buffers remain reused; no performance qualification is claimed.

## Receiving result: still not ready for promotion

The [summary](evidence/casing-modes.json) and [complete compressed report](evidence/casing-modes-report.json.gz.b64) compare 32/64/128 stations at 1.2/1.6/2.0 bar, eight section segments, with nine load/unload points per configuration. Full coordinates are retained; detailed cell strains can be deterministically reconstructed with `inspectCasingStrains` rather than duplicating them in the archive. Source and decompressed-report hashes are recorded.

| Model | Converged samples | Compression-rejected samples | Reaction-refinement failures |
| --- | ---: | ---: | ---: |
| Averaged strain | 81/81 | 26/81 | 24/30 |
| Endpoint energy | 81/81 | 45/81 | 19/30 |

The same 1 N + 5% reaction budget is used. The endpoint model exposes, rather than cures, local compression: 19 legacy samples passed their averaged local gate despite negative endpoint resultants; none pass the endpoint gate with a negative endpoint resultant. `averagingWouldHideCompression` is a counterfactual cell diagnostic for either model, not a claim that the endpoint model hides compression.

At 1.6 bar and 2 mm lowering, endpoint reactions are about 669/415/467 N for 32/64/128 stations. They remain mesh-dependent and compressive. The sweep therefore writes its failure evidence and exits 1. Positive tangent, converged Newton solves, or improved mode behaviour do not establish tyre accuracy.

## Next balanced slice

Investigate the remaining contact-resolution and transverse-kinematic limitations. The current affine section has fixed axial coordinates and cannot independently widen or flatten into a physical contact patch. Local compressed endpoint strains may indicate missing admissible shape modes; they must not be silently accepted or removed with arbitrary stiffness. Compare a declared richer section reduction or a supported tension-only/wrinkling formulation against the same gradient, equilibrium, load/unload, compression and refinement gates before selecting a replacement. Preserve this versioned candidate as a reproducible control.

Only after loaded receiving succeeds: derive runtime mass/stiffness timestep admission, receive native imposed-height loading, integrate the shared law into trail-bike, and add separately declared near-rim/insert behaviour. No burst, pinch or bead-release thresholds are inferred. #95 stays open and calibration remains explicitly deferred.

```
node --test test/sealed-endpoint.test.mjs test/sealed-casing.test.mjs test/tyre-sealed-load.test.mjs
node scripts/tyre-casing-modes.mjs
python scripts/plot-tyre-casing-modes.py
```

Complete local software suite: **497/497 pass**, zero skipped, 121.355 seconds; [receipt](evidence/casing-modes-tests.json), [full output](evidence/casing-modes-node.txt). Edge 158.0.4370.21 passes the existing worker/UI flow plus six direct endpoint numerical comparisons; [browser receipt](evidence/casing-modes-browser.json). The latter is browser JavaScript agreement, not native candidate integration or full-browser receiving. The spinning baseline was regenerated and all non-source fields proved exactly unchanged before refreshing source pins; [receipt](evidence/casing-modes-spinning-refresh.json).
