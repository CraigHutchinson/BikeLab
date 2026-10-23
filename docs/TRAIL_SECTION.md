# Short 2D trail receiving experiment

Select **Short trail · bump and drop · guided rider** in Trail bike, choose full suspension or hardtail, then calculate and play/scrub the recorded run. The authored profile and launch remain editable through the existing scenario JSON. The headless equivalent is `run(preset('trail', bike))`; export/import uses the existing complete trail record.

The 1.5 s fixture launches at 2.5 m/s from a flat zero-height shelf. A 10 mm bump precedes a rising 90 mm crest, then a faceted descent reaches terrain 80 mm below the shelf. The surface remains continuous and rigid. This is a synthetic receiving case, not a measured trail, disconnected gap, calibrated tyre/soil model or anatomical rider. The guided rider and authored suspension compression carry their existing mass/energy semantics. The other checkout's standing-equilibrium and saddle work remains separate.

Do not force a successful jump by relaxing pitch, suspension, casing, rim, penetration or temporal-resolution guards. A ramp alone is not evidence of a jump. Distinguish front-wheel unloading, rear-wheel unloading, both-wheel flight after prior support and later recontact. Ignore the unloaded time-zero contact when counting flight. Current recorded contact events are sampled every 5 ms; they do not locate exact take-off times.

`node scripts/trail-section-review.mjs` saves both bikes at 31.25 and 15.625 μs timesteps in `artifacts/trail-section/`. The postprocessor independently sums recorded tyre forces, checks accepted travel/geometry limits and reports sampled support transitions, maximum energy/work and momentum residuals, peak load and timestep differences. Two timesteps are a sensitivity check, not a proven convergence order or physical calibration. It does not benchmark real-time performance.

The historical legacy `.4` cases below all complete within the existing guards. Current presets use the separately versioned [canonical launch contract](TRAIL_CANONICAL.md); receive its results separately. The [source-hashed receipt](evidence/iteration-20-trail-section.json) retains complete sampled contact transitions, record hashes and sensitivity results:

| Bike | Timestep / μs | Peak ground force / N | Max fork / shock compression / mm | Max energy/work residual / J |
| --- | ---: | ---: | ---: | ---: |
| Full | 31.25 | 1765.2 | 49.71 / 29.18 | 2.831 |
| Full | 15.625 | 1721.7 | 49.69 / 29.28 | 1.127 |
| Hardtail | 31.25 | 2522.3 | 57.83 / 0 | 2.950 |
| Hardtail | 15.625 | 2523.8 | 57.78 / 0 | 1.207 |

Initial total energies are 799.3 J and 809.6 J; do not interpret these as zero-preload launches. Halving the timestep reduces the maximum energy/work residual to about 40% of its coarse value and reduces the momentum residuals. Peak load differs by 2.53% for full suspension and 0.057% for hardtail. This is numerical sensitivity evidence, not a calibration pass.

**Event timing remains sensitive:** full suspension has a single saved front-unloaded frame at 0.610 s that disappears at the finer step. The main front-unloaded interval starts at 0.665 versus 0.670 s; rear unloading starts at 1.200 versus 1.195 s. Do not treat the first unloaded sample as a converged take-off time. Both wheels recover positive recorded support after their separate unloaded intervals. No sustained sampled interval with both wheels unloaded occurs after initial support. Force-only zero-support intervals do not by themselves prove geometric separation. Do not describe this fixture as an active bunny hop or a completed jump.

The pinned-browser receiving check selects the actual preset on both bikes, compares exact model/launch receipts and the complete exported record with Node within the new 1e-9 normalized budget, inspects the longest sampled front/rear unloading intervals and verifies a later both-supported frame, and captures desktop/390 px views. Hosted results and actual capture inspection are pending at this implementation checkpoint. Both pinned Chromium and newer Edge 157 fail the legacy-guided 1e-7 replay budget on this full-suspension scenario; [the preserved failed case](evidence/iteration-20-guided-edge-portability.json) requires separate canonical-guided qualification. It does not invalidate the unchanged headless sensitivity results, and no tolerance is relaxed. This extends the visual track consumer while preserving future active pumping/wheelie/hop controls, 3D lateral/turning, finite failure/blowout, layered soil and adaptive/multirate work as separate gates.

## Canonical trial, 2026-10-23

The separately versioned `.5` policy at `1242d09` completes all four cases. [Its source-hashed receipt](evidence/iteration-20-canonical-trail-section.json) preserves the new results independently of the legacy table above.

| Bike | Timestep / μs | Peak ground force / N | Max fork / shock compression / mm | Max energy/work residual / J |
| --- | ---: | ---: | ---: | ---: |
| Full | 31.25 | 1750.5 | 49.71 / 29.18 | 2.833 |
| Full | 15.625 | 1710.3 | 49.69 / 29.28 | 1.135 |
| Hardtail | 31.25 | 2518.4 | 57.83 / 0 | 2.890 |
| Hardtail | 15.625 | 2514.4 | 57.77 / 0 | 1.210 |

Peak-load sensitivity is 2.35% for full suspension and 0.159% for hardtail. The fine-step maximum energy residual is 40.1% / 41.9% of the coarse value. Full-suspension shock buffers are active in 40 / 39 saved frames, with peak absolute buffer forces 434.7 / 462.5 N; the receiving run exercises the new force mapping. Both bikes retain individual unloading and support return without sustained sampled both-wheel zero support. The brief coarse-only front event and 5 ms event-time sampling remain limitations. These values describe numerical trials within existing limits, not component strength, a solved standing launch, a complete jump or real-time performance.
