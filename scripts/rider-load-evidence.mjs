import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runRig,MODEL} from '../dist/bike-rig.js';
import {momentumClosure} from './rig-momentum-reference.mjs';
const preset={rider:'compliant',riderBuffer:'progressive',riderMass:20,riderTravel:.02,riderBufferWidth:.019,riderStiffness:40000,riderDamping:0,forkBuffer:'progressive',shockBuffer:'progressive',input:'together',amplitude:.08,bumpDuration:.2,duration:2};
const report={model:MODEL,scope:'Illustrative centered rider stops and instantaneous attachment loads; no anatomical or failure calibration',runs:[],comparisons:[]};
for(const bike of ['full','hardtail']){
 const runs=[];
 for(const dt of [.000125,.0000625,.00003125]){
  const r=await runRig({...preset,bike,dt,sampleDt:8*dt});runs.push(r);assert.equal(r.status,'complete');assert.ok(r.summary.maxResidual/Math.max(1,Math.abs(r.summary.work),r.summary.loss)<.01);
  report.runs.push({params:r.params,summary:r.summary,momentumErrors:momentumClosure(r),maxFreePivotMoment:bike==='full'?Math.max(...r.signals.pivotMy.map(Math.abs)):null,maxFixtureFz:Math.max(...r.signals.fixtureFz.map(Math.abs)),maxFixtureMy:Math.max(...r.signals.fixtureMy.map(Math.abs))});
 }
 const [a,b]=runs.slice(1),peaks={};for(const k of ['peakRiderLowerForce','peakRiderUpperForce']){peaks[k]=Math.abs(a.summary[k]-b.summary[k])/b.summary[k];assert.ok(peaks[k]<.02);}
 let maxTravelDifference=0;for(let i=0;i<a.signals.time.length;i++)maxTravelDifference=Math.max(maxTravelDifference,Math.abs(a.signals.riderCompression[i]-b.signals.riderCompression[2*i]));assert.ok(maxTravelDifference<.0002);
 const coarse=await runRig({...preset,bike,dt:.00003125,sampleDt:.0025}),coarseObservationError=momentumClosure(coarse),fineObservationError=momentumClosure(b);
 for(let j=0;j<3;j++){assert.ok(fineObservationError[j]<.12);assert.ok(fineObservationError[j]<coarseObservationError[j]);}
 assert.deepEqual(coarse.summary,b.summary);
 report.comparisons.push({bike,peaks,maxTravelDifference,coarseObservationError,fineObservationError,observationUnits:['N s','N s','N m s'],recordingCadenceChangesDynamics:false});
}
await writeFile('docs/evidence/iteration-12-rider-loads.json',JSON.stringify(report,null,2)+'\n');console.log(report.comparisons);
