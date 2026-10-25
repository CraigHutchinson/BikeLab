// Constitutive prerequisite only. No integration, soft stops or strength model.
import {constructPosture} from './rider-posture.js';

export const FORMAT = 'bikelab-rider-passive-0.1';
export const JOINTS = Object.freeze(['hip', 'knee', 'shoulder', 'elbow']);
const NATIVE = Object.freeze(['riderHip', 'riderKnee', 'riderShoulder', 'riderElbow']);
export const LOAD_STRIDE = 5; // torque, potential, positive loss power, spring torque, damping torque
const FIELDS = ['restAngle', 'stiffness', 'damping', 'minAngle', 'maxAngle'];
const TAU = 2 * Math.PI;

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error(`${label} must be a plain object.`);
  for (const key of Reflect.ownKeys(value)) if (!keys.includes(key)) throw Error(`Unknown ${label} field: ${String(key)}.`);
}
function number(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) throw Error(`${label} must be finite within [${min}, ${max}].`);
  return value;
}

const initial = constructPosture();
// Deliberately narrow, uncalibrated example. These absolute domains/rest angles
// do NOT recenter when the caller changes posture, mass or bend branch.
export const DEFAULTS = freeze({format: FORMAT, posture: initial.spec,
  joints: Object.fromEntries(JOINTS.map((name, i) => [name, {
    restAngle: initial.joints[name], stiffness: [120, 90, 25, 15][i], damping: [8, 6, 2, 1.5][i],
    minAngle: initial.joints[name] - .3, maxAngle: initial.joints[name] + .3
  }]))});

// Absolute constitutive properties can be validated without choosing a bike or
// posture. Geometry/domain compatibility is still checked by the compiler below.
export function validatePassiveJoint(name, p) {
  if (!JOINTS.includes(name)) throw Error('Unknown passive joint: ' + name);
  object(p, FIELDS, name);
  for (const field of FIELDS) if (!Object.hasOwn(p, field)) throw Error(`Incomplete ${name}: ${field}.`);
  const law = {
    restAngle: number(p.restAngle, -TAU, TAU, `${name}.restAngle`),
    stiffness: number(p.stiffness, 0, 5000, `${name}.stiffness`),
    damping: number(p.damping, 0, 500, `${name}.damping`),
    minAngle: number(p.minAngle, -TAU, TAU, `${name}.minAngle`),
    maxAngle: number(p.maxAngle, -TAU, TAU, `${name}.maxAngle`)
  };
  if (!(law.minAngle < law.maxAngle) || law.maxAngle - law.minAngle >= TAU) throw Error(`${name} needs an ordered domain narrower than 2π.`);
  if (law.restAngle < law.minAngle || law.restAngle > law.maxAngle) throw Error(`${name} restAngle is outside its domain.`);
  return Object.freeze(law);
}

export function compilePassiveRider(input = {}) {
  object(input, ['format', 'posture', 'joints'], 'passive rider');
  if (Object.hasOwn(input, 'format') && input.format !== FORMAT) throw Error('Unsupported passive rider format.');
  if (Object.hasOwn(input, 'posture') && input.posture === undefined) throw Error('Passive rider posture must be an object.');
  const posture = constructPosture(Object.hasOwn(input, 'posture') ? input.posture : DEFAULTS.posture);
  const supplied = Object.hasOwn(input, 'joints') ? input.joints : {};
  object(supplied, JOINTS, 'passive joints');
  const joints = {}, laws = [];
  for (let i = 0; i < JOINTS.length; i++) {
    const name = JOINTS[i], p = Object.hasOwn(supplied, name) ? supplied[name] : DEFAULTS.joints[name];
    const law = validatePassiveJoint(name, p);
    const angle0 = posture.joints[name];
    if (angle0 < law.minAngle || angle0 > law.maxAngle) throw Error(`${name} initial angle is outside its domain; supply an explicit law for this posture.`);
    // Keep the entire domain on the initialized nonsingular bend branch. An
    // endpoint-only sine check could admit a jump across a forbidden band.
    if (name === 'knee' || name === 'elbow') {
      const band = Math.floor(angle0 / Math.PI), margin = Math.asin(posture.spec.minBendSine);
      if (law.minAngle < band * Math.PI + margin || law.maxAngle > (band + 1) * Math.PI - margin) {
        throw Error(`${name} domain crosses the minimum-bend boundary.`);
      }
    }
    joints[name] = law;
    laws.push({...law, name, nativeName: NATIVE[i], angle0,
      springref: law.restAngle - angle0, minQ: law.minAngle - angle0, maxQ: law.maxAngle - angle0});
  }
  return freeze({spec: {format: FORMAT, posture: posture.spec, joints}, posture, laws});
}

// q and velocity are four-entry arrays in JOINTS order, not a native nv vector.
// The owner must reject/rollback an unsupported candidate before accepting it.
// No angle wrapping, tolerance extension, force clipping or state clamping.
export function passiveStateIssue(compiled, q, velocity) {
  if (!(Array.isArray(q) || q instanceof Float64Array) || !(Array.isArray(velocity) || velocity instanceof Float64Array) ||
      q.length !== 4 || velocity.length !== 4) return 'passive-rider-state-size';
  for (let i = 0; i < 4; i++) {
    if (!Number.isFinite(q[i]) || !Number.isFinite(velocity[i])) return 'passive-rider-nonfinite-state';
    const law = compiled.laws[i];
    if (q[i] < law.minQ || q[i] > law.maxQ) return `rider-${law.name}-angle-limit`;
    if (!Number.isFinite(law.damping * velocity[i] * velocity[i])) return 'passive-rider-nonfinite-load';
  }
  return null;
}

// Caller-owned storage, with no allocations on the supported evaluation path.
// These are diagnostics: native joints already own the forces and potential.
export function evaluatePassiveRider(compiled, q, velocity, out) {
  const issue = passiveStateIssue(compiled, q, velocity);
  if (issue) throw Error(issue);
  if (!(out instanceof Float64Array) || out.length !== 4 * LOAD_STRIDE || out.buffer === q.buffer || out.buffer === velocity.buffer) {
    throw Error('Passive rider output needs an independent 20-entry Float64Array.');
  }
  for (let i = 0; i < 4; i++) {
    const law = compiled.laws[i], delta = q[i] - law.springref, v = velocity[i], at = i * LOAD_STRIDE;
    const spring = -law.stiffness * delta, damping = -law.damping * v;
    out[at] = spring + damping;
    out[at + 1] = .5 * law.stiffness * delta * delta;
    out[at + 2] = law.damping * v * v;
    out[at + 3] = spring; out[at + 4] = damping;
  }
  return out;
}
