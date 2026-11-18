# Coupled casing mass and internal frequency - 17 November 2026

The casing diagnostic now derives its frozen internal frequency scale from configured tyre mass, hub mass and hub spin inertia. It reuses the existing native-verified `inverseMass` routine instead of introducing a second mass solver. Runtime timesteps and production physics are unchanged: this is not yet a contact/damping/nonlinear timestep admission.

## Received result

The [report](evidence/mass-frequency.json) covers 27 phase-zero snapshots: 128/256/512 stations, 1.2/1.6/2.0 bar and 0/2/4 mm imposed lowering. Each snapshot has six mass/inertia configurations, giving 162 estimates. Shapes and material tangents are held fixed while inertia varies; these are not new gravity-supported equilibria for each mass.

At 1.6 bar and 2 mm lowering:

| Stations | Nominal oscillator scale | Half all mass/inertia | Double all mass/inertia |
| --- | ---: | ---: | ---: |
| 128 | 139.25 us | 98.47 us | 196.93 us |
| 256 | 69.76 us | 49.33 us | 98.66 us |
| 512 | 34.90 us | 24.68 us | 49.36 us |

Nominal means 3 kg hub, 1 kg tyre, 0.08 kg m² hub spin inertia and 8 mm node skin radius. Other variants separately change hub mass to 1/30 kg or hub spin inertia to 0.02 kg m². These are illustrative supported inputs, not calibrated bicycle properties. Uniform mass/inertia scaling reproduces the square-root scale relation within 1e-12 in every snapshot.

All 27 full internal tangents factor positively at both finite-difference steps. The maximum relative change in the coupled operator between steps is approximately 7.75e-10. This is numerical refinement evidence, not a certified bound on the exact Hessian, a global stability proof or a phase/geometry envelope. The [inspected plot](evidence/mass-frequency.svg) keeps these internal scales distinct from admitted timesteps.

## Coupled inverse and units

Let m=tyreMass/N, J0=hubInertia+tyreMass*skin²/2, and q_i be the actual local Cartesian node positions including deformation. For rotation about +y, w_i=(q_zi,-q_xi). The tyre point velocity is V+R(qdot_i+w_i*Omega). Summing translational and body-spin kinetic energies and eliminating free hub translation/spin gives the internal block of the *inverse full mass matrix*:

```
B = I/m + U Uᵀ/hubMass + w wᵀ/J0
```

U repeats the two Cartesian unit columns. B has units 1/kg. Inverting the internal principal block of M instead would give I/m and omit recoil/spin. The implementation applies the already-received full inverse to each tangent column with zero hub generalized force. There is no added hub force or duplicated reaction.

Tests compare M*a with an arbitrary mixed generalized force using the actual [MuJoCo 3.16.0 `mj_fullM` API](https://github.com/google-deepmind/mujoco/blob/3.16.0/include/mujoco/mujoco.h). Eight native cases cover 32/128 nodes, light/heavy mass and inertia, two hub angles and deformed nodes; every row agrees within 2e-9 in its generalized force/torque units. Fine 256/512 estimates use the same derived kinetic-energy structure; those meshes are not thereby native-runtime received. The assumptions are an isolated planar hub, equal node masses, node centers at the slide origins, inherited node spin inertia, no armature and no other connected bodies.

## Frequency estimate and its limits

K is the symmetric finite-difference Hessian of material plus sealed-gas energy in internal Cartesian coordinates (N/m). Steps are 1e-7 and 5e-8 m. For positive K, B*K is similar to the symmetric mass-normalized stiffness; its eigenvalues are real and nonnegative. The matrix infinity norm bounds their magnitudes. The reported scale is 2/sqrt(normInf(B*K)); it is a conservative oscillator ceiling for that frozen approximate matrix, not an exact eigenfrequency. A second reported scale inflates the norm by normInf(B*(K_h-K_h/2)). Skew is recorded separately. That difference inflation is an error estimate only, not a certified enclosure of the true derivative.

For a constant-mass undamped scalar oscillator, the semi-implicit update has determinant one and trace 2-h²*omega²; strict h*omega<2 keeps its eigenvalues on the unit circle. The boundary is not admitted. The [versioned MuJoCo integration description](https://github.com/google-deepmind/mujoco/blob/3.16.0/doc/computation/index.rst) defines the new-velocity position update and explains Euler's implicit joint damping. Actual wheel stepping also includes flex-edge damping, contact constraints, changing geometry and potentially gyroscopic/velocity-dependent forces. They are excluded here. The bound must not replace the current runtime limit on the strength of these results.

## Validation and next receiving

Complete Windows host Node suite: **507/507 pass**, zero skipped; [receipt](evidence/mass-frequency-tests.json) and compressed full log are retained. Four new tests cover coupled recoil and mass scaling, the scalar oscillator discriminant, native full-mass residuals and tangent sign/input preservation. Runtime/browser assets were not changed; no new browser or hosted-full pass is claimed.

Next include the actual damping and native-contact update in loaded timestep refinement across configured masses, then measure complete simulated-time cost in the native wheel. Carry the material/phase/refinement gates forward and compare practical reductions against the fine reference. Do not choose a production mesh from force-only timing, or use this isolated-wheel mass formula for a connected bicycle/rider without deriving that system's mass contract. Trail reuse, near-rim/insert handling and physical calibration remain ahead; #95 stays open and explicitly uncalibrated.

```
node --test test/tyre-mass-frequency.test.mjs
node scripts/tyre-mass-frequency.mjs
python scripts/plot-tyre-mass-frequency.py
```
