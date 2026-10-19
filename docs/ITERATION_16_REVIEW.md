# Iteration 16 review and receiving plan

Base: merged main `ac648d1`; iteration 15 passed 164 Linux/Windows tests, complete browser/headless checks and live Pages verification. Its ring contacts remain frictionless, uncalibrated and discrete in time. Sharp-corner mesh convergence, complete swept casing contact and physical damage are unresolved. Preserve those boundaries while receiving a bounded smooth-ground bike/rider run.

## Top-down receiving slice

A moving MTB view shows both deforming tyres, frame, fork, single-pivot rear suspension and current guided rider. Hardtail and full-suspension share the same force-driven planar translation/pitch and independent wheel spin. Flat landing, smooth bump and separated-flight controls expose contact load transfer, travel limits and work. Playback and exported scenarios use the same worker/headless dynamics. No braking/traction or articulated anatomical contacts are implied.

## Bottom-up integration and contracts

Reuse the pinned native engine, ring assembly, linkage and progressive fork/shock/rider buffer law. Extract shared bike-tree construction without changing historical rig results. Remove platen tyre forces completely from the new consumer. Use explicit nonrotating-carrier/rotating-hub/tyre mass partitions: default front .5+1.5+1=3 kg, rear 1.5+1.5+1=4 kg, preserving the existing total sprung mass plus 7 kg. New inertia is explicit and illustrative: the tyre ring alone exceeds the old front lump's .1 kg m2, so old inertia cannot be preserved by adding another wheel.

Use named native joints/bodies/flexes and actual address tables; never assume the standalone wheel's three root coordinates or flex index zero. Initial pose is an authored launch, not an unreported quasi-static settling solve. Only bounded smooth rigid profiles are admitted; all deformation, rim/domain, suspension/rider travel and numerical support checks terminate at the last accepted state. No extra spring support per terrain sample, no prescribed forward motion, and no input/display-time coupling.

MuJoCo 3.16 postconstraint RNE omits flex contacts. Correct aggregate wheel/fork/rear/root subtree wrenches by subtracting that subtree's flex ground wrench about the same origin. Only complete wheel subtrees qualify: internal edge/foundation forces cancel there, not across individual casing nodes. Preserve native tendon loading and remove the separate equivalent shock-buffer eye force when isolating a rear pivot bearing. Do not label a ground resultant as a bearing or stress load.

## Acceptance and follow-ups

Independent controls: mass/inertia; shared assembly and historical rig replay; free flight and linear/angular momentum; both-wheel contact sums and free-root balance; free-spin bearing torque and complete-wheel Newton/Euler balance; suspension/rider limit reaction signs; ground impulse/work ledger, take-off/recontact and supported refinement. Refine timestep separately from tyre/terrain representation. Record rejected states and JSON replay consistently. Verify browser/headless records, playback lifecycle, imports, mobile layouts and uniform station navigation.

D3 remains bounded to this planar passive-rider/frictionless slice. D4 traction/brake/drive and D5 articulated rider contacts follow in the same connected consumer. Keep layered soil/mud, finite-width 3D steering/lean, terrain cache ingestion, sourced failure/pressure loss and measured real-time fidelity on the connected plan. No separate diagnostic station substitutes for the bike/rider objective.

## Implementation checkpoint

The shared native assembly now runs both wheels, frame, fork, rear linkage and guided rider in one system. Both hardtail and full-suspension one-second flat and smooth-bump probes complete within support limits. Per-wheel contact-list forces/moments agree with independently projected generalized constraints; root and free-bearing reactions close. Five connected-bike controls plus the nine prior moving-wheel controls pass locally. The new viewer, worker and CLI are present; browser receipt and refinement evidence remain in progress.

A 1 ms sampled bearing-impulse check showed about 0.11 kg m/s quadrature error during contact activation. A short 0.125 ms observation control now passes; distinguish recording refinement from integration refinement in the final evidence. Do not weaken integration guards to accommodate this diagnostic. The overload preset uses a 3 m/s downward launch and terminates at the last accepted contact-overlap boundary.

## Final review scope

The numerical receipt and remaining sampling/mesh limits are in `ITERATION_16_EVIDENCE.md`. Primary-source review validated force projections, flex/RNE correction boundaries and COM velocity conventions. Independent tests now include contact attribution and bearing-force impulse, inherited frame/wheel rotation, fixed/compliant rider mass partitions, observation-only invariance and rejected-step replay. The viewer shows the connected body/contact state, with a narrow-screen tracking camera; all ten pages retain the same ordered tabs. Roadmap status was reconciled with the received subset and still retains traction, jump/recontact, articulated rider, finite width, layered terrain, mud, catalogue and fidelity work. Merge remains gated on the current revision's Linux/Windows and complete browser checks.
