# Unbound rider: native construction research

This preserves the reproducible **research checkpoint** merged in PR30. Its script and receipt remain unchanged. The subsequent [bounded production probe](RIDER_UNBOUND.md) adds the separate CLI/panel and guards; its receiving status is recorded there. Neither stage completes independent actor ownership or a riding mode. The research itself changed no production construction, integration, collision, guards, UI or record formats.

## Reproduce and interpret

```sh
node scripts/rider-unbound-review.mjs artifacts/rider-unbound-review.json
```

The [saved receipt](evidence/rider-unbound-review.json) binds the script/imported source hashes, main `a6e5cd8c2873af49f5000ed252f6a7ddc410cbba`, Node runtime, complete normalized passive input, native provenance and each XML hash. The one illustrative 70 kg definition matches the portable-rider asset identity received in PR29. There are **three authored launches at three timesteps**, each lasting 0.02 s. These are not nine independently calibrated rider models.

The native rider fragment is placed directly beneath `worldbody`, omitting the construction carrier, bike sites and connect equalities. Checks establish five segment bodies plus the world, seven DOFs, a world-parented trunk, zero contact/constraint rows and zero applied generalized/body forces. Initial positions/rates, individual masses, world pitch inertias, total COM, momentum and energy agree with independent segment-chain calculations within 1e-10 in their separately reported SI units. Relative angular rates accumulate along the limbs. Root translation velocity means **hip velocity**, not aggregate rider COM velocity.

The reference fit supplies an authored world pose; this is not a conversion from a moving bike's relative state. Launches are translation under gravity, root spin plus internal joint motion under gravity, and the same spin/joint case without gravity. Each is evaluated at 31.25, 15.625 and 7.8125 microseconds. The script checks finite state, passive joint domains and time advancement at every endpoint, and aborts on failure. It allocates research observations each step and is not a production or performance implementation.

## Numerical findings

| Case at 31.25 microseconds | Maximum COM error / m | Linear momentum residual / N s | COM angular momentum residual / N m s | Energy-plus-loss residual / J |
| --- | ---: | ---: | ---: | ---: |
| Translation, gravity | 3.065e-6 | 1.954e-13 | 5.719e-17 | 2.104e-3 |
| Spin and joint motion, gravity | 3.067e-6 | 1.611e-5 | 7.798e-6 | 2.123e-3 |
| Spin and joint motion, no gravity | 1.002e-8 | 1.611e-5 | 7.798e-6 | 2.120e-5 |

COM error is against continuous ballistic motion; linear momentum subtracts gravity impulse. Angular momentum is about the instantaneous aggregate COM, where uniform gravity supplies no net torque. Native potential/kinetic energy already contains spring and gravitational terms; the ledger adds positive joint damping loss once, using per-step trapezoidal quadrature. These dynamic residuals are reported observations, **not received acceptance budgets**. The spin cases' residuals approximately halve with each timestep halving, consistent with a first-order numerical error in this bounded control.

The translation control also tests the exact constant-gravity discrete reference. Native `implicitfast` advances positions using endpoint velocity, giving `z(t) = z0 + vz0*t - g*t*(t+h)/2` and `E(t)-E(0) = -M*g²*h*t/2` at `t=k*h`. Its continuous-flight discrepancy is therefore expected numerical error, not extra physical damping. The script asserts agreement with this discrete position within 1e-10 m and energy within 1e-9 J. Preserve the continuous errors alongside that discrete check; passing the algorithmic reference is not exact physical conservation.

No time limit, joint domain or tolerance was relaxed to complete these cases. No performance measurements were taken. GPT-6.1 Sol independently reviewed the source, signs, frame conventions and interpretation without running another workload.

## Sources and next bounded implementation

The pinned MuJoCo sources at `a892750516336d8358949f4518fcc4fbbd85beae` were read:

- [Kinematics and ordered slides/hinges](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_smooth.c#L41): parent transforms and joint order determine world pose. The existing inverse-rest-rotated rider slides precede pitch, so a world-rooted fragment gives world x/z translation without an extra carrier/root joint set.
- [Object velocity](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_core_util.c#L1071): `mjOBJ_BODY` with world orientation reports angular/linear velocity at body COM; `mjOBJ_XBODY` uses the body origin. The receipt uses the former, not raw generalized velocities as segment velocities.
- [State advancement](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L1467) and [whole-model stepping](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c#L2022): endpoint velocity advances positions; the selected integrator advances the coupled model.

The [implementation follow-up](RIDER_UNBOUND.md) adds the fixed-horizon CLI/panel with owned native skeleton/COM snapshots, accepted-prefix rollback and signed conservation/work diagnostics; hosted receiving remains separate. The attached runner stays unchanged. Add stable actor identity and independent lifetime in a supported shared world before general release. The archived research does not itself supply visible/browser receiving, alongside-bike isolation, arbitrary definition/fit coverage, collision, release/recontact or continuation.

For a later bike-relative state conversion, include the parent rotation and `omega × offset` velocity contribution. Do not copy relative coordinates/rates into world state. A subsequent three-dimensional actor requires full spatial inertia, orientation and angular momentum controls; the present x/z/+y probe does not receive lateral/turning dynamics. Finite saddle receiving and persistent-session work remain separate next increments toward the joined riding consumer, followed by bounded active posture and the [multirate control contract](MULTIRATE_EXECUTION.md).
