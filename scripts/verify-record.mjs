import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { replay, CHANNELS } from '../dist/physics.js';
if (!process.argv[2]) throw new Error('Usage: node scripts/verify-record.mjs run.json');
const raw = await readFile(process.argv[2], 'utf8'), saved = JSON.parse(raw), actual = replay(raw);
const differences = {};
for (const key of CHANNELS) {
  const a = actual.signals[key], b = saved.signals?.[key];
  assert.ok(Array.isArray(b) && b.length === a.length, 'Invalid channel: ' + key);
  let delta = 0, scale = 1;
  for (let i = 0; i < a.length; i++) {
    assert.ok(Number.isFinite(b[i]), 'Nonfinite saved sample');
    delta = Math.max(delta, Math.abs(a[i] - b[i]));
    scale = Math.max(scale, Math.abs(a[i]));
  }
  assert.ok(delta <= 1e-10 * scale, key + ' exceeds cross-runtime tolerance');
  differences[key] = delta;
}
for (const key of Object.keys(actual.metrics)) {
  assert.ok(Number.isFinite(saved.metrics?.[key]), 'Missing metric ' + key);
  assert.ok(Math.abs(saved.metrics[key] - actual.metrics[key]) <= 1e-10 * Math.max(1,Math.abs(actual.metrics[key])), key + ' metric mismatch');
}
assert.deepEqual(saved.events, actual.events);
console.log(JSON.stringify({ result: 'numerical agreement', normalizedTolerance: 1e-10, maxAbsoluteDifferences: differences }, null, 2));

