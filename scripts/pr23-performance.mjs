// Serial review measurements, not a CI speed threshold or real-time certificate.
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {cpus, availableParallelism, platform, arch, release} from 'node:os';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {constructPosture} from '../dist/rider-posture.js';
import {DEFAULTS as PASSIVE, compilePassiveRider, evaluatePassiveRider} from '../dist/rider-passive.js';
import {nativePassiveXML, inspectNativePassive} from '../dist/rider-native.js';
import {getRuntime, geometryLimits, validate as validateWheel} from '../dist/moving-wheel.js';
import {run, preset, validate, modelXML, WHEEL_DEFAULTS, smoothProfile} from '../dist/trail-bike.js';

const args = process.argv.slice(2);
let output = 'artifacts/performance/pr23.json', sourceRef = null, profile = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--profile') profile = true;
  else if (['--output', '--source-ref'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) {
    const key = args[i++]; if (key === '--output') output = args[i]; else sourceRef = args[i];
  } else throw Error('Usage: node scripts/pr23-performance.mjs [--output file.json] [--source-ref SHA] [--profile]');
}
if (sourceRef !== null && !/^[a-f0-9]{40}$/.test(sourceRef)) throw Error('source-ref must be a complete commit SHA.');
const digest = value => createHash('sha256').update(value).digest('hex');
const optionalFile = async path => {try {return (await readFile(path, 'utf8')).trim();} catch {return null;}};
const stats = samples => {const sorted = [...samples].sort((a, b) => a - b); return {samples, min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1)};};
const sourceSha256 = {};
for (const path of ['scripts/pr23-performance.mjs', 'dist/rider-posture.js', 'dist/rider-native.js', 'dist/rider-passive.js',
  'dist/trail-bike.js', 'dist/moving-wheel.js', 'dist/wheel-limits.js', 'dist/bike-assembly.js', 'dist/bike-rig.js',
  'dist/linkage.js', 'dist/rig-loads.js', 'dist/travel-buffer.js', 'dist/drive-controls.js', 'dist/terrain.js',
  'dist/vendor/mujoco-3.16.0/mujoco.js', 'dist/vendor/mujoco-3.16.0/mujoco.wasm']) {
  sourceSha256[path] = digest(await readFile(new URL('../' + path, import.meta.url)));
}
const receipt = {
  format: 'bikelab-pr23-performance-0.1', measuredAt: new Date().toISOString(), sourceRef, sourceSha256,
  mode: profile ? 'single-profile-run' : 'serial-warmed-review',
  scope: 'Unchanged guided connected bike and static rider prerequisites. No articulated integration, physical calibration, target-hardware or real-time acceptance.',
  method: {warmupsPerCase: profile ? 0 : 1, measuredRepeats: profile ? 1 : 3,
    timing: 'Monotonic wall time. Run includes model build, integration, guards, observations and result materialization; JSON/Node clone measured separately.',
    micro: 'Batch loop and checksum overhead included; no overhead subtraction. Native forward fixture is static, not a trajectory.',
    concurrency: 'Serial in one process; operator must avoid concurrent workloads. Shared host contention is uncontrolled.',
    memory: 'Before/after snapshots and cumulative process RSS high-water, not isolated per-case peaks or leak evidence.',
    profile: 'Use --profile under node --cpu-prof separately; never combine its timing with the unprofiled samples.'},
  environment: {node: process.version, v8: process.versions.v8, platform: platform(), arch: arch(), kernel: release(),
    cpuModel: cpus()[0]?.model, visibleLogicalCPUs: cpus().length, availableParallelism: availableParallelism(),
    cpuMax: await optionalFile('/sys/fs/cgroup/cpu.max'), cpuset: await optionalFile('/sys/fs/cgroup/cpuset.cpus.effective'),
    memoryMax: await optionalFile('/sys/fs/cgroup/memory.max'), cpuStatBefore: await optionalFile('/sys/fs/cgroup/cpu.stat')},
  micro: [], connected: []
};
const start = performance.now(), mj = await getRuntime();
receipt.lazyRuntimeInitializationMs = performance.now() - start;
receipt.runtimeInitializationScope = 'getRuntime after JS imports; excludes process/module startup, includes lazy WASM loading/initialization.';
// The official build deliberately does not export HEAPU8. A public typed
// buffer view exposes its backing capacity without touching private getters.
const memoryProbe = new mj.DoubleBuffer(1);
const memory = () => ({...process.memoryUsage(), processHighWaterRssBytes: process.resourceUsage().maxRSS * 1024,
  wasmHeapCapacityBytes: memoryProbe.GetView().buffer.byteLength});
receipt.memoryBefore = memory();

function batch(name, count, fn, details = {}) {
  let checksum = 0;
  const once = () => {const t = performance.now(); for (let i = 0; i < count; i++) checksum += fn(i); return performance.now() - t;};
  once(); const samples = [once(), once(), once()];
  assert.ok(Number.isFinite(checksum));
  const result = {name, iterationsPerBatch: count, batchMs: stats(samples), microsecondsPerCall: stats(samples.map(ms => ms * 1000 / count)), checksum, ...details};
  receipt.micro.push(result); console.error(name, result.microsecondsPerCall.median.toFixed(3), 'us/call');
}
if (!profile) {
  batch('construct-posture', 1000, () => constructPosture().aggregate.mass);
  batch('compile-passive-specification', 1000, () => compilePassiveRider().laws[0].angle0);
  const compiled = compilePassiveRider(), q = new Float64Array(4), v = new Float64Array([.2, -.3, .1, -.1]), out = new Float64Array(20);
  batch('evaluate-four-passive-joints', 500000, i => {q[0] = i & 1 ? .02 : -.02; evaluatePassiveRider(compiled, q, v, out); return out[1] + out[7];});
  const loaded = {joints: {hip: {...PASSIVE.joints.hip, restAngle: PASSIVE.joints.hip.restAngle + .12}}};
  const xml = nativePassiveXML(loaded), model = mj.MjModel.from_xml_string(xml), data = new mj.MjData(model);
  try {
    batch('reused-native-passive-forward', 5000, () => {mj.mj_forward(model, data); return data.qacc[0];},
      {modelXMLSha256: digest(xml), nv: model.nv, specification: compilePassiveRider(loaded).spec,
        scope: 'Closed initial pose with offset hip spring rest; repeated forward at unchanged q/qvel, no integration.'});
  } finally {data.delete(); model.delete();}
  let checksum = 0;
  const inspectBatch = async () => {const t = performance.now(); for (let i = 0; i < 20; i++) checksum += (await inspectNativePassive(loaded)).aggregate.mass; return performance.now() - t;};
  await inspectBatch(); const inspection = []; for (let i = 0; i < 3; i++) inspection.push(await inspectBatch());
  receipt.micro.push({name: 'complete-native-inspection', iterationsPerBatch: 20, batchMs: stats(inspection),
    microsecondsPerCall: stats(inspection.map(ms => ms * 1000 / 20)), checksum, scope: 'Includes XML construction, model/data/buffer allocation, forward evaluation, report copies and native deletion.'});
  for (const nodes of [32, 64, 128]) {
    const p = validateWheel({...WHEEL_DEFAULTS, nodes}), terrain = smoothProfile('flat'), hub = new Float64Array([0, 1]);
    const xyz = new Float64Array(3 * nodes), previous = new Float64Array(3 * nodes), result = {};
    for (let i = 0; i < nodes; i++) {xyz[3 * i] = (p.radius - p.skin) * Math.sin(2 * Math.PI * i / nodes); xyz[3 * i + 2] = 1 - (p.radius - p.skin) * Math.cos(2 * Math.PI * i / nodes);}
    previous.set(xyz); geometryLimits(p, terrain, hub, xyz, previous, result); assert.equal(result.reason, null);
    batch('separated-ring-guard-' + nodes, 1000, () => {geometryLimits(p, terrain, hub, xyz, previous, result); return result.inner;},
      {nodes, nonAdjacentEdgePairs: nodes * (nodes - 3) / 2, scope: 'Fixed undeformed separated ring; guard scaling only, not a wheel-fidelity comparison.'});
  }
}

const cases = [];
for (const bike of ['full', 'hardtail']) for (const kind of ['flat', 'flight', 'square']) {
  const scenario = preset(kind, bike);
  scenario.motion = {...scenario.motion, duration: kind === 'flat' ? .1 : kind === 'flight' ? .2 : 1};
  cases.push({name: bike + '-' + kind, scenario});
}
for (const c of cases) {
  if (profile && c.name !== 'full-square') continue;
  const timings = [], serial = [], clones = [], snapshots = [];
  let canonical, expectedHash, recordInfo;
  const attempts = profile ? 1 : 4;
  for (let repeat = 0; repeat < attempts; repeat++) {
    const before = memory(), t = performance.now(), r = await run(c.scenario), ms = performance.now() - t;
    assert.equal(r.status, 'completed', c.name + ': unsupported/early-stopped case must not become a throughput result');
    assert.ok(Math.abs(r.summary.acceptedTime - r.scenario.motion.duration) < 1e-9);
    const afterRun = memory(), jsonStart = performance.now(), json = JSON.stringify(r), jsonMs = performance.now() - jsonStart;
    const hash = digest(json); if (expectedHash) assert.equal(hash, expectedHash, c.name + ': deterministic output changed'); else expectedHash = hash;
    const cloneStart = performance.now(), cloned = structuredClone(r), cloneMs = performance.now() - cloneStart;
    assert.equal(cloned.frames.length, r.frames.length);
    if (profile || repeat > 0) {timings.push(ms); serial.push(jsonMs); clones.push(cloneMs); snapshots.push({before, afterRun, afterSerializationAndClone: memory()});}
    canonical = r.scenario;
    const slots = Math.round(canonical.motion.duration / canonical.motion.sampleDt) + canonical.commands.length + 2;
    recordInfo = {resultSha256: hash, resultJSONBytes: Buffer.byteLength(json), status: r.status,
      acceptedSeconds: r.summary.acceptedTime, steps: r.summary.steps, frames: r.frames.length,
      sampledContacts: r.frames.reduce((sum, frame) => sum + frame.contacts.length, 0),
      maxSampledContacts: Math.max(...r.frames.map(frame => frame.contacts.length)),
      peakForce: r.summary.peakForce, maxEnergyBalanceResidual: r.summary.maxResidual,
      reservedContactSlots: slots, reservedContactBytes: slots * 512 * 12 * 8};
    console.error(c.name, profile ? 'profile' : repeat ? 'sample ' + repeat : 'warmup', ms.toFixed(1), 'ms');
  }
  const canonicalModel = modelXML(canonical), shape = mj.MjModel.from_xml_string(canonicalModel);
  let modelSize; try {modelSize = {nv: shape.nv, nq: shape.nq, bodies: shape.nbody};} finally {shape.delete();}
  receipt.connected.push({name: c.name, scenario: canonical, modelXMLSha256: digest(canonicalModel), modelSize, ...recordInfo,
    runMs: stats(timings), wallSecondsPerSimulatedSecond: stats(timings.map(ms => ms / 1000 / recordInfo.acceptedSeconds)),
    meanWallMicrosecondsPerAcceptedStepIncludingSetup: stats(timings.map(ms => ms * 1000 / recordInfo.steps)),
    jsonSerializationMs: stats(serial), nodeStructuredCloneMs: stats(clones), memorySnapshots: snapshots});
}
receipt.environment.cpuStatAfter = await optionalFile('/sys/fs/cgroup/cpu.stat');
receipt.memoryAfter = memory(); receipt.finishedAt = new Date().toISOString();
memoryProbe.delete();
// Validate the measurement record before publishing it; no physics settings change.
assert.equal(receipt.connected.length, profile ? 1 : 6);
for (const c of receipt.connected) {
  assert.equal(c.runMs.samples.length, profile ? 1 : 3);
  assert.ok(c.runMs.samples.every(t => Number.isFinite(t) && t > 0));
  const canonical = validate(c.scenario); assert.equal(canonical.wheel.nodes, 64); assert.equal(canonical.motion.dt, .00003125);
}
await mkdir(dirname(resolve(output)), {recursive: true});
await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
console.error('Saved', output);
