import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {run} from '../dist/trail-bike.js';
import {riderControllerPreset,summarizeRiderTracking,compareRiderTransfers} from '../dist/rider-transfer.js';
import {riderLoadSample} from '../dist/rider-loads.js';
import {riderGeometryError} from '../dist/rider-geometry-error.js';
const destination=process.argv[2]??'artifacts/rider-controller',cases=[],records=new Map();
await mkdir(destination,{recursive:true});
const hash=text=>createHash('sha256').update(text).digest('hex');
const sources={};for(const name of ['rider-controller','rider-effort-balance','rider-drive','rider-transfer','rider-loads','rider-geometry-error','trail-bike','trail-initial-state'])sources['dist/'+name+'.js']=hash(await readFile('dist/'+name+'.js'));
const specifications=[];
for(const bike of ['full','hardtail']){
 for(const mass of [20,70,100])specifications.push({bike,mass,kind:'transfer'});
 specifications.push({bike,mass:70,kind:'hold'},{bike,mass:70,kind:'feedback-only'},{bike,mass:70,kind:'refined',dt:.000015625},{bike,mass:70,kind:'geometry'},{bike,mass:70,kind:'half-gravity'});
}
for(const spec of specifications){
 const {bike,mass,kind,dt=.00003125}=spec,a=structuredClone(riderControllerPreset(bike,{control:kind==='hold',dt}));
 a.articulated.passive.posture.riderMass=mass;
 if(kind==='feedback-only')a.active.response.compensation='off';
 if(kind==='half-gravity')a.motion.gravity/=2;
 if(kind==='geometry'){
  const posture=a.articulated.passive.posture;posture.segments.thighs.length=.45;posture.segments.trunk.comFraction=.6;
  // Recompile passive rest/domain and drive targets for the new body; retain the
  // same hip/trunk task and anchors. Do not carry old joint-angle defaults across.
  a.articulated.passive={posture};a.active={format:a.active.format,response:a.active.response};
 }
 const record=await run(a),file=`${bike}-${mass}-${kind}.json`,text=JSON.stringify(record)+'\n';await writeFile(join(destination,file),text);
 const tracking=summarizeRiderTracking(record),last=record.frames.at(-1),geometry=riderGeometryError(record.scenario,last),loads=riderLoadSample(record.scenario,last);
 const statusCounts={};let decompositionResidual=0;
 for(const frame of record.frames){statusCounts[frame.active.estimateStatus]=(statusCounts[frame.active.estimateStatus]??0)+1;for(const j of riderLoadSample(record.scenario,frame).joints)decompositionResidual=Math.max(decompositionResidual,Math.abs(j.decompositionResidual));}
 const entry={...spec,dt,file,sha256:hash(text),status:record.status,termination:record.termination,steps:record.summary.steps,tracking,finalHipErrorM:geometry.hipError,finalJointErrorRad:last.active.error,finalEffort:last.active,finalLoads:loads,statusCounts,decompositionResidual,workJ:record.summary.riderWork,maxEnergyResidualJ:record.summary.maxResidual,maxDiagnosticDifference:record.summary.maxDiagnosticDifference};
 cases.push(entry);records.set(`${bike}-${mass}-${kind}`,record);
 await writeFile(join(destination,'report.json'),JSON.stringify({sources,cases,complete:false},null,2)+'\n');
 console.log(JSON.stringify({bike,mass,kind,status:record.status,reason:record.termination?.reason,finalHipErrorMm:1000*Math.hypot(...geometry.hipError),statusCounts}));
}
const comparisons=[];
for(const bike of ['full','hardtail']){
 const base=records.get(`${bike}-70-transfer`),refined=records.get(`${bike}-70-refined`),off=records.get(`${bike}-70-feedback-only`),hold=records.get(`${bike}-70-hold`),last=base.frames.at(-1),fine=refined.frames.at(-1);
 const hip=r=>Math.hypot(...riderGeometryError(r.scenario,r.frames.at(-1)).hipError);
 comparisons.push({bike,matchedHold:compareRiderTransfers(base,hold),finalHipErrorM:{estimated:hip(base),feedbackOnly:{errorM:hip(off),status:off.status,acceptedTime:off.summary.acceptedTime},refined:hip(refined)},refinementFinalHipDifferenceM:Math.hypot(...last.active.actualHip.map((x,i)=>x-fine.active.actualHip[i])),refinementFinalTorqueDifferenceNm:last.active.torque.map((x,i)=>x-fine.active.torque[i])});
}
await writeFile(join(destination,'report.json'),JSON.stringify({scope:'Saved samples of experimental runs, not proof of equilibrium, human calibration or tyre convergence. All 16 complete or terminated records retained; no suppressed failures.',sources,complete:true,cases,comparisons},null,2)+'\n');
