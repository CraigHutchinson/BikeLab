import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS, constructPosture} from '../dist/rider-posture.js';
import {DEFAULTS as PASSIVE, compilePassiveRider} from '../dist/rider-passive.js';
import {inspectNativePosture} from '../dist/rider-native.js';
import {POSE_EXAMPLES, inspectRiderPose} from '../dist/rider-pose-study.js';

const near = (a,b) => assert.ok(Number.isFinite(a) && Math.abs(a-b) < 1e-10, `${a} vs ${b}`);
const xz = p => [p[0],0,p[1]];
const vector = (a,b) => {assert.equal(a.length,b.length);a.forEach((v,i)=>near(v,b[i]));};

test('pose examples preserve body properties and anchors while native geometry and COM agree', async () => {
  for (const example of POSE_EXAMPLES) {
    const {posture:p} = inspectRiderPose(example.posture), native = await inspectNativePosture(p.spec);
    assert.deepEqual(p.spec.segments, DEFAULTS.segments);
    assert.deepEqual(p.spec.hand, DEFAULTS.hand); assert.deepEqual(p.spec.foot, DEFAULTS.foot);
    near(p.aggregate.mass,70); vector(native.aggregate.com,xz(p.aggregate.com));
    vector(native.aggregate.inertiaCOM,p.aggregate.inertiaCOM);
    const weighted = [0,0];
    for (let i=0;i<p.bodies.length;i++) {
      const b=p.bodies[i], n=native.segments[i], spec=p.spec.segments[b.name];
      near(Math.hypot(b.distal[0]-b.proximal[0],b.distal[1]-b.proximal[1]),spec.length);
      near(b.mass,70*spec.massFraction); vector(n.proximal,xz(b.proximal)); vector(n.distal,xz(b.distal));
      for(let axis=0;axis<2;axis++)weighted[axis]+=b.mass*(b.proximal[axis]+spec.comFraction*(b.distal[axis]-b.proximal[axis]));
    }
    vector(p.aggregate.com,weighted.map(v=>v/70));
    for(const a of native.attachments){vector(a.gap,[0,0,0]);vector(a.residual,[0,0,0]);}
    assert.ok(p.conditioning.kneeBendSine>=p.spec.minBendSine);
    assert.ok(p.conditioning.elbowBendSine>=p.spec.minBendSine);
    assert.deepEqual(constructPosture(JSON.parse(JSON.stringify(p.spec))),p);
  }
});

test('lower poses remain geometric candidates without recentering passive domains or rest angles', () => {
  const baseline=JSON.stringify(PASSIVE), reports=POSE_EXAMPLES.map(p=>inspectRiderPose(p.posture));
  assert.deepEqual(reports.map(r=>r.defaultPassive.accepted),[true,true,false,false]);
  for(const r of reports){
    for(const j of r.joints){near(j.min,PASSIVE.joints[j.name].minAngle);near(j.max,PASSIVE.joints[j.name].maxAngle);}
    if(r.defaultPassive.accepted)assert.deepEqual(compilePassiveRider({posture:r.posture.spec}).spec.joints,PASSIVE.joints);
    else {assert.match(r.defaultPassive.reason,/outside its domain/);assert.throws(()=>compilePassiveRider({posture:r.posture.spec}),/outside its domain/);}
  }
  // Independent reference coordinates, to catch swapped hip/COM or axes.
  vector(reports[0].posture.aggregate.com,[.038853967592562356,.3576111354238653]);
  vector(reports[3].posture.aggregate.com,[-.0009391847939041132,.20847065443538476]);
  assert.equal(JSON.stringify(PASSIVE),baseline);
});

test('pose study rejects invalid geometry and owns inputs without hiding configurable body data', () => {
  for(const input of [{hip:[0,NaN]}, {hip:[0,2]}, {foot:DEFAULTS.hip}, {trunkPitch:Infinity}, {unknown:1}]) {
    assert.throws(()=>inspectRiderPose(input));
  }
  const input=structuredClone(DEFAULTS);input.riderMass=35;
  const report=inspectRiderPose(input);input.hip[0]=2;input.segments.trunk.length=1;
  assert.equal(report.posture.spec.hip[0],DEFAULTS.hip[0]);near(report.posture.aggregate.mass,35);
  vector(report.posture.aggregate.com,constructPosture().aggregate.com);
  assert.ok(Object.isFrozen(report.joints[0]));assert.ok(Object.isFrozen(report.posture.spec.segments.trunk));
  assert.ok(Object.isFrozen(POSE_EXAMPLES[0].posture.hip));
});
