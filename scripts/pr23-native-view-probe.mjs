// Public getter identity probe, not a performance benchmark or lifetime guarantee.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {getRuntime} from '../dist/moving-wheel.js';
import {modelXML, preset} from '../dist/trail-bike.js';

const output = process.argv[2] || 'artifacts/performance/pr23-native-views.json';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const mj = await getRuntime(), xml = modelXML(preset('square', 'full'));
let model, data;
try {
  model = mj.MjModel.from_xml_string(xml); data = new mj.MjData(model); mj.mj_forward(model, data);
  const arrays = [];
  for (const [owner, object, names] of [
    ['data', data, ['qpos', 'qvel', 'qacc', 'qfrc_damper', 'qfrc_constraint', 'xpos', 'flexedge_length']],
    ['model', model, ['body_mass', 'flexedge_length0']]
  ]) for (const name of names) {
    const a = object[name], b = object[name];
    arrays.push({property: owner + '.' + name, type: a.constructor.name, length: a.length,
      distinctViewObjects: a !== b, sameBackingBuffer: a.buffer === b.buffer,
      sameByteOffset: a.byteOffset === b.byteOffset, sameByteLength: a.byteLength === b.byteLength});
  }
  const sourceSha256 = {};
  for (const path of ['scripts/pr23-native-view-probe.mjs', 'dist/trail-bike.js', 'dist/vendor/mujoco-3.16.0/mujoco.js', 'dist/vendor/mujoco-3.16.0/mujoco.wasm']) {
    sourceSha256[path] = digest(await readFile(new URL('../' + path, import.meta.url)));
  }
  const result = {format: 'bikelab-pr23-native-view-probe-0.1', node: process.version, sourceSha256,
    modelXMLSha256: digest(xml), nv: model.nv,
    scope: 'Two consecutive public reads at a fixed state. Distinct views alias native storage; this does not count allocations in an integrated run or prove validity after memory growth, reallocation or owner deletion.', arrays};
  await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(arrays, null, 2));
} finally {data?.delete(); model?.delete();}
