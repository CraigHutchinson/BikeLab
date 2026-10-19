# Iteration 17 evidence — faceted connected impacts

Implementation checkpoint `0afda98` was merged upstream as main `a9afcd5`. Hosted Linux/Windows and browser checks passed in [run 39269197164](https://github.com/CraigHutchinson/BikeLab/actions/runs/39269197164); main deployment run `39269525348` succeeded. The numerical receipt and viewer follow-up are separate small commits. Follow-up `0e1b4b1` passes all checks in [run 39310260209](https://github.com/CraigHutchinson/BikeLab/actions/runs/39310260209), with corrected captures inspected.

Reviewed canonical main `bd8e9390753060fd587d866618736c1cad080bc7` (merged PRs #17/#18); see [review](ITERATION_17_REVIEW.md). The existing connected hardtail/full-suspension bike and passive rider now accept exact authored vertical faces and coarse facets, with horizontal force inspection, unchanged ultimate travel/contact boundaries and explicit overloaded-impact stops. A near-rim typed-array mismatch and fixed-distance activation threshold were corrected.

Initial numerical controls: both assemblies complete 1 s over the synthetic 40 mm square and 60 mm coarse-faceted rocks. The 200 mm obstacle terminates at front casing-strain (full suspension) or contact-penetration (hardtail) support limits, with rollback and replay. Independent contact sums agree with wheel ground wrenches; root/bearing residuals remain below 1e-7. Accepted overlap, rim clearance, casing strain and component travel are checked. Collinear terrain subdivision gives identical complete results. Legacy complete 0.1 smooth records recompute unchanged physics into 0.2.

The recorded contact midpoint is checked against authored terrain within half the admitted overlap plus 10 micrometres. Face normals and convex-corner cones use an explicit 0.005 rad numerical accuracy budget. Measured full-run maximum errors were 0 on the full square case, about 0.001662 rad on the full faceted case and 0.001384 rad on the hardtail faceted case. A 0.3 s control at native distance tolerances 1e-10 and 1e-12 did not improve angular error monotonically (about 0.001662 versus 0.002502 rad); distance tolerance is not an angular bound. No default tolerance was tightened to imply unsupported precision.

`node scripts/faceted-impact-evidence.mjs` generates the [numerical receipt](evidence/iteration-17-impacts.json). `test/trail-impacts.test.mjs` checks admitted geometry, thin/grazing typed-state rim sweep, both assemblies, support limits, force/moment sums, replay, subdivision and legacy migration. The focused test command passes locally. Local `node --test` was also attempted; subprocess/server-dependent files fail in this restricted execution environment. The complete hosted Linux/Windows suite supplies the full-suite result; tests were not weakened or skipped.

## Separate resolution axes

Full-suspension front-impact controls use a common 0.4 s window and unchanged authored terrain. These are exploratory numerical sensitivities, not a passed convergence certificate.

| Profile | dt 31.25 µs: max balance residual | 15.625 µs | 7.8125 µs |
| --- | ---: | ---: | ---: |
| Square, 64 nodes | 0.6150 J | 0.2516 J | 0.1088 J |
| Faceted, 64 nodes | 0.6114 J | 0.2326 J | 0.0990 J |

Energy and momentum balance improve as the timestep is reduced, but the coupled contact trajectory and impulse are not uniformly converged. The final faceted horizontal impulse is −13.148, −12.047 and −12.969 N s respectively. The finest two endpoint positions differ by about 0.985 mm; the square counterparts differ by 0.152 mm. Small position differences do not establish accurate impact peaks.

At fixed 15.625 µs, increasing casing nodes from 64 to 128 changes endpoint position by 2.359 mm on the square and 1.188 mm on the faceted profile. Their total ground-impulse changes are respectively `[0.113, −1.070, 0.991]` and `[−0.113, −0.211, 0.012]` in x/z N s and y N m s. Node/contact multiplicity remains a material-model convergence concern. `peakSampledContactHorizontal` is the largest individual contact |Fx| per wheel, not the wheel resultant or a resolution-independent peak. The viewer's force history instead uses the complete wheel resultant.

All these controls complete inside the existing geometric/travel support limits. Exact collinear subdivision leaves the whole report unchanged. Replacing a square with a rounded or differently faceted rock changes physical shape and is not a numerical refinement. Adaptive search cannot repair this material-mesh sensitivity; the [nonuniform/adaptive design](ADAPTIVE_WHEEL.md) requires separate mechanics and transfer controls.

This is an uncalibrated frictionless impact MVP. Complete swept-casing CCD, curved hub paths, frame/fork collision, pressure-based tyre laws, local stresses, component fracture/deflation, articulated rider contacts, traction, layered materials, 3D turning and real-time performance remain open. Mesh-sensitive loads must not be exported as calibrated breaking loads. [Adaptive wheel design](ADAPTIVE_WHEEL.md) records the requested material-coordinate, hierarchy, ring-buffer and conservation review; adaptive remeshing is not implemented.

## Hosted and visual receipt

The [browser receipt](evidence/iteration-17-browser.json) records 177 passing tests with no failures/skips on each hosted OS, 13 complete Trail bike browser/headless exports with zero observed numeric difference, no captured browser errors, and ZIP artifact SHA-256 verification. The browser path also checks inputs, cancellation/supersession, delayed import, playback/lifecycle, horizontal force selection, and identical ten-station navigation.

Inspected actual full-suspension and hardtail square/faceted/tall-limit screenshots and square-impact 390/320 px captures. Sharp ground vertices, deformed casing, local contacts, wheel resultants, signed force histories and last-accepted support stops are visible. Narrow layouts fit. The tall-limit close-up revealed a clipped frame tip: camera bounds now include actual frame landmarks as well as wheels/rider/terrain. The near-zero rear horizontal force plot exaggerated numerical noise: plots now retain at least a 1 N range on each nonzero side. The fresh capture receipt confirms both fixes on full-suspension and hardtail overload views and a 320 px square-impact view. All 13 JSON exports are byte-identical to the implementation checkpoint. The final receipt-only commit retains the tested dist, scripts, test, workflow and package trees recorded in the JSON receipt.
