# Fixed-anchor rider static effort reference — 2026-10-29

The geometric/load diagnostics expose a roughly 20 mm hold offset and large proportional effort. This offline reference asks what active torque could balance gravity and the existing passive springs at the requested pose, with ideal fixed bilateral hand/foot anchors. The Trail bike target panel compares this reference with recorded active effort. Nothing is applied to native dynamics, and no controller gain, attachment, tyre or integration law changes.

## Sources and mapped conventions

The source review used [Lynch and Park, Modern Robotics, statics of open chains](https://modernrobotics.northwestern.edu/nu-gm-book-resource/5-2-statics-of-open-chains/) for the power/Jacobian-transpose force mapping and its distinction between exerted and external wrench. [Tedrake, MIT Underactuated Robotics, virtual work](https://underactuated.mit.edu/multibody.html) gives zero generalized virtual work at equilibrium and gravity as the negative potential gradient. These principles specify balance, not a unique support distribution or human control strategy.

The following is BikeLab's local derivation. Coordinates are frame-local x forward / z up; angles and torques are positive about +y. For r and F represented as x/z pairs, the y moment is `r_z*F_x - r_x*F_z`. At frame pitch phi, gravity acceleration in these coordinates is `(g*sin(phi), -g*cos(phi))`. All reference forces act **on the rider**. Passive torque is `-k*(angle-restAngle)` with zero velocity; active torque supplies the remainder. This matches the signs in `rider-native.js` and `rider-passive.js` rather than importing a robot-exerted wrench convention.

Let d = hand - foot, G be the complete rider gravity force and C its COM. Whole-rider balance requires `H + F + G = 0` and `cross(d,H) = -cross(C-foot,G)`. For distinct point anchors, the hand force is `H = H0 + lambda*d/|d|`, where `H0 = (d_z,-d_x)*[-cross(C-foot,G)]/|d|^2`; foot force follows from force balance. Lambda is an internal force parameter in newtons. Global force/moment balance does not fix it.

At each of the four relative joints, sum the downstream segment gravity moments and the distal attachment moment about that joint, then negate the sum to obtain total required torque. Subtract the original passive spring torque to obtain active torque `a + b*lambda`. The free-root equations are the whole-body balances above. This avoids a mixed-unit least-squares solve over force and torque equations.

## Explicit selection and admission

This reference selects the minimum **sum of squared active torques** (N m squared), with equal weights for the four joints, subject to their existing `maxTorque` limits. It is an illustrative mathematical policy; no physiological effort metric, preferred hand/foot percentage or real attachment material law is inferred.

Each joint limit gives an interval for lambda. Intersect those intervals, minimize the scalar quadratic, and restrict lambda to that feasible interval. Individual torques are never independently clipped because that would destroy static balance. Zero torque limits are supported. Empty intersection returns `unavailable: torque-limits`. Inputs still pass the original posture reach, bend-branch, passive-domain and drive-limit validators; changed targets do not recenter passive rest angles.

Numerical scope: anchor separation below 1e-6 m and a torque-slope squared norm below 1e-20 m squared return explicit unavailable results. Slopes below 1e-12 m are treated as constant for interval admission, with 1e-9 N m comparison tolerance. Published candidates are checked against 1e-8 N force, 1e-8 N m whole-rider moment and 1e-8 N m torque-bound residual budgets. These are arithmetic budgets, not physical tolerances. Inputs use g in [0,20] m/s squared and pitch within +/-pi.

Anchors may push or pull in any planar direction. There is no grip, unilateral contact, saddle, attachment-force limit, acceleration, power or stability qualification here. Static power is zero; it cannot validate dynamic power limits. Soft-connect closure equilibrium and the selected force-sharing policy are different problems. A solved ideal reference is not an admissible stationary connected-bike state.

## Receiving evidence

At the default posture, horizontal frame, g = 9.80665 m/s squared and original passive rest angles, the selected active torque vector is approximately **[+41.28, -140.05, +21.38, +17.53] N m**, ordered hip/knee/shoulder/elbow. Hand force is [+10.50, +73.73] N and foot force [-10.50, +612.73] N. All four torque bounds have positive margin. Different admissible lambda values also balance the ideal rider; the stated policy picks this one.

The existing `node scripts/rider-hold-review.mjs artifacts/rider-transfer artifacts/rider-loads` now evaluates references at 0, 0.4, 0.6 and 1 s using the requested target and each saved frame tilt. All 32 comparisons from the eight unchanged PR64 runs are available. Source records are hash-checked first; the [static receipt](evidence/rider-static-reference.json) preserves source hashes, target/tilt inputs, solution policy, forces, joint terms and recorded active torque. These are new calculations on old inputs, not new native simulations.

For the 31.25 microsecond unchanged holds at 1 s:

| Bike | Reference active hip / knee / shoulder / elbow | Recorded active hip / knee / shoulder / elbow |
| --- | --- | --- |
| Full suspension | +42.31 / -140.26 / +22.50 / +17.21 N m | +51.51 / -136.96 / +8.13 / +8.14 N m |
| Hardtail | +38.95 / -139.52 / +18.85 / +18.25 N m | +48.21 / -138.79 / +5.84 / +9.78 N m |

The reference uses the requested pose and ideal anchors; recorded effort acts at a different moving pose with soft closures. Their difference is not directly a feedforward command. At the original target with zero velocity, PD feedback produces zero active torque, whereas this static reference requires nonzero active effort. That supplies a concrete reason to investigate a bounded load-compensation path rather than merely increasing gains.

## Verification and next gate

Seven new tests independently check all seven generalized balance equations using central differences of gravitational plus spring potential and endpoint virtual work, at two differentiation steps (1e-5 and 5e-6 m or rad) with 5e-7 N / N m residual budgets. They cover masses 20/70/100 kg, frame tilts -0.3/0/+0.3 rad, shifted target geometry, passive preload, mass/gravity scaling, zero gravity, zero/active torque limits, infeasibility, the minimum objective, coincident anchors and invalid input. These tests do not reuse the production subtree-moment calculation as their oracle.

All **84 quick tests** and vendor checks pass on Windows / Node 24.22.0. The complete Node suite passes **319/320**, with only the unchanged loopback `connect EACCES` failure. The unit receipt is failed and no full attestation is claimed. Browser receiving includes the static-reference readout and existing desktop/mobile captures, but execution remains deferred under the approved Edge fallback. Hosted CI and Pages remain paused until deliberate resumption on or after 1 November.

Next: verify these applied site forces and joint torques against the pinned native rigid-rider model at imposed poses, without relying on soft constraints to choose the load split. Then evaluate a bounded compensation mechanism in a fixed-anchor diagnostic with explicit signed work, saturation, zero-gravity and no-compensation controls. Do not promote compensation to the connected-bike controller before the numerical/support gates. This reference serves the common rider effort path; wheelie, endo, bunny hop, pumping and landing still require their own support/phase/flight policies and receiving evidence.
