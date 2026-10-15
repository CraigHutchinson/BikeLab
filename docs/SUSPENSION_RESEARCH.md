# Slice 2 suspension research and later handling requirements

2026-10-15. Bounded research for the fork/shock axial station. The primary pages below were opened and read through the available web connector. This is a proposed synthetic model and acceptance contract, not a hardware calibration or a final multibody-stack decision. Repository contracts reviewed: AGENTS.md, STACK_DECISION.md, ROADMAP.md, RIG_DESIGN.md, PARAMETERS.md and COMPONENTS.md.

## Primary references actually read

- [MathWorks Spring and Damper Force](https://www.mathworks.com/help/sm/ref/springanddamperforce.html): reciprocal axial forces; spring force depends on length relative to natural length and damping on relative velocity. Its signed force convention allows both repulsion and attraction. This informs the attachment/power contract below; BikeLab's compression coordinate is defined separately.
- [SRAM/RockShox Suspension Theory Guide](https://www.sram.com/globalassets/document-hierarchy/service-manuals/rockshox/suspension-theory-guide.pdf), printed pages 4–7 and 14–19: the coil/preload discussion and separate compression/rebound damping circuits support starting with these mechanisms. Our two-coefficient viscous approximation is a deliberate synthetic simplification; the guide does not provide calibrated coefficients. Its conceptual air-spring material is insufficient for implementing a particular positive/negative-chamber assembly.
- [NIST RK4 documentation](https://www.ctcms.nist.gov/~langer/oof2man/RegisteredClass-RK4.html): classical four-stage explicit method. Retain the existing researched method for this bounded smooth ODE, with a separate convergence assessment for changes of damping branch and travel events.
- [Meijaard, Papadopoulos, Ruina and Schwab (2007)](https://arendschwab.com/assets/pdf/meijaard2007linearized.pdf), especially sections 3, 5 and 6: independent benchmark for small lean/steer dynamics of a rigid bicycle. The model omits tyre slip/compliance and rider articulation; reproducing it would validate an important mechanical limit, not mountain-bike cornering fidelity.
- [Project Chrono tire-model documentation](https://api.projectchrono.org/wheeled_tire.html): important engine-selection limitations. The documented Fiala implementation assumes zero camber and omits overturning moments; the documented Pac02 implementation lacks large-camber and pressure-dependence terms. Generic vehicle tyre availability therefore does not establish bicycle suitability.
- [Project Chrono overview](https://projectchrono.org/): an example candidate for the later stack evaluation, with constrained multibody mechanics, springs/dampers and separate visualization facilities. This research did not install, benchmark or select it.

The equations and proposed gates below are our derivations/design choices, informed by these references. No reference claims the chosen tolerances represent physical accuracy.

## Minimal axial element

Let the attachment separation be L, the extended reference length L_ext, compression q = L_ext - L, and compression velocity u = dq/dt = -dL/dt. Valid travel is 0 <= q <= T. SI parameters: k > 0 N/m, preload force F_pre >= 0 N, c_comp >= 0 and c_reb >= 0 N s/m, and T > 0 m. Equivalently the coil's installed preload displacement is p = F_pre/k; it shifts the force intercept without changing k.

Use:

```text
F_s(q) = F_pre + k q
c(u)   = c_comp if u >= 0, otherwise c_reb
F_d(u) = c(u) u
F(q,u) = F_s(q) + F_d(u)
U(q)   = F_pre q + (1/2) k q^2
dD/dt  = F_d u = c(u) u^2 >= 0
```

U is measured relative to q=0; the constant installed preload energy is omitted. F is signed spreading force. It may become negative during fast rebound because the captured damper can oppose extension with attraction. Do not apply the tyre station's nonnegative normal-force clamp to this element: that would change the model and its work budget. The spring contribution remains positive throughout the admitted stroke.

For attachment positions r_A and r_B, define n = (r_B-r_A)/L. Apply -F n to A and +F n to B at the actual attachment points, with the corresponding moments about each body's centre of mass. The pair's power is F dL/dt = -F u; consequently pair power + dU/dt + dD/dt = 0. This identity supplies a direct future 3D assembly check. Reject coincident attachments; do not normalize a zero-length vector.

The force law is an allocation-free, renderer-independent evaluator of q,u and immutable parameters, returning spring/damper/total force, stored energy, dissipation rate and domain status. Experiment forcing, carriage dynamics, recording, curves and drawing consume it. Fork and shock station fixtures can share the evaluator while displaying their distinct axial stroke. No wheel-travel leverage is part of the bare shock law.

## One-coordinate station and support work

Use an upper carriage of mass m > 0 above a lower prescribed base b(t), with upward world z positive:

```text
z       = b + L_ext - q
z_dot   = b_dot - u
m q_ddot = m(g + b_ddot) - F(q,u)
E       = (1/2)m z_dot^2 + mgz + U(q)
W_dot   = F b_dot
E + D - W = constant
```

For a fixed base the internal equilibrium is q_eq = (mg-F_pre)/k. Restrict equilibrium/rebound experiments to 0 < q_eq < T and choose initial conditions that stay within travel. A setup with mg <= F_pre has no interior gravitational sag in this station; it needs a top-out reaction model to represent its static state. Similarly mg >= F_pre+kT needs a bottom-out reaction. Reject such equilibrium setups visibly rather than inventing a clamped sag solution. Prescribed compression curves may still evaluate the endpoints as curves.

Travel bounds are model-validity bounds in the first delivery. On attempted exit, end the dynamic run with an explicit top-out/bottom-out invalidity event and retain admissible recorded states. An event time is bracketed to the integration step unless a separately researched root locator is added. Guard solver trial states too; if a trial leaves the domain, report the attempted exit without silently evaluating an arbitrary out-of-domain constitutive law. Do not clamp q, zero its velocity, reflect it, or extrapolate a valid-looking rebound. Those operations introduce an unmodelled impact/stop and change momentum or energy. Real stops, friction, air chambers and adjuster circuits require their own laws, sources and tests.

## Independent verification before acceptance

Declare these engineering thresholds before evaluating the implementation. Suggested release gates:

1. **Static and preload:** independently compute q_eq, F_pre=k p, and force slope k. At exact equilibrium require the acceleration residual to be within floating-point arithmetic tolerance. After the declared settling window require |q-q_eq| <= 0.001 T and a separately declared velocity tolerance. Include several m,k pairs and preload offsets, with an interior equilibrium in each case.
2. **Conservative transient:** c_comp=c_reb=0, fixed base, q=q_eq+A cos(omega_n t), u=-A omega_n sin(omega_n t), omega_n=sqrt(k/m), and |A| < min(q_eq,T-q_eq). Compare full displacement/velocity traces with these formulas, independently of the production derivative/evaluator. Target maximum displacement error <= 0.001 |A| over ten periods; use a separately scaled velocity error.
3. **Damped transient:** for equal damping c, alpha=c/(2m), omega_d=sqrt(k/m-alpha^2). With e=q-q_eq, use the separately implemented closed form e=exp(-alpha t)[e_0 cos(omega_d t)+(u_0+alpha e_0)sin(omega_d t)/omega_d]. Also test critical damping e=exp(-omega_n t)[e_0+(u_0+omega_n e_0)t] and overdamped exponential roots. Do not force all reference fixtures into one damping regime.
4. **Compression/rebound asymmetry:** verify F_d changes sign with u, force is continuous at u=0, and F_d u >= 0 over both branches. Use a monotonic half-cycle with an independently calculated constant-coefficient solution; choose a duration before its first velocity reversal. Equal-coefficient tests alone cannot detect swapped compression/rebound coefficients.
5. **Energy/work:** fixed-base conservative |E(t)-E(0)| <= 0.0001 E_char; dissipative D is nondecreasing and |E+D-E(0)| <= 0.0001 E_char. For a smooth moving base use |E+D-W-E(0)| <= 0.001 E_char, where E_char is a declared positive scale built from initial kinetic/elastic excitation or mgT. Check the instantaneous power identity separately, so an accounting sign error cannot hide in a small motion.
6. **Moving support:** for b=A sin(omega t), equal damping, sustained interior motion and an explicit settled window, the independently derived complex transfer from base displacement to carriage displacement is H_z=(k+i c omega)/(k-m omega^2+i c omega). Compare amplitude and phase and retain support work. A stationary-base energy test cannot verify W_dot.
7. **Travel and invalid inputs:** test both exits, exact-boundary inward/outward velocities, insufficient/excessive load, nonfinite/negative parameters, and excessive initial perturbation. Require an explicit failure reason, no silently altered setup, and no admissible-looking samples beyond travel. Compare event-time brackets at h,h/2,h/4; do not infer smooth RK4 order at events or branch changes.
8. **Convergence and consumption:** compare h,h/2,h/4 at matching physical times and analysis windows. Target <1% change between the finest steps in travel amplitude and force impulse; report peaks/events separately. Browser and headless recorded samples must agree under the repository's runtime/tolerance contract. Curves and the displayed mechanism must consume the same law, coordinate and timestamps. Save/replay includes station identity, initial state, preload, both damping coefficients, stroke and forcing.

These tests establish mathematical/numerical agreement for the synthetic law. Real fork/shock claims need independently measured force-displacement and force-velocity data with stroke, temperature, pressure/spring, adjuster configuration, uncertainty, fitting experiments and held-out validation.

## Concrete requirements for whole-bike and 3D work

Preserve the existing x-forward/y-left/z-up right-handed frame. Positive rotation about x leans the top of the bicycle right; positive yaw about z turns left; positive pitch about y is nose-down. UI lean/pitch signs may differ only through documented conversions. Body state should eventually carry full orientation, angular velocity, centre of mass and a positive-definite 3D inertia tensor. Choose an orientation representation/integration method in the later stack decision, after reading its actual documentation.

Every joint/force component needs explicit attachment frames and point velocities v_point=v_COM+omega cross r. Apply equal/opposite forces and reaction torques; use power-conjugate coordinates. For a linkage coordinate s, derive shock q(s) and generalized force -F dq/ds from geometry. Verify attachment power equals generalized-coordinate power; do not add an independent leverage or anti-rise correction for geometry already represented.

Before Slice 3/6 implementation, enumerate bodies, independent coordinates, constraints, contacts and controls for hardtail and full suspension. Hardtail rear attachments are rigid. Planar locks/fixtures are explicit and removable; retain their reactions/work. The later solver evaluation must demonstrate closed-loop linkage, prismatic/revolute joints, limits/contact, constraint error, timestep convergence, deterministic headless scenarios and snapshot consumption. It should compare candidate libraries against these actual bicycle tests; the present one-coordinate RK4 solver is not a general constrained-body solution.

For turning, tyre input contracts must include contact frame, normal load, contact-point relative velocity, wheel angular velocity, longitudinal/lateral slip, camber, terrain motion and applicable load/speed/temperature/setup bounds. Outputs are a full contact wrench with declared force/moment signs and any internal state/storage. Combined-slip grip must share a finite traction budget; independent unbounded longitudinal and lateral curves would permit impossible combined forces. Near-zero-speed behavior and transition to contact loss need explicit treatment. Do not select a car tyre implementation whose documented camber range excludes bicycle lean.

3D acceptance must include:

- Uncontrolled rigid/no-slip limit compared with the published Meijaard benchmark matrices/eigenvalues or time responses across several speeds, including the source-to-BikeLab axis/sign mapping. Its canonical form is M a_ddot+v C1 a_dot+(g K0+v^2 K2)a=tau, a=[lean,steer]. This benchmark does not validate slipping tyres.
- Left/right mirror tests: lateral displacement, yaw, lean, steer and lateral force reverse appropriately; speed, vertical loads and energy agree for mirrored symmetric setups. Test inertial tensors and gyroscopic response separately before judging controller behavior.
- Constant-radius turns with explicit assumptions: net lateral force approaches m v^2/R and the combined bike/rider centre of mass and ground resultant satisfy moment balance. The familiar tan(lean)=v^2/(gR) is only an ideal quasi-steady diagnostic for the specified COM/resultant assumptions, not a universal steer-angle or tyre-camber equation.
- Pure longitudinal slip, pure lateral slip, camber sweep and braking-in-turn tests; combined-force saturation, wheel torque/power consistency, passive dissipation/storage balance, contact loss and zero-speed limits. Separate curve verification from measured bicycle-tyre validation.
- Coupled roll/yaw/pitch responses to front/rear braking, uneven excitation and steering torque; no axis remains silently locked in free 3D mode. Test with rider control disabled, then add a named, bounded controller with logged commands, saturation, delay and mechanical work.
- Rider mass/inertia aggregation first, articulated hand/foot/saddle load paths next, active posture/balance last. Verify passive joint/contact energy, equal/opposite grip torques and release rules. Run identical scenarios with fixed and articulated rider, and sweep controller parameters so automatic balance cannot conceal an incorrect mechanical model.

The cited engine/tyre documentation is enough to expose selection risks, but not to choose a final 3D engine or calibrated tyre law. No physical dataset, 3D implementation, installed solver comparison or hardware performance result was produced by this research.
