import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {createSweptCasing,RELAXED_MODEL} from '../dist/sealed-casing.js';import {runLoaded} from './lib/tyre-native-loaded.mjs';
const dir='artifacts/native-loaded';await mkdir(dir,{recursive:true});
const paths=['scripts/lib/tyre-native-loaded.mjs','scripts/tyre-native-loaded.mjs','dist/moving-wheel.js','dist/sealed-casing.js','dist/tyre-relaxation.js','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm','docs/evidence/contact-relaxation-report.json.gz.b64'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')]))),sourcesSha256=await hashes();
const archive=JSON.parse(gunzipSync(Buffer.from((await readFile(paths.at(-1),'utf8')).trim(),'base64'))),runs=[];
const pilot=process.argv.includes('--pilot'),integrator=process.argv.includes('--implicit')?'implicitfast':'Euler';
for(const nodes of pilot?[256]:[256,512])for(const scale of pilot?[1]:[.5,1,2])for(const damping of pilot?[.5]:[0,.5])for(const dt of pilot?[.0000078125]:[.000015625,.0000078125,.00000390625]){
 const c=archive.cases.find(c=>c.model===RELAXED_MODEL&&c.nodes===nodes&&c.pressure===160000&&c.phase===0),model=createSweptCasing(c.configuration,c.model);
 const r=await runLoaded(model,c.states[2],{integrator,dt,sampleDt:.001,duration:.02,hubMass:3*scale,tyreMass:scale,hubInertia:.08*scale,edgeViscosity:damping});runs.push(r);console.log(nodes,scale,damping,dt,r.status,r.termination,r.maxResidual,r.maxPenetration);await writeFile(`${dir}/progress.json`,JSON.stringify(runs));
}
assert.deepEqual(await hashes(),sourcesSha256);await writeFile(`${dir}/${pilot?'pilot':integrator==='Euler'?'report':'implicit-report'}.json`,JSON.stringify({scope:'Offline free-hub native loaded transient from hard-plane equilibrium; no runtime admission, calibration or cost claim.',sourcesSha256,runs},null,2)+'\n');
