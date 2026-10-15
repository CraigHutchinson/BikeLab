# Timestep reversal research

2026-10-15. User-requested GPT-6.1 Sol bounded source research for PR #5, head `c6a4cc96145bb122f01bbfc38c60a1fad19c115c`. Read the repository rules, trial implementation/configuration, trial contract, iteration 5 evidence and refinement receipt. Added and executed the bounded scalar diagnostic below; no production solver changes, dependency installation or performance measurements were made by this research task. Engine reproduction and matched controls were performed by the implementation agent. The viewer lifecycle repair does not change the solver module or its equations.

## Source identity

The relevant source is **dimforge/rapier**, commit `b716d375efc0201003f0cd9ef7168eee0b62c177`, including its in-repository TypeScript bindings. The older separate `dimforge/rapier.js` repository is not the source of this artifact. Its moving master reports a different core version and must not be used to explain this binary.

Primary files read through the GitHub connector:

- [Binding Cargo template](https://github.com/dimforge/rapier/blob/b716d375efc0201003f0cd9ef7168eee0b62c177/bindings/typescript/builds/prepare_builds/templates/Cargo.toml.tera): binding 0.21.0 and core dependency 0.36.0.
- [Motor coefficients](https://github.com/dimforge/rapier/blob/b716d375efc0201003f0cd9ef7168eee0b62c177/src/dynamics/joint/motor_model.rs).
- [Motor row construction and effective mass](https://github.com/dimforge/rapier/blob/b716d375efc0201003f0cd9ef7168eee0b62c177/src/dynamics/solver/joint_constraint/joint_constraint_helper.rs).
- [Motor solve and bias removal](https://github.com/dimforge/rapier/blob/b716d375efc0201003f0cd9ef7168eee0b62c177/src/dynamics/solver/joint_constraint/joint_velocity_constraint.rs).
- [Substep layout](https://github.com/dimforge/rapier/blob/b716d375efc0201003f0cd9ef7168eee0b62c177/src/dynamics/solver/staged_island_solver/init.rs), especially lines 56–110.
- [Force increments, integration and writeback](https://github.com/dimforge/rapier/blob/b716d375efc0201003f0cd9ef7168eee0b62c177/src/dynamics/solver/staged_island_solver/worker.rs), especially lines 65–76, 273–289 and 639–728.
- [Solve passes](https://github.com/dimforge/rapier/blob/b716d375efc0201003f0cd9ef7168eee0b62c177/src/dynamics/solver/staged_island_solver/solve.rs).
- [Gravity and linearized integration](https://github.com/dimforge/rapier/blob/b716d375efc0201003f0cd9ef7168eee0b62c177/src/dynamics/rigid_body_components.rs), including `compute_effective_force_and_torque` and `integrate_linearized`.
- [Body defaults and additional substeps](https://github.com/dimforge/rapier/blob/b716d375efc0201003f0cd9ef7168eee0b62c177/src/dynamics/rigid_body.rs), lines 116–117, 218–224 and 1730–1731.
- [Integration defaults](https://github.com/dimforge/rapier/blob/b716d375efc0201003f0cd9ef7168eee0b62c177/src/dynamics/integration_parameters.rs), lines 415–429; [motor defaults](https://github.com/dimforge/rapier/blob/b716d375efc0201003f0cd9ef7168eee0b62c177/src/dynamics/joint/generic_joint.rs), lines 219–256.

## What the actual settings mean

`numSolverIterations=4` creates **four real substeps**, each of length `storedDt/4`, rather than four constraint sweeps at the outer timestep. In general the connected component uses `numSolverIterations + max(additionalSolverIterations)` substeps. Both additional body counts default to zero and this fixture does not override them. Internal PGS iterations repeat solves at the same positions; their default is one. The default one stabilization pass runs after position integration. Joint warm starts default to false. CCD substeps are unrelated to these solver substeps; there are no colliders here.

Thus the finest requested outer step, 31.25 microseconds, integrates positions every approximately **7.8125 microseconds**, and a two-second run makes 256,000 position updates in the original world; the halfway-restored world makes another 128,000. The reference timestamps correctly use stored outer dt times integer outer ticks. The previously reported engine `storedDt` remains an outer timestep.

## Ideal scalar recurrence derived from the source

For an exact straight rail with COM anchors, no saturation, fixed base and zero angular motion, write `q` for positive compression, `u` for its velocity, `h` for the **substep**, `a=g*cos(theta)`, `r=-preload/k`, `K=1/m`, and `D=h*k+c`.

The ForceBased coefficients are `ERP=k/D`, `gamma=1/(h*D)`, and `cfm_coeff=0`. The motor row uses `rhs=ERP*(q-r)` and `inv_lhs=1/(K+gamma)`. Gravity enters through `force=user_force+gravity*mass*gravity_scale`, followed by a per-substep increment `force*effective_inv_mass*h`. Hence `v*=u+h*a` axially. The initially zero motor impulse becomes `lambda=(v*+rhs)/(K+gamma)`; the dynamic body's velocity loses `K*lambda`.

Consequently, in exact arithmetic:

```text
u_next = (m*u + m*h*a - h*k*(q-r)) / (m + h*c + h*h*k)
q_next = q + h*u_next
```

This is backward Euler for the scalar spring/damper with constant gravity. It has first-order time bias and numerical damping. The motor's `rhs_wo_bias` equals its `rhs`, so the later bias-removal pass retains the spring term. A second isolated scalar solve has zero residual in exact arithmetic; it does not apply another whole spring force. Finite precision and coupling to other rows can leave small residuals.

ForceBased is explicitly configured, and the target encodes the correct negative preload displacement. AccelerationBased would represent a different mass scaling. Motor maximum force defaults to `Real::MAX`; the default fixture does not reach saturation. The observed reconstructed force is a function of recorded q/u and supplies no independent measurement of the motor impulse.

## A concrete precision mechanism, and its current evidence limit

The pinned `integrate_linearized` implementation ends with `*translation += self.linvel * dt`. This updates **absolute float32 Cartesian position at every substep**. At the default equilibrium q≈0.0405 m, the z component has float32 spacing about 3.73 nm and the x component about 0.93 nm. At the finest substep, a z velocity increment below roughly 0.24 mm/s produces a position increment smaller than half one z ULP. The damped trajectory enters this range. Repeated rounding can then arrest or bias position while the motor still responds to velocity and displacement; it is not merely nanometre rounding when exporting a sample.

A separate source-derived scalar calculation was evaluated in JavaScript doubles and then with **only each position update rounded to float32**. It used the default physical coefficients, h=stored outer dt/4 and samples every intended 5 ms, with no Rapier runtime:

| Outer dt (ms) | Scalar double max q error (µm) | Scalar with float32 position updates (µm) |
|---:|---:|---:|
| 0.5 | 41.632 | 41.605 |
| 0.25 | 20.831 | 20.824 |
| 0.125 | 10.420 | 10.380 |
| 0.0625 | 5.211 | 5.207 |
| 0.03125 | 2.606 | 9.864 |

The float32 position update alone reproduces a reversal and its approximate magnitude. **It does not explain the location of the actual maximum:** this surrogate's finest maximum occurs at 1.925 s, while the engine's maximum occurs around 0.205 s with substantial velocity. It isolates a late-tail mechanism, not the observed early peak. Actual operations also round coefficients, vector force increments, joint frames, velocities and constraint sweeps. The engine's coarser first row is 41.145 µm rather than the scalar 41.632 µm. Claiming the entire discrepancy is just the final output's float32 resolution, or late position stagnation, is unsupported.

## Follow-up: split velocity arithmetic versus coefficient rounding

Engine isolation performed by the implementation agent and retained in [the durable 50-case engine receipt](evidence/iteration-5-timestep-isolation.json) confirms that equal internal h gives equal traces across different outer dt/substep combinations. Increasing internal PGS iterations from one to four leaves the finest default maximum exactly unchanged. Equilibrium-centred coordinates improve the late tail but retain the early reversal: 4.604 µm at the previous step versus 9.518 µm finest. This falsifies an explanation based solely on late absolute-position stagnation. A vertical control also retains a precision plateau, so tilted coordinate extraction is not necessary for the problem.

Additional lightweight scalar isolations held position in **double precision** while varying where float32 rounding occurs. For the split motor calculation, `star=u+h*a`, `rhs=ERP*(q-r)`, `lambda=inv_lhs*(star+rhs)`, `u_next=star-K*lambda`:

| Scalar arithmetic | Previous step max q error (µm) | Finest max q error (µm) | Finest peak time (s) |
|---|---:|---:|---:|
| All double | 5.211 | 2.606 | 0.215 |
| Only coefficients stored in float32 | 5.206 | 2.594 | 0.215 |
| Only final u_next stored in float32 | 5.204 | 2.612 | 0.215 |
| Separate velocity/impulse operations rounded | 2.542 | 6.113 | 0.190 |
| All split velocity operations and coefficients rounded | 2.543 | 6.107 | 0.190 |

For the fourth row, coefficient and rhs calculations remain double; the velocity path explicitly uses `star=f32(u+inc)`, `lambda=f32(inv_lhs*f32(star+rhs))`, `u_next=f32(star-f32(K*lambda))`, where `inc=h*a`. This is an isolation of operation rounding, not an assertion about every exact WASM operation. The fifth row rounds each multiply/add in the split formula and stores its coefficients as float32. Neither row rounds position. Both recover an **early** reversal, unlike the position-only surrogate.

Algebraically combining gravity and preload into the equilibrium target (`inc=0`, `r=qeq`) leaves the double equation unchanged. With position still double, the split-velocity surrogate then converges again: 5.204 µm previous and 2.611 µm finest. This isolates error introduced by the separate external-force increment and opposing motor update. The effect is accumulated operation rounding, not merely a one-time coefficient mismatch. Within a fixed float32 velocity exponent bin, adding a constant small increment rounds it to a fixed integer number of velocity ULPs, creating a coherent increment bias. Dividing that bias by progressively smaller h can produce a nonvanishing or growing effective acceleration error. The opposing motor update undergoes another independent rounding.

Reproduce these scalar controls with `node scripts/timestep-scalar.mjs` and `node scripts/timestep-scalar.mjs --balanced`. The exported `runScalarTimestepIsolation` returns all five fixed steps, named modes, error maxima, signed errors and peak times; its report specifies the rounded operations. It deliberately does not import or execute Rapier. Coefficient-only and final-velocity-only rounding are negative controls for the split-operation mechanism. The fixed model/default setup and finite five-step grid bound its work.

## Crossed engine controls support two distinct causes

The implementation agent's [durable engine receipt](evidence/iteration-5-timestep-isolation.json) supplies the paired engine controls. The balanced diagnostic has zero gravity, motor target qeq and adjusted transverse applied load `F-m*g*sin(theta)`, preserving the scalar axial ODE and intended transverse force. The centred diagnostic measures displacement around equilibrium. These are diagnostic representations, not interchangeable production reaction/load paths.

| Engine representation at finest outer dt | Max q error (µm) | Peak time (s) |
|---|---:|---:|
| Original | 9.139 | 0.205 |
| Centred coordinates only | 9.518 | 0.205 |
| Balanced force only | 5.665 | 1.905 |

Balancing forces removes the early peak and exposes late position rounding; centring alone improves late resolution but retains the early peak. Doing **both** yields a monotonic five-step sequence of 41.750, 21.063, 10.641, 5.225 and 0.926 µm. An independent vertical balanced/centred control also converges monotonically: 38.049, 19.059, 9.509, 4.770 and 2.389 µm. Tolerances remain unchanged.

Together, pinned source, the operation-level scalar controls and the crossed engine controls support a **finite-precision refinement reversal with two separable mechanisms**: accumulated rounding of split external-force/motor velocity updates creates the early peak, while repeated absolute-position rounding creates the late tail. The exact ratio of every rounded operation's contribution is not established, and the scalar surrogate does not match the vector engine bit for bit. The differing diagnostic representations should not replace the original physical fixture merely to produce a passing result. This is neither evidence of a sign/reference error nor a general impossibility result for float32 mechanics.

## Reproduction and limits of attribution

Run `node scripts/diagnose-timestep.mjs` for all 50 engine cases. The bounded harness records complete physical/control settings, actual substep counts/durations, early/late peak errors, closure and trace hashes. Its original fixture is tested against the production trial sample-for-sample; equal internal steps are tested across different outer-step groupings. The [scalar receipt](evidence/iteration-5-scalar-isolation.json) retains all operation-level controls, and the diagnostic tests check their positive and negative results. No timing measurements are included.

The substep, PGS, vertical, centring and net-force controls above have been executed. A full operation-by-operation WASM error budget, rigid whole-world translation sweep, exact vector emulator and general precision envelope are further qualification work, not claims of this diagnosis. The centred/net-force representation demonstrates an axial numerical mechanism; it does not preserve real suspension attachment reactions or license that replacement in the bike.

Exact restart reproduces a deterministic numerical error as well as a correct state. Small transverse closure does not constrain axial accuracy. No tolerance is loosened, solver selected, or general float32 impossibility asserted from this oscillator. The production fixture, settings and failed release remain unchanged; reports/viewer now expose the four internal substeps and nonmonotonic-refinement limitation.
