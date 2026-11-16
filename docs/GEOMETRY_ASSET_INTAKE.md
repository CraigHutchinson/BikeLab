# Geometry asset intake

Status: proposed intake contract. Reviewed 2026-11-16.

This note separates licensed open geometry, manufacturer reference material and
dynamic benchmark data. An asset's availability as a drawing, mesh or chart is
not evidence that it represents a calibrated production bicycle.

## Intake classes

| Class | Candidate | Retention rule | Permitted use | Not evidence for |
|---|---|---|---|---|
| Open geometry fixture | [OpenFrame v0.2](https://github.com/openframe-cc/openframe-v0.2-experimental) | Retain its MIT licence, upstream revision, file hash and explicit experimental/non-ridable notice with every derived asset. | Importer/renderer fixture; mesh/coordinate conversion tests. | Production geometry, strength, handling, calibration or rideability. |
| Manufacturer reference | Orange Five, Transition Sentinel, Trek Fuel EX support material | Retain source URL, review date, model/year/size/configuration and facts transcribed. Link to manufacturer files; do not redistribute decals, manuals or images unless a separate licence permits it. | Nominal catalogue fields, UI citations and manual visual reconstruction with uncertainty. | Pivot/eye coordinates, mass/inertia, kinematic curves or a simulation preset. |
| Dynamics benchmark | BicycleParameters / Meijaard benchmark | Pin upstream release/revision, parameter record, source URL, fetched-file hash, units and coordinate mapping. | Independent rigid-bike 3D geometry/dynamics acceptance checks. | MTB suspension, tyre/terrain response, rider control or production-bike calibration. |
| Synthetic design corpus | BIKED / FRAMED | Retain the dataset/repository licence and exact version; label every selected design synthetic/community-designed. | Import/schema, visual and design-space fixtures. | A manufacturer specification or measured physical behaviour. |

## Required manifest fields

Every accepted source or local derived asset records: `id`, `class`, `title`,
`upstreamUrl`, `upstreamRevision` (or publication/version), `retrievedAt`,
`licence`, `hash`, `files`, `modelYear`, `size`, `configuration`, `units`,
`coordinateFrame`, `provenance`, `uncertainty`, `allowedUses` and
`prohibitedClaims`.

Use SI units internally. Preserve source terminology rather than silently
equating `rear centre` with chainstay or a catalogue geometry chart with
dimensioned kinematics. A mesh must retain its length scale, coordinate
transform, triangle/solid status and any repair/conversion operation.

## First receiving work

1. Add a manifest-only OpenFrame entry and a licence copy; do not load it into
   bike mechanics.
2. Verify a lossless (or explicitly bounded-loss) STEP/GLB/STL import path,
   including scale, handedness and up-axis checks against declared dimensions.
3. Add one BicycleParameters benchmark record in a separate rigid-bike test
   module, with documented source-to-BikeLab axis/sign conversion.
4. Keep manufacturer records informational until a specific bike has measured
   pivot/eye/axle coordinates, mass properties, configuration and validation
   evidence.

No asset admitted by this note grants a structural, safety, handling or
calibration claim.
