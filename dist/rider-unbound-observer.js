// Rider-scoped observation of an already-forwarded native world. This helper
// borrows model/data/velocityBuffer: it never steps, forwards, resets, or frees
// them. The world owner supplies force/contact admission and energy accounting.
import {RIDER_JOINTS} from './rider-native.js';
import {SEGMENTS} from './rider-posture.js';
import {passiveStateIssue} from './rider-passive.js';

export const UNBOUND_RIDER_BINDING = Object.freeze({
  jointNames: RIDER_JOINTS,
  bodyNames: Object.freeze(SEGMENTS.map(name => 'rider_' + name)),
  endSiteNames: Object.freeze(SEGMENTS.map(name => 'rider_' + name + '_end'))
});
export function createUnboundRiderObservation() {
  const v = () => new Float64Array(3);
  return {time: 0, q: new Float64Array(7), v: new Float64Array(7), com: v(), momentum: v(), angularMomentumCOM: v(),
    segments: SEGMENTS.map(name => ({name, proximal: v(), distal: v(), com: v(), velocity: new Float64Array(6)})), lossPower: 0};
}

export function createUnboundRiderObserver(mj, model, data, {passive, velocityBuffer, binding = UNBOUND_RIDER_BINDING}) {
  if (velocityBuffer.GetView().length !== 6) throw Error('Unbound rider needs a six-value borrowed velocity buffer.');
  const names = (key, length) => {
    const a = binding?.[key];
    if (!Array.isArray(a) || a.length !== length || a.some(n => typeof n !== 'string' || !n.length) || new Set(a).size !== length) throw Error('Invalid unbound rider binding: ' + key);
    return [...a];
  };
  const bodyNames = names('bodyNames', 5), endNames = names('endSiteNames', 5), jointNames = names('jointNames', 7);
  const id = (kind, name) => {const n = mj.mj_name2id(model, mj.mjtObj[kind].value, name);if (n < 0) throw Error('Missing unbound native object: ' + name);return n;};
  const bodies = SEGMENTS.map((name, i) => Object.freeze({name, id: id('mjOBJ_BODY', bodyNames[i]), end: id('mjOBJ_SITE', endNames[i])}));
  const joints = jointNames.map((name, i) => {
    const j = id('mjOBJ_JOINT', name), expected = i < 2 ? mj.mjtJoint.mjJNT_SLIDE.value : mj.mjtJoint.mjJNT_HINGE.value;
    if (model.jnt_type[j] !== expected) throw Error('Unsupported unbound joint type.');
    const owner = [0, 0, 0, 1, 2, 3, 4][i];
    if (model.jnt_bodyid[j] !== bodies[owner].id) throw Error('Unbound joint belongs to another body.');
    if (j !== model.body_jntadr[bodies[owner].id] + (i < 3 ? i : 0)) throw Error('Unsupported unbound joint order.');
    return Object.freeze({q: model.jnt_qposadr[j], v: model.jnt_dofadr[j]});
  });
  const parents = [-1, 0, 1, 0, 3], owned = new Set(bodies.map(b => b.id));
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (model.body_parentid[b.id] !== (i ? bodies[parents[i]].id : 0)) throw Error('Unsupported unbound body tree; trunk must be world-rooted.');
    if (model.body_jntnum[b.id] !== (i ? 1 : 3)) throw Error('Unsupported unbound body joint count.');
    if (model.site_bodyid[b.end] !== b.id) throw Error('Unbound endpoint belongs to another body.');
  }
  for (let i = 1; i < model.nbody; i++) if (owned.has(model.body_parentid[i]) && !owned.has(i)) throw Error('Unbound rider has an unowned child body.');
  const mass = bodies.reduce((sum, b) => sum + model.body_mass[b.id], 0);
  if (Math.abs(mass - passive.spec.posture.riderMass) > 1e-10) throw Error('Unbound rider mass mismatch.');
  const limbQ = new Float64Array(4), limbV = new Float64Array(4);
  function observe(out) {
    if (!Number.isFinite(data.time)) return 'nonfinite-state';
    const q = data.qpos, v = data.qvel, a = data.qacc;
    for (let i = 0; i < 7; i++) {
      out.q[i] = q[joints[i].q];out.v[i] = v[joints[i].v];
      if (!Number.isFinite(out.q[i]) || !Number.isFinite(out.v[i]) || !Number.isFinite(a[joints[i].v])) return 'nonfinite-state';
      if (Math.abs(out.q[i]) > 10 || Math.abs(out.v[i]) > 10) return 'unbound-coordinate-or-rate-limit';
      if (i >= 3) {limbQ[i - 3] = out.q[i];limbV[i - 3] = out.v[i];}
    }
    if (Math.abs(out.q[2]) > Math.PI) return 'unbound-pitch-deviation-limit';
    const issue = passiveStateIssue(passive, limbQ, limbV);if (issue) return issue;
    const root = 3 * bodies[0].id;
    if (Math.abs(data.xpos[root]) > 10 || Math.abs(data.xpos[root + 2]) > 10) return 'unbound-world-hip-limit';
    out.time = data.time;out.lossPower = 0;
    for (let i = 0; i < 4; i++) out.lossPower += passive.laws[i].damping * limbV[i] ** 2;
    if (!Number.isFinite(out.lossPower)) return 'nonfinite-energy';
    out.com.fill(0);out.momentum.fill(0);out.angularMomentumCOM.fill(0);
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i], f = out.segments[i];
      mj.mj_objectVelocity(model, data, mj.mjtObj.mjOBJ_BODY.value, b.id, velocityBuffer, 0);
      f.velocity.set(velocityBuffer.GetView());
      // Native views are consumed before the next native call.
      const positions = data.xpos, sites = data.site_xpos, centers = data.xipos, R = data.ximat, I = model.body_inertia, m = model.body_mass[b.id];
      for (let k = 0; k < 3; k++) {
        f.proximal[k] = positions[3 * b.id + k];f.distal[k] = sites[3 * b.end + k];f.com[k] = centers[3 * b.id + k];
        if (!Number.isFinite(f.proximal[k]) || !Number.isFinite(f.distal[k]) || !Number.isFinite(f.com[k]) || !Number.isFinite(f.velocity[k]) || !Number.isFinite(f.velocity[k + 3])) return 'nonfinite-observation';
        out.com[k] += m * f.com[k] / mass;out.momentum[k] += m * f.velocity[k + 3];
      }
      if (Math.abs(f.com[1]) > 1e-10 || Math.abs(f.velocity[0]) > 1e-10 || Math.abs(f.velocity[2]) > 1e-10 || Math.abs(f.velocity[4]) > 1e-10) return 'unbound-planarity-limit';
      for (let k = 0; k < 3; k++) {
        let w = 0;for (let axis = 0; axis < 3; axis++) w += R[9 * b.id + 3 * axis + k] * f.velocity[axis];
        for (let axis = 0; axis < 3; axis++) out.angularMomentumCOM[axis] += R[9 * b.id + 3 * axis + k] * I[3 * b.id + k] * w;
      }
    }
    for (let i = 0; i < bodies.length; i++) {
      const f = out.segments[i], m = model.body_mass[bodies[i].id];
      for (let axis = 0; axis < 3; axis++) {
        const j = (axis + 1) % 3, k = (axis + 2) % 3;
        out.angularMomentumCOM[axis] += m * ((f.com[j] - out.com[j]) * (f.velocity[k + 3] - out.momentum[k] / mass) - (f.com[k] - out.com[k]) * (f.velocity[j + 3] - out.momentum[j] / mass));
      }
    }
    return null;
  }
  return Object.freeze({mass, bodies: Object.freeze(bodies), joints: Object.freeze(joints), observe});
}
