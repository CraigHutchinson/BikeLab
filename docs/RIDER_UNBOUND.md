# Bounded unbound rider probe

This increment implements a **0.02 s authored planar free-flight probe**, using the same five aggregate rider segments and passive joint laws as the attached model, directly under the native world. There is no carrier mass, bike, ground, attachment constraint or collision in this experiment. It is a prerequisite for independent rider motion, not live detachment or a complete jump/crash model. The original Trail physics and record formats are unchanged.

## Run and inspect

Open **Unbound rider · short free-flight probe** in [Trail bike](https://craighutchinson.github.io/BikeLab/trail-bike.html). Choose a launch and timestep, then calculate. The independent worker reports accepted steps, supports cancellation, and exports the accepted record. Dashed grey is the initial skeleton, orange the last accepted skeleton, and cyan the sampled whole-rider COM. World x/z use equal scale without magnification; the short motion can make the two poses overlap. No ground line is drawn because there is no ground model.

```sh
node scripts/rider-posture.mjs --unbound > unbound.json
node scripts/rider-posture.mjs --unbound authored-input.json > authored-run.json
```

Exit status is 0 for a complete horizon, 2 for initial mechanical rejection or termination with an accepted prefix, and 1 for invalid input or an unexpected calculation error. Extract a record's `spec` to a separate JSON file to reproduce it; the whole output record is not an input or continuation capsule. Existing construction, `--native` and `--passive` modes retain their meanings. The new CLI mode caps input files at 8 MiB.

## Input and coordinate meaning

`runUnbound(input, onProgress)` and the CLI accept `bikelab-rider-unbound-input-0.1`. Omitted top-level fields select the illustrative defaults. The canonical `spec` is copied and frozen before asynchronous runtime loading, so caller edits cannot change an in-flight run.

| Field | Meaning and admitted range |
| --- | --- |
| `passive` | Existing [passive rider specification](RIDER_PASSIVE.md), including authored posture and absolute joint laws; unchanged validation |
| `q` | Seven scalars in `riderX, riderZ, riderPitch, riderHip, riderKnee, riderShoulder, riderElbow` order; metres for translations, radians for hinges |
| `v` | Corresponding m/s or rad/s; root translation rates are hip velocity, not aggregate COM velocity |
| `gravity` | Downward world-z acceleration, 0–15 m/s² |
| `dt` | Exactly 31.25, 15.625 or 7.8125 microseconds; 640, 1280 or 2560 steps |

Root translations offset the authored world hip position. Pitch and limb angles are deviations from the authored posture; they are not absolute world/body angles. The existing inverse-rest-rotated slide axes precede pitch and produce world x/z translations in this world-rooted construction. Native segment observations, rather than raw generalized rates, provide world velocities. Do not copy a moving bike's relative rider state into this input: a future physical conversion must include parent rotation and `omega × offset` velocity.

All q/v scalars are bounded to ±10 in their respective SI units. Actual world hip x/z must also lie within ±10 m; pitch deviation within ±π; actual limb angles within the unchanged passive domains. Every accepted endpoint must have finite coordinates, velocities, accelerations and observations, advance the clock by the selected step, move each generalized coordinate by no more than .01 in its respective unit, and remain planar. Contacts, constraint rows and applied external forces are forbidden. These are engineering admission bounds, not anatomical strength or joint-stop laws. Passing them does **not** qualify arbitrary custom masses, inertias, fits or stiffnesses for accuracy at these timesteps.

## Record and accepted prefix

`bikelab-rider-unbound-0.1` records native build, canonical input, coordinate conventions, mass ownership, termination, observed residual maxima and owned frames. Samples occur at 0, .005, .010, .015 and .020 s. A terminated run also retains its last accepted off-grid endpoint; initial rejection exports no pose. Six frame slots and solver/accounting scratch are allocated before stepping. The native model, data and velocity buffer are disposed after materialization, including error paths.

Each frame includes q/v, native segment endpoints and COMs, world angular-then-COM-linear velocities, whole-rider COM, linear momentum, angular momentum about the moving rider COM, native energy, positive joint damping power/loss and signed residual vectors. Full `R diag(I) Rᵀ omega` and COM-relative orbital momentum are used, although only planar states are admitted. This is not 3D receiving evidence.

Candidate observations and trapezoidal damping loss are staged. A rejected step restores q/v, warm start and time, removes forbidden applied forces, refreshes observations, and retains the prior accepted loss, maxima and progress count. The attempted endpoint is never exported as accepted geometry. Unexpected native or rollback failures fail the calculation rather than manufacture a record.

COM residual subtracts continuous ballistic motion. Linear momentum residual subtracts gravity impulse. COM angular momentum residual subtracts its initial value. Energy residual is `E(t) - E(0) + dampingLoss(t)`; native energy already includes gravitational and passive spring energy, so these terms are not added twice. Small residuals contain numerical integration/quadrature error and do not represent an extra physical damping law.

## Verification and receiving status

The [prior native research](RIDER_UNBOUND_REVIEW.md) supplies independent initial kinematics/inertia checks, nine archived launches and the pinned primary-source derivation. The production test compares native snapshots and residuals with all nine cases. Translation also obeys the exact selected-integrator reference `z(t)=z0+vz0*t-g*t*(t+h)/2` and `E(t)-E(0)=-M*g²*h*t/2`, checked at 0, 9.80665 and 15 m/s² gravity. This preserves the distinction between a correct discrete update and continuous conservation.

For the default illustrative spin/joint launch and its zero-gravity control only, tests require the following per-axis maximum residuals across this 0.02 s horizon:

| Quantity | Budget |
| --- | ---: |
| COM against continuous flight | 3.2e-6 m |
| Linear momentum | 2e-5 N s |
| Angular momentum about COM | 1e-5 N m s |
| Energy plus joint damping loss | .0025 J |

Momentum/angular/energy residuals must reduce by a factor in [.48, .52] on each timestep halving. These are small, named regression controls based on the archived research, not calibration or a general model-accuracy envelope. Joint-limit, initial-rejection, invalid specification, ownership, repeated-run, recording-boundary fault, forbidden-force and clock-reversal controls check the accepted-prefix contract independently.

The browser receiver exercises seven actual worker launches, whole-record browser/Node comparison at normalized 1e-9, owned exports, terminal progress, desktop/390/320 px captures, cancellation, replacement, stale messages/errors, startup/post failures, edits and recovery. It checks that Trail scenario/playback/export and the pose study are unchanged, and that cancelling this probe leaves a concurrent Trail calculation active. Deliberately injected callbacks test lifecycle only. Hosted execution and actual capture inspection are **pending for this implementation checkpoint**; the receiver code alone is not visual evidence. Local direct preview-handler checks serve all 65 top-level assets, including the three new modules; actual socket/CLI subprocess checks remain subject to this workspace's EPERM restrictions.

## Next integration gate

The [ownership contract](RIDER_OWNERSHIP.md) remains open: stable actor identity/lifetime, an unbound rider alongside a bike in one shared world, moving-bike independence with interfaces disabled, and a supported physical state conversion. Then receive explicit release/recontact with equal/opposite loads, work and persistence. This finite probe cannot be resumed, attached to a bike or used as an anatomical fall controller. Finite saddle receiving, continuous sessions, bounded active posture and the [multirate contract](MULTIRATE_EXECUTION.md) remain part of the joined MTB goal. Lateral/turning dynamics, independent limbs, collisions, material terrain, strength and pressure loss retain their separate gates.
