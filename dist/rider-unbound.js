// A finite planar free-flight probe. No bike, terrain, release or continuation.
import {passiveRiderParts, RIDER_JOINTS} from './rider-native.js';
import {DEFAULTS as PASSIVE, compilePassiveRider, passiveStateIssue} from './rider-passive.js';
import {SEGMENTS} from './rider-posture.js';
import {getRuntime} from './moving-wheel.js';
import {NATIVE_BUILD} from './trail-initial-state.js';

export const FORMAT = 'bikelab-rider-unbound-0.1';
export const INPUT_FORMAT = 'bikelab-rider-unbound-input-0.1';
export const DURATION = .02, SAMPLE_DT = .005;
export const TIMESTEPS = Object.freeze([.00003125, .000015625, .0000078125]);
function freeze(value) {
  if (value && typeof value === 'object') {for (const child of Object.values(value)) freeze(child);Object.freeze(value);}
  return value;
}
export const DEFAULTS = freeze({format: INPUT_FORMAT, passive: PASSIVE,
  q: [.3, 1, .15, .05, -.04, .03, -.02], v: [.7, .2, .3, .2, -.15, .1, -.08], gravity: 9.80665, dt: TIMESTEPS[0]});
function finite(value, lo, hi, label) {
  if (!Number.isFinite(value) || value < lo || value > hi) throw Error(label + ' outside supported SI range.');
  return value;
}
export function validateUnbound(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw Error('Unbound specification must be a plain object.');
  for (const key of Reflect.ownKeys(input)) {
    if (!Object.hasOwn(DEFAULTS, key)) throw Error('Unknown unbound field: ' + String(key));
    const d = Object.getOwnPropertyDescriptor(input, key);
    if (!d.enumerable || !Object.hasOwn(d, 'value') || d.value === undefined) throw Error('Unbound fields must be defined data properties.');
  }
  const s = {...DEFAULTS, ...input};
  if (s.format !== INPUT_FORMAT) throw Error('Unsupported unbound input format.');
  if (!TIMESTEPS.includes(s.dt)) throw Error('Unsupported unbound timestep.');
  const vector = (a, label) => {
    if (!Array.isArray(a) || a.length !== 7) throw Error(label + ' needs seven numbers in RIDER_JOINTS order.');
    return Array.from({length: 7}, (_, i) => finite(a[i], -10, 10, label + '[' + i + ']'));
  };
  return freeze({format: INPUT_FORMAT, passive: compilePassiveRider(s.passive).spec, q: vector(s.q, 'q'), v: vector(s.v, 'v'),
    gravity: finite(s.gravity, 0, 15, 'gravity'), dt: s.dt});
}
export function unboundExample(name = 'spin') {
  if (!['translation', 'spin', 'zero-gravity', 'joint-limit', 'initial-rejection'].includes(name)) throw Error('Unknown unbound example.');
  const s = structuredClone(DEFAULTS);
  if (name === 'translation') {s.q.fill(0);s.v = [.7, .2, 0, 0, 0, 0, 0];}
  if (name === 'zero-gravity') s.gravity = 0;
  if (name === 'joint-limit' || name === 'initial-rejection') {s.q.fill(0);s.v.fill(0);s.q[6] = name === 'joint-limit' ? -.299 : -.301;s.v[6] = -1;}
  return s;
}

function storage() {
  const v = () => new Float64Array(3);
  return {time: 0, q: new Float64Array(7), v: new Float64Array(7), com: v(), momentum: v(), angularMomentumCOM: v(),
    segments: SEGMENTS.map(name => ({name, proximal: v(), distal: v(), com: v(), velocity: new Float64Array(6)})),
    energy: 0, lossPower: 0, dampingLoss: 0, energyResidual: 0, comResidual: v(), momentumResidual: v(), angularMomentumResidual: v()};
}
function copyFrame(a, b) {
  for (const k of ['time', 'energy', 'lossPower', 'dampingLoss', 'energyResidual']) b[k] = a[k];
  for (const k of ['q', 'v', 'com', 'momentum', 'angularMomentumCOM', 'comResidual', 'momentumResidual', 'angularMomentumResidual']) b[k].set(a[k]);
  for (let i = 0; i < a.segments.length; i++) for (const k of ['proximal', 'distal', 'com', 'velocity']) b.segments[i][k].set(a.segments[i][k]);
}
function materialize(value) {
  if (ArrayBuffer.isView(value)) return Array.from(value);
  if (Array.isArray(value)) return value.map(materialize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, materialize(v)]));
  return value;
}

export async function runUnbound(input = {}, onProgress) {
  const spec = validateUnbound(input), parts = passiveRiderParts(spec.passive), steps = Math.round(DURATION / spec.dt), stride = Math.round(SAMPLE_DT / spec.dt);
  const progress = (phase, acceptedSteps) => {if (onProgress) onProgress({phase, acceptedSteps, totalSteps: steps, dt: spec.dt});};
  progress('preparing', 0);
  const mj = await getRuntime();
  const xml = `<mujoco model="BikeLab unbound rider"><compiler angle="radian"/><option timestep="${spec.dt}" gravity="0 0 -${spec.gravity}" integrator="implicitfast"><flag autoreset="disable"/></option><worldbody>${parts.body}</worldbody></mujoco>`;
  let model, data, velocityBuffer;
  try {
    model = mj.MjModel.from_xml_string(xml);data = new mj.MjData(model);velocityBuffer = new mj.DoubleBuffer(6);
    if (model.nq !== 7 || model.nv !== 7 || model.njnt !== 7 || model.nbody !== 6 || model.neq || model.ngeom || model.nflex || model.na || model.nu || model.nmocap || model.nplugin) throw Error('Unsupported unbound native topology.');
    const id = (kind, name) => {const n = mj.mj_name2id(model, mj.mjtObj[kind].value, name);if (n < 0) throw Error('Missing unbound native object: ' + name);return n;};
    const joints = RIDER_JOINTS.map((name, i) => {
      const j = id('mjOBJ_JOINT', name), expected = i < 2 ? mj.mjtJoint.mjJNT_SLIDE.value : mj.mjtJoint.mjJNT_HINGE.value;
      if (model.jnt_type[j] !== expected) throw Error('Unsupported unbound joint type.');
      return {q: model.jnt_qposadr[j], v: model.jnt_dofadr[j]};
    });
    const bodies = SEGMENTS.map(name => ({name, id: id('mjOBJ_BODY', 'rider_' + name), end: id('mjOBJ_SITE', 'rider_' + name + '_end')}));
    if (model.body_parentid[bodies[0].id] !== 0) throw Error('Unbound rider must be world-rooted.');
    const mass = bodies.reduce((sum, b) => sum + model.body_mass[b.id], 0);
    if (Math.abs(mass - spec.passive.posture.riderMass) > 1e-10) throw Error('Unbound rider mass mismatch.');
    for (let i = 0; i < 7; i++) {data.qpos[joints[i].q] = spec.q[i];data.qvel[joints[i].v] = spec.v[i];}
    const current = storage(), initial = storage(), frames = Array.from({length: 6}, storage);
    const limbQ = current.q.subarray(3), limbV = current.v.subarray(3);
    const oldQ = new Float64Array(7), oldV = new Float64Array(7), oldWarm = new Float64Array(7);
    let count = 0, acceptedSteps = 0, loss = 0, termination = null;
    const summary = {steps: 0, maxCOMResidual: 0, maxMomentumResidual: 0, maxAngularMomentumResidual: 0, maxEnergyResidual: 0};
    function observe() {
      mj.mj_forward(model, data);mj.mj_energyPos(model, data);mj.mj_energyVel(model, data);
      if (data.ncon || data.nefc) return 'unsupported-unbound-contact-or-constraint';
      if (!data.qfrc_applied.every(x => x === 0) || !data.xfrc_applied.every(x => x === 0)) return 'unsupported-unbound-applied-force';
      if (!Number.isFinite(data.time)) return 'nonfinite-state';
      const q = data.qpos, v = data.qvel, a = data.qacc;
      for (let i = 0; i < 7; i++) {
        current.q[i] = q[joints[i].q];current.v[i] = v[joints[i].v];
        if (!Number.isFinite(current.q[i]) || !Number.isFinite(current.v[i]) || !Number.isFinite(a[joints[i].v])) return 'nonfinite-state';
        if (Math.abs(current.q[i]) > 10 || Math.abs(current.v[i]) > 10) return 'unbound-coordinate-or-rate-limit';
      }
      if (Math.abs(current.q[2]) > Math.PI) return 'unbound-pitch-deviation-limit';
      const issue = passiveStateIssue(parts.passive, limbQ, limbV);if (issue) return issue;
      const root = 3 * bodies[0].id;
      if (Math.abs(data.xpos[root]) > 10 || Math.abs(data.xpos[root + 2]) > 10) return 'unbound-world-hip-limit';
      current.time = data.time;current.energy = data.energy[0] + data.energy[1];current.lossPower = 0;
      for (let i = 0; i < 4; i++) current.lossPower += parts.passive.laws[i].damping * limbV[i] ** 2;
      if (!Number.isFinite(current.energy) || !Number.isFinite(current.lossPower)) return 'nonfinite-energy';
      current.com.fill(0);current.momentum.fill(0);current.angularMomentumCOM.fill(0);
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i], f = current.segments[i];
        mj.mj_objectVelocity(model, data, mj.mjtObj.mjOBJ_BODY.value, b.id, velocityBuffer, 0);
        f.velocity.set(velocityBuffer.GetView());
        // These views expire before the next native call.
        const positions = data.xpos, sites = data.site_xpos, centers = data.xipos, R = data.ximat, I = model.body_inertia, m = model.body_mass[b.id];
        for (let k = 0; k < 3; k++) {
          f.proximal[k] = positions[3 * b.id + k];f.distal[k] = sites[3 * b.end + k];f.com[k] = centers[3 * b.id + k];
          if (!Number.isFinite(f.proximal[k]) || !Number.isFinite(f.distal[k]) || !Number.isFinite(f.com[k]) || !Number.isFinite(f.velocity[k]) || !Number.isFinite(f.velocity[k + 3])) return 'nonfinite-observation';
          current.com[k] += m * f.com[k] / mass;current.momentum[k] += m * f.velocity[k + 3];
        }
        if (Math.abs(f.com[1]) > 1e-10 || Math.abs(f.velocity[0]) > 1e-10 || Math.abs(f.velocity[2]) > 1e-10 || Math.abs(f.velocity[4]) > 1e-10) return 'unbound-planarity-limit';
        // World I*omega, independent of native principal-axis permutation.
        for (let k = 0; k < 3; k++) {
          let w = 0;for (let axis = 0; axis < 3; axis++) w += R[9 * b.id + 3 * axis + k] * f.velocity[axis];
          for (let axis = 0; axis < 3; axis++) current.angularMomentumCOM[axis] += R[9 * b.id + 3 * axis + k] * I[3 * b.id + k] * w;
        }
      }
      for (let i = 0; i < bodies.length; i++) {
        const f = current.segments[i], m = model.body_mass[bodies[i].id];
        for (let axis = 0; axis < 3; axis++) {
          const j = (axis + 1) % 3, k = (axis + 2) % 3;
          current.angularMomentumCOM[axis] += m * ((f.com[j] - current.com[j]) * (f.velocity[k + 3] - current.momentum[k] / mass) - (f.com[k] - current.com[k]) * (f.velocity[j + 3] - current.momentum[j] / mass));
        }
      }
      return null;
    }
    function residuals(candidateLoss) {
      current.dampingLoss = candidateLoss;current.energyResidual = current.energy - initial.energy + candidateLoss;
      for (let k = 0; k < 3; k++) {
        const gravity = k === 2 ? spec.gravity : 0;
        current.comResidual[k] = current.com[k] - initial.com[k] - initial.momentum[k] / mass * current.time + .5 * gravity * current.time ** 2;
        current.momentumResidual[k] = current.momentum[k] - initial.momentum[k] + mass * gravity * current.time;
        current.angularMomentumResidual[k] = current.angularMomentumCOM[k] - initial.angularMomentumCOM[k];
      }
      return Number.isFinite(current.energyResidual) && current.comResidual.every(Number.isFinite) && current.momentumResidual.every(Number.isFinite) && current.angularMomentumResidual.every(Number.isFinite);
    }
    const report = {format: FORMAT, engine: 'MuJoCo 3.16.0', nativeBuild: NATIVE_BUILD, spec, duration: DURATION, sampleDt: SAMPLE_DT,
      scope: 'Authored planar unbound free flight only; no bike, ground, collision, live release, recontact, continuation or anatomical calibration. Custom-input accuracy is not established by passing guards.',
      coordinates: 'SI, world xyz. q/v order: ' + RIDER_JOINTS.join(', ') + '. Root translations offset the authored hip; pitch and limb angles deviate from the authored posture. Segment velocity is world angular xyz then COM linear xyz. Angular momentum is about whole-rider COM.',
      mass, bodyMasses: bodies.map(b => ({name: b.name, mass: model.body_mass[b.id]}))};
    const initialIssue = observe() || (data.time !== 0 ? 'unbound-clock-reset' : null);
    if (initialIssue) {progress('finalizing', 0);return {...report, status: 'initial-state-rejected', termination: {reason: initialIssue, time: 0, attemptedTime: 0}, summary, frames: []};}
    copyFrame(current, initial);residuals(0);copyFrame(current, frames[count++]);progress('integrating', 0);
    for (let step = 1; step <= steps; step++) {
      oldQ.set(data.qpos);oldV.set(data.qvel);oldWarm.set(data.qacc_warmstart);
      const time = data.time, oldLossPower = current.lossPower;
      mj.mj_step(model, data);
      let reason = observe();
      if (!reason && Math.abs(data.time - time - spec.dt) > 1e-12) reason = 'unbound-clock-reset';
      if (!reason) for (const j of joints) if (Math.abs(data.qpos[j.q] - oldQ[j.q]) > .01) {reason = 'unbound-step-resolution-limit';break;}
      const candidateLoss = loss + .5 * spec.dt * (oldLossPower + current.lossPower);
      if (!reason && !residuals(candidateLoss)) reason = 'nonfinite-accounting';
      if (reason) {
        termination = {reason, time, attemptedTime: time + spec.dt};
        data.qpos.set(oldQ);data.qvel.set(oldV);data.qacc_warmstart.set(oldWarm);data.time = time;
        data.qfrc_applied.fill(0);data.xfrc_applied.fill(0);
        const restoredIssue = observe();if (restoredIssue || !residuals(loss)) throw Error('Unbound rollback failed: ' + (restoredIssue ?? 'accounting'));
        break;
      }
      loss = candidateLoss;acceptedSteps = step;summary.steps = step;
      summary.maxEnergyResidual = Math.max(summary.maxEnergyResidual, Math.abs(current.energyResidual));
      for (let k = 0; k < 3; k++) {
        summary.maxCOMResidual = Math.max(summary.maxCOMResidual, Math.abs(current.comResidual[k]));
        summary.maxMomentumResidual = Math.max(summary.maxMomentumResidual, Math.abs(current.momentumResidual[k]));
        summary.maxAngularMomentumResidual = Math.max(summary.maxAngularMomentumResidual, Math.abs(current.angularMomentumResidual[k]));
      }
      if (step % stride === 0) {copyFrame(current, frames[count++]);progress('integrating', step);}
    }
    if (Math.abs(frames[count - 1].time - current.time) > 1e-12) copyFrame(current, frames[count++]);
    progress('finalizing', acceptedSteps);
    return {...report, status: termination ? 'terminated' : 'completed', termination, summary, frames: frames.slice(0, count).map(materialize)};
  } finally {velocityBuffer?.delete();data?.delete();model?.delete();}
}
