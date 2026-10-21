// Native construction prerequisite for the connected rider. No time integration.
import {constructPosture, SEGMENTS} from './rider-posture.js';
import {getRuntime} from './moving-wheel.js';
import {ATTACHMENTS, createRiderClosureObserver, copyClosureReport} from './rider-interfaces.js';
export {ATTACHMENTS} from './rider-interfaces.js';
import {compilePassiveRider, evaluatePassiveRider, LOAD_STRIDE} from './rider-passive.js';

export const FORMAT = 'bikelab-rider-native-0.2';
export const RIDER_JOINTS = Object.freeze(['riderX', 'riderZ', 'riderPitch', 'riderHip', 'riderKnee', 'riderShoulder', 'riderElbow']);
// Numerical regularization for this construction fixture, not tissue properties.
export const CLOSURE = Object.freeze({solref: Object.freeze([.02, 1]), solimp: Object.freeze([.9, .95, .001, .5, 2])});
const quat = angle => `${Math.cos(angle / 2)} 0 ${Math.sin(angle / 2)} 0`;
const xyz = point => `${point[0]} 0 ${point[1]}`;
const hinge = name => `<joint name="${name}" type="hinge" axis="0 1 0" ref="0" stiffness="0" damping="0" frictionloss="0" limited="false"/>`;
const passiveHinge = law => `<joint name="${law.nativeName}" type="hinge" axis="0 1 0" ref="0" springref="${law.springref}" stiffness="${law.stiffness}" damping="${law.damping}" frictionloss="0" limited="false"/>`;

// Fragments belong under one frame body and one top-level equality element.
// All joint values are deviations from the solved posture; no stabilization
// step is used to close the starting pose. Names are reserved to this assembly.
export function riderParts(input = {}) {
  return partsFromPosture(constructPosture(input));
}

// Static passive-law prerequisite. These fragments do not enforce ultimate
// domains: a future integrator must own candidate guards and rollback.
export function passiveRiderParts(input = {}) {
  const passive = compilePassiveRider(input);
  return {...partsFromPosture(passive.posture, passive), passive};
}

function partsFromPosture(posture, passive) {
  const {spec, joints} = posture, s = spec.segments;
  const joint = name => {
    const law = passive?.laws.find(law => law.nativeName === name);
    return law ? passiveHinge(law) : hinge(name);
  };
  const inertial = name => {
    const p = s[name], mass = spec.riderMass * p.massFraction;
    return `<inertial pos="0 0 ${p.comFraction * p.length}" mass="${mass}" diaginertia="${p.inertiaPerMass.map(x => mass * x).join(' ')}"/>`;
  };
  const end = name => `<site name="rider_${name}_end" pos="0 0 ${s[name].length}"/>`;
  const leaf = (name, jointName, angle, length, attachment) => `<body name="rider_${name}" pos="0 0 ${length}" quat="${quat(angle)}">${joint(jointName)}${inertial(name)}${end(name)}<site name="rider_${attachment}" pos="0 0 ${s[name].length}"/></body>`;
  const legs = `<body name="rider_thighs" quat="${quat(joints.hip)}">${joint('riderHip')}${inertial('thighs')}${end('thighs')}${leaf('shanksFeet', 'riderKnee', joints.knee, s.thighs.length, 'foot')}</body>`;
  const arms = `<body name="rider_upperArms" pos="0 0 ${s.trunk.length}" quat="${quat(joints.shoulder)}">${joint('riderShoulder')}${inertial('upperArms')}${end('upperArms')}${leaf('forearmsHands', 'riderElbow', joints.elbow, s.upperArms.length, 'hand')}</body>`;
  const c = Math.cos(spec.trunkPitch), sn = Math.sin(spec.trunkPitch);
  // Slides precede the hinge. Inverse-rest-rotated axes keep translations in
  // the parent frame's x/z directions despite the trunk's baked quaternion.
  const slides = `<joint name="riderX" type="slide" axis="${c} 0 ${sn}" ref="0" stiffness="0" damping="0" frictionloss="0" limited="false"/><joint name="riderZ" type="slide" axis="${-sn} 0 ${c}" ref="0" stiffness="0" damping="0" frictionloss="0" limited="false"/>`;
  const body = `<body name="rider_trunk" pos="${xyz(spec.hip)}" quat="${quat(spec.trunkPitch)}">${slides}${hinge('riderPitch')}${inertial('trunk')}${end('trunk')}${legs}${arms}</body>`;
  const sites = ATTACHMENTS.map(name => `<site name="bike_${name}" pos="${xyz(spec[name])}"/>`).join('');
  const equality = ATTACHMENTS.map(name => `<connect name="rider_${name}_closure" site1="rider_${name}" site2="bike_${name}" solref="${CLOSURE.solref.join(' ')}" solimp="${CLOSURE.solimp.join(' ')}"/>`).join('');
  return {posture, body, sites, equality};
}

// A free planar carrier isolates construction from suspension and tyre forces.
// Its declared 12 kg / diagonal inertia is a fixture, not a replacement bike.
export function nativePostureXML(input = {}) {
  return fixtureXML(riderParts(input));
}

export function nativePassiveXML(input = {}) {
  return fixtureXML(passiveRiderParts(input));
}

function fixtureXML(p) {
  return `<mujoco model="BikeLab rider construction"><compiler angle="radian" fusestatic="false"/><option gravity="0 0 -9.80665" jacobian="sparse" solver="Newton" tolerance="1e-12"/><worldbody><body name="frame"><joint name="travel" type="slide" axis="1 0 0"/><joint name="heave" type="slide" axis="0 0 1"/>${hinge('pitch')}<inertial pos="0 0 0" mass="12" diaginertia=".2 .5 .4"/>${p.sites}${p.body}</body></worldbody><equality>${p.equality}</equality></mujoco>`;
}

function centralTensor(model, data, body) {
  const result = Array(9).fill(0), r = data.ximat, moments = model.body_inertia;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
    result[3 * i + j] += r[9 * body + 3 * i + k] * moments[3 * body + k] * r[9 * body + 3 * j + k];
  }
  return result;
}

export async function inspectNativePosture(input = {}) {
  return inspectParts(riderParts(input));
}

export async function inspectNativePassive(input = {}) {
  return inspectParts(passiveRiderParts(input));
}

async function inspectParts(parts) {
  const mj = await getRuntime();
  let model, data, riderJacobian, bikeJacobian, rotationJacobian, interfaceObserver;
  try {
    model = mj.MjModel.from_xml_string(fixtureXML(parts)); data = new mj.MjData(model);
    mj.mj_forward(model, data);
    riderJacobian = new mj.DoubleBuffer(3 * model.nv);
    bikeJacobian = new mj.DoubleBuffer(3 * model.nv);
    rotationJacobian = new mj.DoubleBuffer(3 * model.nv);
    const id = (kind, name) => {
      const value = mj.mj_name2id(model, mj.mjtObj[kind].value, name);
      if (value < 0) throw Error(`Missing native rider object: ${name}.`);
      return value;
    };
    const site = name => Array.from(data.site_xpos.subarray(3 * id('mjOBJ_SITE', name), 3 * id('mjOBJ_SITE', name) + 3));
    const segments = SEGMENTS.map(name => {
      const b = id('mjOBJ_BODY', 'rider_' + name);
      return {name, mass: model.body_mass[b], proximal: Array.from(data.xpos.subarray(3 * b, 3 * b + 3)),
        distal: site('rider_' + name + '_end'), com: Array.from(data.xipos.subarray(3 * b, 3 * b + 3)), inertiaCOM: centralTensor(model, data, b)};
    });
    const mass = segments.reduce((sum, b) => sum + b.mass, 0);
    const com = [0, 1, 2].map(i => segments.reduce((sum, b) => sum + b.mass * b.com[i], 0) / mass);
    const inertiaCOM = Array(9).fill(0);
    for (const b of segments) {
      const offset = b.com.map((x, i) => x - com[i]), squared = offset.reduce((sum, x) => sum + x * x, 0);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        inertiaCOM[3 * i + j] += b.inertiaCOM[3 * i + j] + b.mass * ((i === j ? squared : 0) - offset[i] * offset[j]);
      }
    }
    const jointNames = ['travel', 'heave', 'pitch', ...RIDER_JOINTS];
    const dofs = jointNames.map(name => ({name, index: model.jnt_dofadr[id('mjOBJ_JOINT', name)]}));
    const attachments = ATTACHMENTS.map(name => {
      const equality = id('mjOBJ_EQUALITY', 'rider_' + name + '_closure'), rows = [];
      // Resolve fresh rows by equality ID, never by a presumed persistent index.
      for (let row = 0; row < data.nefc; row++) if (data.efc_type[row] === mj.mjtConstraint.mjCNSTR_EQUALITY.value && data.efc_id[row] === equality) rows.push(row);
      if (rows.length !== 3) throw Error(`Expected three connect rows for ${name}.`);
      const rider = site('rider_' + name), bike = site('bike_' + name);
      // Public site Jacobians are dense regardless of native constraint storage.
      // The wheel-connected consumer exceeds the native AUTO sparse threshold.
      mj.mj_jacSite(model, data, riderJacobian, rotationJacobian, id('mjOBJ_SITE', 'rider_' + name));
      mj.mj_jacSite(model, data, bikeJacobian, rotationJacobian, id('mjOBJ_SITE', 'bike_' + name));
      const jr = riderJacobian.GetView(), jb = bikeJacobian.GetView();
      return {name, rider, bike, gap: rider.map((x, i) => x - bike[i]),
        jacobian: [0, 1, 2].map(axis => dofs.map(({index}) => jr[axis * model.nv + index] - jb[axis * model.nv + index])),
        residual: rows.map(row => data.efc_pos[row])};
    });
    interfaceObserver = createRiderClosureObserver(mj, model, data);
    const interfaceLoads = copyClosureReport(interfaceObserver.read());
    const report = {format: FORMAT, spec: parts.posture.spec, engine: 'MuJoCo 3.16.0',
      scope: 'Native initial construction only; no integration, passive joint law, saddle, connected-bike dynamics or anatomical calibration.',
      coordinates: 'SI; frame x forward, y left, z up; joint values are zero deviations from the constructed posture. Tensors row-major in world axes.',
      dofs, qpos: Array.from(data.qpos), equalityRows: data.nefc, closure: CLOSURE,
      segments, aggregate: {mass, com, inertiaCOM}, attachments, interfaceLoads};
    if (parts.passive) {
      const values = evaluatePassiveRider(parts.passive, [0, 0, 0, 0], [0, 0, 0, 0], new Float64Array(4 * LOAD_STRIDE));
      mj.mj_energyPos(model, data);
      report.format = 'bikelab-rider-native-passive-0.2'; report.spec = parts.passive.spec;
      report.scope = 'Initial native passive-law evaluation only; no integration, enforced stops, saddle, connected-bike dynamics, strength or anatomical calibration.';
      report.passive = {joints: parts.passive.laws.map((law, i) => {
        const joint = id('mjOBJ_JOINT', law.nativeName), q = model.jnt_qposadr[joint], v = model.jnt_dofadr[joint], at = i * LOAD_STRIDE;
        return {name: law.name, angle: law.angle0, springref: model.qpos_spring[q],
          stiffness: model.jnt_stiffness[joint], damping: model.dof_damping[v],
          nativeTorque: data.qfrc_passive[v], torque: values[at], springEnergy: values[at + 1], dampingLossPower: values[at + 2]};
      }), nativePotentialIncludingGravity: data.energy[0],
      ownership: 'Native qfrc_passive and energy[0] already include these spring loads and potentials; joint entries are a decomposition, not an additional force or energy.'};
    }
    return report;
  } finally {interfaceObserver?.delete(); rotationJacobian?.delete(); bikeJacobian?.delete(); riderJacobian?.delete(); data?.delete(); model?.delete();}
}
