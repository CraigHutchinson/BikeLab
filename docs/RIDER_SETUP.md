# Portable rider setup

This increment implements **between-run reuse of a rider definition**, compiled into the existing always-attached Trail bike. Body properties and absolute passive laws are separate from the bike's chassis, authored hand/foot sites, placement and interface settings. One definition can be fitted to either bike without resizing limbs or changing its laws. It is the first prerequisite in [independent rider ownership](RIDER_OWNERSHIP.md), not an independent runtime actor or a completed detachment model.

## Use the existing visual and headless consumers

From the repository root, create an editable portable setup, compile it, retain its provenance receipt and run the result:

```sh
node scripts/rider-setup.mjs --example full > rider-setup.json
node scripts/rider-setup.mjs rider-setup.json > trail-scenario.json
node scripts/rider-setup.mjs --receipt rider-setup.json > rider-receipt.json
node scripts/trail-bike.mjs trail-scenario.json > trail-record.json
```

In **Trail bike → Edit complete bike, tyre, terrain and launch scenario**, paste the contents of `trail-scenario.json` and select **Calculate authored scenario**. The resulting motion, loads, guards and saved records come from the existing runner. The record file can also be loaded with **Load trail-bike record**. Portable setup/receipt files are authoring artifacts, not Trail records; do not feed them to that record importer.

To reuse the same rider, preserve the entire `rider` object and change `trail.bike.bike` from `full` to `hardtail`, then compile again. Change `bikeMount.hand.position` and `bikeMount.foot.position` for authored bike fit; change `placement` for the starting hip/trunk pose and bend branches. The example's anchors are frame-local proxies, not measured manufacturer handlebar/pedal coordinates. The compiler rejects unreachable, singular or out-of-domain fits. It does not stretch segments, recenter laws, settle the bike or solve equilibrium. Future crank/steering sites require an explicit supported body mapping.

The ordinary UI edits the expanded scenario. Those edits **do not update the portable source file or receipt**. Retain the authoring file and regenerate after changing a reusable definition; do not associate an old receipt with a changed run. The JavaScript adapter `riderSetupFromScenario(scenario, provenance)` can explicitly extract a new definition/setup from an authored articulated scenario. It never claims that imported values are calibrated.

## Ownership and formats

The API lives in [rider-setup.js](../dist/rider-setup.js). `compileRiderSetup(setup)` returns deeply owned immutable `{setup, scenario}`. The complete `bikelab-rider-setup-0.1` authoring document contains:

| Field | Owner and meaning |
| --- | --- |
| `rider` | `bikelab-rider-definition-0.1`: complete `riderMass`, all five `segments`, all four absolute passive `joints`, and nonblank `provenance` text |
| `placement` | Frame-local x/z hip position, trunk pitch about +y, elbow/knee bend branch and numerical `minBendSine` admission policy |
| `bikeMount` | Complete chassis mass/COM/inertia, paired `hand` and `foot` sites each with `body: "frame"` and x/z `position` |
| `interfaces` | `kind: "retained-pair"`, numerical `closureTime` and `maxClosureGap`; no release/friction/capture mode is implied |
| `trail` | Existing scenario fields excluding `articulated`; its bike must explicitly select `rider: "articulated"` |

Mass is in kg, length in m, angle in rad, diagonal inertia per mass in m², stiffness in N m/rad and damping in N m s/rad. Segment local +z runs proximal to distal; paired limbs remain aggregate bodies. Relative joint angles use the existing +y convention and initialized bend branch. Joint rest angles and domains are **absolute relative segment angles**, not displacements from the new fit. Native `springref = restAngle - initialAngle` can therefore change between fits while the physical law stays identical. See [posture](../dist/rider-posture.js) and [passive laws](../dist/rider-passive.js).

Definition validation is independent of any particular fit. It requires every segment and law rather than silently filling missing body data. Fitting additionally checks reach, branch conditioning and the entire passive domain. Only supported retained frame-local paired interfaces are accepted. Unknown/duplicate ownership fields, unsupported native bodies, nonfinite values and explicit undefined properties fail before native execution. Chassis is excluded from rider mass; the default complete bike still totals 83 kg, including its 70 kg rider, 6 kg chassis and 7 kg wheel/carrier assembly.

`riderDefinitionIdentity(definition)` returns SHA-256 of the canonical complete definition JSON, including provenance. It excludes bike, placement and native addresses. It is an **asset identity**, not a calibration certificate, physical-state identity, runtime actor ID or continuation token. Key ordering is canonicalized by validation. Changing provenance changes this asset identity even if mechanics are unchanged.

`riderSetupReceipt(setup)` returns `bikelab-rider-setup-receipt-0.1` with the canonical setup, rider identity, compiled scenario and scope. Store it alongside a run, not inside an existing Trail record. Existing combined model/native-build identity still protects complete state import: a state from another bike or fit remains incompatible. Receipts do not authenticate themselves and are not accepted as trusted executable input.

## Receiving evidence and remaining scope

Baseline main is `6813c81ef10c9f91eddceadfdc9b49a0ac134d62`, merging PR28 after [CI 40120534195](https://github.com/CraigHutchinson/BikeLab/actions/runs/40120534195) passed Linux, Windows and browser checks. This implementation changes no integration rates, native construction, forces, guards or legacy record formats. The existing absolute-law validator is extracted without changing its bounds or arithmetic.

Local focused checks pass: exact complete records and XML for both bikes in legacy and canonical launch modes; unchanged fresh-state identity and replay; one unchanged definition on both bikes with reference and changed hand/foot/hip/trunk fit; independently checked native mass, limb lengths, attachment closure and spring torque; different combined identities for all four bike/fit assemblies; explicit invalid-fit and cross-fit-state rejection; ownership/immutability and strict definition validation. Eight compiled posture/spec/law outputs also exactly match the pre-refactor source across both bikes, two fits and 35/70 kg riders. The local full suite passes 37 test files; 11 CLI/server files are blocked by existing subprocess/loopback EPERM restrictions. Direct CLI example/compile/receipt invocation succeeds. [The source-bound receipt](evidence/rider-setup.json) and [handoff](ITERATION_20_HANDOFF.md) retain the distinction from hosted browser/CLI receiving.

The first hosted OS jobs pass 233/234 tests each: the remaining failure exposed a missing preview-server allowlist entry for the new module. That route is now corrected; actual HTTP and browser receiving must pass on the corrected head.

The browser receiving script compiles the same source in Node and Chromium, feeds the expanded scenario through the actual existing JSON editor, compares complete records and captures all four rendered bike/fit combinations. CI retains source receipts, records, comparisons and captures in `rider-setup-evidence`; visual inspection remains pending until those artifacts are downloaded.

Still open: stable runtime actor/interface IDs and independent lifetimes, world-level rider roots and unbound flight, supported detachment/recontact, finite saddle receiving, persistent sessions and active posture control. Future slower rider intent updates follow the [multirate contract](MULTIRATE_EXECUTION.md); this compiler changes no clocks. Physical collision/limits, component failure/pressure loss, layered terrain, calibration, 3D lateral/turning dynamics and measured game performance retain their separate gates.
