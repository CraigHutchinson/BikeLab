# Iteration 5: constrained solver feasibility

Baseline: `0abfde70c96a134de069f5b23160a0c91dcd9d5a`, reviewed before implementation. Iteration 4 geometry, finite-domain classification, witness ownership, stale-file handling, canvas recovery, browser/CLI contracts and recorded evidence were inspected. No new blocking defect was found in that bounded geometry scope. Its probe supplies no dynamic contact or tyre force.

## Receiving decision

Execute the first constrained-solver arm before assembling a bicycle: a fixed support and a moving rigid carriage linked by a genuine 3D prismatic joint. An illustrative linear spring and viscous damper act along the rail. Tilt and a transverse load expose constraint errors that a body with locked coordinates would conceal. Compare against the independent damped-oscillator reference, record complete parameters and expose replay/overlay and a headless report. This is a solver feasibility station, not a fork calibration or whole-bike result.

Begin with the published Rapier 3D compatibility WASM artifact, pinned by version and integrity, retaining its licence. Check upstream source conventions before implementing the motor. The user requested GPT-6.1 Sol for that research. Record engine/core precision and actual settings. MuJoCo/Chrono comparisons, closed-loop assemblies, contact, compliant stops, and the hardtail/full-suspension fixtures remain required before selecting a whole-bike solver. This bounded arm must report failed numerical gates honestly; passing software tests does not imply that the candidate meets them.

Use x forward, y left, z up; rail direction d=(sin(theta),0,-cos(theta)), compression q along d. The spring has signed restoring force preload+k*q+c*qdot. Gravity projects to g*cos(theta), so qeq=(m*g*cos(theta)-preload)/k. The transverse direction n=(cos(theta),0,sin(theta)) is orthogonal to d. Reference motion solves m*e''+c*e'+k*e=0, e=q-qeq; the independent oracle receives no candidate state. Joint force diagnostics must distinguish evaluated constitutive force from engine reaction/impulse, and report unavailable channels explicitly.

## Gates fixed before results

- The existing reference limits remain 1e-6 m compression, 1e-4 m/s velocity and 0.1 N reconstructed constitutive force at matched recording times. Do not loosen these to accept a first engine arm.
- Rail translation and angular closure limits: 1e-5 m and 1e-5 rad. Report sampled comparison errors and every-step closure maxima separately.
- Preregister h=0.5, 0.25, 0.125 ms; optional finer diagnostic steps must retain their actual settings. Require no universal refinement-rate claim for float32 storage.
- Admit only a conservative passive-energy envelope strictly inside the declared stroke, with a margin; unsupported stops are rejected before running. Candidate travel violations terminate the trial, not clamp it into a successful report. This is not the event-safe stop acceptance gate.
- At an interior step, snapshot the complete engine world, reacquire body/joint handles, continue an independent restored arm and compare every subsequent body state plus final snapshot bytes. Application state is the immutable setup and integer tick; no soil/history model exists in this arm. No cross-version or cross-platform bitwise promise follows.
- Independent tests: static equilibrium, known undamped motion, multiple mass/stiffness/damping scales, tilt/transverse loading, malformed/unsupported setup, repeatability and restart. Browser/Node comparisons use the same pinned bytes at the same settings.
- Preserve existing stations and tests. Run Windows/Linux CI, actual module-worker browser tests and inspect desktop/narrow screenshots. Solver replay is offline; no real-time, allocation-free hot-path or physical calibration claim.

## Product connection

A player needs setup changes to alter the same mechanics used on the trail. This experiment makes numerical error and joint fidelity inspectable before those mechanisms affect handling. The next balanced step is the matched second solver arm and coupled assembly/contact tests, followed by the visible hardtail/full-suspension rig. Layered mud/root load transfer, tyre pickup/shedding and carried mass, overload and 3D handling remain explicit requirements; this fixture does not invent unused material parameters.
