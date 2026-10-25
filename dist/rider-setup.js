// Setup-time reuse only. Compiles into the existing always-attached Trail model;
// no runtime actor, attachment transition or new integration policy is created.
import {validatePosture, SEGMENTS} from './rider-posture.js';
import {JOINTS, validatePassiveJoint} from './rider-passive.js';
import {validate, articulatedPreset} from './trail-bike.js';

export const DEFINITION_FORMAT = 'bikelab-rider-definition-0.1';
export const SETUP_FORMAT = 'bikelab-rider-setup-0.1';
export const RECEIPT_FORMAT = 'bikelab-rider-setup-receipt-0.1';
const placementKeys = ['hip', 'trunkPitch', 'elbowSide', 'kneeSide', 'minBendSine'];
const setupKeys = ['format', 'rider', 'placement', 'bikeMount', 'interfaces', 'trail'];

function object(value, keys, label, complete = true) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error(label + ' must be a plain object.');
  for (const key of Reflect.ownKeys(value)) {
    if (!keys.includes(key)) throw Error('Unknown ' + label + ' field: ' + String(key));
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw Error(label + ' fields must be enumerable data properties.');
  }
  if (complete) for (const key of keys) if (!Object.hasOwn(value, key) || value[key] === undefined) throw Error('Incomplete ' + label + ': ' + key);
}
function freeze(value) {
  if (value && typeof value === 'object') {for (const child of Object.values(value)) freeze(child);Object.freeze(value);}
  return value;
}
function scenario(input) {
  const {wheelParams, ...result} = validate(input);
  // Validation may reuse already canonical immutable structures. Own the whole
  // public result, including any future nested fields, before freezing it.
  return freeze(structuredClone(result));
}

export function validateRiderDefinition(input) {
  object(input, ['format', 'riderMass', 'segments', 'joints', 'provenance'], 'rider definition');
  if (input.format !== DEFINITION_FORMAT) throw Error('Unsupported rider definition format.');
  if (typeof input.provenance !== 'string' || !input.provenance.trim() || input.provenance.length > 2000) throw Error('Rider provenance needs 1–2000 characters of nonblank text.');
  object(input.segments, SEGMENTS, 'rider segments');
  object(input.joints, JOINTS, 'rider joints');
  // This validator checks mass/segment properties, not reach or starting pose.
  const p = validatePosture({riderMass: input.riderMass, segments: input.segments});
  const joints = Object.fromEntries(JOINTS.map(name => [name, validatePassiveJoint(name, input.joints[name])]));
  return freeze({format: DEFINITION_FORMAT, riderMass: p.riderMass, segments: p.segments, joints, provenance: input.provenance});
}

function split(a, rider) {
  const {articulated: c, ...trail} = a, p = c.passive.posture;
  return freeze(structuredClone({format: SETUP_FORMAT, rider,
    placement: Object.fromEntries(placementKeys.map(key => [key, p[key]])),
    bikeMount: {chassis: c.chassis, hand: {body: 'frame', position: p.hand}, foot: {body: 'frame', position: p.foot}},
    interfaces: {kind: 'retained-pair', closureTime: c.closureTime, maxClosureGap: c.maxClosureGap}, trail}));
}

// Explicit legacy adapter. A record does not establish anatomical calibration;
// callers retain source evidence separately and supply an honest description.
export function riderSetupFromScenario(input, provenance = 'Extracted from an authored Trail scenario; body properties and passive laws are unverified.') {
  const a = scenario(input);
  if (!a.articulated) throw Error('Portable rider setup requires an articulated scenario.');
  const p = a.articulated.passive;
  const rider = validateRiderDefinition({format: DEFINITION_FORMAT, riderMass: p.posture.riderMass,
    segments: p.posture.segments, joints: p.joints, provenance});
  return split(a, rider);
}

export function riderSetupExample(bike = 'full') {
  if (!['full', 'hardtail'].includes(bike)) throw Error('Rider setup example needs full or hardtail.');
  const a = articulatedPreset(bike);a.initialization = {mode: 'launch'};
  return riderSetupFromScenario(a, 'BikeLab illustrative 70 kg five-group rider: cylinder mass/inertia proxies and uncalibrated passive joint laws; not measured anatomy.');
}

export function compileRiderSetup(input) {
  object(input, setupKeys, 'rider setup');
  if (input.format !== SETUP_FORMAT) throw Error('Unsupported rider setup format.');
  const rider = validateRiderDefinition(input.rider);
  object(input.placement, placementKeys, 'rider placement');
  object(input.bikeMount, ['chassis', 'hand', 'foot'], 'bike mount');
  // Requiring all chassis values prevents a portable file from silently gaining
  // new defaults if the legacy example changes in a future release.
  object(input.bikeMount.chassis, ['mass', 'com', 'inertia'], 'bike chassis');
  for (const name of ['hand', 'foot']) {
    object(input.bikeMount[name], ['body', 'position'], name + ' binding');
    if (input.bikeMount[name].body !== 'frame') throw Error('Only frame-local paired hand/foot bindings are supported.');
  }
  object(input.interfaces, ['kind', 'closureTime', 'maxClosureGap'], 'rider interfaces');
  if (input.interfaces.kind !== 'retained-pair') throw Error('Only retained-pair rider interfaces are supported.');
  object(input.trail, ['bike', 'wheel', 'motion', 'profile', 'assembly', 'surface', 'commands', 'initialization', 'numerics'], 'rider trail', false);
  if (input.trail.bike?.rider !== 'articulated') throw Error('Rider setup trail must explicitly select articulated mode.');
  const a = scenario({...input.trail, articulated: {
    chassis: input.bikeMount.chassis,
    passive: {posture: {riderMass: rider.riderMass, segments: rider.segments, ...input.placement,
      hand: input.bikeMount.hand.position, foot: input.bikeMount.foot.position}, joints: rider.joints},
    closureTime: input.interfaces.closureTime, maxClosureGap: input.interfaces.maxClosureGap
  }});
  // Existing posture/passive validation rejects unreachable and out-of-domain
  // fits. It never resizes segments or recenters the absolute constitutive laws.
  return freeze({setup: split(a, rider), scenario: a});
}

export async function riderDefinitionIdentity(input) {
  const bytes = new TextEncoder().encode(JSON.stringify(validateRiderDefinition(input)));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');
}

export async function riderSetupReceipt(input) {
  const compiled = compileRiderSetup(input);
  return freeze({format: RECEIPT_FORMAT, riderIdentity: await riderDefinitionIdentity(compiled.setup.rider),
    scope: 'Setup-time definition reuse with retained frame-local hand/foot proxies. No independent actor, detachment, live transfer, saddle or anatomical calibration.',
    ...compiled});
}
