import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS, FORMAT, SEGMENTS, validatePosture, constructPosture} from '../dist/rider-posture.js';

const near = (a, b, tolerance = 1e-12) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);
const pointNear = (a, b) => a.forEach((x, i) => near(x, b[i]));
const rotate = (p, a) => [Math.cos(a) * p[0] + Math.sin(a) * p[1], -Math.sin(a) * p[0] + Math.cos(a) * p[1]];

function triangleFixture() {
  const p = structuredClone(DEFAULTS);
  p.hip = [0, 0]; p.trunkPitch = 0; p.hand = [.6, .5]; p.foot = [.6, 0];
  for (const name of SEGMENTS) p.segments[name].length = .5;
  return p;
}

test('posture constructs exact bent-chain geometry, signs and branch selection', () => {
  const p = triangleFixture(), r = constructPosture(p);
  pointNear(r.points.shoulder, [0, .5]); pointNear(r.points.knee, [.3, .4]); pointNear(r.points.elbow, [.3, .1]);
  near(r.conditioning.kneeBendSine, .96); near(r.conditioning.elbowBendSine, .96);
  near(r.closure.hand, 0); near(r.closure.foot, 0);
  near(r.joints.hip, Math.atan2(3, 4));
  near(r.joints.knee, Math.PI - 2 * Math.atan2(3, 4));
  const other = constructPosture({...p, kneeSide: -1, elbowSide: 1});
  pointNear(other.points.knee, [.3, -.4]); pointNear(other.points.elbow, [.3, .9]);
  for (const body of r.bodies) near(Math.hypot(...body.distal.map((x, i) => x - body.proximal[i])), .5);
});

test('posture rejects unreachable and ill-conditioned limbs, including unequal folded lengths', () => {
  const p = triangleFixture();
  for (const foot of [[0, 0], [1, 0], [1.01, 0], [.99999, 0], [.00001, 0]]) {
    assert.throws(() => constructPosture({...p, foot}), /Leg chain/);
  }
  assert.throws(() => constructPosture({...p, hand: [1.01, .5]}), /Arm chain/);
  p.segments.thighs.length = .7; p.segments.shanksFeet.length = .3;
  for (const foot of [[.39, 0], [.4, 0], [.400001, 0]]) assert.throws(() => constructPosture({...p, foot}), /Leg chain/);
  const mirrored = constructPosture({...triangleFixture(), foot: [-.6, 0]});
  pointNear(mirrored.points.knee, [-.3, -.4]);
  assert.ok(constructPosture().conditioning.kneeBendSine > DEFAULTS.minBendSine);
});

test('posture spec is versioned and owned, and rejects incomplete or nonphysical mass data', () => {
  const input = structuredClone(DEFAULTS), spec = validatePosture(input), result = constructPosture(spec);
  input.hip[0] = 1; input.segments.trunk.inertiaPerMass[0] = .9;
  assert.equal(spec.hip[0], DEFAULTS.hip[0]); assert.ok(Object.isFrozen(result.bodies[0].inertiaFrame));
  assert.deepEqual(constructPosture(JSON.parse(JSON.stringify(spec))), result);
  for (const invalid of [null, [], {format: 'future'}, {format: undefined}, {unknown: 1},
    {riderMass: Infinity}, {hip: [0, NaN]}, {foot: new Array(2)}, {elbowSide: 0},
    {kneeSide: '1'}, {minBendSine: 0}, {segments: undefined}, {segments: {other: {}}},
    {segments: {trunk: {length: .6}}}]) assert.throws(() => validatePosture(invalid));
  for (const change of [{massFraction: .7}, {length: 0}, {comFraction: 2},
    {inertiaPerMass: [1, .1, .1]}, {inertiaPerMass: [0, .1, .1]}, {inertiaPerMass: new Array(3)}]) {
    assert.throws(() => validatePosture({segments: {trunk: {...DEFAULTS.segments.trunk, ...change}}}));
  }
  assert.throws(() => validatePosture({[Symbol('unknown')]: 1}));
  assert.equal(spec.format, FORMAT);
});

test('aggregate COM and full inertia match an independent equivalent point-mass cloud', () => {
  const r = constructPosture(), cloud = [];
  for (const body of r.bodies) {
    const [ix, iy, iz] = body.inertiaBody, m = body.mass;
    // Six equal point masses independently represent each admissible diagonal tensor.
    const squared = [iy + iz - ix, ix + iz - iy, ix + iy - iz].map(v => 3 * v / (2 * m));
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const local = [0, 0, 0]; local[axis] = sign * Math.sqrt(Math.max(0, squared[axis]));
      const xz = rotate([local[0], local[2]], body.angle);
      cloud.push({mass: m / 6, p: [body.com[0] + xz[0], local[1], body.com[1] + xz[1]]});
    }
  }
  const mass = cloud.reduce((sum, p) => sum + p.mass, 0);
  const com = [0, 1, 2].map(i => cloud.reduce((sum, p) => sum + p.mass * p.p[i], 0) / mass);
  near(mass, DEFAULTS.riderMass); pointNear([com[0], com[2]], r.aggregate.com); near(com[1], 0);
  const tensor = new Array(9).fill(0);
  for (const p of cloud) {
    const d = p.p.map((v, i) => v - com[i]), norm2 = d.reduce((sum, v) => sum + v * v, 0);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      tensor[3 * i + j] += p.mass * ((i === j ? norm2 : 0) - d[i] * d[j]);
    }
  }
  pointNear(tensor, r.aggregate.inertiaCOM);
  assert.ok(Math.abs(tensor[2]) > .01, 'posture must exercise nonzero off-diagonal aggregate inertia');
});

test('rigid coordinate transforms and rider mass scaling preserve construction invariants', () => {
  const p = structuredClone(DEFAULTS), r = constructPosture(p), rotation = .3, translation = [.2, -.1];
  const transform = point => rotate(point, rotation).map((x, i) => x + translation[i]);
  for (const key of ['hip', 'hand', 'foot']) p[key] = transform(p[key]);
  p.trunkPitch += rotation;
  const moved = constructPosture(p);
  for (const key of Object.keys(r.points)) pointNear(moved.points[key], transform(r.points[key]));
  pointNear(moved.aggregate.com, transform(r.aggregate.com));
  near(moved.aggregate.inertiaCOM[4], r.aggregate.inertiaCOM[4]);
  for (const key of ['hip', 'knee', 'shoulder', 'elbow']) near(moved.joints[key], r.joints[key]);
  const light = constructPosture({...p, riderMass: 35});
  pointNear(light.aggregate.com, moved.aggregate.com);
  pointNear(light.aggregate.inertiaCOM, moved.aggregate.inertiaCOM.map(x => x / 2));
  const displacedCOM = constructPosture({segments: {trunk: {...DEFAULTS.segments.trunk, comFraction: .7}}});
  assert.notDeepEqual(displacedCOM.aggregate.com, r.aggregate.com);
  const shifted = structuredClone(DEFAULTS); shifted.hip[0] -= .1;
  assert.notDeepEqual(constructPosture(shifted).aggregate.inertiaCOM, r.aggregate.inertiaCOM);
});
