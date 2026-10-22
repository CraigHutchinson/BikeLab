import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {run,preset} from '../dist/trail-bike.js';
import {geometryFor} from '../dist/linkage.js';

export function reviewTrailSection(r){
 assert.equal(r.status,'completed');assert.equal(r.scenario.bike.rider,'compliant');assert.equal(r.frames.length,301);
 const g=geometryFor(r.scenario.bike),transitions=[],phases=[];let mask=-1,loaded=false,current;
 const peaks={fork:0,shock:0,pitch:0,momentumResidual:[0,0,0]};
 for(const f of r.frames){
  assert.ok(f.fork>=-1e-9&&f.fork<=g.forkTravel);assert.ok(f.shock>=-1e-9&&f.shock<=g.shockTravel);assert.ok(Math.abs(f.frame[2])<=.35);
  peaks.fork=Math.max(peaks.fork,f.fork);peaks.shock=Math.max(peaks.shock,f.shock);peaks.pitch=Math.max(peaks.pitch,Math.abs(f.frame[2]));
  for(let k=0;k<3;k++)peaks.momentumResidual[k]=Math.max(peaks.momentumResidual[k],Math.abs(f.momentumResidual[k]));
  const supported=[0,1].map(k=>{
   const w=f.wheels[k],contacts=f.contacts.filter(c=>c.wheel===k),force=[0,0];
   for(const c of contacts){force[0]+=c.force[0];force[1]+=c.force[1];}
   for(let j=0;j<2;j++)assert.ok(Math.abs(force[j]-w.ground[j])<1e-6);
   assert.equal(w.limits.reason,null);assert.ok(w.limits.penetration<=r.scenario.wheel.maxPenetration);assert.ok(w.limits.inner>0);
   return contacts.reduce((sum,c)=>sum+c.normalForce,0)>1e-6;
  });
  const next=Number(supported[0])+2*Number(supported[1]);
  if(next===3)loaded=true;
  if(next!==mask){transitions.push({time:f.time,frontSupported:supported[0],rearSupported:supported[1]});current={mask:next,afterFirstBothSupported:loaded,firstTime:f.time,lastTime:f.time,samples:0};phases.push(current);mask=next;}
  current.lastTime=f.time;current.samples++;
 }
 const zeroSupport=phases.filter(p=>p.mask===0&&p.afterFirstBothSupported&&p.samples>=2);
 return {bike:r.scenario.bike.bike,dt:r.scenario.motion.dt,sampleDt:r.scenario.motion.sampleDt,status:r.status,acceptedTime:r.summary.acceptedTime,
  initialEnergy:r.summary.initialEnergy,maxEnergyResidual:r.summary.maxResidual,peakGroundForce:r.summary.peakForce,maxPenetration:r.summary.peakPenetration,peaks,
  frameDisplacementX:r.frames.at(-1).frame[0]-r.frames[0].frame[0],transitions,sampledZeroSupportIntervals:zeroSupport,
  interpretation:'Contact states use summed recorded normal force > 1e-6 N. Event times are sampled, not exact take-off times. Zero-support samples do not prove geometric separation; initial zero-load contact is not a jump. Guided mass, stored suspension energy and launch speed are authored; no active rider or physical calibration.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length>3)throw Error('Usage: node scripts/trail-section-review.mjs [output-directory]');
 const dir=resolve(process.argv[2]??'artifacts/trail-section');await mkdir(dir,{recursive:true});const cases=[];
 for(const bike of ['full','hardtail'])for(const refinement of [1,2]){
  const a=preset('trail',bike);a.motion.dt=.00003125/refinement;const r=await run(a),name=bike+'-dt'+refinement,text=JSON.stringify(r);
  await writeFile(join(dir,name+'.json'),text);const result=reviewTrailSection(r);cases.push({...result,recordSha256:createHash('sha256').update(text).digest('hex')});
  console.log(JSON.stringify({case:name,...result}));
 }
 const sources={};for(const name of ['dist/trail-section.js','dist/trail-bike.js','dist/moving-wheel.js','dist/bike-assembly.js','dist/bike-rig.js','dist/linkage.js','scripts/trail-section-review.mjs'])sources[name]=createHash('sha256').update(await readFile(name)).digest('hex');
 const refinement=cases.filter(c=>c.dt===.00003125).map(coarse=>{const fine=cases.find(c=>c.bike===coarse.bike&&c.dt<coarse.dt);return {bike:coarse.bike,peakForceRelativeDifference:Math.abs(coarse.peakGroundForce-fine.peakGroundForce)/fine.peakGroundForce,energyResidualRatio:fine.maxEnergyResidual/coarse.maxEnergyResidual};});
 await writeFile(join(dir,'review.json'),JSON.stringify({format:'bikelab-trail-section-review-0.1',sources,cases,refinement,scope:'Numerical receiving experiment, not jump validation or physical calibration. No timing/performance measurement.'},null,2)+'\n');
}
