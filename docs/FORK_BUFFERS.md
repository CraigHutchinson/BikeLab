# Fork travel buffers

The bicycle rig now offers optional progressive buffers in the final part of fork extension/compression. The top-out preset uses a hardtail, fixed rider, 9,000 N/m fork spring, 200 N s/m damping and an 80 mm / 0.2 s travelling platen pulse. With identical setup and no buffers it terminates at the fork boundary. With default buffers it continues within supported stroke. A separate bottom-out preset lowers the fork spring to 4,000 N/m and loads both buffers; its unbuffered control can finish, so completion alone is not its evidence of buffer action.

This is an illustrative compliant travel-buffer model. It is not a rigid impact solver, calibrated elastomer, fitted restitution model, damage threshold or proof that a real fork survives a load. Only fork buffers are implemented; shock and rider travel retain their previous termination behaviour. The user-requested spatial tyre deformation and distributed grip follow-up is recorded in TERRAIN_CONTACT.md and remains separate.

## Force and energy contract

Fork compression q increases into its 0–0.16 m stroke. Let width b be the buffer zone at each end, k the spring scale (N/m), c the damping scale (N s/m), and v=qdot:

- top penetration dt=max(0,b-q); bottom penetration db=max(0,q-(0.16-b));
- top magnitude Ft=(k*dt²+c*max(-v,0)*dt)/b;
- bottom magnitude Fb=(k*db²+c*max(v,0)*db)/b;
- generalized force Q=Ft-Fb, positive toward compression;
- potential U=k*(dt³+db³)/(3b);
- loss power D=c*(dt*max(-v,0)²+db*max(v,0)²)/b.

Both buffers are inactive through free travel. At engagement the force is continuous. Damping acts only while entering a buffer; unloading returns spring energy without an attractive contact force. Q*v+dU/dt=-D and D>=0. At full zone depth spring force is k*b, tangent stiffness is 2*k and stored energy is k*b²/3: k is a scale, not a measured constant stiffness or quadratic coefficient.

The force goes to the native fork generalized-force address resolved by joint name. The articulated solve supplies the internal frame reaction; no duplicate Cartesian action or cosine projection is added. U is added once to total energy; D enters total dissipation once and has a separate accumulated channel. It is not external platen work. Include the buffers during physical settling, since top-buffer force can shift the unloaded equilibrium.

| Parameter | Default | Accepted values |
|---|---:|---|
| forkBuffer | none | none / progressive |
| forkBufferWidth | 0.02 m | 0.005–0.03 m |
| forkBufferStiffness | 300,000 N/m | 50,000–1,000,000 N/m |
| forkBufferDamping | 1,500 N s/m | 0–4,000 N s/m |

The bounds keep zones nonoverlapping. All coefficients are illustrative. Disabled mode preserves the original dynamics; dormant parameters still validate. Not every admitted combination completes: a weak/narrow buffer may fail to arrest motion before the ultimate boundary.

## Integration and ultimate boundaries

Custom buffer force is held for each existing native implicitfast step, like the external tyre force. Its nonlinear stiffness and damping remain explicit; native implicit damping does not implicitly integrate qfrc_applied. Continuous passivity therefore does not imply exact discrete energy balance or guaranteed containment. Step refinement and energy budgets are checked in the receiving experiment; micrometre carriage matching remains parked.

The original fork, shock, rider, tyre and pitch domain checks are unchanged. Crossing an ultimate limit rejects the trial and records the preceding valid state; no clamp, expanded stroke or fictitious impact continuation is used. These are endpoint checks, not a continuous-time guarantee. Native clock resets and inadequate settling still reject. Buffers provide finite forces inside a supported domain; they cannot guarantee prevention of any overload.

## Records and viewer

Model `bikelab-planar-rig-0.3` requires complete buffer settings. Complete v0.1 and v0.2 records migrate explicitly with buffers disabled; v0.1 also migrates to fixed rider, while v0.2 preserves its rider mode. Unknown historical fields reject. Import reconstructs the setup instead of trusting supplied samples.

New channels: signed forkBufferForce, positive forkTopForce/forkBottomForce, forkBufferEnergy and cumulative forkBufferDissipation. Summary peakTopForce/peakBottomForce inspect all accepted integration endpoints, not graph samples. bufferLoss is included in total loss and reported separately. Replay shows engagement, changes fork colour under buffer load and plots signed force plus stored/dissipated energy. Top-out and bottom-out presets make the two force directions inspectable.

## Sources and verification

The constitutive law is a documented surrogate derived from its stated potential and dissipation, not an externally calibrated tyre/fork law. GPT-6.1 Sol researched the pinned implementation and independently checked signs/work:

- [MuJoCo force assembly](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c): qfrc_applied is added once to generalized force.
- [Energy implementation](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_sensor.c): native energy includes its model springs/gravity, not the custom buffer potential.
- [Derivative implementation](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_derivative.c): custom applied force is excluded from the native implicit derivative.

Independent tests cover the potential gradient, passive work identity, symmetry/free travel, one-coordinate impact momentum and conservative turning depth at two masses. Coupled checks cover four bike/rider modes, three steps, both buffer directions, no-buffer preservation, weak-buffer ultimate termination, cadence invariance and schema migration. `node scripts/buffer-evidence.mjs` regenerates all receiving runs and enforces the 2% finest-pair peak, 0.2 mm travel and 1% work-scale residual limits. These are numerical budgets for these scenarios, not general parameter or physical-calibration certification.

Model v0.4 additionally supports [shock buffers](SHOCK_BUFFERS.md). Complete v0.3 records retain fork settings and migrate with shock buffers disabled. The earlier fork-only limitation above describes the initial iteration.
