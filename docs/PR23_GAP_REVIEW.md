# PR #23 gap and performance review

Reviewed 2026-10-21 at remote `303380ceb2ffc517edf6d8d1b61079eb196fdc75`, tree `2e581b8cc1cfd6e6aa1d52e94ff5c4fcdc208f52`; main remains `e73f6cc`. [Exact-head CI](https://github.com/CraigHutchinson/BikeLab/actions/runs/39502891463) passed. The prior implementation receipt records 201 Linux/Windows tests and complete browser comparisons. GPT-6.1 Sol independently audited the source and coverage without running tests or performance work.

No new actionable correctness defect was identified in the geometric, native-construction or passive-law prerequisites. This is a source review, not a proof over every configuration. PR #23 remains a draft prerequisite for D5a; its passing tests do not receive a connected articulated rider or a real-time game tier.

## Findings and receiving gaps

Priorities below concern receiving the intended bike/rider feature. Existing, documented omissions are distinguished from regressions in this PR.

| ID | Priority / classification | Evidence and implication | Required next result |
| --- | --- | --- | --- |
| G1 | P1, declared integration gap | `rider-native.js` builds/inspects a free-carrier fixture; `trail-bike.js` still supports fixed/guided riders. Passive tests include deliberately off-manifold forward samples. There is no moving articulated state, saddle, domain rollback or actual segment drawing. | Receive one passive standing case on each bike, then saddle approach/separation/recontact, with shared records, ultimate-domain rollback, observation invariance and inspected UI. Declare closure, work/momentum and refinement budgets first. |
| G2 | P1, identified integration hazard | `trail-bike.js:114–116` rejects equality rows and derives external ground wrench from the total root constraint force. Soft hand/foot closures can contribute a numerical pair moment even with no ground; the existing probe and primary-source mapping are in the iteration review. | Named equality/saddle routing, paired application points and signed work. Keep terrain impulse and numerical closure moment distinct; retain a physical external-momentum residual. Do not add a counterforce or duplicate RNE loads. |
| G3 | P1, declared ownership/configuration gap | `bike-assembly.js:4–6` retains the old combined-mass and synthetic inertia split. The new 12 kg carrier is a fixture. Closure `.02 s` regularization is fixed construction configuration, with no accepted moving sensitivity envelope. | Independently owned chassis mass/COM/inertia, explicit attachment geometry and versioned connected configuration. Convert joint rest coordinates once, preserve native spring energy ownership, and validate moving regularization choices before tuning controllers. |
| G4 | P1 for a game tier, existing execution gap | `trail-bike-worker.js:2` returns a whole completed run. `trail-bike-app.js:25,51` plays recorded frames afterward. Responsive playback is not live physics or bounded input-to-state latency. No connected articulated timing exists yet. | Reproducible connected cost measurements now; later a fixed-tick runner with bounded latency, streaming/transfer budgets, target-hardware measurements and compatible fidelity tiers. Do not infer real-time suitability from the four-joint arithmetic kernel. |
| G5 | P2, existing performance risk | `trail-bike.js:105–110,149,164` performs explicit position/velocity stages before full forward evaluation, a step plus endpoint observation every tick, and a diagnostic forward per recorded frame. `moving-wheel.js:57–66` checks nonadjacent casing-edge pairs and terrain geometry on each guard. | Measure end-to-end cost and a separate CPU profile before optimizing. Retain force freshness, warm starts, buffers, guard ordering, rollback and export parity when evaluating stage reuse or spatial indexing. |
| G6 | P2, existing memory/transfer risk | `trail-bike.js:97` reserves `512*12*8 = 49,152` contact bytes for every slot. Default 203 slots reserve **9.52 MiB**; the admitted maximum 366 slots reserves **17.16 MiB**, excluding all other state, native memory and exported objects. Worker delivery clones the complete result. These are source-derived capacities, not measured process peaks. | Report process/heap/native-capacity observations, full output bytes and serialization/clone cost separately. Consider bounded streaming or compact contact storage only with replay/observation invariance. |
| G7 | P2, retained coverage gap | `test/drive-controls.test.mjs:55–57` rejects a candidate before applying its new command; it does not exercise rejection after new-command endpoint reevaluation at `trail-bike.js:168–169`. Rider CLI round trips/invalid flags have manual evidence but no dedicated CI CLI test. | Add a targeted post-command failure/rollback control when touching that lifecycle, and automated three-mode CLI/replay validation when extending its public interface. Existing coverage should not be described as proving these paths. |
| G8 | P2, confirmed existing hot-path allocation | Native array getters construct fresh typed-array views. `trail-bike.js:111,124,131` repeatedly reads them inside DOF/node loops. A public-API identity probe and the vendored binding source confirm view creation; separate profiling attributes 8.28% of sampled self time to `decodeMemoryView`, within 26.11% in JavaScript binding glue. | Evaluate phase-local view reuse before changing numerical fidelity. Refresh after any native operation that can grow/reallocate storage; retain owner lifetime, fresh lengths and independent output ownership. Prove full-record/termination parity, including command rollback and memory-growth cases, then remeasure. No speedup has been demonstrated yet. |

The new passive evaluator uses caller-owned output without successful-path scratch allocation. Native inspectors release model/data/Jacobian buffers in `finally` and return owned report arrays. Their repeated XML compilation/report allocation is appropriate for inspection, not a proposed per-tick path. Parameter/geometry defaults remain illustrative. No strength, tyre-blowout, anatomical calibration, 3D lateral/turning, layered mud/soil, or pump/wheelie/hop/endo acceptance follows from this PR.

## Performance protocol, declared before measurement

Run serially with no other agent simulations, tests or benchmarks. Preserve all production guards, timestep, contact and diagnostic settings. Record source hashes and Node/CPU/cgroup limits; shared-cloud results are observations, not target-hardware certification.

1. Separate lazy native-runtime initialization, posture/passive construction, reused four-joint evaluation, reused native forward evaluation and full native inspection. A static ten-DOF carrier forward is not a moving rider or wheel-connected benchmark.
2. Measure the existing full/hardtail guided bike at its default 64-node wheels and 31.25 µs timestep: 0.1 s flat, 0.2 s separated flight, and the complete 1 s square-rock preset. Require completion and retain accepted duration, step/frame/contact counts and complete scenario. Use one full warm-up and three measured repeats per case, with deterministic result hashes. Report all samples and min/median/max; three samples cannot establish tail latency or worst case.
3. End-to-end run timing includes validation/model construction, integration, guard/observation work and result materialization. Measure JSON serialization and Node structured clone separately. Wall time per simulated second is an offline throughput metric, not a per-tick deadline or browser input/render measurement. Do not use early termination as a speedup.
4. Time the unchanged geometric guard at fixed 32/64/128-node separated rings as a scaling diagnostic. It is not an approved reduced-fidelity wheel tier or an impact-accuracy comparison. Profile one complete square-rock run separately; profiling instrumentation is excluded from throughput samples.
5. Record before/after memory snapshots and process lifetime RSS high-water explicitly. They do not establish isolated per-case peaks or a memory leak. Source-derived slot reservations remain separate from those measurements.

The serial harness and [raw performance receipt](evidence/pr23-performance.json) now receive this initial measurement protocol. No production physics, timestep, guard or recording setting was changed. The separate CPU attribution and public getter probe follow below.

## Measured throughput and storage

Run `node scripts/pr23-performance.mjs --source-ref 303380ceb2ffc517edf6d8d1b61079eb196fdc75 --output artifacts/performance/pr23.json`. The script checks completion, canonical 64-node/31.25 µs settings and complete-output hashes across a warm-up plus three measured repetitions. All six cases passed those checks. The receipt includes full scenarios, model/source hashes and every raw sample. `--source-ref` is an operator-supplied production-baseline label, checked for SHA syntax only; it does not automatically verify source blobs or identify the later measurement harness. For this review, the synchronized baseline tree was verified separately and `dist/` remains unchanged from it. Use the per-file hashes to identify the measured code.

This shared Linux worker reports Intel Xeon Platinum 8573C, Node 24.19.0, a two-CPU cgroup quota and 8 GiB memory limit. The vendored MuJoCo WASM build is single-threaded. No agent tests/simulations or other benchmark ran concurrently. Host contention, frequency and thermal conditions are uncontrolled. These measurements establish an offline baseline on this worker, not a target-device guarantee or a PR23 slowdown: the measured guided-bike integration path predates the new rider prerequisites.

| Guided bike case | Simulated duration | Median wall seconds per simulated second | Measured range | JSON result bytes |
| --- | ---: | ---: | ---: | ---: |
| Full suspension, flat | 0.1 s | 29.45 | 28.70–31.33 | 211,849 |
| Hardtail, flat | 0.1 s | 27.06 | 26.95–27.26 | 209,231 |
| Full suspension, flight | 0.2 s | 21.81 | 21.61–24.98 | 322,190 |
| Hardtail, flight | 0.2 s | 21.05 | 20.73–21.06 | 320,534 |
| Full suspension, square rock | 1.0 s | 29.93 | 29.50–33.05 | 2,035,563 |
| Hardtail, square rock | 1.0 s | 28.72 | 28.70–31.68 | 2,022,199 |

**The current connected reference is not real time on this worker:** the measured medians consume roughly 21–30 wall seconds per simulated second. This includes setup/materialization and is not a per-tick latency distribution. Both contact-free flight and impact are slow; turning off detailed contact alone is not an evidenced route to real time. The full/hardtail models have 264/263 velocity coordinates. Three repeats do not establish worst-case cost, stationarity, a stable percentile or broad scenario coverage.

| Isolated prerequisite/guard | Median time per call | Scope |
| --- | ---: | --- |
| Construct geometric posture | 25.42 µs | Allocation and complete report |
| Compile passive configuration | 40.17 µs | Validation, construction and owned specification |
| Evaluate four passive joints | 0.088 µs | Reused storage; batch/loop/checksum overhead included |
| Reused native passive forward | 9.04 µs | Ten-DOF static carrier, closed pose with offset hip rest; no integration |
| Complete native passive inspection | 2,232 µs | Build/forward/report/delete, distinct from a per-tick path |
| Separated-ring guard, 32 / 64 / 128 nodes | 5.37 / 12.08 / 42.30 µs | Fixed separated geometry, not approved fidelity alternatives |

Lazy WASM initialization took about 200 ms after JS imports. The fast four-joint kernel and small static native fixture do not predict moving articulated overhead in the 264-coordinate bike. The guard's edge-pair counts are 464/1,952/8,000 at 32/64/128 nodes; the measured scaling supports investigating hierarchy/candidate filtering, without receiving any lower-resolution physical model.

The 1 s square cases retain 201 frames and about 2.0 MB of JSON. Median JSON serialization was 13.36 ms full / 21.54 ms hardtail; Node structured clone was 11.99 / 12.49 ms. These are whole-result Node costs, not browser worker-transfer or render latency. Both runs reserve 9.52 MiB of contacts before actual occupancy is known. The process lifetime RSS high-water reached approximately 361 MiB across all cases/warm-ups/clones, and native backing capacity grew from about 16.8 to 73.0 MiB. These are cumulative process observations; neither a per-case peak nor a leak is established. The cgroup reported about 0.14 s additional throttling across the measurement, without establishing the absence of other host interference.

Prioritize measured whole-system CPU attribution, safe native-stage reuse and recording/transfer design. Preserve diagnostic freshness and all guards. Do not optimize the already tiny scalar joint arithmetic while treating the coupled solve, allocation and scheduling costs as solved. Articulated moving dynamics, long runs, 1–2 cm terrain, layered/muddy contact, 3D and active manoeuvres still need their own fidelity/performance receipts.

## Separate CPU profile and confirmed native view allocation

One complete full-suspension square-rock run was profiled separately with Node's default CPU sampling interval. The [profile run receipt](evidence/pr23-profile-run.json) has the same complete-result SHA-256 as the unprofiled case (`d6f0eb4d6ea95e44a6650c10228cf906ea7647dbe58b1fd9e9bd030f594cb652`). Its instrumented run took 33.70 s; this is excluded from the throughput table. The [profile summary](evidence/pr23-profile-summary.json) retains all sampled function/location aggregates, category totals, source-profile hash and summarizer hash. The original generated `.cpuprofile` is in ignored `artifacts/performance/`; recreate it with the commands below.

The process profile contains 29,645 samples with approximately 34.24 s of attributed time, including imports/runtime initialization, the run, serialization/hash/clone, model recompilation for dimensions, receipt writing and shutdown. Profile mode has no warm-up. Shares below are whole-process sampled **self time**, aggregated across caller stacks, not isolated integration time, inclusive time or deterministic call counts. They do not predict an achievable speedup.

| Sample location | Share of sampled time |
| --- | ---: |
| WASM, including native binding code | 59.71% |
| MuJoCo JavaScript binding glue | 26.11% |
| Connected bike JavaScript | 5.36% |
| Moving wheel JavaScript | 3.62% |
| Other runtime, harness and startup | 4.27% |
| V8 garbage collection | 0.82% |
| Other application JavaScript | 0.10% |

`decodeMemoryView` is the largest aggregated self-time function at 8.28%; `mjd_passive_vel` follows at 8.04%. The latter belongs to the existing native coupled model, not the new four-joint JavaScript rider evaluator. `geometryLimits` contributes 3.21%. The WASM category includes binding functions as well as physics; do not describe its entire 59.71% as solver cost. Low sampled garbage-collector time does not mean view creation and binding work are free.

The [public getter probe](evidence/pr23-native-views.json) reads nine data/model arrays twice at a fixed state. Each pair consists of distinct `Float64Array` objects sharing the same backing buffer, byte offset and length. The source explains this directly: the property getter at `dist/vendor/mujoco-3.16.0/mujoco.js:5473` invokes conversion on each read, and `decodeMemoryView` at line 5742 returns `new TA(HEAP8.buffer, data, size)`. These are new views, not full native-array copies. The unchanged DOF damping/work and finite-state loops, plus wheel strain/deformation loops, repeatedly pay this path per element. The probe does not count allocations over a trajectory or establish view validity across memory growth, native reallocation or owner deletion.

This is a measured reason to investigate local view reuse and native-stage scheduling before reducing wheel resolution or guard frequency. Bind views at safe phase boundaries, never retain a view blindly across model/data creation or native storage changes, and do not expose aliases as historical records. A later optimization must preserve exact full-result/termination behavior, command-boundary rollback, diagnostic freshness and browser/headless agreement; it also needs an explicit memory-growth/stale-view control. No optimization or physics change is included in this review.

Reproduce serially, with no other performance workload:

```sh
mkdir -p artifacts/performance
node --cpu-prof --cpu-prof-dir=artifacts/performance --cpu-prof-name=pr23.cpuprofile scripts/pr23-performance.mjs --profile --source-ref 303380ceb2ffc517edf6d8d1b61079eb196fdc75 --output artifacts/performance/pr23-profile-run.json
node scripts/pr23-profile-summary.mjs artifacts/performance/pr23.cpuprofile artifacts/performance/pr23-profile-summary.json
node scripts/pr23-native-view-probe.mjs artifacts/performance/pr23-native-views.json
```

The summarizer checks sample/delta shape and accounting totals; the run harness checks completion and production settings. The committed profile result was independently compared with the unprofiled hash. The source hashes bind these observations to the unchanged production modules and WASM. Full physics/browser suites were not rerun for these measurement/docs-only changes; the successful reviewed-head CI remains the correctness evidence above.

## Next work order

1. Add independent chassis configuration and named interface force/work observation, preserving old replay.
2. Receive passive connected standing and saddle transitions with guard/rollback, conservation/refinement and actual geometry on both bikes.
3. Use measured whole-system costs to choose phase-local native view reuse, stage scheduling, storage/streaming and contact-search improvements. A small exact-parity view-reuse investigation can proceed independently of articulated integration. Validate fixed nonuniform meshes before live remeshing or multirate transfer; never drop guards to improve a timing.
4. Add bounded active rider work and manoeuvre controls, then broader terrain/failure/3D envelopes with their separate physical validation and latency budgets.

## Subsequent observer and research increment

After synchronizing `469fb80`, [seated/unseated rider research](RIDER_SEATED_UNSEATED.md) was captured with primary-source limits and staged measurement/control gates. [Named closure observation](RIDER_INTERFACES.md) now supplies the force/work/moment decomposition needed by G2 and is consumed by the native/passive inspections. Its instantaneous checks do not complete connected routing, saddle support or G1/G3. G7's three-mode CLI replay/error gap is now covered automatically; post-command endpoint rollback remains open. The observer makes no connected performance change, and the measured baseline above remains tied to its original source hashes.


## Connected unseated update, 2026-10-21

Implementation `e312974` addresses G1's first moving unseated case and G3's independent chassis configuration, with actual native segment rendering and seven-coordinate/segment-velocity records. G2 now routes hand/foot work separately and derives external terrain wrench from wheel resultants; physical momentum residual and closure angular impulse stay distinct. Natural joint-domain rejection and controlled post-command numerical failures exercise rollback, including activation and complete final-frame equality, addressing G7's retained lifecycle subpath. See [moving contract and evidence](RIDER_CONNECTED.md).

D5a is still incomplete: saddle support/transitions, a matched locked-posture connected control and broader conditioning/motion acceptance remain open. G4–G6/G8 performance/storage work and later physical failure, layered terrain and 3D requirements are unchanged. The performance measurements above remain historical guided-bike measurements, not articulated timing or a claim of real-time readiness.

The connected implementation passes 213 tests on each hosted OS and all 29 browser/Node Trail bike comparisons exactly, with inspected desktop/390/320 px rider captures for both bikes. See the [browser receipt](evidence/iteration-20-connected-browser.json). Before adding saddle mechanics, address the [contact classification and work-routing plan](RIDER_SADDLE_PLAN.md): all frictionless rows currently enter terrain normal work, and the recorder only accepts wheel flex contacts. Merely adding a saddle shape would therefore misclassify work and reject its contacts. This is a scoped extension gap, not a supported unseated-path failure.

The user's screenshot concern prompted a separate [load-distribution review](RIDER_LOAD_REVIEW.md). It confirms feet dominate upward rider support in both saved runs, while identifying the unsolved gravity equilibrium as a remaining D5a acceptance gap: the default rider sags rather than maintains standing. Add signed vertical interface observability and independently balanced standing/seated controls. Passing the short numerical transient does not establish realistic normal riding or calibrate a hand-load fraction.
