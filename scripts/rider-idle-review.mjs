// Reproduce the passive idle gap within existing limits; no controller or
// state resets. Successful script execution means evidence was saved, not that
// posture holding or long-duration equilibrium has passed.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {articulatedPreset,run} from '../dist/trail-bike.js';
import {JOINTS,LOAD_STRIDE} from '../dist/rider-passive.js';

if(process.argv.length>3)throw Error('Usage: node scripts/rider-idle-review.mjs [output-directory]');
const directory=process.argv[2]??'artifacts/rider-idle';
await mkdir(directory,{recursive:true});
const hash=value=>createHash('sha256').update(value).digest('hex');
const report={format:'bikelab-rider-idle-review-0.1',scriptSha256:hash(await readFile(new URL(import.meta.url))),
 scope:'Passive, unseated, nonequilibrium canonical launches on flat frictionless ground. Requested 1.5 s horizon is the current admitted maximum, not a long-idle qualification. Existing domain guards remain active. No controller, equilibrium solve, state reset, calibration or performance measurement.',
 measurement:'Frame metrics use accepted recording samples, including the final accepted endpoint. Native scalar velocities use the complete final state; accelerations are not recorded. Small net force or COM drift alone cannot qualify whole-world stationarity.',cases:[]};
function snapshot(r,f){
 const rider=f.articulated,p=r.scenario.articulated.passive.posture,dx=rider.centerOfMass[0]-f.frame[0],dz=rider.centerOfMass[2]-f.frame[1],c=Math.cos(f.frame[2]),s=Math.sin(f.frame[2]);
 return {time:f.time,frame:f.frame,riderCOM:rider.centerOfMass,riderCOMInFrame:[c*dx-s*dz,s*dx+c*dz],
  riderCOMVelocity:[3,5].map(k=>rider.segments.reduce((sum,body)=>sum+p.segments[body.name].massFraction*body.velocity[k],0)),
  jointDisplacement:Object.fromEntries(JOINTS.map((name,i)=>[name,rider.coordinates[i]])),
  passiveJointTorque:Object.fromEntries(JOINTS.map((name,i)=>[name,rider.passiveLoads[i*LOAD_STRIDE]])),
  fork:f.fork,shock:f.shock,rearAngle:f.rearAngle,
  handFoot:rider.interfaces.attachments.map(a=>({name:a.name,forceOnRider:a.forceOnRider,gap:a.gap,active:a.active})),
  ground:f.wheels.map((w,i)=>({wheel:i===0?'front':'rear',forceAndMomentAtHub:w.ground})),
  energy:f.energy,dampingLoss:f.dampingLoss,constraintWork:f.constraintWork,residual:f.residual};
}
function velocityMaxima(state){
 const result={};
 for(const j of state.joints){
  const group=j.name.startsWith('rider')?'rider':j.name.includes('wheel')?'wheel':/^(fork|swing)$/.test(j.name)?'suspension':'frame';
  const key=group+(j.type==='slide'?'LinearMps':'AngularRadps'),magnitude=Math.abs(j.velocity);
  if(!result[key]||magnitude>result[key].absolute)result[key]={joint:j.name,absolute:magnitude,signed:j.velocity};
 }
 return result;
}
for(const bike of ['full','hardtail'])for(const dt of [.00003125,.000015625,.0000078125]){
 const input=articulatedPreset(bike);input.initialization={mode:'launch'};input.motion={...input.motion,duration:1.5,dt};
 const label=bike+'-'+dt;let phaseBefore='',bucketBefore=-1;
 const r=await run(input,(phase,acceptedSteps,totalSteps)=>{
  const bucket=Math.floor(20*acceptedSteps/totalSteps);
  if(phase!==phaseBefore||bucket!==bucketBefore){console.error(`${label}: ${phase}, ${acceptedSteps}/${totalSteps} accepted steps`);phaseBefore=phase;bucketBefore=bucket;}
 });
 const text=JSON.stringify(r)+'\n',record=label+'.json';await writeFile(join(directory,record),text);
 const first=snapshot(r,r.frames[0]),last=snapshot(r,r.frames.at(-1));
 const entry={bike,dt,input,record,recordSha256:hash(text),model:r.model,initialization:r.initialization,
  requestedDuration:input.motion.duration,status:r.status,termination:r.termination,summary:r.summary,
  completedRequestedHorizon:r.status==='completed'&&Math.abs(r.summary.acceptedTime-input.motion.duration)<1e-10,
  initial:first,final:last,riderCOMDrop:first.riderCOM[2]-last.riderCOM[2],
  riderCOMInFrameChange:last.riderCOMInFrame.map((x,i)=>x-first.riderCOMInFrame[i]),
  maxSampledJointDisplacement:Object.fromEntries(JOINTS.map((name,i)=>[name,Math.max(...r.frames.map(f=>Math.abs(f.articulated.coordinates[i]-r.frames[0].articulated.coordinates[i])))])),
  finalNativeVelocityMaxima:velocityMaxima(r.finalState)};
 report.cases.push(entry);
 console.error(`${label}: ${r.status} at ${last.time.toFixed(6)} s; ${r.termination?.reason??'no guard stop'}; COM drop ${(1000*entry.riderCOMDrop).toFixed(2)} mm`);
}
await writeFile(join(directory,'review.json'),JSON.stringify(report,null,2)+'\n');
console.log('Saved '+join(directory,'review.json'));
