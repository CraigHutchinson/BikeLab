# Bounded active rider joint-drive probe

This implements the first effort layer from [active stability](RIDER_ACTIVE_STABILITY.md). Both bikes use the same browser worker and headless runner. Select **Active rider · bounded posture hold** or **10-second idle probe** in Trail bike. The complete JSON editor configures each hip, knee, shoulder and elbow target, gain and limit. No native pose, mass, passive spring law or root motion is overwritten.

## Mechanics and replay

The opt-in `active` section has format `bikelab-rider-drive-0.1` and four named `joints`. Each supplies `targetAngle`, `kp`, `kd`, `maxTorque`, `maxSpeed`, `maxPositivePower` and `maxNegativePower`. Targets are absolute geometric joint angles within the existing passive joint domains. Units are rad, N m/rad, N m s/rad, N m, rad/s and W. All values are illustrative; paired limbs are aggregated, and these are not calibrated human capacities.

The sampled law is `torqueDemand = kp * (targetQ - q) - kd * velocity`. Targets are converted against the original constructed angle; displacement below 1e-12 rad becomes zero and other displacements use 12 significant digits, matching the canonical numerical policy. The passive coordinate references never recenter. Torque saturation precedes separate positive/negative power saturation. Static effort stays bounded even at zero velocity. Applied effort can change instantly between physics ticks: **torque slew, integral control and biological metabolism are not modeled**.

Only the four relative rider hinges receive effort. The native dynamics supply the internal reactions; no extra counterforce or root torque is added. Effort is held through one integration interval. Signed rider work is the sum of that held torque times actual joint displacement. The endpoint torque belongs to the next interval. Active feedback damping is accounted as actuator work, separately from native passive damping, contact/closure work and hub drive.

Speed and both held-old-effort and new-effort power are checked at step endpoints. These guards do not certify an unsampled continuous-time power maximum. A rejected step restores native state, activation, warm start and command, then recomputes memoryless effort; it commits no rider work. Repeated observations do not advance a controller clock or history. Lower-rate intent/feedback and rate-limited actuator state remain separately tested work under the [multirate contract](MULTIRATE_EXECUTION.md).

Records use `bikelab-trail-bike-active-0.1`, require articulated mode and explicit launch/state initialization, and bind drive configuration/semantics into physical identity. Old record discriminators reject active settings. Existing passive identities and XML/record output remain unchanged. Fresh restart resets cumulative work and native warm start; it is not continuation. The active-only admission permits up to 10 s and 0.05 s recording intervals, with the existing 300-interval cap. Legacy limits stay unchanged.

## Configuration and observed boundary

The preset uses gains `[2400,2400,800,600]`, damping `[100,100,30,25]`, torque caps `[250,250,100,100]`, speed cap 12 rad/s and positive/negative power caps `[600,600,200,200]`. These engineering demonstration parameters are not fitted human data. Its closure regularization is 0.01 s; the unchanged gap limit is 2 mm. Comparisons against passive effort use that same closure time.

Initial lower-gain attempts are retained in the evidence: at 0.02 s closure they reach the foot-gap guard around 0.19 s; at 0.01 s closure they instead reach the knee-domain guard around 0.24–0.30 s. The stronger bounded drive completes 0.5 s and continuous 10 s runs on both bikes without widening physical guards. Gravity-dependent joint error remains; fixed-target PD does not provide exact zero-droop support.

The coarse 10 s probes have roughly 0.058 rad final knee error and micrometre-scale sampled rider COM range over the last second. **Whole-world stationarity fails:** final native slide speed is about 0.04–0.07 m/s, substantial tyre-coordinate acceleration remains, and the maximum energy residual accumulates to about 1.3 J. Small rider motion does not qualify tyre/suspension equilibrium or long-duration numerical accuracy. Timestep refinement, perturbation recovery and full stationarity budgets must precede a stable-idle claim. The 60 s gate remains unavailable.

Run `node scripts/rider-drive-review.mjs [directory] short` for matched active/passive controls, or use `long` for both bikes at 31.25 and 15.625 µs over 10 s. It preserves complete records, source hashes and accepted-step progress. It reports observations without declaring stability from completion. The [receipt](evidence/rider-drive.json) separates local observations from hosted/browser receiving.

## Verification and remaining controls

Eight drive tests cover strict configuration, signed saturation, four-joint binding, zero-effort equivalence on both bikes, active identity/replay/fresh restart, independently intercepted held-torque work, recording-cadence independence, post-command rollback, genuine held-power rejection and active flight. In flight, linear momentum, angular momentum after the numerical closure contribution, and energy errors decrease across three timesteps. The native integrator does not preserve continuous momentum exactly during shape change; zero root actuation and bounded refining error are distinct checks. Twenty complete legacy XML models and eight complete legacy records remain byte-identical. Full local tests pass 41 files; the same eleven subprocess/loopback files remain blocked by workspace EPERM. All 68 top-level assets pass the actual request-handler check. GPT-6.1 Sol reviewed mechanics, ownership, identity and work/rollback; hosted/browser checks remain pending.

The visible panel shows target/actual angles, demand/applied torque, saturation, signed work/power and all-coordinate sampled rate/acceleration maxima. The browser receiver checks both bikes, full-record agreement, mobile layout, JSON admission, removal of active mode when changing rider coupling, progress and cancellation. Captures must actually be received before claiming visual verification.

Next: receive those browser checks and the refinement results, then compatible perturbation recovery and the [IK/task-control review](RIDER_CONTROL_ARCHITECTURE.md). Active hold is not yet support-aware COM regulation, saddle support, repeated-bump absorption or a general humanoid controller.
