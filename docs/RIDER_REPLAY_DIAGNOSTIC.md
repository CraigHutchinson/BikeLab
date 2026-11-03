# Rider target replay diagnosis — 2026-11-03

## Result

Identical serialized 0.1 s timed-target inputs reproduce the browser/Node discrepancy on both bikes. The generated XML is byte-identical and all **inspected** compiled native arrays match exactly (4,253 numbers for full suspension, 4,241 for hardtail). Host-derived initial/target angles differ by ulps; three of the 44 compiled target displacements differ, by at most about 1e-14 rad.

A controlled browser run substitutes **only the Node-compiled target displacement table** through an isolated loopback test server. It then passes the existing strict complete-record comparator on both bikes. Final saved native states are exactly equal; remaining record differences are at most 7.994e-14. This isolates target preprocessing as a sufficient source of the observed strict failure in these two short cases. It does not prove that contact-law sensitivity or solver residuals are absent, nor explain the ten other failures in the prior 22-record matrix.

| Case | Baseline leaves outside 1e-9 normalized budget | First saved budget failure | Target-table control |
| --- | ---: | --- | --- |
| Full suspension | 431 | 0.015 s, front bearing horizontal resultant | 0 outside budget; strict comparator passes |
| Hardtail | 430 | 0.015 s, front ground horizontal resultant | 0 outside budget; strict comparator passes |

The first nonzero target command is tick 320 (0.01 s). Recording is at 5 ms intervals: 0.015 s is the first **saved** budget failure, not a demonstrated first divergent integration step. At time zero, observer-only passive-load/angle values already differ at roughly 1e-14 due to host calculations, within budget. The model and target displacement distinction matters: canonical XML does not canonicalize every derived controller input.

Current Edge 157.0.4341.36 reproduces the earlier Edge 157.0.4341.30 archived browser records exactly in the initial diagnostic. The final committed-input runs use Windows, Node 24.22.0 and Playwright 1.62.1. These are measured runtime pairs, not a universal cross-engine guarantee.

## Reproduction and boundaries

Run from the repository with isolated Playwright available in `NODE_PATH` and optionally set `BIKELAB_CHROMIUM` to the installed Chromium-family executable:

```powershell
node scripts/rider-replay-diagnostic.mjs docs/evidence/replay-full-input.json artifacts/replay-full
node scripts/rider-replay-diagnostic.mjs docs/evidence/replay-hardtail-input.json artifacts/replay-hardtail
```

Both commands intentionally exit **1**, because their unmodified baseline still fails. A passing diagnostic intervention cannot make the report's baseline `success` true. The input files preserve the model/scenario from the earlier browser exports and need no local archived record. Supplying a complete record additionally compares the current browser result with that archive.

The harness runs the same setup/physics modules in Node and a fresh browser worker. It captures initial angles, compiled targets, generated XML, a declared subset of native arrays and complete recorded results. Its second worker receives the Node target q table via an exact, uniquely matched source substitution in the **test server only**. The server refuses substitution if that compiler expression changes. It binds only 127.0.0.1 and serves the existing preview allowlist plus two explicit diagnostic modules. No application server, production file, record version, gain, material, solver, tolerance or force law changes.

`replay-difference.mjs` reports counts and bounded first/max examples using the same normalized budget and structural ordering as the strict comparator. Four focused tests cover tolerance/structure/nonfinite acceptance, first-versus-maximum attribution and bounded report size. The intervention also invokes the original strict comparator directly. Complete snapshots remain in ignored artifacts; [committed evidence](evidence/rider-replay-diagnostic.json) contains results, inputs and source/artifact hashes.

## Next implementation boundary

Do not “fix” legacy records by silently rounding their evolving state or recompiling their targets differently. Design a versioned, reproducible compiled-target contract for the common bounded drive, including serialized target displacements or a defined deterministic compilation policy, ownership/validation and compatibility with existing schedules. Retain both archived failures as regression evidence.

First extend the same diagnostic to the longer transfer and estimated-controller records: mass/geometry-derived static estimates and feedback may expose other host-derived quantities. A remedy must preserve runtime-configured mass/gravity/geometry, the unchanged crouch budget and same-runtime legacy replay. Reference-rate feedback remains a separate controller change after its target identity is explicit. PR54's contact-law/rest/spin/connected qualification and #58/#59 support/reference checks remain independent. No manoeuvre acceptance follows from this two-case diagnostic.

Validation: complete local Node suite **353/353**, no skips, and vendor hashes pass on the clean source recorded in the receipt. Both diagnostic baseline commands exit nonzero as required; both target-table controls pass the original strict comparator. Production `dist/` bytes are unchanged. No full-local/hosted attestation or new production replay pass is claimed.
