// Numerical receiving receipt, not a performance benchmark or calibration.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {run, articulatedPreset} from '../dist/trail-bike.js';
const output=process.argv[2]??'artifacts/rider-connected/evidence.json';
const digest=value=>createHash('sha256').update(value).digest('hex');
const paths=['dist/rider-connected.js','dist/rider-interfaces.js','dist/rider-native.js','dist/rider-passive.js','dist/rider-posture.js','dist/trail-bike.js','dist/bike-assembly.js','dist/linkage.js','dist/moving-wheel.js','dist/rig-loads.js','dist/travel-buffer.js','dist/wheel-limits.js','dist/drive-controls.js','dist/terrain.js','dist/trail-bike-app.js','dist/trail-bike.html','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm','scripts/rider-connected-evidence.mjs'];
const sourceSha256={};for(const path of paths)sourceSha256[path]=digest(await readFile(new URL('../'+path,import.meta.url)));
const receipt={format:'bikelab-connected-rider-evidence-0.1',createdAt:new Date().toISOString(),node:process.version,v8:process.versions.v8,sourceSha256,
 scope:'Uncalibrated passive unseated motion; no saddle, active controller, anatomical validation, component survival, 3D or real-time claim. Initial loaded poses are relaxation transients, not equilibria.',
 budgets:{maxClosureGapM:.002,maxEnergyBalanceJ:.5,maxPhysicalMomentumResidual:.1,maxClosureAngularImpulseNmS:.02,mediumFinePositionM:.0005,mediumFineEnergyJ:.05},cases:[],refinement:[]};
async function measure(name,scenario){
 const r=await run(scenario),first=r.frames[0],last=r.frames.at(-1);
 assert.equal(r.status,'completed',name);assert.ok(r.summary.maxClosureGap<.002,name);assert.ok(r.summary.maxResidual<.5,name);
 const physical=[0,1,2].map(k=>Math.max(...r.frames.map(f=>Math.abs(f.momentumResidual[k]))));assert.ok(physical.every(x=>x<.1),name);assert.ok(Math.abs(r.summary.closureAngularImpulse)<.02,name);
 const result={name,scenario:r.scenario,resultSha256:digest(JSON.stringify(r)),status:r.status,summary:r.summary,maxPhysicalMomentumResidual:physical,
  initialGapM:Math.max(...first.articulated.interfaces.attachments.map(a=>Math.hypot(...a.gap))),initialRelativeSiteSpeed:Math.max(...first.articulated.interfaces.attachments.map(a=>Math.hypot(...a.riderVelocity.map((v,k)=>v-a.bikeVelocity[k])))),
  final:{time:last.time,frame:last.frame,com:last.articulated.centerOfMass,q:last.articulated.nativeCoordinates,velocity:last.articulated.nativeVelocities,energy:last.energy,physicalMomentumResidual:last.momentumResidual,afterNumericalClosure:last.articulated.momentumResidualAfterClosure},
  sampledFrames:r.frames.length,sampledContacts:r.frames.reduce((n,f)=>n+f.contacts.length,0)};
 assert.ok(result.initialGapM<=1e-10);assert.ok(result.initialRelativeSiteSpeed<=1e-10);receipt.cases.push(result);console.error(name,'completed');return result;
}
for(const bike of ['full','hardtail']){
 await measure(bike+'-flight',articulatedPreset(bike,'flight'));
 const a=articulatedPreset(bike),runs=[];
 for(const dt of [.00003125,.000015625,.0000078125])runs.push(await measure(bike+'-standing-dt-'+dt,{...a,motion:{...a.motion,dt}}));
 const [coarse,medium,fine]=runs;
 const difference=(a,b)=>({frame:a.final.frame.map((x,k)=>Math.abs(x-b.final.frame[k])),com:a.final.com.map((x,k)=>Math.abs(x-b.final.com[k])),energy:Math.abs(a.final.energy-b.final.energy)});
 const errors={bike,coarseFine:difference(coarse,fine),mediumFine:difference(medium,fine)};
 assert.ok(errors.mediumFine.frame.slice(0,2).every(x=>x<.0005));assert.ok(errors.mediumFine.com.every(x=>x<.0005));assert.ok(errors.mediumFine.energy<.05);receipt.refinement.push(errors);
 await measure(bike+'-standing-closure-10ms',{...a,articulated:{...a.articulated,closureTime:.01}});
}
const legacy=JSON.parse(await readFile(new URL('../docs/evidence/pr23-performance.json',import.meta.url))).connected.find(c=>c.name==='full-flat');
const legacyHash=digest(JSON.stringify(await run(legacy.scenario)));assert.equal(legacyHash,legacy.resultSha256);
receipt.legacyControl={case:'full-flat',baseline:'303380ceb2ffc517edf6d8d1b61079eb196fdc75',resultSha256:legacyHash,exactMatch:true};
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(receipt,null,2)+'\n');console.error('Saved',output);
