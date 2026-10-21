# Rider and wheel load distribution review

User concern, 2026-10-21: the moving-rider screenshot appears front-loaded, while ordinary rider support should principally pass through pedals and, when seated, the saddle. This review uses the two complete hosted `*-articulated-standing.json` records from [implementation run 39631713678](https://github.com/CraigHutchinson/BikeLab/actions/runs/39631713678). GPT-6.1 Sol independently checked the load paths and default passive laws. No new simulation, physical calibration or performance measurement was run.

## What the captured state shows

The front tyre carries more ground load at the final frame, but most upward rider support passes through the feet. These are different force balances:

| At 0.1 s | Full suspension | Hardtail |
| --- | ---: | ---: |
| Front / rear tyre vertical force | 110.3 / 70.2 N | 170.7 / 44.0 N |
| Front share of total ground force | 61.1% | 79.5% |
| Hand / foot vertical force **on rider** | 32.6 / 130.4 N | 49.9 / 147.7 N |
| Feet's share of combined upward interface force | 80.0% | 74.8% |
| Combined upward rider support | 163.0 N | 197.6 N |
| Rider COM drop over the run | 34.9 mm | 38.0 mm |
| Final rider COM vertical velocity | −0.709 m/s | −0.722 m/s |

Feet carry more upward force than hands at every saved 5 ms sample. The sampled trapezoidal hand/foot support impulse gives feet shares of 80.7% / 77.5%; this is a coarse postprocessing estimate, not the integration-step work/impulse ledger. The current UI's hand/foot values are force **magnitudes**, which include horizontal forces. They must not be interpreted as vertical support or percentages of body weight.

The stronger limitation is the lack of a maintained stance. The 70 kg rider weighs **686.5 N**; the complete 83 kg system weighs **814.0 N**. Final rider support is only 24% / 29% of rider weight, and total ground support is only 22% / 26% of whole-system weight. From `Fz − mg = m az`, the forces imply rider COM acceleration −7.48 / −6.98 m/s² and whole-system COM acceleration −7.63 / −7.22 m/s². These accelerations are inferred from force balance, not independent acceleration residual measurements. The recorded COM drop and segment-weighted COM velocity separately establish that the rider is sinking.

## Cause and interpretation

The preset is already labelled unseated relaxation and explicitly has no saddle. Its passive rest angles equal its authored initial joint angles and initial relative rates are zero, so all four initial spring/damping torques are zero. Suspension initial compression and tyre deformation are also not solved as a coupled gravity equilibrium. The model begins relaxing immediately. It tests constrained motion and accounting over 0.1 s; it does not reproduce a rider actively maintaining a standing position.

The illustrative spring torques at the edges of the ±0.3 rad domains reach only 36 / 27 / 7.5 / 4.5 N m at hip/knee/shoulder/elbow. Damping supplies no static support at equilibrium. This does not prove no equilibrium exists anywhere in the admitted domain, but none has been solved or accepted. Do not extend the transient until a limit is reached and call that standing balance, or alter forces to produce a preferred screenshot.

The rider COM is only 48 / 63 mm ahead of the retained-foot point at the final frame; these records do not show the rider COM placed over the front wheel. The segment masses and pose remain illustrative, so this is not an anatomical validation. No reversed hand/foot force sign or hidden saddle load was identified in this bounded review.

For a complete stationary system on flat ground with no external applied moment, axle reactions are determined by the total COM: `Nfront = M g (xCOM − xrear) / (xfront − xrear)` and `Nrear = M g − Nfront`. Pedal force can load **both** wheels through the frame; handlebar support is not front-wheel load. Redistributing internal hand/foot/saddle forces at fixed total COM does not change that static balance. Dynamic acceleration, angular momentum change, suspension and tyre motion make the screenshot's transient split different from static weight distribution.

Even the rider-only static split depends on geometry and horizontal interface forces. With no saddle, taking moments about the foot gives `(xhand − xfoot) Fhand,z = m g (xCOM − xfoot) + (zhand − zfoot) Fhand,x` in a stationary planar pose. A seated third support adds another unknown load path. A fixed universal hand fraction cannot replace posture, joint support and contact mechanics. The [reviewed MTB field evidence](RIDER_SEATED_UNSEATED.md) motivates separate load measurements, not one calibrated percentage for all situations.

## Required follow-up

1. Expose signed hand/foot vertical components alongside their horizontal components and the tyre loads; add saddle load when implemented. Keep magnitudes labelled as magnitudes. Make the passive sag state prominent near the readouts, including that it is not balanced standing.
2. Receive a gravity-balanced unseated reference with independently checked joint preload or explicitly bounded active support, matched chassis/rider COM, tyre/suspension equilibrium and no hidden settling or teleportation. Record residual velocities/accelerations and force/moment balance. Account for any work introduced by changing rest angles or control.
3. Receive seated equilibrium and saddle unloading/recontact with [finite unilateral contact](RIDER_SADDLE_PLAN.md). Keep intended posture separate from measured support; support must disappear when contact unloads. Most-load-through-feet/saddle is a scenario-dependent validation question, not a hardcoded allocator.
4. Compare fixed-COM load paths, COM shifts, braking and impact controls using signed forces, momentum and work. Preserve existing domains and last-accepted rollback; add measured rider data before calling a default representative of normal riding.

The [machine receipt](evidence/iteration-20-rider-load-review.json) retains record hashes, every sampled load/COM value, formula-derived quantities and spring bounds. Reproduce it with `node scripts/rider-load-review.mjs full-articulated-standing.json hardtail-articulated-standing.json output.json`. This review changes no physics, UI, parameter or acceptance budget. The existing numerical gates remain passed; maintained standing and seated support remain open D5a requirements.

## Subsequent support display

The next UI increment implements item 1: signed hand/foot x/z components, explicitly labelled magnitudes, separate rider histories, rider weight, net vertical force including gravity and segment-weighted COM vertical velocity. It displays no percentages and does not classify a momentary force balance as equilibrium. Applied-record provenance is explicit during edits; zero-gravity, no-frame and mode-switch cases have dedicated checks. No simulation force, parameter, record version or balance acceptance criterion changed. Hosted browser verification remains pending at this implementation checkpoint.
