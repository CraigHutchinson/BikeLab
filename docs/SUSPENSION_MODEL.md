# Decision 002: axial suspension laboratory

2026-10-15. Model bikelab-suspension-0.1. Primary sources, derivations and proposed test budgets were read before implementation; see [research receipt](SUSPENSION_RESEARCH.md). This station is a synthetic coil/viscous-damper experiment, not a calibrated fork or shock.

## Consumed mechanism

One guided supported mass above a fixed or vertically prescribed base. Compression q increases as the element shortens. Relative compression velocity u is positive during compression. Spring and damper act in parallel:

```text
F_s = F_pre + k q
F_d = c_comp u, u >= 0; c_reb u, u < 0
F   = F_s + F_d
U   = F_pre q + k q²/2
D'  = c(u) u² >= 0
```

F is signed spreading force, not a unilateral tyre normal force. Negative total force during fast rebound is admissible for the captured damper. Preload changes the spring intercept, not stiffness. Stored energy is relative to zero compression; the constant installed preload energy is omitted. No friction, air chambers, linkage leverage, hydraulic adjuster mapping or end-stop force is implied.

World z is upward. The constant extended attachment separation is omitted from the coordinate origin, so q=b-z and u=b'-z', with prescribed base b. The mass equation is z''=F/m-g. Support work rate W'=F b'. Mechanical energy E=m z'²/2+mgz+U therefore obeys E+D-W=E_initial. Both complete and stopped runs report the maximum residual across every accepted integration endpoint, independently of plot sampling.

The force evaluator returns spring/damper/total force, elastic energy and dissipation rate using caller-owned output. It is independent of renderer, experiment forcing and integration. Future assembly applies this same axial action at attachment points; [3D requirements](THREE_DIMENSIONAL_DYNAMICS.md) specify the vector and power contract. No general multibody engine has been selected.

## Initial state, inputs and bounds

Initial compression and relative compression velocity are explicit SI inputs. For sine forcing, b'(0) is nonzero, so initial mass velocity is b'(0)-u(0). The fixed-base equilibrium is (mg-F_pre)/k. The station requires equilibrium strictly inside 0<q<travel; a static load held at a stop requires an additional reaction model and is rejected here.

All physical defaults and presets are illustrative, with unknown physical uncertainty and no named-product applicability. Fork-scale and shock-scale presets are complete editable parameter fixtures using the same law. Bare shock stroke is not rear-wheel travel. The production-bike catalogue remains separate planned work.

| Parameter | Internal unit | Admitted range | Fork / shock fixture |
|---|---|---|---|
| Supported mass | kg | 1–150 | 45 / 30 |
| Stiffness | N/m | 1,000–200,000 | 9,000 / 22,000 |
| Preload force | N | 0–1,500 | 50 / 40 |
| Compression damping | N s/m | 0–8,000 | 350 / 500 |
| Rebound damping | N s/m | 0–8,000 | 650 / 1,000 |
| Stroke | m | 0.02–0.3 | 0.16 / 0.065 |
| Initial compression | m | 0–stroke | 0.075 / 0.025 |
| Initial relative velocity | m/s | -3–3 | 0 / 0 |
| Base amplitude | m | 0–0.05 | 0.005, inactive for fixed base |
| Frequency / inverse bump duration | Hz | 0.2–12 | 2 |
| Duration | s | 0.1–30 | 4 |
| Integration step | s | 0.00001–0.0005 | 0.0005 |
| Recording interval | s | 0.001–0.02 | 0.005 |

These are numerical/product bounds, not a physical validity envelope. Duration and recording intervals must align with integration ticks. A step-times-component-rate product above 0.5 is rejected; above 0.1 warns to refine. The component rate is max(sqrt(k/m), c_comp/m, c_reb/m). These conservative setup heuristics are not an accuracy certificate. An energy warning triggers above 0.1% of a run scale defined as max(mg travel, |E_initial|, |E_endpoint|, |W|, D).

## Travel termination and records

Every RK4 trial stage and accepted endpoint must satisfy 0<=q<=travel. An attempted exit rejects the whole step, restores the last accepted state and stops with status=travel-limit. The record includes top-out/bottom-out type, lastValidTime, attemptedTime, dt uncertainty and reason. That interval identifies the attempted numerical step, not a root-located physical impact; trial excursions can be conservative false positives at coarse steps. Refine and compare. No state is clamped, reflected or extrapolated beyond stroke, and no end-stop impulse is invented.

The last accepted endpoint is always recorded, even if off the ordinary recording grid. An immediate exit produces one sample. Playback searches actual timestamps and cannot advance past the last valid time. Comparisons may include differently terminated setups but each trace stops at its own end time. Metrics cover accepted endpoints only; they exclude the rejected trial and do not predict an impact peak.

Record version 1 stores the model, complete setup, provenance label, status/termination, warnings, endpoint metrics and signal arrays. Save/load reruns the setup. The separate verifier recomputes all channels and metrics with the established 1e-10 scaled cross-runtime tolerance; status, termination and warnings must match exactly. It does not certify physical accuracy. Same-runtime replay must match exactly. CLI --suspension exits 2 for a travel-limited run while optionally preserving its evidence; malformed setups and I/O errors exit 1. Output files are exclusively created, never overwritten.

## Verification contract

Independent equilibrium, underdamped/critical/overdamped and conservative oscillator formulas cover several mass/stiffness scales. Unequal damping is checked against independent monotonic half-cycles to detect reversed coefficient selection. Moving-base amplitude/phase and nonzero support work are checked separately. Tests compare h, h/2 and h/4, endpoint diagnostics at different recording intervals, boundary inward/outward motion, record corruption, maximum recording size and accepted parameter extremes. Tests do not assert generic fourth-order convergence through branch changes or travel events.

See [Slice 2 evidence](SLICE_2_EVIDENCE.md) for actual outcomes and unresolved acceptance items. Synthetic law verification, browser agreement, visual inspection, hardware calibration and participant evidence are distinct.

## Required overload extension

The user requires mechanically enforced travel and physical high-impact outcomes, including component breakage and possible rim-deformation-induced tubeless deflation. The current travel-limit status is an explicit validity stop, not a calculated stop reaction, damage event or survival claim. Before continuing through such impacts, implement verified top/bottom-out behavior and load transmission, then apply supported component failure criteria and update geometry/load paths or stop if the outcome is unsupported. The complete review basis is in [OVERLOAD_AND_FAILURE.md](OVERLOAD_AND_FAILURE.md); ordinary bottom-out need not imply fracture, and damage may precede bottom-out.
