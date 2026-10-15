import { G } from './physics.js';
import { DEFAULTS, MODEL as CANDIDATE, validate } from './suspension.js';

export const REFERENCE = 'axial-closed-form-1';
export const COMPARISON = 'axial-comparison-1';
export const LIMITS = Object.freeze({ compression: 1e-6, compressionVelocity: 1e-4, force: 0.1 });

// Exact solution of m e'' + c e' + k e = 0; e is displacement from equilibrium.
// Reuses the station test oracle's mathematics, independently of element() and RK4.
// Caller validates positive m/k, nonnegative c, finite inputs and nonnegative t.
// Caller-owned [e, u] storage avoids allocations in the sample loop.
export function oscillatorState(m, k, c, e0, u0, t, out) {
  const alpha = c / (2 * m), w2 = k / m, d = alpha * alpha - w2;
  const b = u0 + alpha * e0;
  if (d <= 0) {
    const w = Math.sqrt(-d), x = w * t, decay = Math.exp(-alpha * t);
    const s = Math.abs(x) < 1e-4 ? t * (1 - x*x/6 + x*x*x*x/120) : Math.sin(x) / w;
    const co = Math.cos(x);
    out[0] = decay * (e0 * co + b * s);
    out[1] = decay * (u0 * co - (alpha * u0 + w2 * e0) * s);
  } else {
    const beta = Math.sqrt(d), x = beta * t;
    if (x < 1) {
      const decay = Math.exp(-alpha * t), co = Math.cosh(x);
      const s = x < 1e-4 ? t * (1 + x*x/6 + x*x*x*x/120) : Math.sinh(x) / beta;
      out[0] = decay * (e0 * co + b * s);
      out[1] = decay * (u0 * co - (alpha * u0 + w2 * e0) * s);
    } else {
      // Avoid cancellation in -alpha + beta and overflow in cosh(beta*t).
      const slow = -w2 / (alpha + beta), fast = -alpha - beta;
      const a = (u0 - fast * e0) / (2 * beta), bFast = e0 - a;
      const es = Math.exp(slow * t), ef = Math.exp(fast * t);
      out[0] = a * es + bFast * ef;
      out[1] = a * slow * es + bFast * fast * ef;
    }
  }
}

export function compareSuspension(run) {
  if (!run || run.model !== CANDIDATE) throw new Error('Comparison needs the current suspension model.');
  if (!run.params || Object.keys(DEFAULTS).some(key => !Object.hasOwn(run.params, key)))
    throw new Error('Comparison needs a complete setup.');
  const p = validate(run.params);
  const report = { comparison: COMPARISON, candidate: CANDIDATE, reference: REFERENCE,
    params: p, limits: LIMITS, scope: 'Recorded-time numerical agreement; not hardware calibration or a continuous-time error bound.' };
  const unavailable = reason => ({ ...report, status: 'unavailable', reason });
  if (!['complete', 'travel-limit'].includes(run.status)) throw new Error('Invalid candidate run status.');
  if (run.status !== 'complete') return unavailable('The candidate stopped at a travel limit; no end-stop reference is available.');
  if (p.profile !== 'flat') return unavailable('Reference requires a fixed base.');
  if (p.compressionDamping !== p.reboundDamping) return unavailable('Reference requires equal compression and rebound damping.');
  const qEq = (p.mass * G - p.preload) / p.stiffness, e0 = p.initialCompression - qEq;
  const envelope = Math.hypot(e0, p.initialVelocity / Math.sqrt(p.stiffness / p.mass));
  if (qEq - envelope < 0 || qEq + envelope > p.travel)
    return unavailable('The conservative reference energy envelope leaves stroke; no end-stop reference is available.');

  const n = Math.round(p.duration / p.sampleDt) + 1, names = Object.keys(LIMITS);
  for (const name of ['time', ...names]) {
    const a = run.signals?.[name];
    if ((!Array.isArray(a) && !(a instanceof Float64Array)) || a.length !== n)
      throw new Error('Invalid candidate channel: ' + name);
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(a[i])) throw new Error('Nonfinite candidate channel: ' + name);
      if (name === 'time' && Math.abs(a[i] - i*p.sampleDt) > 1e-10)
        throw new Error('Candidate recording times do not match the setup.');
    }
  }
  const signals = { time: run.signals.time, ...Object.fromEntries(names.map(key => [key, new Float64Array(n)])) };
  const errors = Object.fromEntries(names.map(key => [key, { maxAbsolute: 0, rms: 0, limit: LIMITS[key] }]));
  const state = new Float64Array(2);
  for (let i = 0; i < n; i++) {
    oscillatorState(p.mass, p.stiffness, p.compressionDamping, e0, p.initialVelocity, signals.time[i], state);
    signals.compression[i] = qEq + state[0];
    signals.compressionVelocity[i] = state[1];
    signals.force[i] = p.preload + p.stiffness * signals.compression[i] + p.compressionDamping * state[1];
    for (const key of names) {
      const delta = Math.abs(run.signals[key][i] - signals[key][i]);
      if (!Number.isFinite(delta)) throw new Error('Nonfinite analytical comparison.');
      errors[key].maxAbsolute = Math.max(errors[key].maxAbsolute, delta);
      errors[key].rms += delta * delta;
      if (!Number.isFinite(errors[key].rms)) throw new Error('Candidate differences exceed the finite reporting range.');
    }
  }
  for (const key of names) errors[key].rms = Math.sqrt(errors[key].rms / n);
  return { ...report, status: names.every(key => errors[key].maxAbsolute <= LIMITS[key]) ? 'pass' : 'fail',
    sampleCount: n, startTime: signals.time[0], endTime: signals.time[n-1], errors, signals };
}

// Compact report has the complete setup/grid contract; traces remain a viewer detail.
export function comparisonReport(comparison) {
  const { signals, ...report } = comparison;
  return report;
}
