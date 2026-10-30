import {CONTROL_FORMAT} from './rider-controller.js';
// Postprocess accepted samples only. Never feeds forces or targets into dynamics.
import {JOINTS} from './rider-passive.js';
import {SEGMENTS} from './rider-posture.js';
import {summarizeRiderTracking} from './rider-transfer.js';
const finite=(x,label)=>{if(!Number.isFinite(x))throw Error('Invalid '+label);return x;};
const vector=(a,n,label)=>{if(!Array.isArray(a)||a.length!==n||!Array.from(a).every(Number.isFinite))throw Error('Invalid '+label);return a;};
export function riderLoadSample(scenario,frame){
 const posture=scenario.articulated.passive.posture,mass=finite(posture.riderMass,'rider mass'),gravity=finite(scenario.motion.gravity,'gravity');
 if(mass<=0||gravity<0)throw Error('Invalid mass or gravity.');
 const a=frame.articulated,attachments=a?.interfaces?.attachments;
 if(!Array.isArray(attachments)||attachments.length!==2)throw Error('Expected hand and foot loads.');
 const force=name=>{const found=attachments.filter(x=>x.name===name);if(found.length!==1)throw Error('Missing or duplicate '+name+' attachment.');return [...vector(found[0].forceOnRider,3,'attachment force')];};
 const hand=force('hand'),foot=force('foot'),support=hand.map((x,i)=>x+foot[i]),weight=mass*gravity,netForce=[support[0],support[1],support[2]-weight];
 if(!Array.isArray(a.segments)||a.segments.length!==SEGMENTS.length)throw Error('Expected complete rider segments.');
 const comVelocity=[0,0,0];let totalFraction=0;
 for(const name of SEGMENTS){
  const found=a.segments.filter(s=>s.name===name);if(found.length!==1)throw Error('Missing or duplicate rider segment.');
  const fraction=finite(posture.segments[name]?.massFraction,'mass fraction');if(fraction<=0)throw Error('Invalid mass fraction.');totalFraction+=fraction;
  const velocity=vector(found[0].velocity,6,'segment velocity');for(let i=0;i<3;i++)comVelocity[i]+=fraction*velocity[i+3];
 }
 if(Math.abs(totalFraction-1)>1e-9)throw Error('Rider mass fractions must sum to one.');
 const joints=[];
 if(scenario.active){
  const active=frame.active;for(const key of ['error','velocities','requestedTorque','torque','saturation'])vector(active?.[key],4,'drive '+key);
  if(scenario.active.format===CONTROL_FORMAT)for(const key of ['kp','kd','estimate'])vector(active[key],4,'controller '+key);
  for(let i=0;i<JOINTS.length;i++){
   const name=JOINTS[i],law=scenario.active.joints[name],proportional=finite(active.kp?.[i]??law.kp,'kp')*active.error[i],damping=-finite(active.kd?.[i]??law.kd,'kd')*active.velocities[i],estimate=finite(active.estimate?.[i]??0,'effort estimate');
   joints.push({name,...(active.estimate?{estimate}:{}),proportional,damping,requested:active.requestedTorque[i],applied:active.torque[i],saturation:active.saturation[i],decompositionResidual:active.requestedTorque[i]-proportional-damping-estimate});
  }
 }
 return {hand,foot,support,weight,netForce,comVelocity,joints};
}
export function summarizeRiderLoads(record){
 const tracking=summarizeRiderTracking(record),dt=tracking.dt,rows=record.frames.map(frame=>({tick:Math.round(frame.time/dt),...riderLoadSample(record.scenario,frame)}));
 const range=values=>values.length?{min:Math.min(...values),max:Math.max(...values)}:null;
 return {scope:'Saved-sample signed loads and PD terms. World xyz for forces/COM velocity; joint torques use native joint signs. No equilibrium or support qualification.',status:record.status,phases:tracking.phases.map((phase,index)=>{
  const selected=rows.filter(r=>r.tick>=phase.startTick&&(r.tick<phase.endTick||(index===tracking.phases.length-1&&r.tick===phase.endTick)));
  return {phase:phase.phase,startTick:phase.startTick,endTick:phase.endTick,complete:phase.complete,samples:selected.length,hipErrorM:phase.sampleMaxHipErrorM,
   handVerticalN:range(selected.map(r=>r.hand[2])),footVerticalN:range(selected.map(r=>r.foot[2])),netVerticalN:range(selected.map(r=>r.netForce[2])),comVerticalVelocityMps:range(selected.map(r=>r.comVelocity[2])),
   joints:JOINTS.map((name,i)=>({name,proportionalNm:range(selected.map(r=>r.joints[i].proportional)),dampingNm:range(selected.map(r=>r.joints[i].damping)),appliedNm:range(selected.map(r=>r.joints[i].applied)),maxDecompositionResidualNm:selected.length?Math.max(...selected.map(r=>Math.abs(r.joints[i].decompositionResidual))):null})),last:selected.at(-1)??null};
 })};
}
