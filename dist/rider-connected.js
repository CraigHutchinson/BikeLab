// Unseated passive rider ownership/observation for the connected Trail bike.
import {compilePassiveRider, passiveStateIssue, evaluatePassiveRider, LOAD_STRIDE} from './rider-passive.js';
import {SEGMENTS} from './rider-posture.js';
import {createRiderClosureObserver, createClosureStorage, storeClosure, copyClosureReport, RiderInterfaceNumericalError} from './rider-interfaces.js';

export const FORMAT = 'bikelab-connected-rider-0.1';
function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error(label + ' must be an object.');
  for (const key of Reflect.ownKeys(value)) if (!keys.includes(key)) throw Error('Unknown ' + label + ' field: ' + String(key));
}
function number(value, lo, hi, label) {
  if (!Number.isFinite(value) || value < lo || value > hi) throw Error(label + ' outside supported SI range.');
  return value;
}
function vector(value, count, lo, hi, label) {
  if (!Array.isArray(value) || value.length !== count) throw Error(label + ' needs ' + count + ' entries.');
  return Object.freeze(Array.from({length: count}, (_, i) => number(value[i], lo, hi, label)));
}
export function validateConnectedRider(input = {}) {
  object(input, ['format', 'chassis', 'passive', 'closureTime', 'maxClosureGap'], 'articulated');
  if (Object.hasOwn(input, 'format') && input.format !== FORMAT) throw Error('Unsupported connected rider format.');
  const raw = Object.hasOwn(input, 'chassis') ? input.chassis : {};
  object(raw, ['mass', 'com', 'inertia'], 'chassis');
  const c = {mass: 6, com: [0, -.15], inertia: [.35, .5, .3], ...raw};
  const chassis = Object.freeze({mass: number(c.mass, 2, 30, 'chassis mass'), com: vector(c.com, 2, -.5, .5, 'chassis COM'), inertia: vector(c.inertia, 3, .001, 20, 'chassis inertia')});
  for (let i = 0; i < 3; i++) if (chassis.inertia[i] > chassis.inertia[(i + 1) % 3] + chassis.inertia[(i + 2) % 3]) throw Error('Chassis inertia violates rigid-body triangle inequalities.');
  if (Object.hasOwn(input, 'passive') && input.passive === undefined) throw Error('Passive rider must be an object.');
  const passive = compilePassiveRider(Object.hasOwn(input, 'passive') ? input.passive : {});
  const closureTime = number(Object.hasOwn(input, 'closureTime') ? input.closureTime : .02, .005, .05, 'closure time');
  const maxClosureGap = number(Object.hasOwn(input, 'maxClosureGap') ? input.maxClosureGap : .002, .00001, .005, 'closure gap');
  return Object.freeze({format: FORMAT, chassis, passive: passive.spec, closureTime, maxClosureGap});
}

export function createRiderFrame() {
  const vector = () => new Float64Array(3);
  return {segments: SEGMENTS.map(name => ({name, proximal: vector(), distal: vector(), com: vector(), velocity: new Float64Array(6)})),
    centerOfMass: vector(), coordinates: new Float64Array(4), velocities: new Float64Array(4),
    nativeCoordinates: new Float64Array(7), nativeVelocities: new Float64Array(7),
    passiveLoads: new Float64Array(4 * LOAD_STRIDE), interfaces: createClosureStorage(),
    closureWork: 0, closureAngularImpulse: 0, momentumResidualAfterClosure: vector()};
}
export function materializeRiderFrame(f) {
  return {...f, segments: f.segments.map(s => ({name: s.name, proximal: Array.from(s.proximal), distal: Array.from(s.distal), com: Array.from(s.com), velocity: Array.from(s.velocity)})),
    centerOfMass: Array.from(f.centerOfMass), coordinates: Array.from(f.coordinates), velocities: Array.from(f.velocities), passiveLoads: Array.from(f.passiveLoads),
    nativeCoordinates: Array.from(f.nativeCoordinates), nativeVelocities: Array.from(f.nativeVelocities),
    interfaces: copyClosureReport(f.interfaces), momentumResidualAfterClosure: Array.from(f.momentumResidualAfterClosure)};
}

export function createConnectedRider(mj, model, data, specification) {
  const passive = compilePassiveRider(specification.passive), q = new Float64Array(4), velocity = new Float64Array(4), loads = new Float64Array(4 * LOAD_STRIDE);
  const id = (kind, name) => {
    const value = mj.mj_name2id(model, mj.mjtObj[kind].value, name);
    if (value < 0) throw Error('Missing connected rider object: ' + name);
    return value;
  };
  const joints = passive.laws.map(law => {const j = id('mjOBJ_JOINT', law.nativeName); return {q: model.jnt_qposadr[j], v: model.jnt_dofadr[j]};});
  const nativeJoints = ['riderX', 'riderZ', 'riderPitch'].map(name => {const j = id('mjOBJ_JOINT', name); return {q: model.jnt_qposadr[j], v: model.jnt_dofadr[j]};}).concat(joints);
  const segments = SEGMENTS.map(name => ({body: id('mjOBJ_BODY', 'rider_' + name), end: id('mjOBJ_SITE', 'rider_' + name + '_end')}));
  const observer = createRiderClosureObserver(mj, model, data);
  let nativeVelocity;
  try {nativeVelocity = new mj.DoubleBuffer(6);} catch (error) {observer.delete(); throw error;}
  let interfaces, issue = 'unobserved-rider';
  return {
    get interfaces() {return interfaces;},
    get issue() {return issue;},
    observe() {
      const positions = data.qpos, speeds = data.qvel, accelerations = data.qacc;
      for (let i = 0; i < 4; i++) {q[i] = positions[joints[i].q]; velocity[i] = speeds[joints[i].v];}
      issue = passiveStateIssue(passive, q, velocity);
      if (issue) return issue;
      for (let i = 0; i < model.nv; i++) if (!Number.isFinite(positions[i]) || !Number.isFinite(speeds[i]) || !Number.isFinite(accelerations[i])) return issue = 'nonfinite-state';
      try {interfaces = observer.read();}
      catch (error) {if (error instanceof RiderInterfaceNumericalError) return issue = 'nonfinite-rider-interface'; throw error;}
      if (interfaces.otherEqualityRows) return issue = 'unsupported-rider-equality';
      for (const a of interfaces.attachments) {
        if (!a.active) return issue = 'rider-' + a.name + '-released';
        if (Math.hypot(...a.gap) > specification.maxClosureGap) return issue = 'rider-' + a.name + '-closure-gap';
      }
      evaluatePassiveRider(passive, q, velocity, loads);
      return null;
    },
    record(out) {
      if (issue) throw Error('Cannot record unsupported rider: ' + issue);
      const positions = data.xpos, sites = data.site_xpos, centers = data.xipos, masses = model.body_mass;
      out.centerOfMass.fill(0);
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i], f = out.segments[i];
        mj.mj_objectVelocity(model, data, mj.mjtObj.mjOBJ_BODY.value, s.body, nativeVelocity, 0);
        f.velocity.set(nativeVelocity.GetView());
        for (let k = 0; k < 3; k++) {
          f.proximal[k] = positions[3 * s.body + k]; f.distal[k] = sites[3 * s.end + k]; f.com[k] = centers[3 * s.body + k];
          out.centerOfMass[k] += masses[s.body] * f.com[k] / passive.spec.posture.riderMass;
        }
      }
      const positionsQ = data.qpos, speeds = data.qvel;
      for (let i = 0; i < nativeJoints.length; i++) {out.nativeCoordinates[i] = positionsQ[nativeJoints[i].q]; out.nativeVelocities[i] = speeds[nativeJoints[i].v];}
      out.coordinates.set(q); out.velocities.set(velocity); out.passiveLoads.set(loads); storeClosure(interfaces, out.interfaces);
    },
    delete() {nativeVelocity.delete(); observer.delete();}
  };
}
