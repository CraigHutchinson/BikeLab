# Manufacturer geometry catalogue

The bicycle viewer now provides a selectable manufacturer-reference table and downloads the complete versioned catalogue as JSON. The shared data module is `dist/geometry-catalogue.js`; headless consumers can import `CATALOGUE` and `referenceRows`. Eight records cover three manufacturers, with source URLs and review dates, stable model/year/size/configuration IDs, SI dimensions and explicit unknowns. GPT-6.1 Sol researched the primary sources on 2026-10-16.

| Manufacturer / model | Records included | Direct manufacturer data | Mechanism evidence |
|---|---|---|---|
| [Orange Five Factory 2020 / Mk12](https://orangebikes.com/blogs/bike-archive-2020/five-factory-2020) | S, M, L, XL, XXL; 150 mm fork | Size-specific fit chart; 145 mm rear travel; 210 × 55 mm shock; static unsagged dimensions | Single pivot identified; no numerical pivot/eye coordinates |
| [Santa Cruz Hightower 3 MY23](https://web.santacruzbicycles.com/pages/product-support/hightower-3-my23) | M Low and M High | Fit chart; 150/145 mm travel; 210 × 55 mm shock; 30 × 8 mm mounting hardware at both ends | VPP upper/lower links, parts list and exploded drawing; no dimensioned kinematic pivots |
| [Transition Sentinel Carbon 2022 archive](https://www.transitionbikes.com/SupportFiles/SentinelCarbon2022.pdf) and [2020–24 support](https://www.transitionbikes.com/Product-Support-By-Model-Version-Details/Sentinel-Carbon/18) | MD, 160/150 mm travel | PDF page 16 fit chart; 205 × 62.5 mm shock; upper trunnion and lower 25 × 8 mm hardware | Separate linkage model needed; no numerical pivots extracted |

Useful additional schematic candidate: [Trek Fuel EX MY23 service manual, revision 2](https://media.trekbikes.com/image/upload/v1691156199/TK_Fuel_Ex_ServiceManual_MY23_Rev2_EN-GB_2023-10-13.pdf), pages 4–7, identifies ABP, rocker, main pivot and shock hardware. Page 7 specifies 185 × 55 mm shock dimensions and upper 54 × 10 / lower 40 × 8 mm mounts. A matching size/settings-specific fit chart was not verified in this pass, so this is a source candidate rather than a selectable record. Its geometry and progression adjustments must be recorded independently.

## Data contract and precision

`schema` is `bikelab-geometry-catalogue-1`. Lengths are metres; angles are radians. Frame and suspension groups each carry a source ID. Additional mounting hardware has its own source ID. UI conversion to mm/degrees is presentation only. Source numbers are nominal published dimensions, not measured values with known uncertainty. Missing fields are `null`, never zero or copied from a different model. Mass distribution, stiffness, failure strength and tyre dimensions are not inferred from a chart.

BB drop is positive downward from the axle datum: Orange's −25 mm axle-relative BB height becomes +0.025 m drop. Santa Cruz's “rear centre” retains its own field; do not silently interpret it as a measured chainstay link length. Shock mounting length preserves the manufacturer's dimension, but conventional eyes and trunnion hardware are distinct. Nominal travel divided by shock stroke is an average ratio, not a leverage curve.

Keep year, size, wheel/fork setup, flip-chip/progression position, sag convention and document revision separate. The Orange page's 2025 publication timestamp does not change its 2020 model identity. Transition's fit data is from the 2022 PDF, while support covers 2020–24; it is not evidence that all years have identical fit. The alternative 140 mm Sentinel setup uses 57.5 mm stroke and is not merged into the 150 mm record. Unknown sag conventions must be resolved before calibration.

## Integration gate

Selecting a reference displays facts and sources without modifying the current calculated rig. Every record has `simulationPreset: null`, with numerical pivot coordinates, shock-eye coordinates and link lengths explicitly unknown. The separate annotated layout remains an image-informed estimate; matching its shock specification does not make it an Orange production preset. Current frame/axle coordinates are synthetic and are not overwritten piecemeal from a fit chart.

To promote a record to an accurate selectable simulation preset, obtain dimensioned pivot/eye/axle coordinates in a defined pose and coordinate system (or CAD/measurements with uncertainty), support its topology, reconcile frame fit and shock/travel, acquire mass/inertia and attachment data, and independently verify the kinematic curve, equilibrium and force/work mapping. Exploded service drawings identify assembly relationships but must not be treated as scale drawings. Preserve source URLs/revisions and actual measurements so a future catalogue update cannot silently alter saved runs. Hardware bolt dimensions and assembly torques are not component breaking loads.

Future catalogue extension: verified Trek fit/configuration records, additional hardtail references, manufacturer CAD or dimensioned suspension drawings, sourced masses/inertias and versioned calibration evidence. None of the inspected sources yet closes the exact suspension-coordinate requirement.
