# Offline tyre diagnostic delivery checkpoint

After disclosure of PR96's complete Windows Node pass and unresolved browser replay failure, the user directed: "Continue, merge progress after each iteration." This checkpoint records the resulting bounded delivery decision for PR96. Future reviewable increments should reach main each iteration with their remaining work and actual evidence preserved.

PR96 adds offline pressure/energy diagnostics, Cartesian force/work mapping, an independent approximate constant-pressure static reference, scalar candidate screening and archived evidence. Relative to base main f90e895, it does not change production dist assets, CI workflows or repository protection. The PR90 evidence archive is also preserved. This is an experimental diagnostic merge, not tyre production acceptance, a release or a deployment.

Evidence: 21 focused tests pass; complete Windows Node receiving at 6774f81 passes 453/453 with zero failures/skips. The scalar screening CLI and inspected plot are received separately. The earlier Linux 440/453 receipt retains its thirteen environment-blocked checks. These are source-specific receipts, not an exact-head full attestation for every later documentation commit.

Known full failure remains: Edge articulated-standing replay differs at frames.1.wheels.0.ground.0 by about 2.65e-8 N, outside the unchanged comparison budget. Its source-bound full log, report and failing record are archived in docs/evidence/pr96-full-local-failure.json and the referenced archive. Subsequent browser checks were not reached. ci/policy failure is not rewritten as success. Normal merge is requested under the user's delivery decision; protections are not disabled or bypassed if GitHub rejects it.

#95 stays open. Next: implement and compare realizable energy-based casing candidates; establish stable unloaded pressurized equilibrium with explicit local pressure/material forces, volume/energy gradients and rim reactions; receive loaded shape/footprint; then compare complete runtime cost at equal accuracy. Scalar fits do not supply those properties. Calibration, insert clearance/energy/loss, damage and pressure-loss criteria, and production integration remain unreceived. PR91's contact-transition refinement failure and the rider browser replay defect remain separate follow-ups.

This decision does not declare the model calibrated or optimal, relax numerical tolerances, authorize production changes without their receiving checks, or turn skipped hosted full CI into a pass. The actual merge SHA is supplied by GitHub after merging.
