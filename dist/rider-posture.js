// Construction prerequisite only: no active rider, native constraints or dynamics.
// SI, frame-local x forward / y left / z up. Angles rotate about +y.
export const FORMAT = 'bikelab-rider-posture-0.1';
export const SEGMENTS = Object.freeze(['trunk', 'thighs', 'shanksFeet', 'upperArms', 'forearmsHands']);

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

// Explicit solid-cylinder proxies, not anthropometric coefficients. Local +z
// runs from proximal to distal. Paired limbs are single aggregate bodies.
function cylinder(massFraction, length, radius) {
  const transverse = (3 * radius ** 2 + length ** 2) / 12;
  return {massFraction, length, comFraction: .5,
    inertiaPerMass: [transverse, transverse, radius ** 2 / 2]};
}

export const DEFAULTS = freeze({
  format: FORMAT,
  riderMass: 70,
  hip: [-.15, .25],
  trunkPitch: .55,
  hand: [.45, .32],
  foot: [0, -.30],
  elbowSide: -1,
  kneeSide: 1,
  minBendSine: .05,
  segments: {
    trunk: cylinder(.60, .55, .12),
    thighs: cylinder(.20, .43, .08),
    shanksFeet: cylinder(.10, .43, .07),
    upperArms: cylinder(.055, .30, .05),
    forearmsHands: cylinder(.045, .30, .04)
  }
});

function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw Error(`${label} must be a plain object.`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (!keys.includes(key)) throw Error(`Unknown ${label} field: ${String(key)}.`);
  }
}

function number(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw Error(`${label} must be finite within [${min}, ${max}].`);
  }
  return value;
}

function vector(value, count, min, max, label) {
  if (!Array.isArray(value) || value.length !== count) throw Error(`${label} needs ${count} numbers.`);
  return Array.from({length: count}, (_, i) => number(value[i], min, max, `${label}[${i}]`));
}

export function validatePosture(input = {}) {
  object(input, Object.keys(DEFAULTS), 'posture');
  const p = {...DEFAULTS, ...input};
  if (p.format !== FORMAT) throw Error('Unsupported rider posture format.');
  number(p.riderMass, 20, 100, 'riderMass');
  number(p.trunkPitch, -Math.PI, Math.PI, 'trunkPitch');
  number(p.minBendSine, .001, .95, 'minBendSine');
  for (const key of ['elbowSide', 'kneeSide']) {
    if (p[key] !== -1 && p[key] !== 1) throw Error(`${key} must be -1 or 1.`);
  }
  for (const key of ['hip', 'hand', 'foot']) p[key] = vector(p[key], 2, -2, 2, key);
  const supplied = Object.hasOwn(input, 'segments') ? input.segments : {};
  object(supplied, SEGMENTS, 'segments');
  p.segments = {};
  let fraction = 0;
  for (const key of SEGMENTS) {
    const s = Object.hasOwn(supplied, key) ? supplied[key] : DEFAULTS.segments[key];
    object(s, Object.keys(DEFAULTS.segments[key]), key);
    // A supplied segment must be complete: changing its length cannot silently
    // reuse the default COM or inertia as if they were derived measurements.
    for (const field of Object.keys(DEFAULTS.segments[key])) {
      if (!Object.hasOwn(s, field)) throw Error(`Incomplete ${key}: ${field}.`);
    }
    const massFraction = number(s.massFraction, .001, 1, `${key}.massFraction`);
    const length = number(s.length, .1, 1.2, `${key}.length`);
    const comFraction = number(s.comFraction, 0, 1, `${key}.comFraction`);
    const inertiaPerMass = vector(s.inertiaPerMass, 3, 1e-6, 1, `${key}.inertiaPerMass`);
    for (let i = 0; i < 3; i++) {
      if (inertiaPerMass[i] > inertiaPerMass[(i + 1) % 3] + inertiaPerMass[(i + 2) % 3]) {
        throw Error(`${key} inertia violates the physical triangle inequality.`);
      }
    }
    p.segments[key] = {massFraction, length, comFraction, inertiaPerMass};
    fraction += massFraction;
  }
  if (Math.abs(fraction - 1) > 1e-12) throw Error('Segment mass fractions must sum to one; they are not renormalized.');
  return freeze(p);
}

const point = (origin, angle, length) =>
  [origin[0] + length * Math.sin(angle), origin[1] + length * Math.cos(angle)];
const angle = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

function chain(start, end, firstLength, secondLength, side, minBendSine, label) {
  const dx = end[0] - start[0], dz = end[1] - start[1], distance = Math.hypot(dx, dz);
  if (distance <= Math.abs(firstLength - secondLength) || distance >= firstLength + secondLength) {
    throw Error(`${label} is unreachable or singular.`);
  }
  const along = (distance ** 2 + firstLength ** 2 - secondLength ** 2) / (2 * distance);
  const heightSquared = firstLength ** 2 - along ** 2;
  if (!(heightSquared > 0)) throw Error(`${label} is singular.`);
  const height = Math.sqrt(heightSquared), bendSine = distance * height / (firstLength * secondLength);
  if (bendSine < minBendSine) throw Error(`${label} is too close to a straight or folded singularity.`);
  // side chooses the joint's side of the directed proximal->distal line in x/z.
  const joint = [start[0] + along * dx / distance - side * height * dz / distance,
    start[1] + along * dz / distance + side * height * dx / distance];
  return {joint, firstAngle: angle(start, joint), secondAngle: angle(joint, end), bendSine};
}

function segment(name, spec, mass, proximal, distal) {
  const theta = angle(proximal, distal), c = Math.cos(theta), s = Math.sin(theta);
  const inertia = spec.inertiaPerMass.map(x => x * mass), [ix, iy, iz] = inertia;
  const cross = c * s * (iz - ix);
  return {
    name, mass, length: spec.length, proximal: [...proximal], distal: [...distal], angle: theta,
    com: proximal.map((x, i) => x + spec.comFraction * (distal[i] - x)),
    inertiaBody: inertia,
    inertiaFrame: [c * c * ix + s * s * iz, 0, cross, 0, iy, 0, cross, 0, s * s * ix + c * c * iz]
  };
}

export function constructPosture(input = {}) {
  const spec = validatePosture(input), s = spec.segments;
  const shoulder = point(spec.hip, spec.trunkPitch, s.trunk.length);
  const legs = chain(spec.hip, spec.foot, s.thighs.length, s.shanksFeet.length,
    spec.kneeSide, spec.minBendSine, 'Leg chain');
  const arms = chain(shoulder, spec.hand, s.upperArms.length, s.forearmsHands.length,
    spec.elbowSide, spec.minBendSine, 'Arm chain');
  const endpoints = [
    [spec.hip, shoulder], [spec.hip, legs.joint], [legs.joint, spec.foot],
    [shoulder, arms.joint], [arms.joint, spec.hand]
  ];
  const bodies = SEGMENTS.map((name, i) =>
    segment(name, s[name], spec.riderMass * s[name].massFraction, ...endpoints[i]));
  const mass = bodies.reduce((sum, body) => sum + body.mass, 0);
  const com = [0, 1].map(i => bodies.reduce((sum, body) => sum + body.mass * body.com[i], 0) / mass);
  const inertiaCOM = new Array(9).fill(0);
  for (const body of bodies) {
    const dx = body.com[0] - com[0], dz = body.com[1] - com[1], m = body.mass;
    const offset = [m * dz * dz, 0, -m * dx * dz, 0, m * (dx * dx + dz * dz), 0, -m * dx * dz, 0, m * dx * dx];
    for (let i = 0; i < 9; i++) inertiaCOM[i] += body.inertiaFrame[i] + offset[i];
  }
  const closure = (start, firstAngle, secondAngle, l1, l2, target) => {
    const end = point(point(start, firstAngle, l1), secondAngle, l2);
    return Math.hypot(end[0] - target[0], end[1] - target[1]);
  };
  return freeze({
    format: FORMAT, spec,
    scope: 'Illustrative planar aggregate posture and mass construction only; no dynamics, anatomical calibration, contact, actuation or manoeuvre validation.',
    axes: 'Frame-local x forward, y left, z up; angles about +y from local +z; inertia tensors row-major in kg m².',
    points: {hip: [...spec.hip], shoulder, knee: legs.joint, foot: [...spec.foot], elbow: arms.joint, hand: [...spec.hand]},
    joints: {trunk: spec.trunkPitch, hip: wrap(legs.firstAngle - spec.trunkPitch),
      knee: wrap(legs.secondAngle - legs.firstAngle), shoulder: wrap(arms.firstAngle - spec.trunkPitch),
      elbow: wrap(arms.secondAngle - arms.firstAngle)},
    bodies, aggregate: {mass, com, inertiaCOM},
    closure: {foot: closure(spec.hip, legs.firstAngle, legs.secondAngle, s.thighs.length, s.shanksFeet.length, spec.foot),
      hand: closure(shoulder, arms.firstAngle, arms.secondAngle, s.upperArms.length, s.forearmsHands.length, spec.hand)},
    conditioning: {kneeBendSine: legs.bendSine, elbowBendSine: arms.bendSine, minBendSine: spec.minBendSine}
  });
}
