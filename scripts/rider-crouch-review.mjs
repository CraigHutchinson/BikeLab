import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {run} from '../dist/trail-bike.js';
import {riderCrouchPreset,assessRiderCrouch} from '../dist/rider-crouch.js';
import {summarizeRiderTracking,compareRiderTransfers} from '../dist/rider-transfer.js';
import {riderGeometryError} from '../dist/rider-geometry-error.js';
const destination=process.argv[2]??'artifacts/rider-crouch-matrix';await mkdir(destination,{recursive:true});
const cases=[],records=new Map(),hash=text=>createHash('sha256').update(text).digest('hex');
const sources={};for(const name of ['rider-crouch','rider-cycle','rider-controller','rider-drive','rider-transfer','trail-bike'])sources[name]=hash(await readFile('dist/'+name+'.js'));
for(const bike of ['full','hardtail'])for(const kind of ['20','70','100','hold','refined']){
 const mass=['hold','refined'].includes(kind)?70:Number(kind),a=riderCrouchPreset(bike,{control:kind==='hold',dt:kind==='refined'?.000015625:.00003125,passive:{posture:{riderMass:mass}}});
 const r=await run(a),text=JSON.stringify(r)+'\n',file=bike+'-'+kind+'.json';await writeFile(join(destination,file),text);records.set(bike+'-'+kind,r);
 const assessment=assessRiderCrouch(r),tracking=r.frames.length?summarizeRiderTracking(r):null;
 let maxTracking=null;
 for(const f of r.frames)if(f.time>=.5-1e-9){const target=r.scenario.riderTargets.commands[f.active.targetCommand],error=Math.hypot(...f.active.actualHip.map((v,i)=>v-target.hip[i]));if(!maxTracking||error>maxTracking.errorM)maxTracking={time:f.time,errorM:error,geometry:riderGeometryError(r.scenario,f),jointError:f.active.error,jointVelocity:f.active.velocities,kp:f.active.kp,kd:f.active.kd,estimate:f.active.estimate,proportional:f.active.proportional,damping:f.active.damping};}
 const entry={bike,mass,kind,dt:a.motion.dt,file,sha256:hash(text),status:r.status,termination:r.termination,assessment,tracking,maxTracking,netRiderWorkJ:r.summary?.riderWork,energyResidualJ:r.summary?.maxResidual};cases.push(entry);
 await writeFile(join(destination,'report.json'),JSON.stringify({complete:false,sources,cases},null,2)+'\n');console.log(JSON.stringify({bike,mass,kind,status:r.status,screen:assessment.status,failed:assessment.checks.filter(c=>!c.pass).map(c=>c.name)}));
}
const comparisons=[];
for(const bike of ['full','hardtail']){
 const a=records.get(bike+'-70'),hold=records.get(bike+'-hold'),fine=records.get(bike+'-refined'),comparison={bike};
 if(a.status==='completed'&&hold.status==='completed'){
  const samples=compareRiderTransfers(a,hold).samples;comparison.matchedHold={sampleCount:samples.length,lowered:samples.find(s=>s.tick===Math.round(1.5/a.scenario.motion.dt)),final:samples.at(-1)};
 }else comparison.matchedHold={status:'incomplete-control-or-task'};
 if(a.status==='completed'&&fine.status==='completed'){
  const samples=a.frames.map(f=>({coarse:f,fine:fine.frames.find(g=>Math.abs(g.time-f.time)<1e-9)}));if(samples.some(s=>!s.fine))throw Error('Refinement samples differ.');
  comparison.refinement={maxSavedHipDifferenceM:Math.max(...samples.map(s=>Math.hypot(...s.coarse.active.actualHip.map((v,i)=>v-s.fine.active.actualHip[i])))),finalHipDifferenceM:Math.hypot(...a.frames.at(-1).active.actualHip.map((v,i)=>v-fine.frames.at(-1).active.actualHip[i])),netWorkDifferenceJ:a.summary.riderWork-fine.summary.riderWork};
 }else comparison.refinement={status:'incomplete'};
 comparisons.push(comparison);
}
await writeFile(join(destination,'report.json'),JSON.stringify({complete:true,scope:'Declared saved-sample screen. All failures retained. No gain tuning, relaxed budget or manoeuvre certification.',sources,cases,comparisons},null,2)+'\n');
