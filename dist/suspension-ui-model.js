import { DEFAULTS, validate } from './suspension.js';
export const FIELD_SCALES = Object.freeze({ mass: 1, stiffness: .001, preload: 1,
  compressionDamping: 1, reboundDamping: 1, travel: 1000, initialCompression: 1000,
  initialVelocity: 1, amplitude: 1000, frequency: 1, duration: 1, dt: 1000, sampleDt: 1000 });
export function setupFromFields(values, previous = DEFAULTS) {
  const p = {};
  for (const [key, scale] of Object.entries(FIELD_SCALES)) {
    if (typeof values[key] !== 'string' || !values[key].trim()) throw new Error(key + ' is required.');
    const shown = Number(values[key]);
    p[key] = shown === previous[key] * scale ? previous[key] : shown / scale;
  }
  p.profile = values.profile;
  return validate(p);
}
// Handles the final off-grid endpoint retained by a travel-limited run.
export function frameAt(times, time) {
  let lo = 0, hi = times.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (times[mid] <= time) lo = mid; else hi = mid - 1;
  }
  return lo;
}
