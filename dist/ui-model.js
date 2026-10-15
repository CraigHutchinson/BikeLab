import { DEFAULTS, validate } from './physics.js';
export const FIELD_SCALES = Object.freeze({
  mass: 1, radius: 1000, stiffness: 0.001, damping: 1,
  amplitude: 1000, frequency: 1, duration: 1, dt: 1000, sampleDt: 1000, lift: 1000
});
export function setupFromFields(values, previous = DEFAULTS) {
  const params = {};
  for (const [key, scale] of Object.entries(FIELD_SCALES)) {
    if (typeof values[key] !== 'string' || !values[key].trim()) throw new Error(key + ' is required.');
    const shown = Number(values[key]);
    // Preserve imported precision when the displayed value was not changed.
    params[key] = shown === previous[key] * scale ? previous[key] : shown / scale;
  }
  params.profile = values.profile;
  return validate(params);
}
export function sceneBounds(run) {
  let bottom = 0, top = 0;
  for (let i = 0; i < run.signals.time.length; i++) {
    bottom = Math.min(bottom, run.signals.platen[i], run.signals.height[i] - run.params.radius);
    top = Math.max(top, run.signals.platen[i], run.signals.height[i] + run.params.radius);
  }
  return { bottom: bottom - 0.03, top: top + 0.06 };
}
