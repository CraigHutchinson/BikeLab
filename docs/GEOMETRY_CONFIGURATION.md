# Single-pivot geometry and configuration diagnostics

Model v0.5 receives the annotated high-eye layout in the physical solver and renderer, plus geometry controls and sag/load/leverage diagnostics. It remains an uncalibrated planar platen fixture. The default is an image-informed mechanism, not an Orange Five production preset.

## Source and dimensions

The [Orange Five Factory 2020 reference](https://orangebikes.com/blogs/bike-archive-2020/five-factory-2020) specifies a 210 × 55 mm shock and 25 mm BB drop. The [image receipt](evidence/geometry-reference-sources.json) retains its URL and SHA-256. Its actual downloaded dimensions are **2670 × 1558**, distinct from a resized conversation preview.

The user identified normalized image coordinates (x right, y down):

| Landmark | x | y | Use |
|---|---:|---:|---|
| Shock body | 47.0% | 46.1% | Component identification, not eye midpoint |
| Main-frame pivot | 43.4% | 61.8% | Origin of swingarm eye offset |
| Swingarm shock eye | 40.8% | 46.3% | Rotating upper arm attachment |
| Main-frame shock eye | 50.7% | 43.9% | Rigid frame attachment |

Convert normalized differences with the original image width/height, invert y into +z, and scale uniformly so the two eye centres are 0.210 m apart. Pivot placement relative to the existing BB is an **estimate**: 40 mm forward, 80 mm upward. Retain the synthetic frame origin and unloaded axle positions; do not shift wheelbase while changing the pivot. The derived layout is:

| Quantity | Frame or arm coordinates (m) |
|---|---|
| BB (display datum) | frame (0, −0.315) |
| Main pivot | frame (+0.040, −0.235) |
| Frame shock eye | frame (+0.193322035, −0.015623079) |
| Arm shock eye | relative to pivot (−0.054607848, +0.189963256) |
| Rear axle | frame (−0.450, −0.290), arm (−0.490, −0.055) |
| Extended shock / stroke | 0.210 / 0.055 |

The arm eye is above the pivot. Positive +y swing rotation raises the rear wheel and moves the high arm eye forward, shortening the shock. Unlike the earlier steep 351.141 mm fixture, this produces the near-horizontal mechanism identified in the photograph. The renderer uses the same transformed eyes/axles as the native solver and shows the frame eye mounted to the down-tube region by a rigid schematic bracket.

Do not mistake displayed decimal precision for measurement accuracy. Perspective, source bike sag, eye occlusion, annotation placement, inferred pivot placement and synthetic axle/frame proportions limit this fit. No calibrated uncertainty interval is established. The source's shock specification does not prove that its photographed installed eye distance was exactly the extended length. Those are explicit modelling assumptions. Real production-bike calibration requires measured pivot/eye coordinates, loaded geometry and mass/inertia data.

## Editable geometry and admissibility

The viewer exposes frame-local pivot x/z, frame-local shock eye x/z, pivot-local arm eye x/z and shock stroke. Presets load the annotated or original reference layout. All are in metres. `geometryFor` derives separate arm-local axle coordinates from the unchanged frame axle. Geometry changes therefore affect lever arms, native dynamics, buffers, travel checks, drawing and diagnostics together. Hardtail geometry settings are stored/validated but dormant.

Validation checks finite parameter ranges, a strictly positive compression derivative over the entire admitted 0–0.4 rad angle range, minimum eye separation, reachable shock stroke and nonoverlapping buffer zones. It evaluates analytic extrema of the sine/cosine derivative numerator, not a sampled pose grid. This excludes toggles/sign reversals and coincident eyes in this bounded mechanism family. More general linkage topologies require a separate model. Valid geometry does not promise every mass/spring/input combination settles or survives travel; unsupported motion still stops at the last accepted endpoint.

The shock's compression is s=L(0)−L(theta). Native tendon forces and the existing shock buffers consume the exact geometry-dependent j=ds/dtheta. The buffer moment remains B*j, with no duplicate wheel spring or leverage multiplier. The stroke limit, not the full 0.4 rad angle bound, normally limits rear travel. Endpoint detection remains discrete; no rigid impact or component damage is introduced.

## What the diagnostics mean

After settling, both browser and CLI report initial axle loads/front share, fork sag/travel fraction, shock sag/stroke fraction, extended eye distance, derived full-stroke vertical rear travel, j in m/rad and instantaneous frame-vertical wheel/shock motion ratio. The curve plots d(z_rear)/ds against supported shock compression; replay marks the current compression. This ratio is neither a constant rear wheel rate nor a complete frame/pivot reaction wrench. Actual world travel additionally includes frame heave/pitch.

Use `node scripts/bike-rig.mjs [setup.json] [run.json]` for the same diagnostics and physical run. The original shock-buffer experiment buttons explicitly load original geometry so their published receiving cases remain reproducible. New default-geometry buffer and refinement cases are separately tested.

## Historical reconstruction

v0.5 records require all seven geometry fields. Complete v0.1–v0.4 records explicitly restore original geometry (and their existing rider/fork/shock migration rules). The old encoded arm z offset is retained exactly for numerical replay. Four pre-change v0.4 hardtail/full and fixed/passive records reproduce every channel and summary exactly, checked by immutable trace hashes. Stored sample arrays and stored `geometry` objects are not trusted on import; the complete setup is validated and rerun.

The original 25 mm BB drop remains corrected. Next work requires measured production geometry and mass distribution, rider attachment load paths and supported end-stop/failure loads. The separate distributed contact, layered soil/root/mud, 3D traction and adaptive-rate gates remain open.
