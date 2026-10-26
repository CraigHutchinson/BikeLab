# Rider observation without world ownership

This is the next small prerequisite after [PR31's bounded unbound probe](RIDER_UNBOUND.md). The existing CLI, worker and panel now use [a rider-scoped observer](../dist/rider-unbound-observer.js). Their input, native XML, integration, recording and output formats stay unchanged. No shared bike/rider mode is added here.

Previously the probe's observation function combined whole-world admission and energy with rider geometry/momentum. A second native root would break that assumption: unrelated bike contact/force rows would be rejected, and native world energy could be mislabelled as rider energy. The extraction establishes the boundary before adding a bike.

## Internal contract

`createUnboundRiderObserver(mj, model, data, {passive, velocityBuffer, binding})` borrows compatible live native objects and an exactly six-value velocity buffer from the world owner. `passive` is the compiled immutable passive specification. Optional explicit `jointNames`, `bodyNames` and `endSiteNames` bind the same generated rider tree under another namespace; defaults retain existing names. This is an internal binding API, not an arbitrary native XML importer or stable actor identity.

The binding must refer to a semantically equivalent compiler-generated tree, with the same axes, authored rest pose, masses/inertias and passive parameters. Checks resolve names once and verify joint type/order/body ownership, expected body parents and joint counts, endpoint ownership, complete rider descendants, world-rooted trunk and aggregate mass. These checks detect misbinding but do not independently qualify every axis, inertia or force-law value in externally authored XML. Native addresses are scoped to this model and cannot identify a persistent actor across worlds.

`createUnboundRiderObservation()` allocates owned output arrays. After forwarding the world, the caller invokes `observer.observe(out)`. It fills only that rider's time, q/v, native segment geometry/COM velocities, aggregate COM, linear momentum, angular momentum about its COM and positive passive damping power. Existing finite-state, coordinate/rate, pitch, joint-domain, actual-world-hip and planarity checks remain. A returned issue means this candidate observation is incomplete and must not be published as accepted state.

The observer does not step, forward, evaluate native world energy, reset state, inspect unrelated constraints/forces, or delete native resources. It has no energy/work ledger or continuation state. All native views are consumed before the next native call; the borrowed velocity view is copied immediately. Observation scratch is allocated once. The caller must keep native model parameters and their compiled specification consistent for the observer's lifetime.

The existing `runUnbound` still owns its strict rider-only topology, zero contact/constraint/force admission, native energy, integration, rollback, recording, progress and disposal. A shared-world caller will need its own rider-interface/contact admission and complete-world rollback. Observer success alone does not establish unconstrained free flight or physical independence from another actor.

## Verification

The [receipt](evidence/rider-unbound-observer.json) binds source hashes and the received pre-extraction head. All **15 complete isolated records**—translation, spin, zero gravity, joint-limit stop and initial rejection at all three admitted timesteps—are byte-identical before and after the extraction in the local runtime. The unchanged five numerical tests continue to cover the independent archived controls and rejected-step accounting.

Three new tests exercise the boundary:

- Unrelated free/ball coordinates, 3D motion, contact rows and applied forces precede/follow the rider in a native world. Rider observation matches its isolated reference, does not mutate state/forces/warm start/energy and makes no forward/step/energy call. The world remains usable after observation.
- Two separately named rider trees share a native world and borrowed velocity buffer. Each matches its isolated reference at five recording times; masses, native ownership, state, output storage and joint-limit issues stay separate. This is a controlled native fixture, not the supported shared bike scenario.
- Missing/duplicate names, swapped root slides, foreign joint/endpoint ownership, a non-world parent and an unowned child body are rejected.

Eight focused tests pass and all 66 top-level preview assets are served by the actual handler without opening a socket. Full local `node --test` passes 39 files; the same eleven subprocess/loopback files remain blocked by the workspace's established EPERM restrictions. Direct CLI execution exactly preserves the baseline record.

[PR32](https://github.com/CraigHutchinson/BikeLab/pull/32) is merged at `000155a`. Final head `59bc407` passes 243 tests on each OS and the complete browser suite in [run 40293681213](https://github.com/CraigHutchinson/BikeLab/actions/runs/40293681213). All eight downloaded probe records reproduce exactly, and the Trail before/after exports are byte-identical. Three desktop captures were inspected directly; the other five captures, including both mobile widths, joint-limit, rejection and cancellation, match the inspected PR31 captures byte for byte. Native geometry, COM, numerical readouts and guarded empty/accepted states remain clear. The receipt binds artifact and file hashes. No new timing measurement, arbitrary-model accuracy, Pages receiving or completed independent actor-lifetime claim is made.

## Next small integration

The [explicit chassis extraction](BIKE_CHASSIS.md) separates chassis inertia from rider insertion in `bikeAssembly`. Next introduce the bounded new shared-world Trail mode. Retain the [ownership gates](RIDER_OWNERSHIP.md): disjoint body ownership, both bike types, reciprocal independence controls, actor and combined mass/momentum/energy, full-world rollback, explicit collision/separation boundaries and fresh world identity. In particular, replace the frame-subtree gravity-moment assumption for the new actor set; do not simply remove the existing attached-rider release guard.
