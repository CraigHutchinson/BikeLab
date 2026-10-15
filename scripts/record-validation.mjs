import { readRecord, simulate, MODEL, CHANNELS } from '../dist/physics.js';

export function verifyRecord(text) {
  const saved = readRecord(text);
  if (saved.model !== MODEL) throw new Error('Verification requires the matching model revision. Older setup files can be rerun, not certified as current records.');
  const actual = simulate(saved.params);
  const differences = {};
  for (const key of CHANNELS) {
    const a = actual.signals[key], b = saved.signals?.[key];
    if (!Array.isArray(b) || b.length !== a.length) throw new Error('Invalid channel: ' + key);
    let delta = 0, scale = 1;
    for (let i = 0; i < a.length; i++) {
      if (!Number.isFinite(b[i])) throw new Error('Nonfinite saved sample in ' + key);
      delta = Math.max(delta, Math.abs(a[i] - b[i]));
      scale = Math.max(scale, Math.abs(a[i]));
    }
    if (delta > 1e-10 * scale) throw new Error(key + ' exceeds cross-runtime tolerance');
    differences[key] = delta;
  }
  for (const key of Object.keys(actual.metrics)) {
    if (!Number.isFinite(saved.metrics?.[key])) throw new Error('Missing metric ' + key);
    if (Math.abs(saved.metrics[key] - actual.metrics[key]) > 1e-10 * Math.max(1, Math.abs(actual.metrics[key])))
      throw new Error(key + ' metric mismatch');
  }
  if (!Array.isArray(saved.events) || saved.events.length !== actual.events.length)
    throw new Error('Contact event count mismatch.');
  for (let i = 0; i < actual.events.length; i++) {
    for (const key of ['time','type','uncertainty']) {
      if (saved.events[i]?.[key] !== actual.events[i][key]) throw new Error('Contact event mismatch.');
    }
  }
  return { result: 'numerical agreement', normalizedTolerance: 1e-10, maxAbsoluteDifferences: differences };
}
