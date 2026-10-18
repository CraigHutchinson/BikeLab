# Rider stops and attachment loads

Model v0.6 adds optional finite compliant stops to the existing passive guide. It also reports total guide, fixture and rear-attachment reactions from the same accepted state used by the worker and CLI. It remains a synthetic planar fixture, not an anatomical rider or a component-strength model.

## Centered stop convention

Upward rider displacement is q, speed u; the allowed domain remains −T ≤ q ≤ T. Existing compression signals use −q. Apply the shared progressive law at q+T with total travel 2T. Lower penetration is max(0,width−q−T); upper penetration is max(0,q−T+width). Lower force is positive up; upper force is negative. The spring is quadratic in penetration; damping acts only while entering a zone. Potential K·penetration³/(3·width) and closing loss C·closingSpeed²·penetration/width enter the energy budget once. The native guide spring/damper remains separate.

`riderBuffer` is `none` by default or `progressive`. Width defaults to 0.015 m (range 0.002–0.03 m, strictly less than T); stiffness scale defaults to 300000 N/m (50000–1000000); closing damping defaults to 1500 N s/m (0–6000). Fixed-rider mode validates these fields but leaves them dormant. These are bounded illustrative parameters, not measured stops or human tissue properties.

With stops enabled, initialize the settling guess inside the domain if unbuffered static sag would exceed it. This is an initial guess before four seconds of physical settling, not a projection of a moving impact. Accepted dynamics never clamp travel. A weak stop can still cross the ultimate boundary; reject that trial and end at the last valid endpoint. No rigid impact or damage continuation is inferred.

The “Load rider-stop experiment” button uses a 20 kg rider share, ±20 mm travel, 19 mm zones and 40000 N/m guide spring, with the two platens moving together. It engages both stops and can be compared on either assembly. The narrow free zone deliberately makes both transitions observable; it is not a recommended riding setup.

## Wrench meaning and ownership

`guideFx/Fz/My` is the total frame-on-rider reaction at rider COM. Forces use world +x forward and +z upward; +My is nose-down. `guideAxial` projects along the rotating guide; `guideTransverse` projects along frame +x. `riderForce` retains its old spring/damper-only meaning. `riderTotalForce` adds the stop; it agrees with `guideAxial`. The frame receives an equal/opposite wrench **at the same origin**; transporting to another point changes the moment. Fixed mode's separate guide is unresolved, not a physical zero load on an actual rider.

`fixtureFx/Fz/My` reports world-on-frame at the frame origin. World x is fixed, but heave and pitch are admitted: ideal fixture Fz and My are approximately zero and its power is zero. The nonzero horizontal force is the artificial fixture's constraint reaction, not tyre traction.

`pivotFx/Fz/My` reports frame-on-rear at the main pivot for full suspension. The ideal free hinge has approximately zero My. On a hardtail the origin is the rigid rear attachment at its axle and that attachment can transmit a moment. No out-of-plane lateral load is produced by this planar experiment.

A preallocated diagnostic MuJoCo data instance copies accepted qpos/qvel and current applied forces, runs a fresh forward solve and post-constraint inverse dynamics. This avoids mixing new positions with the integrator's previous acceleration. Native `cfrc_int` is torque/force, world-oriented at `subtree_com[body_rootid]`; shift its moment by `(C−O)×F` to the reporting origin.

The native spatial shock spring/damper already has a body-force representation in RNE. Generalized shock-buffer force does not: its equivalent arm-eye force is −B·(armEye−frameEye)/L. Subtract that eye wrench from the raw rear-interface result to isolate the physical pivot load. Do not subtract the native tendon twice. This correction is independently checked with buffers of both signs and a vanishing free-axis moment.

## Sampling, verification and records

Reaction channels are instantaneous accepted **recording endpoints**, not integration-step impulses or maxima. Default recording remains 5 ms and simulation time remains independent of display timing. Headless recording can now be as fine as 0.25 ms, up to 32001 samples for the largest admitted run; the browser continues to require 5 ms imported records. Scratch and recording arrays are allocated outside integration loops.

Short stop/contact pulses can be missed by coarse output quadrature even when solver timestep is refined. `scripts/rider-load-evidence.mjs` checks both solver/recording refinement and recording-only refinement at fixed solver dt. The independent `scripts/rig-momentum-reference.mjs` reconstructs world linear/angular momentum from masses, body poses and rates, then integrates gravity, platen forces and the fixture wrench. The finest 0.03125 ms solver / 0.25 ms recording case must close within 0.12 N s for each linear component and 0.12 N m s for angular momentum. Coarse-output residuals are retained as evidence; do not interpret a 5 ms load plot as a converged impulse integral.

Other gates cover hanging-mass signs, offset wrench transport, rider Newton/Euler balance, internal paired power, energy, corrected pivot moment, ultimate bounds, <2% finest-pair stop-force peaks, <0.2 mm rider displacement difference and <1% relative work residual. Old v0.1–v0.5 records restore rider stops disabled and retain their own geometry/buffer migration. New v0.6 records require all four rider-stop fields. Historical signal and summary values remain exact; new telemetry is additive.

Next: measured attachment geometry, independently articulated rider and hand/foot/saddle contacts, sourced mass/inertia, validated component stress/failure and pressure-loss criteria. Hardware dimensions or service torques are not breaking forces. Distributed tyre deformation, square-edge loads, layered root/soil/mud, 3D turning and measured multirate real-time operation remain separate required work.
