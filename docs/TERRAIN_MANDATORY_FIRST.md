# Mandatory-first terrain delivery — issue #40

This slice starts from main `2dd2be6`, independently of the stability work in PR54 and geometry labels in PR60. Its named consumers are the R0 terrain-request viewer and `scripts/terrain-request.mjs`. It changes delivery scheduling, not terrain geometry, contact forces or physical time.

## Delivery contract

A complete response owns all mandatory sample arrays and returns after required extraction. Optional I/O is not awaited. At most eight speculative tile keys are queued and one optional source load is active. Optional loads share the existing eight-load global bound; foreground requests retain the four-request bound. Queue overflow is discarded, never reported as missing mandatory terrain.

Demand promotes a resident or in-flight optional tile. Loads of the same key are shared. Demand eviction chooses speculative tiles before demand LRU entries; speculative insertion can replace only speculative entries, never demand-resident data. A full demand cache can therefore make prefetch ineffective. Unrelated in-flight I/O still consumes finite source capacity: an unusually wide required request can return explicit `pending` under the shared bound. There is no claim that lookahead can only help or that delivery is real time.

Cancellation, reset and per-wheel supersession remove queued work. An already-started source promise is not abortable; it remains bounded and its late result is discarded unless promoted to demand or adopted by a current optional request. Optional failure is counted and handled without rejecting an already-delivered mandatory response. Replay shutdown cancels both wheels' optional queues, including failure/cancellation paths.

`optionalClipped` describes geometry/source-domain and per-request tile-budget clipping. Queue overflow, stale results, insertion refusal and I/O failures are separate cache observations (`discarded`/`failed`). `completed` counts successful optional load operations even when their result was discarded; it is not a resident-tile count. All counters describe a delivery instant and may differ by runtime scheduling.

## Records and viewer

New records use `bikelab-terrain-request-0.2`. Geometry, request identities, topology, admission decisions and array structure retain the existing exact-discrete/1e-12 geometry comparison. Cache observations instead undergo shape, type, resident-byte and queue-bound validation; they are not deterministically regenerated or evidence of measured performance. Verification preserves these observations and reports `cacheObservationsCompared: false`.

Version 0.1 remains readable through its original awaited-optional replay path and strict cache comparison. Six SHA-256 fixtures were captured from the unmodified baseline before implementation. Every regenerated legacy record must match its complete original serialized bytes. This compatibility path is exercised only when explicitly requesting or verifying the legacy format.

The viewer draws each accepted interval while the next required request is waiting and shows queued/active/failed/discarded lookahead at that delivery instant. Playback and export become available only when receiving completes. Page departure cancels unfinished receiving even after the first interval has appeared. The browser regression now requires a visible accepted interval during a delayed receive, then checks cancellation and the existing six-track replay/import/mobile cases.

## Evidence and remaining gate

On Windows / Node 24.22.0, the focused Node suite passes 21 tests and the local quick tier passes all 55 checks. The complete local Node suite runs 285 tests: 284 pass and the unchanged loopback-server test fails with `connect EACCES 127.0.0.1` under the environment network restrictions. The unit receipt correctly records failure; this is not a full-suite pass or attestation. Gate-controlled tests hold unrelated optional I/O indefinitely: the legacy response remains blocked while the new response returns complete, and a later disjoint mandatory request also completes before that gate is released. This is a scheduling regression check, not a wall-time speedup claim. Other checks cover optional rejection, cancellation/reset/supersession, promotion and deduplication, queue/load/cache bounds, eviction protection, output ownership, strict geometry identities, malformed cache observations and all six legacy hashes.

Edge/native browser receiving is deferred because the available browser paths were unavailable in this session. The viewer change and browser regression have not been executed in a browser; no screenshot or visual-verification claim is made. Keep #40 open and the PR draft until that receiving gate passes. The native port's reported stalls/timings have not been reproduced. No hosted CI or Pages deployment is requested during the pause through 1 November 2026; see [CI workflow](CI_WORKFLOW.md).
