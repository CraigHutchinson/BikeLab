# Casing sampling separation — 16 November 2026

The endpoint candidate's remaining loaded error is not resolved by refining transverse sampling alone. At 1.6 bar and 2 mm hub lowering, all 27 continuation solves converge, but all nine final states have compressive resultants. No production model or material constant changed.

| Circumferential stations | 8 section segments | 16 section segments | 32 section segments |
| --- | ---: | ---: | ---: |
| 32 | 668.767 N | 674.547 N | 675.922 N |
| 64 | 415.178 N | 418.809 N | 419.672 N |
| 128 | 467.125 N | 471.236 N | 472.215 N |

All six transverse reaction comparisons pass the existing 1 N + 5% budget; all six circumferential comparisons fail it. The active crown count is 1/3/5 for 32/64/128 stations and is unchanged by section refinement. These are contact vertices, not a measured physical footprint. Compression-cell counts grow with the number of cells; they are not comparable physical severity measures.

The [inspected plot](evidence/casing-resolution.svg), [summary](evidence/casing-resolution.json) and [complete compressed report](evidence/casing-resolution-report.json.gz.b64) preserve the findings. The report records source hashes, full coordinates, forces, KKT residuals and stability. The diagnostic intentionally exits 1 because model receiving fails. Its comparison `complete` flag prevents an early failed continuation being treated as the requested final load.

Section refinement samples the same circular stress-free geometry more finely; it does not add independent transverse displacement coordinates. Each station still has two crown coordinates, with all section vertices mapped affinely and axial positions fixed. This result separates section sampling from circumferential resolution at this one pressure/load. It does not establish circumferential convergence, prove that contact alone explains the failure, or validate a richer shape or wrinkling law.

Next compare contact-phase sensitivity and further circumferential refinement before choosing additional transverse shape freedoms or supported tension-only physics. Preserve the original candidate as a control. Native loaded receiving, runtime timestep admission, trail reuse and near-rim/insert behaviour remain pending. #95 stays open and explicitly uncalibrated.

Reproduce with `node scripts/tyre-casing-resolution.mjs` (expected exit 1), then `python scripts/plot-tyre-casing-resolution.py`. This increment only adds an offline diagnostic and evidence; runtime and browser numerical code are unchanged. The previous focused Edge receipt retains its original scope; no new browser or full hosted pass is claimed.

Validation: complete Windows host Node suite **497/497 pass**, zero skipped. The sandbox attempt was 496/497 with one loopback EACCES failure. [Receipt and log hashes](evidence/casing-resolution-tests.json) retain both outcomes; compressed complete logs are adjacent. Archive SHA-256, source hashes, all 27 KKT states, contact reaction sums and all 12 comparison outcomes were independently checked.
