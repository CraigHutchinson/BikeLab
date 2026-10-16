# Passive rider compliance receiving slice

Research/design proposal, 2026-10-16. Reviewed `dist/bike-rig.js`, `test/bike-rig.test.mjs`, `BIKE_RIG.md`, `ITERATION_6_REVIEW.md` and the overload, 3D and fidelity contracts. This note does not implement or validate rider dynamics. No timing experiment was run. Existing nominal rig checks remain their own evidence; proposed gates below have not passed yet.

## Blockers to resolve before implementing

1. **Mass ownership:** current `mass` includes both fixed rider and frame at the frame origin. Adding a rider body without subtracting its mass would duplicate weight. Its fixed 8 kg m² diagonal inertia is not a separately identified bicycle inertia. Decide and record the split rather than inferring anatomy from the old value.
2. **Comparison ownership:** moving a rider COM above the frame and changing its inertia would change rigid response before compliance is enabled. The selected zero-offset/proportional-inertia split below avoids that confound at the unloaded reference; sag still changes the actual coupled COM physically.
3. **Native addresses:** current fork/rear coordinates and shock tendon use literal indices; tests also assume rear body index 3. Resolve joint qpos/dof addresses and body/tendon IDs by names before adding a child. In particular, adding the rider before the rear child changes qpos ordering. Preserve an explicit record schema rather than making body traversal order a public contract.
4. **Observations and domain:** total COM, static-load formula, initialization, generalized rates, spring energy, dissipation, recordings, termination metadata and viewer all need the rider. Current rollback buffers are sized by model nq/nv and can accommodate it, but their meaning and downstream drawing must be checked. The current shock observation assumes tendon zero; the proposed rider joint adds no tendon.

These are receiving-feature issues, not reasons to reopen broad solver precision work. Existing spring/tyre coupling, endpoint validation and strict failed Rapier gates should retain their claims and limits.

## Minimum coherent mechanism

Use one rigid aggregate rider as a frame child with one frame-local z slide and native linear joint stiffness/damping. The rider shares frame orientation. It can move up/down relative to the frame; it cannot pitch, lean, release, pedal or redistribute forces between hands/feet/saddle. This is a passive guided mass, not a biomechanical human model or a seated/standing calibration. A viewer should show the guide explicitly rather than imply articulated limbs.

The rider COM in frame coordinates is `a + q*ez`, with `a=(ax,0,az)` a versioned unloaded attachment/COM location. Selected bounded start: `a=(0,0,0) m`, coincident with the legacy frame COM. This location is a synthetic aggregate mechanism, not an anatomical rider COM. The spring acts between the fixed guide origin a and the translating COM along the same guide line; the ideal prismatic joint also constrains the other translations and relative rotations. No separate world tether, native contact, external rider support force or duplicate spring is added. The child contributes its mass and full positive COM inertia to the articulated solve.

The same rider is used on hardtail/full suspension; neither gets an extra rear suspension coordinate. This yields four/five coordinates in compliant mode. Future 3D will need explicit hand/foot/saddle contacts, independent rider orientation and release rules. Do not bake this guide into a universal rider interface.

### Axes, force and work

Keep x forward, y left, z up and positive frame pitch theta about +y nose down. Let `R=Ry(theta)` and `e=R*ez=(sin(theta),0,cos(theta))`. Rider coordinate q is positive upward extension; define displayed compression `s=-q` with `springref=0`. Then:

- `pR = pFrame + R*(a + q*ez)`;
- `vR = vFrame + omega × [R*(a+q*ez)] + e*qdot`;
- native generalized rider force `Q = -k*q - c*qdot` in N;
- axial force on rider `F = Q*e`, with equal/opposite axial reaction on frame;
- elastic energy `Ur=0.5*k*q²`, dissipation rate `Dr=c*qdot² >= 0`.

The axial force pair is collinear at the guide origin and COM. Its total power is `Q*qdot = -dUr/dt - Dr`. Rotation of the guide is part of the endpoint velocity; subtracting only world vertical COM velocities gives the wrong damper rate when the frame pitches. Use the joint rate, not an absolute rider velocity.

The guide additionally transmits transverse forces and a reaction couple to keep the rider aligned with the frame. Those are internal, equal/opposite wrench exchanges; their combined power is zero for the ideal constraint, although each body's reaction power need not be zero. The axial spring force is therefore **not** the complete rider/frame attachment wrench and must not be labelled pedal, saddle, handlebar or injury load. The native tree transmits these reactions without manually applying a second force. Full guide-wrench telemetry can be a separate sourced/verified addition; do not improvise it from axial force alone.

Native gravitational/kinetic/spring energy already includes the rider. Check this once against an independent kinetic-energy expression including inherited rotation and translation, and `mR*g*zR + Ur`; do not add the rider spring twice. Add `Dr` once to the existing loss quadrature. External support power remains the two platen terms only. The stationary world fixture still does no generalized work; the moving internal guide is not an external stationary support.

### Controls and mass budget

Illustrative defaults for development, **not measured human parameters**:

| Quantity | Suggested value / admitted development range | Ownership |
|---|---|---|
| Main frame assembly mass | `p.mass-mR` (12 kg at defaults) | Positive residual; excludes existing 3/4 kg axle assemblies |
| Rider mass | 70 kg / 30–100 kg, constrained below total | Editable physical partition; total mass stays fixed |
| Rider COM inertia | each diagonal `8*mR/p.mass` kg m² | Synthetic spherical partition, not anthropometry |
| Main frame COM inertia | each diagonal `8*(p.mass-mR)/p.mass` kg m² | Positive residual; unloaded sum equals legacy inertia |
| Rider stiffness | 14,000 N/m / 8,000–30,000 N/m | Native joint stiffness |
| Rider damping | 900 N s/m / 0–2,000 N s/m | Native joint damping |
| Compression travel | 0.15 m / 0.08–0.20 m | Strict admissible s endpoint, not extra stop compliance |
| Extension travel | 0.05 m initially | Allows bilateral rebound above unloaded reference |

At the default, flat-guide static compression estimate is 49.0 mm, fixed-guide natural frequency 2.25 Hz, damping ratio 0.455. These are analytic design scales, not results from the coupled rig. The received implementation supersedes this proposal with 12,000 N/m, 900 N s/m, 70 kg and symmetric ±0.15 m travel (bounds 4,000–40,000 N/m, 0–3,000 N s/m, 20–100 kg and ±0.02–0.25 m; residual frame mass at least 5 kg). Its fixed-guide sag estimate is 57.2 mm. See RIDER_MODEL.md for the implemented contract. At low stiffness/high mass the static sag can exceed a selected travel; reject that setup honestly. Coupled pitch changes equilibrium through `cos(theta)` and changes the complete modal response. Bounds are exploratory and do not promise completion for every combination. Four seconds' settling with the current speed rejection is retained unless a named case demonstrates a need to revise initialization. Zero/low damping may reject; never add hidden damping to make it pass.

Keep the existing total `mass` control as the main frame-plus-rider budget and require `mFrame=mass-mR>0`, with positive finite inertias. At defaults 82 kg splits into 12 kg residual frame and 70 kg rider; wheels still add 7 kg. A rider-mass edit at fixed total redistributes mass; it does not increase total weight. A total-mass edit increases total weight. Avoid treating the suggested independent ranges as a rectangular valid domain: reject incompatible combinations before native model construction. The proportional inertia split preserves the original spherical sum at q=0 but remains entirely synthetic.

### Fixed baseline and records

Keep current fixed mode readable with unchanged mass/inertia, geometry, DOFs and expected samples. Add a versioned compliant setup with explicit rider mode and mass. Fixed remains the default and retains the legacy lump without a rider joint. Compliant splits its mass and spherical inertia as above, and adds the slide. For an independent model-level control, construct the split child with no rider joint at q=0: its total mass, COM, inertia, mass matrix and gravity vector must match the legacy fixed model. This test control need not become a third UI mode. It is an actual rigid child, not an enormous spring or a clamped dynamic joint.

The zero-offset unloaded reference avoids a new posture/inertia confound. Its sagged compliant equilibrium has a lower COM than the legacy lump; report that physical consequence rather than claim equal settled posture. Each run owns independent state, settles independently and receives the same prescribed platen schedule. A later raised-COM or articulated model needs a distinct matched locked comparison and new provenance.

Export rider mode, all effective masses/inertias, geometry/rest coordinate/travel, native version, setup model ID and initial state. Record rider q/s, qdot, world COM, signed axial force and rider damping loss; do not call this force total interface load. Import reconstructs and reruns setup, as today. Browser and CLI use the same path. Old records must not silently acquire compliant defaults or changed masses.

## Independent checks and acceptance proposal

1. **Legacy and topology:** rerun current fixed tests unchanged. Inspect compiled total mass, bodies, DOFs, named addresses, and absent rear hinge on hardtail. The eventual anatomical hand/foot/saddle attachment requirements are explicitly deferred; this slice does not satisfy them. For the model-only zero-offset locked child, verify its analytically merged mass/inertia against the old lump, then compare native mass matrices and gravity forces at nonzero frame/fork/rear poses. Verify guide kinematics under nonzero pitch/q/qdot with analytic rotations and velocity, including the omega cross term.
2. **Element sign/work:** with frame fixed at several prescribed pitch angles, verify native `Q=-k*q-c*qdot` against direct formula, and finite-difference elastic potential gradient. Verify axial reaction pair net force/moment and pair power; do not use spring-only load to assert full guide wrench. Constant frame pitch and gravity give `qEq=-mR*g*cos(theta)/k`. Compare a damped fixed-frame oscillator transient against its closed-form solution with independent initial conditions; c=0 conservative and zero-velocity cases are useful element controls even if full-rig settling rejects them.
3. **Whole-system statics:** both bike variants and several rider mass partitions/total masses/stiffnesses. Total platen force equals total weight; moment balance uses mass-weighted world COM of **all** bodies. Keep the independent fork-sag check. At rest require `abs(k*s-mR*g*cos(theta))<0.001 N` for rider equilibrium and existing 0.001 N load gates for nominal cases, subject to settling actually reaching that accuracy. Damping changes must not change the static equilibrium. Stiffness changes rider sag; total mass changes total loads; rider mass at fixed total changes the rider share and sag rather than total weight. Do not accept a stationary but force-unbalanced state just because speed is small.
4. **Controlled coupled experiments:** fixed/compliant, hardtail/full; zero excitation, front-only, rear-only, together and delayed bumps. Change one parameter at a time. Demonstrate damping changes loss/transient response, stiffness changes sag/transient response, rider mass changes its actual mass partition and sag, total mass changes weight, and travel changes the supported domain rather than adding force. Do not assert monotonic peak-load benefits: coupled resonance and timing can reverse that expectation. Use settled states independently, not one run's trajectory driving another.
5. **Budget and refinement:** retain nominal 0.02 J energy/work and <1% peak axle-load, <0.1 mm fork/shock travel refinement budgets for the declared receiving cases. Add <0.1 mm recorded rider travel change from dt=0.25 to 0.0625 ms, <1% axial-force peak change when nonzero, and a preregistered absolute tolerance when a relative peak is near zero. Report both peak and aligned time-series errors. Also compare every-step maxima so recording cadence cannot hide a peak. These are proposed gates, not universal certification or grounds to relax earlier failed solver gates.
6. **Strict boundary handling:** test compression and extension separately, settling exits, nonfinite parameters, invalid mass budgets, initial out-of-range poses, low damping and off-record-grid termination. Check every accepted endpoint and violating trial; restore the last admissible state/energy/work history and record the violating rider state separately. Never clamp q, zero velocity, add extra healthy travel or continue through unmodelled stops. Native soft joint limits would add forces and stored/dissipated energy, so do not enable them as an unnoticed substitute for this domain contract.
7. **Receiving consumer:** replay visibly moves the rider and guide, switches modes, displays signed/compressive convention and termination, and exports/reruns identically in browser and CLI. Verify control edits affect the calculation. Keep numerical checks, native browser interaction evidence and physical calibration statements separate. No real-time claim follows from precomputed worker replay.

## Primary-source basis and limits

Read actual source through the GitHub connector at the pinned 3.16.0 URLs on the research date:

- [XMLreference.rst](https://github.com/google-deepmind/mujoco/blob/3.16.0/doc/XMLreference.rst): `body/joint` axis, stiffness, damping and springref; qpos_spring stores the spring equilibrium. `springdamper` can override explicit stiffness/damping using reference inertia, so omit that convenience attribute here.
- [engine_passive.c](https://github.com/google-deepmind/mujoco/blob/3.16.0/src/engine/engine_passive.c): `mj_springdamper`, slide/hinge displacement from qpos_spring, spring and dof damping assembly. The proposed linear coefficients select `-k*(q-qref)` and `-c*qdot`; no polynomial terms are requested.

Kinematics, static balance and power equations above are explicit mechanical derivations, not literature-fitted rider laws. No anthropometric data, grip model, rider force distribution or observed bicycle-rider transient dataset was consulted. The source URLs identify the requested tag; this research did not independently prove tag-to-binary correspondence or rerun the existing distribution receipt. Implementation should use the already pinned vendor and existing provenance checks.

Travel/overload rules remain `OVERLOAD_AND_FAILURE.md`: this slice stops at the supported boundary and does not predict bottom-out force, structural survival or human injury. Spatial terrain, tyre/soil/tread history, free rolling, steering/lean and 3D handling remain required future mechanisms. Native guided rider dynamics cannot be generalized to those regimes. Reopen solver investigation only for a demonstrated receiving-case failure beyond the stated budget; do not spend this iteration polishing isolated micrometre agreement.
