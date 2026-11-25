# Bounded pressure-aware static footprint (#113)

The new `pressure-footprint.html` station solves the shared relaxed membrane/sealed-gas model against a flat plane. Open it from the legacy footprint station. Select 1.2, 1.6 or 2.0 bar, calculate, then scrub the seven load/unload equilibria. Save a versioned record; loading validates its input and recalculates instead of trusting saved output.

## Deliberately received scope

The illustrative circular section has 622 mm bead diameter, 30 mm bead spacing and 50 mm reference height. Material rigidities, ambient pressure and gas exponent are the existing reference values, with visible uncalibrated provenance. The admitted circumferential resolution is 256 stations at zero phase. The only lowering cycle is 0/1/2/4/2/1/0 mm. The worker evaluates actual equilibria; it does not interpolate archived samples or convert pressure to a foundation stiffness.

The displayed load is the balancing fixture reaction for prescribed lowering. It is not an inverse target-load calculation or rider-weight simulation. Footprint means active-vertex span, not a measured contact area. Pressure, volume, lower profile, load/deflection and rim clearance come from the same geometry. Terrain, arbitrary material/section inputs, large strain, near-rim/insert behaviour, native dynamics and measured failure predictions are outside this consumer. Unknown input fields or pressures refuse; the unchanged solver rejects nonconverged, compressive or stability-indeterminate states.

The original script imports now reexport the shared browser implementation. [Extraction evidence](evidence/pressure-footprint-extraction.json) records exact equivalence apart from import paths. Historical receipts are unchanged; future diagnostic generators hash the shared implementation as well as their entry points. Legacy footprint models and saved files remain at the original station.

## Receiving

Run `node scripts/pressure-footprint-check.mjs` for all 21 states. Compare coordinates, energy, pressure, volume and reaction to the archived 256-station reference; compare all reactions to the 512-station reference with the existing 1 N + 5% budget. Return states retain the 1e-4 N and 1e-8 J budgets. At each pressure, an independent finite difference of minimized potential checks reaction within 0.003 N. This reuses the received material law; it does not constitute measured calibration.

Run `node scripts/pressure-footprint-browser-check.mjs` with the existing isolated Playwright package in `NODE_PATH` and installed Edge in `BIKELAB_CHROMIUM` (see [local preview](LOCAL_PREVIEW.md)). It serves the real modules/worker beneath `/BikeLab/`, downloads actual saved records, compares them to headless output, reloads/recalculates, scrubs loading and unloading, cancels an active worker, supersedes one with changed inputs and refuses a legacy record. A wall-clock check exercises the 60-second timeout with an inert worker. Desktop and narrow-screen captures are separate visual evidence.

The first browser comparator attempt failed on finite-difference diagnostic noise, while physical differences were around 1e-12 N/J and 1e-9 Pa. The corrected comparator retains physical tolerances and requires both engines' unchanged positive-stability admission plus overlapping eigenvalue error bounds; it does not demand identical roundoff estimates. The initial failed receipt is preserved. No physics gate or solver tolerance was loosened.

Complete calculation costs include all seven states and stability checks; browser costs additionally include worker startup and transfer. Frame-gap percentiles and maxima are both retained: headless timing is a local responsiveness observation, not a universal frame-rate guarantee. Cancellation discards all partial states. Inputs/results use generation identity; a superseded worker cannot publish. A 60-second wall-clock limit bounds waiting on slow/stalled workers; it is a UX timeout, not physical time or a solver tolerance.

Final counts and timing receipts are recorded in the working checkpoint after verification. This focused receiving is not full-browser, cross-platform, full hosted CI or native dynamic acceptance.

## Next balanced increment

#112 owns native stationary force balance and a physically appropriate loaded fixture. Reconcile the documented contact/rest issues and receive perturb/release, mesh/timestep and equal-accuracy cost before promoting a relaxed moving-wheel consumer in #114. Then #115 reuses it with configured bike/rider mass; #116 owns near-rim/inserts. #117 remains blocked on measured tyre data. #95 stays retired as superseded; this static delivery does not erase native failures.
