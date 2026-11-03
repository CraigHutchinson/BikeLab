import {activePreset,validate} from './trail-bike.js';
import {compilePassiveRider} from './rider-passive.js';
import {CONTROL_FORMAT,CONTROL_MODEL} from './rider-controller.js';
import {riderCycleTargets} from './rider-cycle.js';
const phases=['initial-hold','lower','crouch-hold','rise','recovery-hold'];
export function riderCrouchPreset(bike='full',{control=false,dt=.00003125,depthFraction=.05,passive}={}){
 if(!['full','hardtail'].includes(bike)||!Number.isFinite(depthFraction)||depthFraction<.01||depthFraction>.1)throw Error('Unsupported crouch configuration.');
 const a=activePreset(bike,2.5),body=compilePassiveRider(passive??a.articulated.passive).spec,p=body.posture;
 const depth=depthFraction*(p.segments.thighs.length+p.segments.shanksFeet.length);
 a.articulated={...a.articulated,passive:body};a.active={format:CONTROL_FORMAT};a.motion={...a.motion,dt,sampleDt:.01};
 a.riderTargets=riderCycleTargets(body,{goal:{hip:[p.hip[0],p.hip[1]-depth],trunkPitch:p.trunkPitch},control,dt,phaseSeconds:.5,phases});
 const {wheelParams,...scenario}=validate(a);return scenario;
}

// Observation-only screen with declared budgets, not a continuous-support gate.
export function assessRiderCrouch(record){
 const unavailable=reason=>({status:'unavailable',reason,checks:[]});
 const s=record?.scenario,commands=s?.riderTargets?.commands,frames=record?.frames;
 if(!Array.isArray(commands)||!commands.some(c=>c?.phase==='lower'))return {status:'not-applicable',checks:[]};
 if(record.model!==CONTROL_MODEL||s.active?.format!==CONTROL_FORMAT||s.motion?.duration!==2.5||commands.length!==43)return unavailable('Unsupported crouch protocol.');
 const p=s.articulated?.passive?.posture,goal=commands[21],dt=s.motion.dt;
 if(!Array.isArray(p?.hip)||p.hip.length!==2||!p.hip.every(Number.isFinite)||!Number.isFinite(p.riderMass)||p.riderMass<=0||goal?.phase!=='crouch-hold'||!Array.isArray(goal.hip))return unavailable('Missing crouch goal.');
 const depth=p.hip[1]-goal.hip[1];
 if(!Number.isFinite(depth)||depth<0||goal.hip[0]!==p.hip[0]||goal.trunkPitch!==p.trunkPitch)return unavailable('Expected vertical crouch at unchanged trunk pitch.');
 try{
  const expected=riderCycleTargets(s.articulated.passive,{goal:{hip:goal.hip,trunkPitch:goal.trunkPitch},dt,phaseSeconds:.5,phases}).commands;
  if(Array.from(commands).some((c,i)=>c.tick!==expected[i].tick||c.phase!==expected[i].phase||c.trunkPitch!==expected[i].trunkPitch||c.hip?.length!==2||c.hip.some((v,k)=>v!==expected[i].hip[k])))return unavailable('Target sequence differs from the declared crouch cycle.');
 }catch{return unavailable('Invalid target cycle.');}
 if(!Array.isArray(frames)||!frames.length)return unavailable('No accepted samples.');
 const finiteArray=(a,n)=>Array.isArray(a)&&a.length===n&&Array.from(a).every(Number.isFinite);
 let previous=-1,index=0,maxError=0,minLoad=Infinity,eligible=true,saturation=false,maxGap=0;
 for(const f of frames){
  if(!f||typeof f!=='object')return unavailable('Missing sample.');
  const tick=Math.round(f.time/dt),a=f.active;
  if(!Number.isFinite(f.time)||Math.abs(f.time/dt-tick)>1e-6||tick<=previous||(previous<0&&tick!==0)||f.time>2.5+1e-9||!finiteArray(a?.actualHip,2)||!Number.isFinite(a.work)||!finiteArray(a.saturation,4)||!Array.isArray(f.wheels)||f.wheels.length!==2||!f.wheels.every(w=>finiteArray(w?.ground,3)))return unavailable('Missing, unordered or nonfinite samples.');
  if(previous>=0)maxGap=Math.max(maxGap,(tick-previous)*dt);previous=tick;
  while(commands[index+1]?.tick<=tick)index++;
  if(a.targetCommand!==index)return unavailable('Sample target identity differs.');
  saturation||=a.saturation.some(v=>v!==0);
  if(f.time>=.5-1e-9){maxError=Math.max(maxError,Math.hypot(...a.actualHip.map((v,k)=>v-commands[index].hip[k])));minLoad=Math.min(minLoad,...f.wheels.map(w=>w.ground[1]));eligible&&=a.contactMask===3&&a.estimateStatus==='two-wheel-contact-estimate';}
 }
 const last=frames.at(-1),complete=record.status==='completed'&&Math.abs(last.time-2.5)<1e-9;
 if(depth===0)return {status:complete?'control':'incomplete-control',reason:'Unchanged-posture control; no requested lowering.',checks:[]};
 const weight=record.massBudget?.total*s.motion.gravity,workScale=p.riderMass*s.motion.gravity*depth;
 if(!Number.isFinite(weight)||weight<=0||!Number.isFinite(workScale)||workScale<=0)return unavailable('Positive configured weight is required.');
 const bottom=frames.find(f=>Math.abs(f.time-1.5)<1e-9),finalError=Math.hypot(...last.active.actualHip.map((v,k)=>v-p.hip[k])),lowering=bottom?p.hip[1]-bottom.active.actualHip[1]:null,work=last.active.work-frames[0].active.work;
 const checks=[
  {name:'complete',pass:complete},
  {name:'sampling',pass:maxGap<=.01+1e-10&&!!bottom,value:maxGap,limit:.01},
  {name:'tracking',pass:maxError<=.25*depth,value:maxError,limit:.25*depth},
  {name:'lowering',pass:lowering!==null&&lowering>=.8*depth&&lowering<=1.2*depth,value:lowering,min:.8*depth,max:1.2*depth},
  {name:'recovery',pass:complete&&finalError<=.003,value:finalError,limit:.003},
  {name:'wheel-loads',pass:Number.isFinite(minLoad)&&minLoad>=.01*weight,value:Number.isFinite(minLoad)?minLoad:null,min:.01*weight},
  {name:'estimate-eligibility',pass:eligible&&last.time>=.5},
  {name:'saturation',pass:!saturation},
  {name:'net-work',pass:Math.abs(work)<=3*workScale,value:work,limit:3*workScale}
 ];
 return {status:checks.every(c=>c.pass)?'screen-passed':'screen-failed',scope:'Saved-sample protocol only; no continuous support, equilibrium or manoeuvre qualification.',requestedDepthM:depth,observedLoweringM:lowering,finalHipErrorM:finalError,checks};
}
