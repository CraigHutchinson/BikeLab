# Geometry label equivalence

Work item [#39](https://github.com/CraigHutchinson/BikeLab/issues/39), independent of the tyre/rider stability work. Base: main at `2dd2be60073cd0c4e5b5e55548800984b270434a`.

The annotated geometry derives four shock-eye coordinates from normalized image points, pixel dimensions and a 210 mm eye-to-eye length. A different evaluation order or `hypot` implementation can change their last bits. Exact comparison used to turn an otherwise equivalent imported setup into "Custom geometry".

`geometryLabel` now admits an absolute difference of **8 × Number.EPSILON metres**, approximately **1.776e-15 m**, for those four derived coordinates only. This is a small numerical-equivalence allowance for the label, not a geometric measurement tolerance, a physical accuracy claim or proof of imported provenance. The authored pivot coordinates and shock stroke still match exactly. The original reference preset contains only authored literals and also retains exact matching. Nonfinite and nonnumeric values never match through the tolerance.

An edit inside the derived-coordinate allowance is deliberately indistinguishable from numerical roundoff in the existing parameter-only record format. Larger edits remain custom; tests include differences of 1e-14 m. Adding a provenance field or changing record schemas is unnecessary for this bounded display fix. The annotated label continues to say the geometry is estimated.

No coordinates are rounded or snapped, and no model, force law, solver or saved-record field changes. `geometryFor` retains its exact historical offset branch for legacy mechanics. Both the viewer and headless diagnostics consume the same label function.

## Local validation, 2026-10-28

- `node --test test/linkage.test.mjs test/bike-geometry.test.mjs test/pages.test.mjs`: 11 passed. Includes independent coordinate reconstruction, both adjacent binary64 values for each derived field, the tolerance boundary neighborhood, deliberate authored/custom edits, invalid values, exact save/load replay, rendering-coordinate agreement and all four historical signal hashes.
- `node scripts/local-ci.mjs quick`: 46 passed, with both vendor manifests verified. Node 24.22.0 on Windows. Browser-script syntax and Git whitespace checks pass.
- The existing browser suite now imports a rounded annotated setup, verifies the label, exports/reloads the exact changed value and checks that a nearby custom edit remains custom before restoring the preset.
- Actual browser interaction and capture verification remain pending: the in-app browser timed out reaching the isolated local server at port 4189. That failed attempt is not visual evidence. No hosted CI or Pages deployment is requested during the pause through 31 October.

Keep issue #39 open until that browser receiving check succeeds. These checks do not claim that the reporting native port or Apple/FMA hardware has been rerun.
