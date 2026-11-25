# Static footprint delivery, 25 November 2026

The [static footprint](../PRESSURE_FOOTPRINT.md) passes all 21 flat-plane states across three pressures, including mesh refinement, conservative return and independent reaction checks. See the [numerical receipt](../evidence/pressure-footprint-numerical.json) and [Edge receipt](../evidence/pressure-footprint-browser.json). Complete cycles took 9.76-11.10 seconds in Node and 9.93-10.83 seconds in Edge. Cancellation took 13 ms. Desktop and mobile layouts were inspected. The virtual-clock timeout test stalled and was replaced by a passing real 60-second timeout check. All 513 tests passed in the complete Windows Node run during implementation. Final focused page/record checks passed.

Next: #112 native equilibrium and loaded refinement before #114 moving-wheel integration. The equal-load mesh and settling failures still apply. Measured calibration awaits data under #117.
