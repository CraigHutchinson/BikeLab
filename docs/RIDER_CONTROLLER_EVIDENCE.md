# Runtime rider controller evidence — 2026-10-30

This records the experimental [implementation contract](RIDER_CONTROLLER_ITERATION.md). The common controller is now consumed by native stepping, both-bike viewer examples, headless runs and record replay. The [compact receipt](evidence/rider-controller.json) retains every case's source-record hash, configuration, result, phase tracking, effort decomposition and refinement comparison. Complete local records live under `artifacts/rider-controller-final`; regenerate them with `node scripts/rider-controller-review.mjs artifacts/rider-controller-final`.

## Configuration matrix

Each case requests one second, with the shared 43-command hold/transfer/recovery schedule. Default dt is 31.25 microseconds and saved interval 10 ms. The hold control has the identical schedule with unchanged target geometry. The default transfer is 2 mm forward/down and 0.002 rad trunk change; this is a small receiving probe, not a qualified crouch.

| Variant | Full suspension final hip error | Hardtail final hip error | Result |
| --- | --- | --- | --- |
| 20 kg transfer | 1.050 mm | 0.851 mm | Both complete |
| 70 kg transfer | 0.713 mm | 0.980 mm | Both complete |
| 100 kg transfer | 1.476 mm | 0.828 mm | Both complete |
| 70 kg unchanged hold | 0.522 mm | 0.952 mm | Both complete |
| 70 kg, dt 15.625 microseconds | 0.712 mm | 0.967 mm | Both complete |
| Thigh 0.45 m, trunk COM fraction 0.6 | 0.561 mm | 0.879 mm | Both complete |
| Half gravity | 1.491 mm | 0.833 mm | Both complete |
| Compensation disabled, same derived gains | 103.862 mm at 0.192125 s | 103.816 mm at 0.182750 s | Both stop at knee-angle limit |

The last row is a terminated prefix, **not a one-second result**. All 14 estimated-effort cases complete, while both feedback-only controls stop cleanly and retain their accepted prefix. The lower nominal gains cannot support gravity by posture error within the admitted knee domain alone. Accordingly, loss of the static estimate is an explicit bounded fallback, not a guarantee of continuing posture hold.

For 70 kg transfer, peak sampled initial-hold hip errors are 6.58 mm (full) and 10.88 mm (hardtail), larger than the final values. Final error alone does not describe the transient. Compared with earlier fixed-gain PR64 holds near 20.8 mm low, the new mechanism supplies the gravity effort without requiring that large persistent error. This is a comparison of experimental behaviors, not a calibrated human result or a claim of settled tyre motion.

At the end of the 70 kg transfer, nominal-step versus half-step hip positions differ by 0.00117 mm (full) and 0.01283 mm (hardtail). Largest joint-torque differences are 0.0117 and 0.0398 N m. Reported peak energy residual drops from 0.1658 to 0.0558 J (full) and 0.2415 to 0.0815 J (hardtail). These are two-resolution observations, not proof of convergence or closure of the independent tyre/stability investigation. Contact eligibility is an instantaneous geometric test and can switch effort; sample counts cannot rule out between-sample switches.

## Verification and review

Ten controller tests cover 13 native static configurations plus a deliberately reversed-force control, mass scaling, independent geometry/inertia calculations, malformed input, model identity, finite diagnostics, signed effort limits, contact eligibility, torque infeasibility, both-bike recording-cadence independence, same-runtime replay, flight momentum refinement, independently intercepted applied work and exact rejected-step restoration. Existing static-reference tests independently use finite differences of potential and endpoint virtual work. No root actuation or hypothetical support force is applied in production.

A local review enumerated changed consumers and corrected two diagnostic issues before publication: legacy load-observer output keeps its old shape, while controller records require complete finite gain/estimate arrays; the load panel includes the estimate when explaining requested torque. Native contact wrappers are disposed, solver scratch stays preallocated, and configuration/targets join record identity. Research independently verified the primary-source force convention and the limits of the nominal scalar PD formula. This is local implementation review and independent numerical evidence, not an external code-review approval.

The full local Node suite reports **329/330 passing**, with only the pre-existing loopback `connect EACCES` restriction in `test/server.test.mjs`. The unit receipt is failed; no full local attestation is claimed. Targeted controller/load tests pass **17/17**. All **84 quick tests** and pinned vendor hashes pass. The final-source full suite again passes 329/330 with only loopback EACCES; all 16 matrix records reproduce byte-for-byte after the admission/diagnostic fixes. Check receipts and source Git blob/record hashes are retained in the compact receipt. These were local source-tree checks, not hosted commit statuses.

Browser receiving was extended for both controller examples, worker/headless full-record comparison, 320 px panels, mass edits and legacy-mode cleanup. Execution and visual inspection remain deferred under the user's approved Edge fallback. Hosted CI and Pages remain paused; no workflow dispatch, release or deployment is part of this iteration. The draft is suitable for review, not for claiming all browser/platform or production stability gates passed.

## Remaining gates

A larger crouch/recovery needs declared tracking/load/work budgets and actual interaction evidence. One-wheel balance, endo, wheelie and bunny hop need support/flight policy, retention/contact semantics and appropriate momentum feasibility. The new common drive is their receiving path; the static two-wheel estimate is not their complete controller. PR54 and issues #41/#57–59 retain separate numerical/contact qualification. No issue is closed by this result.
