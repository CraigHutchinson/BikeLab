import {CONTROL_FORMAT,CONTROL_MODEL} from './rider-controller.js';
// Observation-only matched controls. No controller tuning or force-law changes.
import {activePreset,validate} from './trail-bike.js';
import {compileRiderTask} from './rider-task.js';
import {TARGET_FORMAT,TARGET_MODEL} from './rider-targets.js';
export function riderTransferPreset(bike='full',{control=false,dt=.00003125}={}){
 if(!['full','hardtail'].includes(bike)||typeof control!=='boolean')throw Error('Invalid transfer control.');
 const stride=.01/dt;if(!Number.isSafeInteger(stride)||stride<1)throw Error('Transfer commands must align to physics ticks.');
 const a=activePreset(bike,1);a.motion={...a.motion,dt,sampleDt:.01};
 const base=a.articulated.passive.posture;
 const path=compileRiderTask({passive:a.articulated.passive,goal:{hip:[base.hip[0]+.002,base.hip[1]-.002],trunkPitch:base.trunkPitch+.002},ticks:20,tickSeconds:.01}).frames;
 const commands=[],add=(timeTick,phase,index)=>{const p=control?base:path[index];commands.push({tick:timeTick*stride,phase,hip:[...p.hip],trunkPitch:p.trunkPitch});};
 add(0,'initial-hold',0);add(20,'transfer',0);
 for(let i=1;i<20;i++)add(20+i,'transfer',i);
 add(40,'target-hold',20);add(60,'recover',20);
 for(let i=1;i<20;i++)add(60+i,'recover',20-i);
 add(80,'recovery-hold',0);
 a.riderTargets={format:TARGET_FORMAT,commands};const {wheelParams,...scenario}=validate(a);return scenario;
}
// Same target producer and matched schedule, with a versioned runtime effort policy.
export function riderControllerPreset(bike='full',options={}){
 const a=riderTransferPreset(bike,options);a.active={format:CONTROL_FORMAT};
 const {wheelParams,...scenario}=validate(a);return scenario;
}
const finite=(v,label)=>{if(!Number.isFinite(v))throw Error('Invalid '+label);return v;};
function samples(record){
 if(![TARGET_MODEL,CONTROL_MODEL].includes(record?.model)||!Array.isArray(record.frames)||!record.frames.length)throw Error('Tracking needs an accepted target record.');
 const {dt,duration}=record.scenario.motion,commands=record.scenario.riderTargets.commands;
 if(!(dt>0)||!Number.isFinite(dt)||!Number.isFinite(duration)||duration<0||!commands?.length)throw Error('Invalid target clock.');
 let previous=-1,index=0;
 return record.frames.map(f=>{
  const tick=Math.round(finite(f.time,'sample time')/dt);
  if((previous<0&&tick!==0)||tick>Math.round(duration/dt)||tick<=previous||Math.abs(f.time/dt-tick)>1e-6)throw Error('Invalid or unordered sample tick.');previous=tick;
  while(commands[index+1]?.tick<=tick)index++;
  if(f.active?.targetCommand!==index)throw Error('Sample target identity differs.');
  const vector=(a,n)=>{if(!Array.isArray(a)||a.length!==n||!Array.from(a).every(Number.isFinite))throw Error('Invalid tracking vector.');return a;};
  vector(f.active.actualHip,2);vector(f.active.actualCOM,2);vector(f.active.targetCOM,2);vector(f.active.error,4);vector(f.active.saturation,4);vector(commands[index].hip,2);
  finite(f.active.work,'work');finite(f.active.totalPower,'power');
  if(!Array.isArray(f.wheels)||f.wheels.length!==2)throw Error('Invalid wheel samples.');f.wheels.forEach(w=>finite(w.ground?.[1],'wheel load'));
  return {tick,frame:f,command:commands[index]};
 });
}
export function summarizeRiderTracking(record){
 const rows=samples(record),{dt,duration}=record.scenario.motion,commands=record.scenario.riderTargets.commands,endTick=Math.round(duration/dt),acceptedTick=rows.at(-1).tick;
 const groups=[];
 for(const c of commands)if(!groups.length||groups.at(-1).phase!==c.phase)groups.push({phase:c.phase,startTick:c.tick});
 const phases=groups.map((g,i)=>{
  const end=groups[i+1]?.startTick??endTick,last=i===groups.length-1;
  const observations=rows.filter(r=>r.tick>=g.startTick&&(r.tick<end||(last&&r.tick===end)));
  const start=rows.find(r=>r.tick===g.startTick),finish=rows.find(r=>r.tick===Math.min(end,acceptedTick));
  const error=(r,key,target)=>Math.hypot(...r.frame.active[key].map((v,j)=>v-target(r)[j]));
  return {...g,endTick:end,complete:acceptedTick>=end,samples:observations.length,lastSampleTick:observations.at(-1)?.tick??null,
   sampleMaxHipErrorM:observations.length?Math.max(...observations.map(r=>error(r,'actualHip',r=>r.command.hip))):null,
   sampleMaxCOMErrorM:observations.length?Math.max(...observations.map(r=>error(r,'actualCOM',r=>r.frame.active.targetCOM))):null,
   sampleMaxJointErrorRad:observations.length?Math.max(...observations.flatMap(r=>r.frame.active.error.map(Math.abs))):null,
   saturatedSamples:observations.filter(r=>r.frame.active.saturation.some(Boolean)).length,
   sampleMinWheelLoadN:observations.length?Math.min(...observations.flatMap(r=>r.frame.wheels.map(w=>w.ground[1]))):null,
   riderWorkJ:start&&finish&&finish.tick>=start.tick?finish.frame.active.work-start.frame.active.work:null};
 });
 return {scope:'Saved-sample diagnostics only; no continuous support or stable tracking qualification.',dt,acceptedTick,requestedEndTick:endTick,status:record.status,phases};
}
export function compareRiderTransfers(target,control){
 const strip=r=>{const s=structuredClone(r.scenario);s.riderTargets.commands=s.riderTargets.commands.map(({tick,phase})=>({tick,phase}));return s;};
 if(JSON.stringify(strip(target))!==JSON.stringify(strip(control)))throw Error('Unmatched transfer configurations.');
 // State identity includes the intentionally different target sequence; compare the native launch coordinates separately.
 const launch=r=>({format:r.initialState?.format,joints:r.initialState?.joints});
 if(!target.initialState?.joints||!control.initialState?.joints||JSON.stringify(launch(target))!==JSON.stringify(launch(control)))throw Error('Unmatched initial native states.');
 const a=samples(target),b=samples(control);if(a.length!==b.length||a.some((r,i)=>r.tick!==b[i].tick))throw Error('Transfer observations do not match.');
 const origin=control.scenario.articulated.passive.posture;
 if(control.scenario.riderTargets.commands.some(c=>c.hip.some((x,i)=>x!==origin.hip[i])||c.trunkPitch!==origin.trunkPitch))throw Error('Control must retain the original target.');
 const delta=(a,b)=>a.map((x,i)=>x-b[i]);
 return {scope:'Matched-run differences; static droop remains visible in each absolute record. No causal isolation of numerical error.',samples:a.map((r,i)=>({tick:r.tick,phase:r.command.phase,
  requestedHipDelta:delta(r.command.hip,b[i].command.hip),actualHipDelta:delta(r.frame.active.actualHip,b[i].frame.active.actualHip),
  targetCOMDelta:delta(r.frame.active.targetCOM,b[i].frame.active.targetCOM),actualCOMDelta:delta(r.frame.active.actualCOM,b[i].frame.active.actualCOM),
  riderWorkDelta:r.frame.active.work-b[i].frame.active.work}))};
}
