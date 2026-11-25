import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {solveFootprint,configuration} from '../dist/pressure-footprint.js';
import {solveSealedPlane} from '../dist/sealed-plane.js';
import {RELAXED_MODEL} from '../dist/sealed-casing.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
export const sourcePaths=['scripts/pressure-footprint-check.mjs','scripts/pressure-footprint-browser-check.mjs','server.mjs','dist/style.css','dist/pressure-footprint.js','dist/pressure-footprint-worker.js','dist/pressure-footprint-app.js','dist/pressure-footprint.html','dist/sealed-plane.js','dist/static-dense.js','dist/sealed-casing.js','dist/sealed-casing-example.js','dist/tyre-relaxation.js','dist/tyre-gas.js','dist/wheel-ring.js'];
export async function sourceHashes(){return Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,hash(await readFile(p))])));}
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} vs ${b}; budget ${t}`);
const archiveBytes=gunzipSync(Buffer.from((await readFile('docs/evidence/contact-relaxation-report.json.gz.b64','utf8')).trim(),'base64')),archive=JSON.parse(archiveBytes);
const report={scope:'Fixed illustrative section, phase zero, flat static only. No measured calibration or native receiving.',node:process.version,sourcesSha256:await sourceHashes(),archiveSha256:hash(archiveBytes),cases:[],success:false};
await mkdir('artifacts/pressure-footprint',{recursive:true});
for(const pressure of [120000,160000,200000]){
 const start=performance.now(),states=[...solveFootprint({pressure})],elapsedMs=performance.now()-start;
 const coarse=archive.cases.find(c=>c.model===RELAXED_MODEL&&c.nodes===256&&c.pressure===pressure&&c.phase===0),fine=archive.cases.find(c=>c.model===RELAXED_MODEL&&c.nodes===512&&c.pressure===pressure&&c.phase===0);
 const comparisons=[];
 for(const [i,s] of states.entries()){
  const a=coarse.states[i],b=fine.states[i];near(s.reaction,a.reaction,1e-7);near(s.potential,a.state.potential,1e-10);near(s.pressure,a.state.gaugePressure,1e-7);near(s.volume,a.state.volume,1e-14);for(let j=0;j<s.coordinates.length;j++)near(s.coordinates[j],a.coordinates[j],1e-12);
  const error=Math.abs(s.reaction-b.reaction),budget=1+.05*Math.max(s.reaction,b.reaction);assert.ok(error<=budget);assert.ok(s.metrics.maxKktForce<=1e-5&&s.metrics.minGap>=-1e-12);comparisons.push({index:i,forceError:error,budget});
 }
 for(const [i,j] of [[0,6],[1,5],[2,4]]){near(states[i].reaction,states[j].reaction,1e-4);near(states[i].potential,states[j].potential,1e-8);}
 // Independent derivative of the minimized total potential with respect to lowering.
 const s=states[2],c=configuration({pressure}),h=1e-7;
 const p=solveSealedPlane(c,s.height+h,s.coordinates,{casingModel:RELAXED_MODEL}),n=solveSealedPlane(c,s.height-h,s.coordinates,{casingModel:RELAXED_MODEL});assert.ok(p.locallyAdmissible&&n.locallyAdmissible);const energyDerivative=-(p.state.potential-n.state.potential)/(2*h);near(energyDerivative,s.reaction,.003);
 report.cases.push({pressure,elapsedMs,states,comparisons,energyDerivative,energyError:Math.abs(energyDerivative-s.reaction)});console.log(pressure,elapsedMs);
}
assert.deepEqual(await sourceHashes(),report.sourcesSha256);report.success=true;
await writeFile('artifacts/pressure-footprint/numerical.json',JSON.stringify(report,null,2)+'\n');
const summary={...report,cases:report.cases.map(c=>({...c,states:c.states.map(({coordinates,contacts,stability,...s})=>s)}))};
await writeFile('docs/evidence/pressure-footprint-numerical.json',JSON.stringify(summary,null,2)+'\n');
