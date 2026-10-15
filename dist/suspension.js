import { G, road, MAX_RECORD_BYTES } from './physics.js';

export const MODEL = 'bikelab-suspension-0.1';
export const DEFAULTS = Object.freeze({
  mass: 45, stiffness: 9000, preload: 50, compressionDamping: 350, reboundDamping: 650,
  travel: 0.16, initialCompression: 0.075, initialVelocity: 0,
  profile: 'flat', amplitude: 0.005, frequency: 2, duration: 4, dt: 0.0005, sampleDt: 0.005
});
export const PRESETS = Object.freeze({
  fork: DEFAULTS,
  shock: Object.freeze({ ...DEFAULTS, mass: 30, stiffness: 22000, preload: 40,
    compressionDamping: 500, reboundDamping: 1000, travel: 0.065, initialCompression: 0.025 })
});
const bounds = {
  mass: [1, 150], stiffness: [1000, 200000], preload: [0, 1500],
  compressionDamping: [0, 8000], reboundDamping: [0, 8000], travel: [0.02, 0.3],
  initialCompression: [0, 0.3], initialVelocity: [-3, 3], amplitude: [0, 0.05], frequency: [0.2, 12],
  duration: [0.1, 30], dt: [0.00001, 0.0005], sampleDt: [0.001, 0.02]
};
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    && [Object.prototype, null].includes(Object.getPrototypeOf(v));
}
export function validate(input = {}) {
  if (!isObject(input)) throw new Error('Setup must be a JSON object.');
  for (const key of Object.keys(input)) if (!Object.hasOwn(DEFAULTS, key)) throw new Error('Unknown setup parameter: ' + key);
  const p = { ...DEFAULTS, ...input };
  for (const [key, [lo, hi]] of Object.entries(bounds))
    if (!Number.isFinite(p[key]) || p[key] < lo || p[key] > hi) throw new Error(key + ' must be between ' + lo + ' and ' + hi + ' (SI).');
  if (!['flat', 'bump', 'sine'].includes(p.profile)) throw new Error('Unknown profile.');
  for (const n of [p.sampleDt / p.dt, p.duration / p.sampleDt])
    if (Math.abs(n - Math.round(n)) > 1e-7) throw new Error('Step and duration must align with recording intervals.');
  if (p.initialCompression > p.travel) throw new Error('Initial compression exceeds travel.');
  const sag = (p.mass * G - p.preload) / p.stiffness;
  if (sag <= 0 || sag >= p.travel) throw new Error('This station needs equilibrium strictly inside travel; change load, preload, stiffness or stroke. End-stop reactions are not modelled.');
  if (p.dt * componentRate(p) > 0.5) throw new Error('Integration step is too coarse for this element; reduce dt.');
  return Object.freeze(p);
}
function componentRate(p) {
  return Math.max(Math.sqrt(p.stiffness / p.mass), p.compressionDamping / p.mass, p.reboundDamping / p.mass);
}

// Signed spreading force. q increases in compression; u = dq/dt.
// Caller-owned output [spring, damper, total, elastic energy, loss rate].
// Parameters are validated once by the caller; no allocations in this evaluator.
export function element(p, q, u, out) {
  if (!Number.isFinite(q) || !Number.isFinite(u) || q < 0 || q > p.travel)
    throw new Error('Element state is outside finite travel.');
  const c = u >= 0 ? p.compressionDamping : p.reboundDamping;
  out[0] = p.preload + p.stiffness * q;
  out[1] = c * u;
  out[2] = out[0] + out[1];
  out[3] = p.preload * q + 0.5 * p.stiffness * q * q;
  out[4] = c * u * u;
}
class TravelLimit extends Error {
  constructor(type) { super(type + ': end-stop dynamics are not modelled.'); this.type = type; }
}
export class Solver {
  constructor(input = {}) {
    this.p = validate(input);
    // Upward z, measured from the extended carriage reference at base=0.
    // q = base - z; u = baseVelocity - zVelocity.
    this.state = new Float64Array(5); // z, v, support work, damper loss, force impulse
    this.base = new Float64Array(2); this.values = new Float64Array(5);
    this.k1 = new Float64Array(5); this.k2 = new Float64Array(5);
    this.k3 = new Float64Array(5); this.k4 = new Float64Array(5);
    this.tmp = new Float64Array(5); this.next = new Float64Array(5);
    road(this.p, 0, this.base);
    this.state[0] = -this.p.initialCompression;
    this.state[1] = this.base[1] - this.p.initialVelocity;
    this.ticks = 0; this.t = 0;
    this.observe(0, this.state);
    this.initialEnergy = this.energy();
    this.energyScale = Math.max(this.p.mass * G * this.p.travel, Math.abs(this.initialEnergy));
    this.minCompression = this.maxCompression = this.q;
    this.minForce = this.maxForce = this.values[2];
    this.maxResidual = 0;
  }
  observe(t, s) {
    road(this.p, t, this.base);
    this.q = this.base[0] - s[0]; this.u = this.base[1] - s[1];
    if (this.q < 0) throw new TravelLimit('top-out');
    if (this.q > this.p.travel) throw new TravelLimit('bottom-out');
    element(this.p, this.q, this.u, this.values);
  }
  derivative(t, s, out) {
    this.observe(t, s);
    out[0] = s[1]; out[1] = this.values[2] / this.p.mass - G;
    out[2] = this.values[2] * this.base[1];
    out[3] = this.values[4]; out[4] = this.values[2];
  }
  step() {
    const h = this.p.dt, s = this.state, tmp = this.tmp;
    // Keep state transactional: a rejected RK trial must not corrupt the last valid endpoint.
    try {
      this.derivative(this.t, s, this.k1);
      for (let i = 0; i < 5; i++) tmp[i] = s[i] + h * this.k1[i] / 2;
      this.derivative(this.t + h / 2, tmp, this.k2);
      for (let i = 0; i < 5; i++) tmp[i] = s[i] + h * this.k2[i] / 2;
      this.derivative(this.t + h / 2, tmp, this.k3);
      for (let i = 0; i < 5; i++) tmp[i] = s[i] + h * this.k3[i];
      this.derivative(this.t + h, tmp, this.k4);
      for (let i = 0; i < 5; i++) {
        this.next[i] = s[i] + h * (this.k1[i] + 2 * this.k2[i] + 2 * this.k3[i] + this.k4[i]) / 6;
        if (!Number.isFinite(this.next[i])) throw new Error('Nonfinite physical state.');
      }
      this.observe((this.ticks + 1) * h, this.next);
    } catch (error) { this.observe(this.t, s); throw error; }
    s.set(this.next); this.t = ++this.ticks * h;
    this.minCompression = Math.min(this.minCompression, this.q);
    this.maxCompression = Math.max(this.maxCompression, this.q);
    this.minForce = Math.min(this.minForce, this.values[2]);
    this.maxForce = Math.max(this.maxForce, this.values[2]);
    this.maxResidual = Math.max(this.maxResidual, Math.abs(this.energy() + s[3] - s[2] - this.initialEnergy));
    this.energyScale = Math.max(this.energyScale, Math.abs(this.energy()), Math.abs(s[2]), s[3]);
  }
  energy() { return 0.5 * this.p.mass * this.state[1] ** 2 + this.p.mass * G * this.state[0] + this.values[3]; }
}
export const CHANNELS = Object.freeze(['time', 'height', 'velocity', 'base', 'compression', 'compressionVelocity',
  'springForce', 'damperForce', 'force', 'energy', 'work', 'loss', 'residual']);
export function simulate(input = {}) {
  const solver = new Solver(input), p = solver.p;
  const capacity = Math.round(p.duration / p.sampleDt) + 2;
  const signals = Object.fromEntries(CHANNELS.map(key => [key, new Float64Array(capacity)]));
  const stride = Math.round(p.sampleDt / p.dt), steps = Math.round(p.duration / p.dt);
  let count = 0, termination = null;
  function record() {
    const s = solver.state, v = solver.values, e = solver.energy(), n = count++;
    signals.time[n] = solver.t; signals.height[n] = s[0]; signals.velocity[n] = s[1];
    signals.base[n] = solver.base[0]; signals.compression[n] = solver.q; signals.compressionVelocity[n] = solver.u;
    signals.springForce[n] = v[0]; signals.damperForce[n] = v[1]; signals.force[n] = v[2];
    signals.energy[n] = e; signals.work[n] = s[2]; signals.loss[n] = s[3];
    signals.residual[n] = e + s[3] - s[2] - solver.initialEnergy;
  }
  record();
  for (let i = 1; i <= steps; i++) {
    try { solver.step(); }
    catch (error) {
      if (!(error instanceof TravelLimit)) throw error;
      termination = { type: error.type, lastValidTime: solver.t, attemptedTime: i * p.dt,
        uncertainty: p.dt, reason: 'An integration trial left travel; no end-stop law is implemented.' };
      if (signals.time[count - 1] !== solver.t) record();
      break;
    }
    if (i % stride === 0) record();
  }
  // Trim only after integration. The final valid endpoint can be off the recording grid.
  for (const key of CHANNELS) signals[key] = signals[key].slice(0, count);
  const relativeResidual = solver.maxResidual / solver.energyScale;
  const warnings = [];
  if (p.dt * componentRate(p) > 0.1) warnings.push('Integration step is coarse relative to component time scales. Refine and compare.');
  if (relativeResidual > 0.001) warnings.push('Energy balance error exceeds 0.1% of the run energy scale. Refine the integration step.');
  if (termination) warnings.push(termination.type + ': run stopped at the last valid endpoint. This is a model-domain limit, not a simulated impact.');
  if (p.profile === 'bump' && p.duration <= 1) warnings.push('This run ends before the bump begins at 1 s.');
  return { model: MODEL, params: p, status: termination ? 'travel-limit' : 'complete', termination, signals, warnings,
    metrics: { equilibriumCompression: (p.mass * G - p.preload) / p.stiffness,
      minCompression: solver.minCompression, peakCompression: solver.maxCompression,
      minForce: solver.minForce, peakForce: solver.maxForce, impulse: solver.state[4],
      dissipatedEnergy: solver.state[3], maxResidual: solver.maxResidual, relativeResidual, endTime: solver.t } };
}
export function sameScenario(a, b) {
  return ['profile', 'amplitude', 'frequency', 'duration', 'dt', 'sampleDt', 'initialCompression', 'initialVelocity']
    .every(key => a[key] === b[key]);
}
export function serialize(run) {
  if (run.model !== MODEL) throw new Error('Cannot serialize a different station model.');
  const text = JSON.stringify({ recordVersion: 1, model: MODEL, params: run.params,
    provenance: 'Illustrative, uncalibrated axial coil and viscous damper; no end stops',
    status: run.status, termination: run.termination, metrics: run.metrics, warnings: run.warnings,
    signals: Object.fromEntries(CHANNELS.map(key => [key, Array.from(run.signals[key])])) }, null, 2);
  if (new TextEncoder().encode(text).length > MAX_RECORD_BYTES) throw new Error('Run exceeds the 64 MiB record limit.');
  return text;
}
export function readRecord(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_RECORD_BYTES) throw new Error('Run file must be text within the 64 MiB limit.');
  let r;
  try { r = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('Run file is not valid JSON.'); }
  if (!isObject(r) || r.model !== MODEL || r.recordVersion !== 1) throw new Error('Unsupported suspension model or record format.');
  if (!isObject(r.params) || Object.keys(DEFAULTS).some(key => !Object.hasOwn(r.params, key))) throw new Error('Saved runs must contain the complete setup.');
  validate(r.params);
  return r;
}
export function replay(text) { return simulate(readRecord(text).params); }
