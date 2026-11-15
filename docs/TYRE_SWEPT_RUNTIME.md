# Swept sealed casing in the moving-wheel viewer — 15 November 2026

This opt-in experimental mode is the first native wheel consumer for #95. Select **Sealed casing · uncalibrated flat drop** in `moving-wheel.html`. Other examples and old records retain their foundation model. The new model has its own record identity and preserves the complete casing declaration through save/load, replay, restore and authored JSON. The viewer shows live gauge pressure, chamber volume and maximum material strain. No measured tyre data are available; it is explicitly uncalibrated.

## Model and force application

The stress-free transverse section is swept around the wheel into a closed, consistently oriented triangulated surface. Each transverse vertex is affine in its station's two hub-relative Cartesian tread coordinates, with zero displacement at the beads and full displacement at the crown. Material reference lengths and areas remain separate from the inflated embedding. Each cell uses the existing orthotropic meridional/hoop energy, with meridional length averaged across its two station edges and hoop length measured between their midpoints. Forces differentiate this discrete energy through the affine map.

Signed volume and its analytic gradient use the closed triangle sum `sum(a dot (b cross c))/6`, following [Eberly's polyhedral mass-property derivation](https://www.geometrictools.com/Documentation/PolyhedralMassProperties.pdf). Winding is never repaired with absolute volume. Fixed beads, owned angular sectors, triangle orientation, cell lengths, strain and volume guards bound the reduction. These guards are not a general proof for arbitrary self-intersecting 3D surfaces.

The discrete surface solves its own uniform unloaded inflation equilibrium at the declared gauge pressure, then seals that volume as its gas reference. The same polytropic pressure/energy implementation serves offline diagnostics and the browser. Runtime evaluation reuses surface, force and gas buffers. The full gas implementation now lives in `dist/tyre-gas.js`; the old diagnostics import path reexports it, and affected evidence generators hash the new dependency.

In sealed mode native foundation and elastic edge stiffness are zero: the membrane and gas supply elastic forces, while the existing edge viscosity remains a separate dissipative term. The retained foundation/extension parameter fields are legacy record fields and do not contribute elastic force in this mode. Internal generalized forces act only on the relative tread slides; no extra hub translation or spin force is added. External loading still comes from configured masses, gravity and applied forces.

The pinned [MuJoCo 3.16 source](https://github.com/google-deepmind/mujoco/blob/a892750516336d8358949f4518fcc4fbbd85beae/src/engine/engine_forward.c) supplies split `mj_step1`/`mj_step2`. The receiver explicitly selects Euler and evaluates casing forces between the stages, at every step. It does not claim RK4 coupling. The provisional maximum step is 15.625 microseconds; the example uses half that. This bounded receiving limit is not a derived stability guarantee for all admitted material/mass combinations. A runtime stiffness/mass admission bound and wider refinement remain work to do.

## Numerical and browser receiving

Independent checks cover signed volume against the polygon-of-revolution formula, every tread-coordinate material and gas energy gradient, unloaded force balance, pressure response, configuration ownership and invalid geometry. Full Cartesian unloaded tangents, including tangential modes, factor without shifts at two finite-difference scales for 32/64 stations and 1.2/1.6/2.0 bar. This establishes the sampled unloaded controls only; loaded tangential stability and general shear/bending behaviour are not received.

Native tests receive all three pressures on the short flat drop, exact JSON replay, recording-cadence independence, whole-wheel free-flight linear/angular momentum, and decreasing work error on timestep halving. The illustrated 32-station, 1.6-bar drop reaches about 117 N peak contact load, 0.060 mm maximum numerical overlap and 0.00017 J maximum work-balance residual. It is not a quasi-static load–deflection curve.

Focused Edge receiving compares the real worker's saved record against headless output, with `1e-7 + 1e-8*abs(reference)` numerical budget. It also exercises selection, save, scrub, restore and load. An initial mismatch in near-zero lateral force (about 1.3e-7 N) failed this budget. Sharing the foundation model's canonical binary64 ring directions removed that mismatch; no tolerance was relaxed. Edge 158.0.4370.21 passes and the screenshot was inspected. Source hashes and the browser receipt are saved in `docs/evidence/swept-wheel-browser.json`. This is focused receiving, not a full-browser attestation; historical rider replay/contact failures remain unresolved.

Run:

```
node --test test/sealed-casing.test.mjs test/sealed-moving-wheel.test.mjs test/moving-wheel.test.mjs test/tyre-sealed.test.mjs
node scripts/sealed-wheel-browser-check.mjs
```

The browser command uses existing pinned Playwright-core 1.56.1 via `NODE_PATH` and `BIKELAB_CHROMIUM` for the local Edge executable. It starts and closes its own loopback server; the standalone preview remains `node server.mjs`.

## Remaining #95 gates

1. Receive imposed hub-height load/unload at 1.2/1.6/2.0 bar with force components, footprint width, deflection, pressure, volume and rim clearance; perform loaded mesh/timestep and tangential stability checks. Derive timestep admission from runtime stiffness/mass, retaining measured numerical bounds.
2. Reuse the same law in trail-bike with configured rider/bike mass and explicit record/version handling. Receive browser/headless agreement there.
3. Add and verify a separately declared near-rim/insert potential and dissipative work. Service pressure limits do not establish pinch, burst or bead-release criteria.
4. Keep calibration deferred until measured data exist. Do not turn illustrative pressure/material inputs or software admission bounds into physical strength claims.

#95 remains open. The opt-in viewer is useful receiving progress, not closure of those remaining gates.

The initial complete suite was 482/487: five failures correctly rejected a stale spinning-baseline source pin. Regenerating all 36 prescribed controls produced exact equality of every non-source field against the previous archive before updating its pins; see `evidence/swept-spinning-refresh.json`. The targeted ten spinning tests then passed. No archived numerical result or comparison budget changed.

Final complete local Node suite: **487/487 pass**, zero skipped, 137.695 seconds on Node 24.22.0/Windows; see [test receipt](evidence/swept-wheel-tests.json) and [complete output](evidence/swept-wheel-node.txt). The browser worker record is retained as [gzip/base64 JSON](evidence/swept-wheel-record.json.gz.b64), with its decompressed SHA-256 in the test receipt.
