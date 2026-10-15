import { G } from './physics.js';
export const MODEL = 'bikelab-prismatic-trial-1';
export const DEFAULTS = Object.freeze({mass:45, stiffness:9000, damping:350, preload:50,
  travel:.16, initialCompression:.075, initialVelocity:0, tiltDegrees:20, transverseForce:100, probeTorque:0,
  dt:.0005, duration:2});
export const STEPS = Object.freeze([.0005,.00025,.000125,.0000625,.00003125]);
export const SAMPLE_DT = .005;
export const CLOSURE_LIMITS = Object.freeze({translation:1e-5, rotation:1e-5});
const bounds = {mass:[1,150],stiffness:[1000,50000],damping:[0,3000],preload:[0,1000],
  travel:[.02,.3],initialCompression:[0,.3],initialVelocity:[-1,1],tiltDegrees:[-45,45],
  transverseForce:[-500,500],probeTorque:[-50,50],duration:[.1,2]};
export function validate(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || ![Object.prototype,null].includes(Object.getPrototypeOf(input))) throw new Error('Setup must be a plain object.');
  for (const key of Object.keys(input)) if (!Object.hasOwn(DEFAULTS,key)) throw new Error('Unknown parameter: '+key);
  const p={...DEFAULTS,...input};
  for (const [key,[lo,hi]] of Object.entries(bounds))
    if (!Number.isFinite(p[key]) || p[key]<lo || p[key]>hi) throw new Error(key+' outside supported SI range ['+lo+', '+hi+'].');
  if (!STEPS.includes(p.dt)) throw new Error('Choose a supported integration step.');
  if (Math.abs(p.duration/SAMPLE_DT-Math.round(p.duration/SAMPLE_DT))>1e-8) throw new Error('Duration must align with 5 ms recordings.');
  const eq=(p.mass*G*Math.cos(p.tiltDegrees*Math.PI/180)-p.preload)/p.stiffness;
  const envelope=Math.hypot(p.initialCompression-eq,p.initialVelocity/Math.sqrt(p.stiffness/p.mass));
  if (eq-envelope<.001 || eq+envelope>p.travel-.001)
    throw new Error('Reference energy envelope needs 1 mm clearance inside stroke. Stops are unsupported.');
  return Object.freeze(p);
}
