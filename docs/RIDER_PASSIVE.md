# Passive rider joint-law prerequisite

`bikelab-rider-passive-0.1` combines the complete [posture specification](RIDER_POSTURE.md) with four scalar hip/knee/shoulder/elbow laws. This increment evaluates constitutive loads and their native mapping at specified states. It does not integrate a rider, receive D5a, enforce a native hard stop, predict strength/injury or replace the guided rider in Trail bike.

Each joint owns `restAngle`, `stiffness`, `damping`, `minAngle` and `maxAngle`. A supplied joint must include all five fields. Canonical specifications are owned/frozen and retain all defaults for replay. Unknown, incomplete, nonfinite and out-of-domain inputs fail explicitly. Changing the posture does not recenter a rest angle or domain: supply explicit laws when the changed pose is outside the old domain.

Angles are in radians about +y, using the child's proximal-to-distal axis relative to its parent's axis, as in the posture constructor. They are not clinical flexion angles. The constructed angle `theta0` starts on the constructor's wrapped branch; subsequent native displacement `q` is unwrapped:

```
theta = theta0 + q
springref = restAngle - theta0
spring torque = -stiffness * (q - springref)
damping torque = -damping * qVelocity
spring potential = 0.5 * stiffness * (q - springref)^2
positive damping loss power = damping * qVelocity^2
```

The conversion to `springref` occurs once. No shortest-angle wrapping is applied, including when a configured spring displacement exceeds π. Stiffness units are N·m/rad; damping units are N·m·s/rad. Root x/z/pitch coordinates remain free of passive frame tethers. Native `qfrc_passive` owns the torques and `energy[0]` already includes spring potential. The diagnostic decomposition must not be applied or added a second time. Fixed rest angles are passive; changing them during a run would require an explicit actuator-work contract.

The example coefficients (hip/knee/shoulder/elbow stiffness 120/90/25/15, damping 8/6/2/1.5) and ±0.3 rad domains about the default pose are arbitrary fixture choices, not anatomical measurements. Configuration admits stiffness 0–5000, damping 0–500, absolute angles within ±2π and ordered domain widths below 2π. These bounds describe this implementation envelope, not human capacity. The initial angle and rest angle must lie within the domain. Knee/elbow domains must lie entirely in the same connected interval `nπ + asin(minBendSine)` through `(n+1)π - asin(minBendSine)` as the initialized bend. This prevents a candidate from jumping through a straight/folded band to the opposite branch; it does not receive moving closure/rank/conditioning budgets.

`passiveStateIssue` consumes four displacement/rate entries in hip/knee/shoulder/elbow order. Exact domain boundaries are admitted; strict violations return a named angle-limit reason. Nonfinite states and overflowing damping loss are unsupported. `evaluatePassiveRider` checks the entire state before writing a separate caller-owned 20-entry `Float64Array`, five entries per joint: total torque, potential, positive damping loss power, spring torque, damping torque. Successful evaluations allocate no scratch. No state is clamped and no load is clipped.

`nativePassiveXML` and `passiveRiderParts` are construction fixtures with `limited="false"`, not standalone safe integration APIs. A receiving integrator must check every candidate, reject/rollback unsupported states and keep the last admissible state. Compliant buffers, ultimate termination in the connected lifecycle and sourced failure thresholds remain future work. A soft native limit would not establish a hard travel bound.

## Checks declared before execution

Analytical torque/potential/native-force comparisons use 1e-10 absolute/relative tolerance; central energy derivatives use coordinate perturbation 1e-6 rad and 1e-7 absolute/relative tolerance. Controls include both velocity/displacement signs, zero coefficients, nonzero rest offsets, offsets exceeding π, changed mass and opposite bend branches. Native potential is checked with gravity disabled; the initial inspection also checks the gravitational sum independently. Root coefficients/forces and manually applied forces must remain zero. Existing no-law construction and connected replay retain their existing gates. Browser/Node report comparisons use the existing 1e-12 normalized tolerance.

State checks cover exact boundaries, strict excursions, singular-band crossings, nonfinite/overflow values, input ownership and atomic output on rejection. Native perturbed samples can be off the closure manifold: they verify scalar constitutive mapping, not supported motion. No timestep, drift, momentum, equilibrium or visual articulated-rider acceptance follows from these checks.

## Primary implementation sources

Read MuJoCo 3.16.0 at vendored commit `a892750516336d8358949f4518fcc4fbbd85beae` before implementation; GPT-6.1 Sol independently reviewed the conventions:

- [Reference and spring reference coordinates](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/doc/XMLreference.rst#L2572).
- [Scalar spring and damping forces](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_passive.c#L679).
- [Passive force ownership in forward dynamics](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1010).
- [Native spring potential](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_sensor.c#L1793) and [polynomial potential](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_util_misc.c#L2352).

Next: independent chassis mass/COM/inertia, named hand/foot equality force/work routing and unilateral saddle contact, followed by passive connected integration, rollback, shared records and actual segment visualization on both bikes. Keep suspension/casing bounds and unsupported-overload termination. Physical rim/spoke/frame/bead failure, pressure loss, active pumping/wheelie/hop/endo controls, layered terrain, adaptive real-time tiers and 3D remain separate open work.
