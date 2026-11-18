import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {createSweptCasing,RELAXED_MODEL} from '../dist/sealed-casing.js';import {runLoaded} from './lib/tyre-native-loaded.mjs';
const dir='artifacts/equal-load';await mkdir(dir,{recursive:true});
const paths=['scripts/lib/tyre-native-loaded.mjs','scripts/tyre-equal-load.mjs','dist/moving-wheel.js','dist/sealed-casing.js','dist/tyre-relaxation.js','dist/wheel-ring.js','dist/tyre-gas.js','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm','docs/evidence/contact-relaxation-report.json.gz.b64'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')]))),sourcesSha256=await hashes(),archive=JSON.parse(gunzipSync(Buffer.from((await readFile(paths.at(-1),'utf8')).trim(),'base64'))),runs=[];
for(const nodes of [256,512])for(const contactTime of [.001,.0005])for(const dt of [.0000078125,.00000390625]){
 const c=archive.cases.find(c=>c.model===RELAXED_MODEL&&c.nodes===nodes&&c.pressure===160000&&c.phase===0),r=await runLoaded(createSweptCasing(c.configuration,c.model),c.states[2],{integrator:'implicitfast',appliedLoad:400,contactTime,dt,duration:.1,sampleDt:.001});runs.push(r);console.log(nodes,contactTime,dt,r.status,r.maxResidual,r.frames.at(-1).maxBodySpeed);await writeFile(`${dir}/progress.json`,JSON.stringify(runs));
}
assert.deepEqual(await hashes(),sourcesSha256);await writeFile(`${dir}/report.json`,JSON.stringify({scope:'Equal 400 N constant hub load, nominal mass, 1.6 bar. Native contact/mesh/settling diagnostic; no production admission or calibration.',sourcesSha256,runs})+'\n');
