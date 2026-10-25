import test from 'node:test';
import assert from 'node:assert/strict';
import {compileRiderSetup, validateRiderDefinition, riderDefinitionIdentity, riderSetupReceipt, riderSetupFromScenario, riderSetupExample} from '../dist/rider-setup.js';
import {articulatedPreset, modelXML, run, replay, inputFromRecord} from '../dist/trail-bike.js';
import {compilePassiveRider} from '../dist/rider-passive.js';
import {inspectNativePassive} from '../dist/rider-native.js';
import {stateIdentity} from '../dist/trail-initial-state.js';
const copy = structuredClone;
const near = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a - b) < 1e-10, `${a} vs ${b}`);
function changedFit(input) {
  const s = copy(input);s.placement.hip = [-.13, .29];s.placement.trunkPitch = .60;
  s.bikeMount.hand.position = [.46, .33];s.bikeMount.foot.position = [.01, -.29];
  return s;
}

test('portable compilation exactly preserves legacy XML, complete records and fresh-state identity', async () => {
  for (const bike of ['full', 'hardtail']) for (const canonical of [false, true]) {
    const a = articulatedPreset(bike);a.motion.duration = .02;if (canonical) a.initialization = {mode: 'launch'};
    const setup = riderSetupFromScenario(a), c = compileRiderSetup(setup);
    assert.equal(modelXML(c.scenario), modelXML(a));
    assert.deepEqual(compileRiderSetup(copy(c.setup)), c);
    const actual = await run(c.scenario), original = await run(a);
    assert.equal(actual.status, 'completed');assert.deepEqual(actual, original);
    assert.deepEqual(await replay(actual), original);assert.deepEqual(inputFromRecord(actual), inputFromRecord(original));
    if (canonical) assert.equal(actual.initialState.identity, original.initialState.identity);
  }
});

test('one unchanged definition fits both bikes and changed sites without resizing or recentering laws', async () => {
  const reference = riderSetupExample(), identity = await riderDefinitionIdentity(reference.rider);
  const baseline = compilePassiveRider(compileRiderSetup(reference).scenario.articulated.passive);
  const identities = new Set();
  for (const bike of ['full', 'hardtail']) for (const changed of [false, true]) {
    let setup = copy(reference);setup.trail.bike.bike = bike;setup.trail.motion.duration = .02;
    if (changed) setup = changedFit(setup);
    const c = compileRiderSetup(setup), passive = compilePassiveRider(c.scenario.articulated.passive);
    assert.equal(await riderDefinitionIdentity(c.setup.rider), identity);
    assert.deepEqual(c.setup.rider, reference.rider);
    assert.deepEqual(passive.spec.joints, baseline.spec.joints);
    assert.deepEqual(passive.spec.posture.segments, reference.rider.segments);
    if (changed) assert.notDeepEqual(passive.laws.map(p => p.springref), baseline.laws.map(p => p.springref));
    const native = await inspectNativePassive(passive.spec);
    near(native.aggregate.mass, reference.rider.riderMass);
    for (const b of native.segments) {
      const s = reference.rider.segments[b.name];near(b.mass, reference.rider.riderMass * s.massFraction);
      near(Math.hypot(...b.distal.map((v, i) => v - b.proximal[i])), s.length);
    }
    for (const a of native.attachments) near(Math.hypot(...a.gap), 0);
    for (const j of native.passive.joints) {
      const law = reference.rider.joints[j.name];near(j.nativeTorque, -law.stiffness * (j.angle - law.restAngle));
    }
    const r = await run(c.scenario);assert.equal(r.status, 'completed');
    assert.equal(r.massBudget.rider, 70);assert.equal(r.massBudget.chassis, 6);assert.equal(r.massBudget.total, 83);
    identities.add(r.initialState.identity);
    assert.equal(r.initialState.identity, await stateIdentity(modelXML(c.scenario), c.scenario));
  }
  assert.equal(identities.size, 4, 'world state remains bike/fit specific');
  const receipt = await riderSetupReceipt(reference);
  assert.equal(receipt.riderIdentity, identity);assert.deepEqual(receipt.setup, reference);
  const other = copy(reference.rider);other.provenance += ' Separate evidence.';
  assert.notEqual(await riderDefinitionIdentity(other), identity, 'asset identity includes provenance');
});

test('portable definitions require complete properties and reject ownership conflicts without mutating inputs', () => {
  const original = riderSetupExample(), snapshot = JSON.stringify(original);
  const invalid = [
    s => {s.rider.chassis = {};}, s => {s.rider.hip = [0, 0];}, s => {delete s.rider.segments.trunk;},
    s => {delete s.rider.segments.trunk.inertiaPerMass;}, s => {s.rider.segments.trunk.inertiaPerMass = [.1, .1, 1];},
    s => {delete s.rider.joints.hip;}, s => {s.rider.joints.hip.damping = NaN;}, s => {s.rider.riderMass = undefined;},
    s => {s.rider.provenance = ' ';}, s => {s.rider.provenance = 'x'.repeat(2001);},
    s => {s.rider[Symbol('hidden')] = 1;}, s => {s.placement.hand = [.4, .3];},
    s => {Object.defineProperty(s.placement, 'hip', {value: [2, 2], enumerable: false});},
    s => {Object.defineProperty(s.placement, 'hip', {get: () => [2, 2]});},
    s => {s.bikeMount.hand.body = 'fork';}, s => {s.bikeMount.foot.position[0] = Infinity;},
    s => {delete s.bikeMount.chassis.mass;}, s => {s.interfaces.kind = 'released';},
    s => {s.interfaces.closureTime = undefined;}, s => {s.trail.articulated = {};},
    s => {s.trail.bike.rider = 'compliant';}, s => {s.placement = null;}, s => {s.format = 'future';}
  ];
  for (const change of invalid) {const s = copy(original);change(s);assert.throws(() => compileRiderSetup(s));}
  for (const d of [null, [], new Date(), {}]) assert.throws(() => validateRiderDefinition(d));
  assert.equal(JSON.stringify(original), snapshot);
  const mutable = copy(original), a = compileRiderSetup(mutable), b = compileRiderSetup(mutable);
  mutable.rider.segments.trunk.length = 1;mutable.rider.joints.hip.stiffness = 1;mutable.bikeMount.hand.position[0] = 1;
  assert.deepEqual(a, b);assert.notEqual(a.setup.rider, b.setup.rider);
  assert.ok(Object.isFrozen(a.setup.rider.segments.trunk.inertiaPerMass));
  assert.ok(Object.isFrozen(a.scenario.articulated.passive.joints.hip));
  assert.throws(() => {a.scenario.articulated.passive.posture.hip[0] = 1;}, TypeError);
});

test('fit and cross-model state failures are explicit; no hidden reach or passive-domain correction', async () => {
  const original = riderSetupExample();
  for (const [change, reason] of [
    [s => {s.bikeMount.hand.position = [2, 2];}, /unreachable/],
    [s => {s.bikeMount.foot.position = s.placement.hip;}, /singular/],
    [s => {s.placement.kneeSide = -1;}, /initial angle/],
    [s => {s.placement.hip = [-.22, .07];s.placement.trunkPitch = .65;}, /outside its domain/]
  ]) {const s = copy(original);change(s);assert.throws(() => compileRiderSetup(s), reason);}
  const a = copy(original);a.trail.motion.duration = .02;const record = await run(compileRiderSetup(a).scenario);
  const b = changedFit(a);b.trail.initialization = {mode: 'state', state: record.finalState};
  b.trail.motion = Object.fromEntries(['gravity', 'duration', 'dt', 'sampleDt'].map(k => [k, a.trail.motion[k]]));
  await assert.rejects(() => run(compileRiderSetup(b).scenario), /physical identity/);
});
