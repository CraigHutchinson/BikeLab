# Active rider posture, sustained idle and repeated-bump recovery

User requirement, 2026-10-26: the rider is an active participant, able to hold posture, move its COM to maintain support and use its legs to absorb consecutive bumps. Progressive passive slumping does not meet the product goal. This is a D5 requirement for both bikes and both synthetic-data and game consumers. No active controller is implemented by this review.

## Current passive baseline

Run `node scripts/rider-idle-review.mjs [output-directory]`. It saves six complete records and a diagnostic report, with accepted-step progress. The same scenario inputs can run in the existing Trail JSON editor. Both bikes use the passive standing preset, canonical explicit launch, flat frictionless ground and zero initial forward/spin velocity. The requested 1.5 s horizon is the current admitted maximum. Guards, stiffness, joint domains and initial state are unchanged.

All six runs stop at `rider-elbow-angle-limit`:

| Bike | Step (µs) | Last accepted time (s) | World rider COM drop (mm) | Rider COM drop relative to frame (mm) |
| --- | ---: | ---: | ---: | ---: |
| Full suspension | 31.25 | 0.126031 | 55.758 | 68.380 |
| Full suspension | 15.625 | 0.125984 | 55.709 | 68.358 |
| Full suspension | 7.8125 | 0.125992 | 55.714 | 68.360 |
| Hardtail | 31.25 | 0.119406 | 53.308 | 56.108 |
| Hardtail | 15.625 | 0.119422 | 53.317 | 56.106 |
| Hardtail | 7.8125 | 0.119383 | 53.280 | 56.077 |

The [evidence](evidence/rider-idle.json) includes inputs, record hashes, signed hand/foot and ground loads, COM motion, joint drift, suspension positions, energy/work and final native scalar velocity maxima. These rates are coordinate rates, not world material-point speeds. At the accepted endpoint, rider COM still moves downward at about 0.88 m/s on the full bike and 0.86 m/s on the hardtail. Guard rollback retains the supported prefix; the elbow-domain stop does not represent injury. `attemptedLimits: not-evaluated` means the rider guard returned before tyre checks on the rejected candidate. Two independently invoked coarse records match exactly. The workflow now preserves the complete six-record diagnostic as `rider-idle-evidence`; its first hosted receiving is pending. A successful generation job does not mean idle stability passed.

The initial passive springs are at rest angles, giving zero joint torque, and damping vanishes at zero speed. Initial ground resultants are also zero: this is an authored launch transient, not a loaded equilibrium. Gravity-supported standing generally requires joint effort. Passive springs can support a displaced equilibrium, but these particular launches slump into the existing boundary. This does not establish that every passive equilibrium is impossible, or that the solver is unstable. Similar failures at three timesteps support the qualitative finding; nonmonotonic stop times do not establish a convergence order.

No long-duration or all-coordinate stationarity claim is made. The report does not record every native acceleration. The current 1.5 s/300-interval caps also prevent a long hold. Repeated fresh-state imports reset time, warm starts and ledgers and cannot be stitched into uninterrupted stability evidence.

## Distinct receiving claims

| Behavior | Required evidence |
| --- | --- |
| Posture hold | Joint shape and trunk pose remain near declared targets with bounded physical effort. Holding shape can still accelerate the bike. |
| Stationary equilibrium | Small velocity and acceleration for every relevant native coordinate, including tyre deformation, suspension, rider and roots; consistent forces, moments and constraint/contact residuals. |
| Stable idle | Nearby admitted position/velocity perturbations in both directions remain bounded and recover; no progressive slump, oscillation, saturation or unsupported contact. |
| COM transfer | Continuous physical rider/combined COM motion with corresponding wheel/attachment reactions and pitch, subject to reach, joint, friction, effort and travel limits. |
| Riding absorption | Errors follow a moving reference and trail position. Legs flex/extend while the bike follows terrain; consecutive disturbances do not accumulate posture/travel drift. World COM height is not artificially locked. |

Front tyre load and hand load are distinct. Hands/feet are external for the rider but internal for the combined system. Check rider momentum against support/gravity and combined momentum against ground/gravity independently. Small net rider force does not establish stationary tyre coordinates. COM between axles is only a limited flat static check.

Current motion is planar. Future 3D idle must declare actual support, such as a modeled foot on the ground or a qualified trackstand with steering and small motion. Suppressing lateral dynamics does not demonstrate 3D balance.

## Next small increments

1. **Bounded active hold:** add explicit effort at hip, knee, shoulder and elbow, with fixed pose targets first. Preserve passive properties and old records. Apply no world/root/heave force or state projection. This can use the attached model without waiting for runtime detachment, while controller configuration/state belongs to the reusable rider.
2. **Effort/work accounting:** expose requested/actual torque, torque-rate, speed, positive/negative power limits and saturation. Power limits alone do not bound torque at rest. Record signed active work separately from passive storage/loss, interfaces and wheel drive/braking. Static effort has zero mechanical work but may consume biological energy; metabolic calibration is separate. Any support bias/feedforward is explicit; unlimited gains are not a substitute for feasible effort.
3. **Uninterrupted hold:** declare a 10 s initial engineering horizon, then a 60 s sustained-idle gate on both bikes. These are project targets, not physiological thresholds. Add bounded recording and truthful progress without resetting state. Set drift, final-window velocity/acceleration, oscillation, residual and saturation budgets before tuning. Include a supported loaded start and the same authored launch used by the passive control. Seated receiving additionally requires finite saddle support.
4. **Recovery/insufficiency:** perturb joints/roots in both directions, declare settling/overshoot budgets, and test inadequate effort, unreachable targets and contact loss. Preserve honest unsupported outcomes and physical bounds. Check timestep refinement, replay and rollback of controller history, applied effort and cumulative work.
5. **Support-aware COM motion:** add controlled lean and feasible support feedback after holding passes. Distinguish desired posture from achieved COM/contact/load distribution; do not impose an arbitrary handlebar weight percentage.
6. **Consecutive bumps:** use several bumps with varying spacing and a recovery section, without resets or retuning. Compare passive, holding, absorbing and mistimed controls at matched entry state and trail position. Record peak/accumulated posture error, travel margin, COM acceleration, support/unloading, saturation and cumulative work. These precede the [pump and manoeuvre goals](RIDER_MANOEUVRES.md).

Fast mechanical integration/contact remain coupled. Lower-rate intent may be added separately, with explicit clocks and impact-delay/held-effort tests. `trail-bike.js` reevaluates observations and clears/rebuilds applied forces repeatedly; stateful controller advancement must not occur opportunistically inside observations. Rate limiting, anti-windup, controller ticks and work participate in complete-world rollback. See [multirate execution](MULTIRATE_EXECUTION.md) and [rider ownership](RIDER_OWNERSHIP.md).

## Primary reference

[Stephens and Atkeson, 2010, Dynamic Balance Force Control for Compliant Humanoid Robots](https://www.cs.cmu.edu/~cga/papers/stephens-iros10.pdf), sections II–V, was read during this review. It separates feasible contact-force/COM-momentum regulation from posture tasks and acknowledges infeasible motion under support/friction constraints. This supports separating balance objectives from joint tracking. Humanoid feet, contact moments, gains and actuation mapping are not transferable MTB parameters; BikeLab must use its tyre/interface mechanics. No DBFC implementation or calibrated human effort limit is claimed. GPT-6.1 Sol provided independent source/design and diagnostic-script review.
