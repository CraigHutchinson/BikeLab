# Iteration 19 review and receiving contract

Reviewed iteration 18 / PR #21 at merged main `24a181d80ed975ed6c32cd93c370fa88814e1898`. Exact-head and main Linux/Windows tests pass (183 each); all 17 connected-bike browser exports agree. Pages run 39380152802 succeeded and published assets match their committed bytes. Homogeneous distributed traction, signed slip and normal/tangent work are received. Contact regularization, unresolved mesh/impulse convergence, physical calibration and real-time cost remain qualified in ITERATION_18_EVIDENCE.md.

Next balanced slice D4b adds controlled rear hub drive and separate front/rear brakes to the same full-suspension/hardtail Trail bike consumer. Top-down: apply and release controls during a short trail run, inspect slip, wheel spin, load transfer and work, save and replay. Bottom-up: native wheel-relative generalized drive and friction-loss brake constraints retain wheel/carrier countertorques and ownership. This is an abstract hub torque source, not a chain/crank/rider-effort or hydraulic/thermal brake model.

## Contract

- Bounded complete command snapshots `{tick, rearDrive, frontBrake, rearBrake}` use integer physics ticks, start at zero and increase strictly. Drive is signed N m; brake values are nonnegative torque capacities in N m, not solved torque. Commands are right-continuous and independent of recording cadence. Default commands are zero.
- Set native wheel DOF friction loss before rebuilding constraints. Read solved brake torque from friction rows identified by DOF, not contact positions or persistent row addresses. Ground wheel moment excludes brake torque. The total carrier-on-wheel wrench includes drive and brake torque; the ideal bearing wrench excludes both. Torques internal to a complete carrier subtree must not be subtracted again.
- Drive work is commanded torque times accepted relative hub-angle displacement. Signed brake work is a partition of total constraint work alongside normal/tangent work; count it once. Report actual relative spin, solved brake torque, command and work, including regularization effects. No exact static lock or perfect instantaneous passivity claim.
- Finish endpoint force/work evaluation with the old command, then apply a boundary command without a state projection or impulse. Accept state, command and ledgers together; rejected steps restore all of them. Record command boundaries as well as regular samples. Legacy records preserve zero controls and cannot be reinterpreted as driven/braked runs.
- Validate bounded inputs, independent rotor/free-carrier acceleration, reaction torque, work/momentum, near-zero/reversal/release and under/over-capacity response. Connected controls cover both assemblies, contact force/moment ownership, separated flight, accepted termination, replay and recording invariance. Browser controls and headless physics share the same engine and scenario.

## Primary source conventions

GPT-6.1 Sol rechecked pinned MuJoCo 3.16.0 sources. [Friction rows](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_constraint.c#L985) are rebuilt from current DOF friction loss, use a scalar identity Jacobian and identify their DOF. [Post-constraint RNE](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_core_smooth.c#L2303) omits flex contacts and leaves generalized drive/brake moments in the inferred interface wrench. [Friction-loss formulation](https://github.com/google-deepmind/mujoco/blob/3.16.0/doc/computation/index.rst#L797) bounds solved force and is regularized. Map positive hub rotation/torque to +y (forward rolling on flat ground); work uses wheel angle relative to its carrier.

## Resumed implementation review

After PR #22 was available, reviewed its implementation at `42fdac8dfbfdf5f336d12d3c06f4f3b11bc8fea1` against the merged traction baseline above. GPT-6.1 Sol independently checked native brake-row ownership, endpoint command timing, countertorque/work, bearing-versus-carrier accounting and rollback. No consequential mechanics defect was found. Modern replay with an explicit `commands: undefined` did bypass the required schedule through new-run defaults; the follow-up rejects it and adds a regression. Model documentation now describes version 0.4 and the implemented control contract.

The [iteration evidence](ITERATION_19_EVIDENCE.md) records independent rotor/pair controls, both connected assemblies, thirteen sensitivity trials, hosted Linux/Windows/browser results and actual screenshot inspection. It also identifies the untested new-command rejection subpath and unresolved timestep/mesh sensitivity. These limits remain visible when receiving D4b.

## Retained follow-ups

Chain/crank/freehub mechanics, rider power/actuation limits, brake hydraulics/thermal fade, rolling loss and physically calibrated grip remain open. Preserve articulated rider D5, finite-width 3D steering/combined traction D6, layered soil/roots/rock D7, shared mud pickup/packing/deformation-spin shedding and carried mass D8, measured bike setup/catalogue D9, damage/pressure loss D10, scanned/generated terrain request/cache D11, and conservation-qualified physics tiers/adaptation D12. This iteration must receive the connected controls before expanding those mechanisms.
