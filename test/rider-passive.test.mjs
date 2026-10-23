import test from 'node:test';
import assert from 'node:assert/strict';
import {constructPosture} from '../dist/rider-posture.js';
import {DEFAULTS, JOINTS, compilePassiveRider, passiveStateIssue, evaluatePassiveRider} from '../dist/rider-passive.js';
import {nativePassiveXML, inspectNativePassive} from '../dist/rider-native.js';
import {getRuntime} from '../dist/moving-wheel.js';

const near = (a, b, tol = 1e-10) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const copy = value => JSON.parse(JSON.stringify(value));
const zero = () => [0, 0, 0, 0];
const shifted = () => ({joints: {hip: {...DEFAULTS.joints.hip, restAngle: DEFAULTS.joints.hip.restAngle + .12},
  // Difference exceeds π: this hinge spring must not take the wrapped shortcut.
  shoulder: {...DEFAULTS.joints.shoulder, restAngle: -1, minAngle: -1.2, maxAngle: 3.3}}});
function opposite() {
  const posture = constructPosture({riderMass: 35, kneeSide: -1, elbowSide: 1});
  return {posture: posture.spec, joints: Object.fromEntries(JOINTS.map(name => [name, {
    ...DEFAULTS.joints[name], restAngle: posture.joints[name] + .05,
    minAngle: posture.joints[name] - .2, maxAngle: posture.joints[name] + .2
  }]))};
}

test('passive specification owns canonical values and never silently recenters a changed posture', () => {
  const input = copy(DEFAULTS), compiled = compilePassiveRider(input), snapshot = copy(compiled);
  input.joints.hip.stiffness = 1; input.posture.hip[0] = 1;
  assert.deepEqual(compiled, snapshot); assert.ok(Object.isFrozen(compiled.laws[0]));
  assert.deepEqual(compilePassiveRider(copy(compiled.spec)), compiled);
  assert.deepEqual(compilePassiveRider({}).spec, DEFAULTS);
  assert.throws(() => compilePassiveRider({posture: {kneeSide: -1}}), /initial angle/);
  assert.equal(compilePassiveRider(opposite()).spec.posture.riderMass, 35);
  for (const input of [null, [], new Date(), {format: undefined}, {format: 'old'}, {unknown: 1},
    {[Symbol('hidden')]: 1}, {posture: undefined}, {joints: undefined}, {joints: {root: {}}}, {joints: {hip: {}}}]) {
    assert.throws(() => compilePassiveRider(input));
  }
  for (const patch of [{stiffness: -1}, {stiffness: 5001}, {damping: -1}, {damping: Infinity},
    {restAngle: NaN}, {restAngle: 0}, {minAngle: 2, maxAngle: 1}, {minAngle: -Math.PI, maxAngle: Math.PI},
    {minAngle: -7}, {extra: 0}, {stiffness: undefined}]) {
    assert.throws(() => compilePassiveRider({joints: {hip: {...DEFAULTS.joints.hip, ...patch}}}));
  }
});

test('ultimate domains admit exact bounds, reject unsupported states atomically and cannot cross a singular bend band', () => {
  const c = compilePassiveRider(), out = new Float64Array(20).fill(123);
  for (let i = 0; i < 4; i++) for (const bound of ['minQ', 'maxQ']) {
    const q = zero(); q[i] = c.laws[i][bound];
    assert.equal(passiveStateIssue(c, q, zero()), null);
    evaluatePassiveRider(c, q, zero(), out);
    q[i] += bound === 'minQ' ? -1e-12 : 1e-12;
    const before = Array.from(out), state = [...q];
    assert.equal(passiveStateIssue(c, q, zero()), `rider-${JOINTS[i]}-angle-limit`);
    assert.throws(() => evaluatePassiveRider(c, q, zero(), out), /angle-limit/);
    assert.deepEqual(Array.from(out), before); assert.deepEqual(q, state);
  }
  for (const [q, v] of [[[], zero()], [Array(4), zero()], [[0, 0, NaN, 0], zero()],
    [zero(), [0, Infinity, 0, 0]], [zero(), [1e308, 0, 0, 0]]]) {
    assert.ok(passiveStateIssue(c, q, v));
    assert.throws(() => evaluatePassiveRider(c, q, v, out));
  }
  const buffer = new Float64Array(20);
  assert.throws(() => evaluatePassiveRider(c, buffer.subarray(0, 4), zero(), buffer), /independent/);
  assert.throws(() => evaluatePassiveRider(c, zero(), zero(), []), /Float64Array/);
  const q = zero(); q[2] = 2 * Math.PI;
  assert.match(passiveStateIssue(c, q, zero()), /angle-limit/);
  for (const name of ['knee', 'elbow']) {
    const initial = c.posture.joints[name], band = Math.floor(initial / Math.PI), margin = Math.asin(c.posture.spec.minBendSine);
    const law = {...DEFAULTS.joints[name], minAngle: band * Math.PI + margin, maxAngle: (band + 1) * Math.PI - margin};
    const boundary = compilePassiveRider({joints: {[name]: law}});
    assert.equal(passiveStateIssue(boundary, zero(), zero()), null);
    for (const patch of [{minAngle: law.minAngle - 1e-12}, {maxAngle: law.maxAngle + 1e-12}]) {
      assert.throws(() => compilePassiveRider({joints: {[name]: {...law, ...patch}}}), /minimum-bend/);
    }
  }
});

test('passive torques equal independent energy gradients and damping removes energy for both velocity signs', () => {
  for (const input of [{}, shifted(), opposite()]) {
    const c = compilePassiveRider(input), out = new Float64Array(20);
    for (const sign of [-1, 0, 1]) {
      const q = [.06, -.08, .04, -.02].map(x => sign * x), v = [.7, -1.1, -.3, 0].map(x => sign * x);
      assert.equal(evaluatePassiveRider(c, q, v, out), out);
      for (let i = 0; i < 4; i++) {
        const p = c.spec.joints[JOINTS[i]], theta = c.posture.joints[JOINTS[i]] + q[i];
        const potential = angle => .5 * p.stiffness * (angle - p.restAngle) ** 2;
        const gradient = (potential(theta + 1e-6) - potential(theta - 1e-6)) / 2e-6;
        near(out[5 * i + 3], -gradient, 1e-7);
        near(out[5 * i + 1], potential(theta));
        near(out[5 * i + 4], -p.damping * v[i]);
        near(out[5 * i] * v[i] + gradient * v[i], -out[5 * i + 2], 1e-7);
        assert.ok(out[5 * i + 2] >= 0); assert.ok(out[5 * i + 4] * v[i] <= 0);
      }
    }
  }
  const input = copy(DEFAULTS); for (const p of Object.values(input.joints)) {p.stiffness = 0; p.damping = 0;}
  const out = evaluatePassiveRider(compilePassiveRider(input), [.1, -.1, .1, -.1], [1, -1, 1, -1], new Float64Array(20));
  assert.ok(out.every(x => x === 0));
});

test('native scalar springs own forces and energy once with untethered rider root coordinates', async () => {
  const mj = await getRuntime();
  for (const input of [{}, shifted(), opposite()]) {
    const c = compilePassiveRider(input);
    // Static off-manifold samples isolate constitutive mapping; no step or
    // closed-chain dynamics claim. Remove gravity for an independent potential.
    const m = mj.MjModel.from_xml_string(nativePassiveXML(input).replace('gravity="0 0 -9.80665"', 'gravity="0 0 0"'));
    const d = new mj.MjData(m);
    try {
      const joint = name => mj.mj_name2id(m, mj.mjtObj.mjOBJ_JOINT.value, name);
      const ids = c.laws.map(law => joint(law.nativeName));
      const qids = ids.map(id => m.jnt_qposadr[id]), vids = ids.map(id => m.jnt_dofadr[id]);
      for (let i = 0; i < 4; i++) {
        near(m.qpos0[qids[i]], 0); near(m.qpos_spring[qids[i]], c.laws[i].restAngle - c.laws[i].angle0);
        assert.equal(m.jnt_limited[ids[i]], 0);
      }
      for (const sign of [-1, 0, 1]) {
        d.qpos.fill(0); d.qvel.fill(0);
        const q = [.09, -.06, -.04, .08].map(x => sign * x), v = [.4, -.7, 1.2, -.3].map(x => sign * x);
        const expected = evaluatePassiveRider(c, q, v, new Float64Array(20));
        for (let i = 0; i < 4; i++) {d.qpos[qids[i]] = q[i]; d.qvel[vids[i]] = v[i];}
        for (const name of ['riderX', 'riderZ', 'riderPitch']) {
          const j = joint(name); d.qpos[m.jnt_qposadr[j]] = .17; d.qvel[m.jnt_dofadr[j]] = -.6;
          near(m.jnt_stiffness[j], 0); near(m.dof_damping[m.jnt_dofadr[j]], 0);
        }
        mj.mj_forward(m, d); mj.mj_energyPos(m, d);
        near(d.energy[0], q.reduce((sum, _, i) => sum + expected[5 * i + 1], 0));
        for (let i = 0; i < m.nv; i++) {
          near(d.qfrc_applied[i], 0);
          const index = vids.indexOf(i);
          near(d.qfrc_passive[i], index < 0 ? 0 : expected[5 * index]);
          near(d.qfrc_smooth[i] + d.qfrc_bias[i], d.qfrc_passive[i]);
        }
        for (let i = 0; i < 4; i++) {
          const energy = [];
          for (const direction of [-1, 1]) {
            d.qpos[qids[i]] = q[i] + direction * 1e-6; mj.mj_forward(m, d); mj.mj_energyPos(m, d); energy.push(d.energy[0]);
          }
          d.qpos[qids[i]] = q[i];
          near(-(energy[1] - energy[0]) / 2e-6, expected[5 * i + 3], 1e-7);
        }
      }
    } finally {d.delete(); m.delete();}
  }
});

test('initial passive inspection exposes canonical rest offsets and native load decomposition for replay', async () => {
  for (const input of [{}, shifted(), opposite()]) {
    const report = await inspectNativePassive(input);
    assert.equal(report.format, 'bikelab-rider-native-passive-0.2');
    assert.deepEqual(await inspectNativePassive(copy(report.spec)), report);
    assert.ok(report.qpos.every(x => x === 0));
    for (const joint of report.passive.joints) {near(joint.nativeTorque, joint.torque); near(joint.dampingLossPower, 0);}
    const gravity = report.segments.reduce((sum, body) => sum + 9.80665 * body.mass * body.com[2], 0);
    near(report.passive.nativePotentialIncludingGravity, gravity + report.passive.joints.reduce((sum, joint) => sum + joint.springEnergy, 0));
  }
});
