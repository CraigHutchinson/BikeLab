# Iteration 19 evidence — connected hub drive and brakes

Reviewed merged traction PR #21 at main `24a181d80ed975ed6c32cd93c370fa88814e1898`, then PR #22 implementation `42fdac8dfbfdf5f336d12d3c06f4f3b11bc8fea1`. The [review](ITERATION_19_REVIEW.md) retains the source conventions and receiving contract. D4b now receives scheduled rear hub drive and front/rear brake capacities in the same connected hardtail/full-suspension bike and guided rider. The command editor, drive/brake presets, spin/brake histories, worker, CLI and saved replay share version 0.4 scenarios. Drive is an abstract relative hub torque; brakes use native regularized friction loss.

## Independent controls and review

Five focused tests cover bounded, immutable command schedules and historical 0.3 replay; rigid rotor acceleration, rest, reversal, under/over-capacity braking and release; a free rotor/carrier pair with equal-and-opposite torque, angular momentum and relative-coordinate work; connected event timing, force/moment/work ownership and recording invariance on both bikes; and airborne momentum plus overload rollback/replay. The rotor/pair references are separate from the connected bike diagnostics. Command boundaries between regular samples and at the final tick are checked. Legacy 0.1–0.3 records cannot smuggle in new controls; a modern record must contain a valid command array.

GPT-6.1 Sol reviewed the implementation against pinned native source conventions. It found no consequential mechanics defect in old-command endpoint integration, command-boundary application, drive/brake countertorque or terrain-moment ownership. The resumed review did find an input-validation gap: a programmatic modern record with `commands: undefined` silently defaulted to zero controls. Commit `eb5c3d05b735b94d6a1c4d05fbe65ae375104b4d` rejects that input, adds a regression and updates the model documentation. The focused drive-controls test file passes locally.

Coverage limitation: the overload regression rejects an interval under its old command and verifies that a command at the rejected endpoint never takes effect. It does not independently force a failure specifically during the second, new-command endpoint evaluation. That restoration branch was reviewed, but has no dedicated fault-injection control.

## Separate timestep and casing evidence

`node scripts/drive-brake-evidence.mjs` regenerates the [13-trial numerical receipt](evidence/iteration-19-drive-brake.json). All trials complete within the current travel, casing and support limits. The flat 0.3 s examples start at 1.5 m/s with matching nominal wheel spin and homogeneous friction 0.6. Drive applies 20 N m at the rear; braking applies front/rear capacities of 55/35 N m. Both apply at 0.05 s and release at 0.2 s.

| Assembly | Control | Final COM speed x (m/s) | Drive work (J) | Brake work (J) | Maximum energy-balance residual (J) |
| --- | --- | ---: | ---: | ---: | ---: |
| Full suspension | Coast | 1.49597 | 0 | 0 | 0.44751 |
| Full suspension | Drive | 1.58661 | 12.92942 | 0 | 0.45097 |
| Full suspension | Brake | 1.08449 | 0 | -43.67329 | 0.42406 |
| Hardtail | Coast | 1.49498 | 0 | 0 | 0.44096 |
| Hardtail | Drive | 1.58678 | 13.28655 | 0 | 0.45529 |
| Hardtail | Brake | 1.09085 | 0 | -42.76051 | 0.44805 |

Across all trials, constraint-power partition discrepancy is below 7.4e-13 W, sampled root-wrench components below 1.14e-11 in their respective SI units, and sampled ideal-bearing moment below 3e-12 N m. Repeating diagnostics changes no state. No sampled brake torque exceeds its capacity. Sampled total brake power is nonpositive in these trials; this does not establish exact static lock or universal instantaneous passivity for regularized constraints.

The separate full-suspension timestep control uses 64 casing nodes, a 0.15 s horizon, and braking from 0.05 to 0.1 s:

| Step (microseconds) | Maximum energy-balance residual (J) | Brake work (J) | Horizontal impulse (N s) | Final front/rear relative spin (rad/s) |
| --- | ---: | ---: | ---: | ---: |
| 31.25 | 0.21195 | -15.46999 | -12.08987 | 3.59463 / 3.42553 |
| 15.625 | 0.08407 | -15.49353 | -12.15529 | 4.38148 / 3.97665 |
| 7.8125 | 0.03806 | -15.57394 | -12.24235 | 3.70726 / 3.67712 |

Energy balance improves with refinement, while wheel spin is not uniformly converged. Independently varying 32/64/128 casing nodes at 15.625 microseconds gives horizontal impulse -11.50846/-12.15529/-11.44113 N s and brake work -15.57057/-15.49353/-15.26793 J. These numerical sensitivities do not certify stopping distance, peak loads, physical grip or mesh convergence.

The 0.02 s airborne drive/brake/reversal control has zero ground impulse. Halving the step from 31.25 to 15.625 microseconds reduces maximum energy residual from 0.002656 to 0.001334 J. Endpoint horizontal/vertical/angular momentum-balance residuals decrease from approximately (4.94e-5 N s, 2.64e-6 N s, 4.01e-5 N m s) to (2.56e-5, 1.45e-6, 2.07e-5) in the same units. This supports internal torque/work accounting, independently of ground contact, without establishing calibrated rider/bike response.

## Receiving verification and visual inspection

Implementation `42fdac8` passed all 188 tests on both Linux and Windows, without failures or skips, plus the complete hosted browser checks in [run 39386186885](https://github.com/CraigHutchinson/BikeLab/actions/runs/39386186885). Chromium 141.0.7390.37 produced 23 complete Trail bike exports with zero maximum numerical difference from headless replay. These retain smooth/edge/faceted/flight/overload controls, both assemblies and traction, and add both drive/brake presets, an authored schedule and legacy traction import. Browser checks exercise schedule editing/restoration, invalid times, spin/brake accessible labels and existing lifecycle/import/cancellation behavior. No captured page or console errors were reported.

The downloaded Trail bike artifact's SHA-256 was verified. Actual full/hardtail drive and brake images, the 320 px full-page brake image and the separate bike viewport image were inspected: bike/contact geometry, command rows, spin history and capacity/solved-torque readouts are legible. The narrow sidebar is long but showed no horizontal overflow. The [browser receipt](evidence/iteration-19-browser.json) records the exact run, artifact digest, agreement results and inspected image hashes. These captures verify those rendered states, not production-bike geometry or physical calibration.

Local full-suite/browser execution is restricted by child-process/loopback permission errors in the resumed environment; hosted Linux/Windows/browser evidence supplies those checks. Fresh exact-head success after the replay-validation follow-up remains a merge gate. Final workflow and Pages deployment links are recorded on [PR #22](https://github.com/CraigHutchinson/BikeLab/pull/22).

D5 articulated rider contacts/control is the next connected slice. Chain/crank/freehub mechanics, rider power limits, brake thermal/hydraulic response, rolling loss, calibrated tyre/terrain laws, 3D turning/combined grip, layered terrain and mud history, sourced structural failure/pressure loss, scanned trail provenance and measured real-time fidelity remain open. Unsupported overload still stops explicitly; neither brake capacity nor an attachment reaction is a component-strength criterion.
