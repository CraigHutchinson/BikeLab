// Postprocess complete saved runs; no simulation or force modification.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const [fullPath, hardtailPath, output = 'artifacts/rider-connected/load-review.json', ...extra] = process.argv.slice(2);
if (!fullPath || !hardtailPath || extra.length) throw Error('Usage: node scripts/rider-load-review.mjs full-record.json hardtail-record.json [output.json]');
const hash = value => createHash('sha256').update(value).digest('hex');
const receipt = {
  format: 'bikelab-rider-load-review-0.1',
  createdAt: new Date().toISOString(),
  scriptSha256: hash(await readFile(new URL(import.meta.url))),
  scope: 'Arithmetic from hosted unseated relaxation records; no new simulation, calibration or performance measurement. Force-balance accelerations are inferred from forces, not independent acceleration-residual checks. Shares use instantaneous or sampled integrated upward interface force, not body weight.',
  cases: []
};

for (const [bike, path] of [['full', fullPath], ['hardtail', hardtailPath]]) {
  const raw = await readFile(path), r = JSON.parse(raw);
  assert.equal(r.model, 'bikelab-trail-bike-articulated-0.1');
  assert.equal(r.scenario.bike.bike, bike);
  assert.equal(r.status, 'completed');
  const p = r.scenario.articulated.passive.posture, g = r.scenario.motion.gravity;
  const riderWeight = p.riderMass * g, totalWeight = r.massBudget.total * g;
  const rows = r.frames.map(f => {
    const interfaces = f.articulated.interfaces.attachments;
    const hand = interfaces.find(a => a.name === 'hand'), foot = interfaces.find(a => a.name === 'foot');
    const handZ = hand.forceOnRider[2], footZ = foot.forceOnRider[2];
    const frontZ = f.wheels[0].ground[1], rearZ = f.wheels[1].ground[1];
    const riderSupport = handZ + footZ, groundSupport = frontZ + rearZ;
    const comVelocityZ = f.articulated.segments.reduce((sum, s) => sum + p.segments[s.name].massFraction * s.velocity[5], 0);
    return {
      time: f.time, frontZ, rearZ, handX: hand.forceOnRider[0], handZ, footX: foot.forceOnRider[0], footZ,
      riderSupport, groundSupport,
      footSupportShare: riderSupport > 0 ? footZ / riderSupport : null,
      frontGroundShare: groundSupport > 0 ? frontZ / groundSupport : null,
      riderSupportOverWeight: riderSupport / riderWeight, groundSupportOverWeight: groundSupport / totalWeight,
      riderAccelerationZFromForceBalance: riderSupport / p.riderMass - g,
      wholeAccelerationZFromForceBalance: groundSupport / r.massBudget.total - g,
      riderCOM: f.articulated.centerOfMass, riderCOMVelocityZ: comVelocityZ,
      riderCOMAheadOfFoot: f.articulated.centerOfMass[0] - foot.rider[0]
    };
  });
  assert.ok(rows.length > 1);
  let handImpulse = 0, footImpulse = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i], dt = b.time - a.time;
    assert.ok(dt > 0);
    handImpulse += .5 * dt * (a.handZ + b.handZ);
    footImpulse += .5 * dt * (a.footZ + b.footZ);
  }
  const first = rows[0], last = rows.at(-1);
  receipt.cases.push({
    bike, recordSha256: hash(raw), scenarioSha256: hash(JSON.stringify(r.scenario)),
    riderMass: p.riderMass, totalMass: r.massBudget.total, gravity: g, riderWeight, totalWeight,
    initialPassiveLoads: r.frames[0].articulated.passiveLoads,
    maxSpringTorqueWithinDomain: Object.fromEntries(Object.entries(r.scenario.articulated.passive.joints).map(([name, law]) =>
      [name, law.stiffness * Math.max(Math.abs(law.minAngle - law.restAngle), Math.abs(law.maxAngle - law.restAngle))])),
    riderCOMDrop: first.riderCOM[2] - last.riderCOM[2],
    sampledSupportImpulse: {method: 'Trapezoid over saved 5 ms samples; not the integration-step ledger.', hand: handImpulse, foot: footImpulse, footShare: footImpulse / (handImpulse + footImpulse)},
    feetExceedHandsAtEverySavedSample: rows.every(f => f.footZ > f.handZ),
    minSavedFootSupportShare: Math.min(...rows.map(f => f.footSupportShare ?? Infinity)),
    maxSavedFootSupportShare: Math.max(...rows.map(f => f.footSupportShare ?? -Infinity)),
    frames: rows
  });
}
await mkdir(dirname(output), {recursive: true});
await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
console.log('Saved', output);
