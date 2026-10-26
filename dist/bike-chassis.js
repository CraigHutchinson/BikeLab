// Illustrative frame-only inertial properties, independent of rider bodies.
// Retains the connected-rider adapter's existing defaults and admission bounds.
export const CHASSIS_DEFAULTS = Object.freeze({mass: 6, com: Object.freeze([0, -.15]), inertia: Object.freeze([.35, .5, .3])});
export function validateChassis(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw Error('chassis must be an object.');
  for (const key of Reflect.ownKeys(input)) if (!['mass', 'com', 'inertia'].includes(key)) throw Error('Unknown chassis field: ' + String(key));
  const number = (value, lo, hi, label) => {
    if (!Number.isFinite(value) || value < lo || value > hi) throw Error(label + ' outside supported SI range.');
    return value;
  };
  const vector = (value, count, lo, hi, label) => {
    if (!Array.isArray(value) || value.length !== count) throw Error(label + ' needs ' + count + ' entries.');
    return Object.freeze(Array.from({length: count}, (_, i) => number(value[i], lo, hi, label)));
  };
  const c = {...CHASSIS_DEFAULTS, ...input};
  const chassis = Object.freeze({mass: number(c.mass, 2, 30, 'chassis mass'), com: vector(c.com, 2, -.5, .5, 'chassis COM'), inertia: vector(c.inertia, 3, .001, 20, 'chassis inertia')});
  for (let i = 0; i < 3; i++) if (chassis.inertia[i] > chassis.inertia[(i + 1) % 3] + chassis.inertia[(i + 2) % 3]) throw Error('Chassis inertia violates rigid-body triangle inequalities.');
  return chassis;
}
