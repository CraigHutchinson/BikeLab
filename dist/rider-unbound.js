// A finite planar free-flight probe. No bike, terrain, release or continuation.
import {passiveRiderParts, RIDER_JOINTS} from './rider-native.js';
import {DEFAULTS as PASSIVE, compilePassiveRider} from './rider-passive.js';
import {createUnboundRiderObservation, createUnboundRiderObserver} from './rider-unbound-observer.js';
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
  const f = createUnboundRiderObservation(), v = () => new Float64Array(3);
  // Preserve the existing record property order as well as its values.
  return {time: f.time, q: f.q, v: f.v, com: f.com, momentum: f.momentum, angularMomentumCOM: f.angularMomentumCOM,
    segments: f.segments, energy: 0, lossPower: f.lossPower, dampingLoss: 0, energyResidual: 0, comResidual: v(), momentumResidual: v(), angularMomentumResidual: v()};
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
    const observer = createUnboundRiderObserver(mj, model, data, {passive: parts.passive, velocityBuffer});
    const {joints, bodies, mass} = observer;
    for (let i = 0; i < 7; i++) {data.qpos[joints[i].q] = spec.q[i];data.qvel[joints[i].v] = spec.v[i];}
    const current = storage(), initial = storage(), frames = Array.from({length: 6}, storage);
    const oldQ = new Float64Array(7), oldV = new Float64Array(7), oldWarm = new Float64Array(7);
    let count = 0, acceptedSteps = 0, loss = 0, termination = null;
    const summary = {steps: 0, maxCOMResidual: 0, maxMomentumResidual: 0, maxAngularMomentumResidual: 0, maxEnergyResidual: 0};
    function observe() {
      mj.mj_forward(model, data);mj.mj_energyPos(model, data);mj.mj_energyVel(model, data);
      if (data.ncon || data.nefc) return 'unsupported-unbound-contact-or-constraint';
      if (!data.qfrc_applied.every(x => x === 0) || !data.xfrc_applied.every(x => x === 0)) return 'unsupported-unbound-applied-force';
      const issue = observer.observe(current);if (issue) return issue;
      // This probe admits only rider bodies. In a shared world this native
      // energy would include the bike and must not be labelled rider energy.
      current.energy = data.energy[0] + data.energy[1];
      return Number.isFinite(current.energy) ? null : 'nonfinite-energy';
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
