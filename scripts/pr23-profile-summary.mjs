// Summarize sampled self time; never interpret these shares as speedup promises.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const [input = 'artifacts/performance/pr23.cpuprofile', output = 'artifacts/performance/pr23-profile-summary.json'] = process.argv.slice(2);
const raw = await readFile(input), profile = JSON.parse(raw);
assert.equal(profile.samples.length, profile.timeDeltas.length);
const byId = new Map(profile.nodes.map(n => [n.id, n])), functions = new Map(), categories = new Map();
const normalizedURL = url => url.replace(/^file:\/\/.*\/BikeLab\//, '');
function category(frame) {
  if (frame.functionName === '(garbage collector)') return 'V8 garbage collection';
  if (frame.url.startsWith('wasm:')) return 'WASM including native bindings';
  if (frame.url.includes('/vendor/mujoco-3.16.0/')) return 'MuJoCo JavaScript binding glue';
  if (frame.url === 'dist/trail-bike.js') return 'Connected bike JavaScript';
  if (frame.url === 'dist/moving-wheel.js') return 'Moving wheel JavaScript';
  if (frame.url.startsWith('dist/')) return 'Other application JavaScript';
  return 'Other runtime, harness and startup';
}
let sampledMicroseconds = 0;
for (let i = 0; i < profile.samples.length; i++) {
  const node = byId.get(profile.samples[i]), us = profile.timeDeltas[i];
  assert.ok(node && Number.isFinite(us) && us >= 0);
  const {functionName, url, lineNumber, columnNumber} = node.callFrame;
  const frame = {functionName, url: normalizedURL(url), lineNumber, columnNumber}, key = JSON.stringify(frame);
  const row = functions.get(key) || {...frame, samples: 0, selfMicroseconds: 0};
  row.samples++; row.selfMicroseconds += us; functions.set(key, row);
  const group = category(frame); categories.set(group, (categories.get(group) || 0) + us);
  sampledMicroseconds += us;
}
assert.ok(sampledMicroseconds > 0);
const percent = us => 100 * us / sampledMicroseconds;
const rows = [...functions.values()].sort((a, b) => b.selfMicroseconds - a.selfMicroseconds);
const result = {
  format: 'bikelab-pr23-cpu-profile-summary-0.1',
  profileSha256: createHash('sha256').update(raw).digest('hex'), profileBytes: raw.length,
  summaryScriptSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
  method: 'Node --cpu-prof, default sampling interval; timeDeltas attributed to sampled leaf frames, merged by function/URL/location across caller stacks. Zero-based source locations. No inclusive-time or call-count claim.',
  scope: 'One separate complete full-square process, including imports/runtime initialization, run, result serialization/hash/clone, model recompilation for dimensions, receipt writing and shutdown. No profile warm-up. Profile timing is not an unprofiled throughput sample. Sample shares do not establish optimization speedups or native-versus-binding ownership within WASM.',
  nodes: profile.nodes.length, samples: profile.samples.length, sampledMicroseconds,
  processProfileMicroseconds: profile.endTime - profile.startTime,
  categories: [...categories].map(([name, selfMicroseconds]) => ({name, selfMicroseconds, percent: percent(selfMicroseconds)})).sort((a, b) => b.selfMicroseconds - a.selfMicroseconds),
  functions: rows.map(row => ({...row, percent: percent(row.selfMicroseconds)}))
};
assert.equal(rows.reduce((sum, row) => sum + row.selfMicroseconds, 0), sampledMicroseconds);
assert.equal([...categories.values()].reduce((sum, us) => sum + us, 0), sampledMicroseconds);
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({categories: result.categories, topFunctions: result.functions.slice(0, 12)}, null, 2));
