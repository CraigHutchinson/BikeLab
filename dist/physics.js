export const MODEL = 'bikelab-wheel-0.1';
export const G = 9.80665;
export const DEFAULTS = Object.freeze({
  mass: 45, radius: 0.36, stiffness: 90000, damping: 400,
  amplitude: 0.035, frequency: 2, profile: 'bump', duration: 8,
  dt: 0.0005, sampleDt: 0.005, lift: 0
});
const bounds = {
  mass: [5, 150], radius: [0.2, 0.5], stiffness: [10000, 300000],
  damping: [0, 3000], amplitude: [0, 0.1], frequency: [0.2, 12],
  duration: [0.1, 30], dt: [0.00001, 0.0005], sampleDt: [0.001, 0.02],
  lift: [0, 0.2]
};
export function validate(input = {}) {
  const p = { ...DEFAULTS, ...input };
  for (const [key, range] of Object.entries(bounds)) {
    if (!Number.isFinite(p[key]) || p[key] < range[0] || p[key] > range[1])
      throw new Error(key + ' must be between ' + range.join(' and ') + ' (SI).');
  }
  if (!['flat', 'bump', 'sine'].includes(p.profile)) throw new Error('Unknown profile.');
  for (const n of [p.sampleDt / p.dt, p.duration / p.sampleDt]) {
    if (Math.abs(n - Math.round(n)) > 1e-7) throw new Error('Step and duration must align with recording intervals.');
  }
  if (p.mass * G / p.stiffness > 0.2 * p.radius) throw new Error('Static deflection exceeds this model’s setup range.');
  return Object.freeze(p);
}
// Caller-owned output: height and velocity. No allocation during stepping.
export function road(p, t, out) {
  out[0] = 0; out[1] = 0;
  if (p.profile === 'sine') {
    const w = 2 * Math.PI * p.frequency;
    out[0] = p.amplitude * Math.sin(w * t);
    out[1] = p.amplitude * w * Math.cos(w * t);
  } else if (p.profile === 'bump') {
    const u = (t - 1) * p.frequency;
    if (u > 0 && u < 1) {
      const s = Math.sin(Math.PI * u), c = Math.cos(Math.PI * u);
      out[0] = p.amplitude * s ** 4;
      out[1] = 4 * p.amplitude * Math.PI * p.frequency * s ** 3 * c;
    }
  }
}
export class Solver {
  constructor(input = {}) {
    this.p = validate(input);
    this.state = new Float64Array(6);
    this.state[0] = this.p.radius - this.p.mass * G / this.p.stiffness + this.p.lift;
    this.k1 = new Float64Array(6); this.k2 = new Float64Array(6);
    this.k3 = new Float64Array(6); this.k4 = new Float64Array(6);
    this.tmp = new Float64Array(6); this.base = new Float64Array(2);
    this.ticks = 0; this.t = 0; this.force = 0; this.compression = 0;
    this.maxForce = 0; this.maxCompression = 0;
    this.observe(0, this.state);
    this.initialEnergy = this.energy();
  }
  observe(t, state) {
    road(this.p, t, this.base);
    this.compression = Math.max(0, this.base[0] + this.p.radius - state[0]);
    this.force = this.compression > 0
      ? Math.max(0, this.p.stiffness * this.compression + this.p.damping * (this.base[1] - state[1]))
      : 0;
  }
  derivative(t, state, out) {
    this.observe(t, state);
    out[0] = state[1]; out[1] = this.force / this.p.mass - G;
    out[2] = this.force * this.base[1];
    out[3] = this.compression > 0
      ? (this.force - this.p.stiffness * this.compression) * (this.base[1] - state[1]) : 0;
    out[4] = this.force;
    out[5] = this.force <= 0 ? 1 : 0;
  }
  step() {
    const h = this.p.dt, s = this.state, tmp = this.tmp;
    this.derivative(this.t, s, this.k1);
    for (let i = 0; i < 6; i++) tmp[i] = s[i] + h * this.k1[i] / 2;
    this.derivative(this.t + h / 2, tmp, this.k2);
    for (let i = 0; i < 6; i++) tmp[i] = s[i] + h * this.k2[i] / 2;
    this.derivative(this.t + h / 2, tmp, this.k3);
    for (let i = 0; i < 6; i++) tmp[i] = s[i] + h * this.k3[i];
    this.derivative(this.t + h, tmp, this.k4);
    for (let i = 0; i < 6; i++) {
      s[i] += h * (this.k1[i] + 2 * this.k2[i] + 2 * this.k3[i] + this.k4[i]) / 6;
      if (!Number.isFinite(s[i])) throw new Error('Nonfinite physical state.');
    }
    this.t = ++this.ticks * h;
    this.observe(this.t, s);
    this.maxForce = Math.max(this.maxForce, this.force);
    this.maxCompression = Math.max(this.maxCompression, this.compression);
    if (this.compression > 0.35 * this.p.radius) throw new Error('Compression exceeds surrogate range. Reduce excitation or change setup.');
  }
  energy() {
    return 0.5 * this.p.mass * this.state[1] ** 2 + this.p.mass * G * this.state[0]
      + 0.5 * this.p.stiffness * this.compression ** 2;
  }
}
export const CHANNELS = Object.freeze(['time', 'height', 'velocity', 'platen', 'compression', 'force', 'energy', 'work', 'loss', 'residual', 'unloaded']);
export function simulate(input = {}) {
  const solver = new Solver(input), p = solver.p;
  const count = Math.round(p.duration / p.sampleDt) + 1;
  const signals = Object.fromEntries(CHANNELS.map(key => [key, new Float64Array(count)]));
  const stride = Math.round(p.sampleDt / p.dt);
  const events = []; // Recorded after integration from sampled signals.
  let maxResidual = 0;
  for (let n = 0; n < count; n++) {
    if (n) for (let j = 0; j < stride; j++) solver.step();
    const s = solver.state, e = solver.energy();
    signals.time[n] = solver.t; signals.height[n] = s[0]; signals.velocity[n] = s[1];
    signals.platen[n] = solver.base[0]; signals.compression[n] = solver.compression;
    signals.force[n] = solver.force; signals.energy[n] = e;
    signals.work[n] = s[2]; signals.loss[n] = s[3];
    signals.residual[n] = e + s[3] - s[2] - solver.initialEnergy;
    signals.unloaded[n] = s[5];
    maxResidual = Math.max(maxResidual, Math.abs(signals.residual[n]));
  }
  for (let n = 1; n < count; n++) {
    if ((signals.force[n] > 0) !== (signals.force[n - 1] > 0))
      events.push({ time: signals.time[n], type: signals.force[n] > 0 ? 'load-restored' : 'load-lost', uncertainty: p.sampleDt });
  }
  return { model: MODEL, params: p, signals, events, metrics: {
    peakForce: Math.max(signals.force[0], solver.maxForce),
    peakCompression: Math.max(signals.compression[0], solver.maxCompression),
    unloadedTime: solver.state[5], impulse: solver.state[4], maxResidual
  }};
}
export function serialize(run) {
  return JSON.stringify({ model: MODEL, params: run.params,
    provenance: 'Illustrative, uncalibrated tyre surrogate', metrics: run.metrics, events: run.events,
    signals: Object.fromEntries(CHANNELS.map(k => [k, Array.from(run.signals[k])])) }, null, 2);
}
export function replay(text) {
  const record = JSON.parse(text);
  if (record.model !== MODEL) throw new Error('Unsupported model version.');
  if (!record.params || typeof record.params !== 'object') throw new Error('Missing setup.');
  // Recompute from validated setup; imported plots cannot masquerade as solver evidence.
  return simulate(record.params);
}
export function sameScenario(a, b) {
  return ['profile', 'amplitude', 'frequency', 'duration', 'dt', 'sampleDt', 'lift'].every(k => a[k] === b[k]);
}
