# Rider browser receiving — reviewed 2026-11-03

The focused Windows browser run completed on 2 November using Node 24.22.0, Playwright 1.62.1 and Edge 157.0.4341.30. All UI assertions completed on both bikes with no captured page or console errors. The overall browser gate **fails** because 12 of 22 complete-record browser/Node comparisons exceed the existing 1e-9 normalized budget. [Receipt, sources, cases and artifact hashes](evidence/rider-browser.json).

## Received behavior

The actual worker/viewer receives active hold, dense tyre diagnostics, uninterrupted/fresh observation windows, timed targets, transfer/control, estimated-effort controller/control and crouch/control. Tests cover full-record export, calculated readouts, 70→100 kg gain recomputation, authored JSON/error admission, cleanup when returning to passive mode, cancellation of a long calculation and 320/390 px layouts. Four default crouch/control records complete; moving cases still display their frozen tracking failure. Numerical replay is attempted for every exported case and assessed separately.

There are 49 retained captures. Both bike renderings and both desktop/320 px crouch panels were visually inspected: geometry, contacts and effort/readout panels render; the tracking FAIL remains explicit and narrow text wraps. This is not participant feedback, an animation-quality study or proof of physical calibration.

| Browser/Node record category | Full suspension | Hardtail |
| --- | --- | --- |
| Active hold, tyre probe, late window, fresh window, unchanged transfer control | Pass (5) | Pass (5) |
| Timed targets and moving transfer | Fail (2) | Fail (2) |
| Estimated-effort controller and its hold control | Fail (2) | Fail (2) |
| Crouch and matched hold control | Fail (2) | Fail (2) |

## Defects fixed during receiving

The preview allowlist omitted twelve newer rider modules, so the rider page could not load. The real server regression caught a 404 once host loopback access worked; adding the missing assets makes the existing complete-dist and traversal/method checks pass. No broader filesystem serving was introduced.

Exported starting angles also failed an exact-equality conflict check when receiver-side trigonometry differed by 4.44e-16 / 8.88e-16 radians. Admission now calls the same `canonicalTargetDelta` zero-displacement rule already used by the drive. It preserves serialized angles, authored first-pose equality, model/identity rules and meaningful conflict rejection. A regression uses the actual Edge-derived angle values, verifies exact same-runtime frames/work, and covers legacy/estimated drive admission and rejected conflicting targets. No solver, force law, feedback gains, replay tolerance or crouch budget changed.

After both fixes, the complete local Node suite passed **337/337** with vendor hashes on clean implementation commit `0fc2c8ac2fd0aa77a1e6212c707d572b727cce48`. This supersedes the earlier sandbox-blocked 335/336 result. It is not a full-local attestation: the focused browser gate is still failed and the installed browser/tooling are not the pinned full-local combination.

## Numerical boundary and next work

All strict failures are retained with the first differing record field. A diagnostic of the full-suspension 0.1 s target record finds no structural differences, but 431 numerical leaves exceed the unchanged budget. Maximum saved hip difference is about 3.62e-13 m; a near-zero horizontal wheel resultant differs by about 7.21e-7 N, and sampled hinge acceleration by about 1.16e-6 rad/s². These small values do not waive the declared gate, and this one short diagnostic does not bound the longer controller records.

Next trace the first browser/Node divergence from identical serialized configuration: compare compiled target deltas and native attributes, then accepted state/contact/effort history. Keep this evidence with #57 and PR54's separate numerical work; do not tune rider gains, change contact policy or relax comparisons to absorb it. Reference-velocity feedback remains the next bounded rider-control experiment after this evidence is reconciled, with the frozen crouch baseline preserved. No endo/wheelie/hop qualification follows from UI completion.

Use [LOCAL_PREVIEW.md](LOCAL_PREVIEW.md) for the verified host launch and focused command. The focused runner records replay failures while continuing later UI cases, then exits nonzero if any comparison failed. The full suite keeps its original fail-fast comparator. Complete records, full transfer comparisons and PNGs remain in ignored artifacts; their hashes and compact summaries are committed. Hosted CI/Pages remain disabled and no merge/deployment is claimed.

## Target preprocessing diagnosis — 2026-11-03

[Both short target cases](RIDER_REPLAY_DIAGNOSTIC.md) now have an identical-input browser/Node diagnostic. Native XML and inspected arrays match; a target-q-only browser intervention removes all strict failures in these two cases. This is diagnostic evidence, not a production correction or resolution of the remaining ten failed records. The prior no-merge/CI-pause wording is historical; the workstream is integrated through PR80 and current main retains minimal-CI policy.
