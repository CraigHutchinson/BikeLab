import test from 'node:test';
import assert from 'node:assert/strict';
import {getRuntime} from '../dist/moving-wheel.js';
import {nativePassiveXML, inspectNativePassive, inspectNativePosture} from '../dist/rider-native.js';
import {DEFAULTS} from '../dist/rider-passive.js';
import {createRiderClosureObserver, copyClosureReport} from '../dist/rider-interfaces.js';
const near = (a, b, tol = 1e-9) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const vectorNear = (a, b, tol) => {assert.equal(a.length, b.length); a.forEach((x, i) => near(x, b[i], tol));};
const id = (mj, m, type, name) => {const i = mj.mj_name2id(m, mj.mjtObj[type].value, name); assert.ok(i >= 0, name); return i;};
const fixture = () => nativePassiveXML({joints:{hip:{...DEFAULTS.joints.hip, restAngle:DEFAULTS.joints.hip.restAngle + .12}}}).replace('gravity="0 0 -9.80665"', 'gravity="0 0 0"');
function setup(mj, m, d) {
  const q = name => m.jnt_qposadr[id(mj, m, 'mjOBJ_JOINT', name)];
  const v = name => m.jnt_dofadr[id(mj, m, 'mjOBJ_JOINT', name)];
  d.qpos[q('travel')] = .23; d.qpos[q('heave')] = -.17; d.qpos[q('pitch')] = .31;
  d.qpos[q('riderX')] = .007; d.qpos[q('riderPitch')] = .03;
  for (let i = 0; i < m.nv; i++) d.qvel[i] = .1 * (i - 3);
  mj.mj_forward(m, d); return {q, v};
}

test('connect site velocities, signed work and paired moments match independent derivatives and native projections', async () => {
  const mj = await getRuntime();
  for (const storage of ['dense', 'sparse']) {
    const m = mj.MjModel.from_xml_string(fixture().replace('jacobian="sparse"', `jacobian="${storage}"`)), d = new mj.MjData(m);
    let observer;
    try {
      const t = setup(mj, m, d); observer = createRiderClosureObserver(mj, m, d);
      const result = observer.read(), saved = copyClosureReport(result), initial = Array.from(d.qpos), speeds = Array.from(d.qvel);
      const applied = Array.from(d.qfrc_applied), native = Array.from(d.qfrc_constraint), acceleration = Array.from(d.qacc);
      assert.equal(result.otherEqualityRows, 0); assert.ok(result.attachments.every(a => a.active && a.rows === 3));
      assert.ok(Math.abs(result.pairMoment[1]) > .01, 'open soft closure must reveal a numerical pair moment');
      vectorNear(result.pairMoment, [0, native[t.v('pitch')], 0]);
      near(native[t.v('travel')], 0); near(native[t.v('heave')], 0);
      near(result.rowPower, native.reduce((sum, f, i) => sum + f * speeds[i], 0));
      near(result.pairPower, result.rowPower); near(result.powerResidual, 0);
      for (const a of result.attachments) {
        vectorNear(a.gap, a.nativeResidual);
        vectorNear(a.pairMoment, a.momentOnRider.map((v, i) => v + a.momentOnBike[i]));
        near(a.pairPower, a.powerOnRider + a.powerOnBike); near(a.rowPower, a.pairPower);
      }
      assert.equal(observer.read(), result); assert.deepEqual(Array.from(d.qfrc_applied), applied);
      assert.deepEqual(Array.from(d.qacc), acceleration); assert.deepEqual(Array.from(d.qpos), initial);
      // Independent position differences use q(t +/- epsilon) = q +/- v*epsilon.
      const epsilon = 1e-6, positions = [];
      for (const sign of [-1, 1]) {
        d.qpos.set(initial.map((x, i) => x + sign * speeds[i] * epsilon)); mj.mj_forward(m, d);
        positions.push(Array.from(d.site_xpos));
      }
      for (const a of saved.attachments) for (const [name, velocity] of [[`rider_${a.name}`, a.riderVelocity], [`bike_${a.name}`, a.bikeVelocity]]) {
        const site = id(mj, m, 'mjOBJ_SITE', name);
        for (let axis = 0; axis < 3; axis++) near((positions[1][3 * site + axis] - positions[0][3 * site + axis]) / (2 * epsilon), velocity[axis], 1e-8);
      }
      d.qpos.set(initial); mj.mj_forward(m, d); observer.read();
      // RNE owns the same forces at actual points; sum them independently about
      // its root-subtree COM. Gravity and external applied forces are zero here.
      mj.mj_rnePostConstraint(m, d);
      const expected = Array.from({length:m.nbody}, () => new Float64Array(6));
      for (const a of saved.attachments) for (const side of ['rider', 'bike']) {
        const site = id(mj, m, 'mjOBJ_SITE', `${side}_${a.name}`), body = m.site_bodyid[site], root = m.body_rootid[body];
        const force = a.forceOnRider.map(x => side === 'rider' ? x : -x), p = a[side].map((x, i) => x - d.subtree_com[3 * root + i]);
        expected[body][0] += p[1] * force[2] - p[2] * force[1]; expected[body][1] += p[2] * force[0] - p[0] * force[2]; expected[body][2] += p[0] * force[1] - p[1] * force[0];
        for (let axis = 0; axis < 3; axis++) expected[body][3 + axis] += force[axis];
      }
      for (let body = 1; body < m.nbody; body++) vectorNear(Array.from(d.cfrc_ext.subarray(6 * body, 6 * body + 6)), expected[body]);
      assert.deepEqual(copyClosureReport(observer.read()), saved);
      // A fresh wrapper remains valid after native backing-memory growth.
      if (storage === 'dense') {
        const before = d.qpos.buffer, growth = new mj.DoubleBuffer(Math.ceil(before.byteLength / 8) + 1024);
        try {
          assert.notEqual(d.qpos.buffer, before, 'control must actually grow native backing memory');
          mj.mj_forward(m, d); assert.deepEqual(copyClosureReport(observer.read()), saved);
        } finally {growth.delete();}
      }
    } finally {observer?.delete(); d.delete(); m.delete();}
  }
});

test('observer remaps disabled/reactivated rows and separates unrelated equality, brake and contact rows', async () => {
  const mj = await getRuntime();
  const xml = fixture().replace('<worldbody>', '<worldbody><geom type="plane" size="2 2 .1"/>')
    .replace('<equality>', '<equality><joint name="unrelated" joint1="pitch" polycoef="0 0 0 0 0"/>')
    .replace('<joint name="travel" type="slide" axis="1 0 0"/>', '<joint name="travel" type="slide" axis="1 0 0" frictionloss="2"/>')
    .replace('<body name="frame">', '<body name="frame"><geom type="sphere" size=".1" contype="1" conaffinity="1"/>');
  const m = mj.MjModel.from_xml_string(xml), d = new mj.MjData(m); let observer;
  try {
    setup(mj, m, d); observer = createRiderClosureObserver(mj, m, d);
    const r = observer.read(), original = copyClosureReport(r), hand = id(mj, m, 'mjOBJ_EQUALITY', 'rider_hand_closure');
    assert.ok(d.ncon > 0); assert.equal(r.otherEqualityRows, 1);
    assert.ok(d.efc_type.includes(mj.mjtConstraint.mjCNSTR_FRICTION_DOF.value));
    assert.ok(d.efc_type.some(t => t !== mj.mjtConstraint.mjCNSTR_EQUALITY.value && t !== mj.mjtConstraint.mjCNSTR_FRICTION_DOF.value));
    const borrowedForce = r.attachments[0].forceOnRider;
    d.eq_active[hand] = 0; mj.mj_forward(m, d); assert.equal(observer.read(), r);
    assert.equal(r.attachments[0].forceOnRider, borrowedForce); assert.equal(r.attachments[0].active, false); assert.equal(r.attachments[0].rows, 0);
    vectorNear(r.attachments[0].forceOnRider, [0,0,0], 0); near(r.attachments[0].pairPower, 0, 0);
    assert.ok(r.attachments[1].active); assert.ok(Math.abs(r.attachments[1].rowPower) > 0);
    d.eq_active[hand] = 1; mj.mj_forward(m, d); observer.read();
    for (let i = 0; i < 2; i++) vectorNear(r.attachments[i].forceOnRider, original.attachments[i].forceOnRider);
    for (const flag of [mj.mjtDisableBit.mjDSBL_EQUALITY.value, mj.mjtDisableBit.mjDSBL_CONSTRAINT.value]) {
      m.opt.disableflags = flag; mj.mj_forward(m, d); observer.read();
      assert.ok(r.attachments.every(a => !a.active && a.rows === 0)); vectorNear(r.pairMoment, [0,0,0], 0); near(r.rowPower, 0, 0);
    }
    assert.ok(original.attachments.every(a => a.active)); assert.notDeepEqual(copyClosureReport(r), original);
  } finally {observer?.delete(); d.delete(); m.delete();}
});

test('bad metadata, stale/malformed rows and nonfinite loads fail without publishing a partial result', async () => {
  const mj = await getRuntime(), m = mj.MjModel.from_xml_string(fixture()), d = new mj.MjData(m); let observer;
  try {
    setup(mj, m, d); observer = createRiderClosureObserver(mj, m, d); const r = observer.read(), saved = copyClosureReport(r);
    for (const key of ['efc_force', 'efc_vel', 'efc_pos']) {
      const old = d[key][4]; d[key][4] = NaN; assert.throws(() => observer.read(), /Nonfinite/); assert.deepEqual(copyClosureReport(r), saved); d[key][4] = old;
    }
    const old = d.efc_id[4]; d.efc_id[4] = 999; assert.throws(() => observer.read(), /Malformed|Missing/); assert.deepEqual(copyClosureReport(r), saved); d.efc_id[4] = old;
    d.eq_active[0] = 0; assert.throws(() => observer.read(), /Malformed/); assert.deepEqual(copyClosureReport(r), saved);
    mj.mj_forward(m, d); d.eq_active[0] = 1; assert.throws(() => observer.read(), /Missing/); assert.deepEqual(copyClosureReport(r), saved);
    m.opt.enableflags = mj.mjtEnableBit.mjENBL_SLEEP.value; assert.throws(() => observer.read(), /Sleeping/); assert.deepEqual(copyClosureReport(r), saved); m.opt.enableflags = 0;
    for (const [key, replacement] of [['eq_type', mj.mjtEq.mjEQ_WELD.value], ['eq_objtype', mj.mjtObj.mjOBJ_BODY.value], ['eq_obj1id', m.eq_obj2id[0]]]) {
      const before = m[key][0]; m[key][0] = replacement; assert.throws(() => createRiderClosureObserver(mj, m, d), /rider-first/); m[key][0] = before;
    }
    observer.delete(); observer.delete(); assert.throws(() => observer.read(), /deleted/);
  } finally {observer?.delete(); d.delete(); m.delete();}
});

test('native report copies retain closure data after deletion and replay in both inspection modes', async () => {
  for (const inspect of [inspectNativePosture, inspectNativePassive]) {
    const a = await inspect(), b = await inspect(JSON.parse(JSON.stringify(a.spec)));
    assert.deepEqual(a, b); assert.ok(a.interfaceLoads.attachments.every(x => Array.isArray(x.forceOnRider)));
    a.interfaceLoads.attachments[0].rider[0] = 999; assert.notEqual(b.interfaceLoads.attachments[0].rider[0], 999);
  }
});
