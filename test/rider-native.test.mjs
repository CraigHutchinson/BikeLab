import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS, constructPosture} from '../dist/rider-posture.js';
import {RIDER_JOINTS, CLOSURE, riderParts, nativePostureXML, inspectNativePosture} from '../dist/rider-native.js';
import {getRuntime} from '../dist/moving-wheel.js';

const near = (actual, expected, budget = 1e-10) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= budget,
  `${actual} vs ${expected} (budget ${budget})`);
const vectorNear = (a, b, budget) => {assert.equal(a.length, b.length); a.forEach((v, i) => near(v, b[i], budget));};
const variants = [{}, {riderMass: 35, kneeSide: -1, elbowSide: 1},
  {segments: {trunk: {...DEFAULTS.segments.trunk, comFraction: .73, inertiaPerMass: [.04, .06, .03]}}}];
const xz = p => [p[0], 0, p[1]];

function tools(mj, model) {
  const id = (kind, name) => {const v = mj.mj_name2id(model, mj.mjtObj[kind].value, name); assert.ok(v >= 0, name); return v;};
  return {id, joint: name => model.jnt_dofadr[id('mjOBJ_JOINT', name)],
    site: (data, name) => Array.from(data.site_xpos.subarray(3 * id('mjOBJ_SITE', name), 3 * id('mjOBJ_SITE', name) + 3))};
}

test('native rider owns five masses, seven zero-reference coordinates and feasible named closures', async () => {
  for (const input of variants) {
    const p = constructPosture(input), r = await inspectNativePosture(input);
    assert.equal(r.dofs.length, 10); assert.equal(r.equalityRows, 6);
    assert.deepEqual(r.dofs.slice(3).map(j => j.name), RIDER_JOINTS);
    assert.ok(r.qpos.every(q => q === 0));
    near(r.aggregate.mass, p.aggregate.mass); vectorNear(r.aggregate.com, xz(p.aggregate.com));
    vectorNear(r.aggregate.inertiaCOM, p.aggregate.inertiaCOM);
    for (let i = 0; i < p.bodies.length; i++) {
      const a = r.segments[i], b = p.bodies[i];
      near(a.mass, b.mass); vectorNear(a.proximal, xz(b.proximal)); vectorNear(a.distal, xz(b.distal));
      vectorNear(a.com, xz(b.com)); vectorNear(a.inertiaCOM, b.inertiaFrame);
    }
    for (const a of r.attachments) {vectorNear(a.gap, [0, 0, 0]); vectorNear(a.residual, a.gap);}
    assert.deepEqual(await inspectNativePosture(JSON.parse(JSON.stringify(r.spec))), r);
  }
  await assert.rejects(inspectNativePosture({foot: DEFAULTS.hip}), /Leg chain/);
});

test('native closure rank is four and Jacobians agree with independent endpoint differences and rigid launch', async () => {
  const mj = await getRuntime();
  for (const input of variants) for (const pitch of [0, .31]) for (const storage of ['dense', 'sparse']) {
    const model = mj.MjModel.from_xml_string(nativePostureXML(input).replace('jacobian="sparse"', `jacobian="${storage}"`)), data = new mj.MjData(model), velocity = new mj.DoubleBuffer(6);
    try {
      const t = tools(mj, model), p = constructPosture(input);
      data.qpos[t.joint('travel')] = .27; data.qpos[t.joint('heave')] = -.19; data.qpos[t.joint('pitch')] = pitch;
      data.qvel[t.joint('travel')] = .8; data.qvel[t.joint('heave')] = -.4; data.qvel[t.joint('pitch')] = .7;
      mj.mj_forward(model, data);
      assert.equal(data.nefc, 6);
      for (let eq = 0; eq < model.neq; eq++) {
        vectorNear(Array.from(model.eq_solref.subarray(2 * eq, 2 * eq + 2)), CLOSURE.solref, 0);
        vectorNear(Array.from(model.eq_solimp.subarray(5 * eq, 5 * eq + 5)), CLOSURE.solimp, 0);
      }
      const start = Array.from(data.qpos), rowCopies = {};
      for (const name of ['hand', 'foot']) {
        const eq = t.id('mjOBJ_EQUALITY', `rider_${name}_closure`), rows = [];
        for (let i = 0; i < data.nefc; i++) if (data.efc_id[i] === eq) {
          assert.equal(data.efc_type[i], mj.mjtConstraint.mjCNSTR_EQUALITY.value);
          const row = Array(model.nv).fill(0);
          if (mj.mj_isSparse(model)) {
            const start = data.efc_J_rowadr[i];
            for (let k = start; k < start + data.efc_J_rownnz[i]; k++) row[data.efc_J_colind[k]] = data.efc_J[k];
          } else for (let k = 0; k < model.nv; k++) row[k] = data.efc_J[i * model.nv + k];
          rows.push(row);
          near(data.efc_vel[i], 0);
        }
        assert.equal(rows.length, 3); vectorNear(rows[1], Array(model.nv).fill(0), 1e-12); rowCopies[name] = rows;
        // Four independent columns: arm joints cannot move the foot; leg joints cannot move the hand.
        const own = name === 'hand' ? ['riderShoulder', 'riderElbow'] : ['riderHip', 'riderKnee'];
        const other = name === 'hand' ? ['riderHip', 'riderKnee'] : ['riderShoulder', 'riderElbow'];
        for (const j of other) {near(rows[0][t.joint(j)], 0, 1e-12); near(rows[2][t.joint(j)], 0, 1e-12);}
        const a = t.joint(own[0]), b = t.joint(own[1]);
        const determinant = rows[0][a] * rows[2][b] - rows[0][b] * rows[2][a];
        const [l1, l2, angle] = name === 'hand' ? [p.spec.segments.upperArms.length, p.spec.segments.forearmsHands.length, p.joints.elbow]
          : [p.spec.segments.thighs.length, p.spec.segments.shanksFeet.length, p.joints.knee];
        near(determinant / (l1 * l2), -Math.sin(angle));
        assert.ok(Math.abs(determinant / (l1 * l2)) >= p.spec.minBendSine);
      }
      if (pitch === 0) {
        const report = await inspectNativePosture(input);
        for (const a of report.attachments) for (let axis = 0; axis < 3; axis++) vectorNear(a.jacobian[axis], rowCopies[a.name][axis]);
      }
      // Every COM has the same rigid twist, with no duplicated rider root velocity.
      for (let b = 1; b < model.nbody; b++) {
        mj.mj_objectVelocity(model, data, mj.mjtObj.mjOBJ_BODY.value, b, velocity, 0);
        const x = data.xipos[3 * b] - start[0], z = data.xipos[3 * b + 2] - start[1];
        vectorNear(Array.from(velocity.GetView()), [0, .7, 0, .8 + .7 * z, 0, -.4 - .7 * x]);
      }
      // Native constraints and independent finite differences include the frame columns.
      const epsilon = 1e-6;
      for (let column = 0; column < model.nq; column++) {
        const gaps = [];
        for (const sign of [-1, 1]) {
          data.qpos.set(start); data.qpos[column] += sign * epsilon; mj.mj_forward(model, data);
          gaps.push(Object.fromEntries(['hand', 'foot'].map(name => [name,
            t.site(data, 'rider_' + name).map((x, i) => x - t.site(data, 'bike_' + name)[i])])));
        }
        for (const name of ['hand', 'foot']) for (let axis = 0; axis < 3; axis++) {
          near((gaps[1][name][axis] - gaps[0][name][axis]) / (2 * epsilon), rowCopies[name][axis][column], 1e-8);
        }
      }
      // Reference-root slide names mean frame x/z, not trunk-tilted x/z.
      for (const [joint, direction] of [['riderX', [Math.cos(pitch), 0, -Math.sin(pitch)]], ['riderZ', [Math.sin(pitch), 0, Math.cos(pitch)]]]) {
        data.qpos.set(start); mj.mj_forward(model, data); const before = t.site(data, 'rider_trunk_end');
        data.qpos[t.joint(joint)] += .01; mj.mj_forward(model, data);
        vectorNear(t.site(data, 'rider_trunk_end').map((v, i) => v - before[i]), direction.map(x => .01 * x));
      }
    } finally {velocity.delete(); data.delete(); model.delete();}
  }
});

test('locked native segments match one independently aggregated rigid rider in mass matrix, bias and energy', async () => {
  const mj = await getRuntime();
  for (const input of variants) {
    const parts = riderParts(input), {mass, com, inertiaCOM: I} = parts.posture.aggregate;
    const base = nativePostureXML(input).replace(/<equality>.*?<\/equality>/, '');
    const lockedXML = base.replace(/<joint name="(rider[^"]+)"[^>]*\/>/g, (match, name) => RIDER_JOINTS.includes(name) ? '' : match);
    const aggregateXML = base.replace(parts.body, `<body name="matchedRider"><inertial pos="${com[0]} 0 ${com[1]}" mass="${mass}" fullinertia="${[I[0], I[4], I[8], I[1], I[2], I[5]].join(' ')}"/></body>`);
    const a = mj.MjModel.from_xml_string(lockedXML), b = mj.MjModel.from_xml_string(aggregateXML), da = new mj.MjData(a), db = new mj.MjData(b);
    try {
      assert.equal(a.nv, 3); assert.equal(b.nv, 3);
      for (const pitch of [0, -.27, .31]) {
        for (const d of [da, db]) {d.qpos.set([.21, .9, pitch]); d.qvel.set([.8, -.4, .7]);}
        for (const [m, d] of [[a, da], [b, db]]) {mj.mj_forward(m, d); mj.mj_energyPos(m, d); mj.mj_energyVel(m, d);}
        for (const key of ['M', 'qfrc_bias', 'energy']) {
          assert.equal(da[key].length, db[key].length);
          for (let i = 0; i < da[key].length; i++) near(da[key][i], db[key][i], 1e-9 * Math.max(1, Math.abs(db[key][i])));
        }
        near(a.body_subtreemass[1], 12 + mass); near(b.body_subtreemass[1], 12 + mass);
        vectorNear(Array.from(da.subtree_com.subarray(3, 6)), Array.from(db.subtree_com.subarray(3, 6)));
      }
    } finally {db.delete(); da.delete(); b.delete(); a.delete();}
  }
});

