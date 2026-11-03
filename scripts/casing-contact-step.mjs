// Diagnostic-only bounded RK4 substeps. Contact law is unchanged; see CASING_ENTRY.md.
import {createStageObserver,STAGE_BUDGETS} from '../dist/casing-rk4-observer.js';
export const CONTACT_STEP=Object.freeze({format:'bikelab-contact-bisection-0.1',maxBisections:8,maxExtraSubsteps:4096,solverTolerance:1e-20});
export const CONTACT_TRACE='bikelab-contact-stage-trace-0.1';
export const TRACE_COLUMNS=Object.freeze(['time','contacts','rows','loadedRows','verticalForce','minimumGap','minimumGapVelocity','hubQX','hubQZ','hubVX','hubVZ','maxRelativeDisplacement','maxRelativeSpeed']);
const require=(ok,message)=>{if(!ok)throw Error(message);};

// Initial endpoint, then blocks of four ordered RK predictors and one accepted
// endpoint. Equal-time predictors never constitute a physical contact cycle.
function createTrace(capacity){
 const width=TRACE_COLUMNS.length,data=new Float64Array((1+5*capacity)*width);let rows=0;
 function sample(d,o,row){
  require(row*width+width<=data.length,'Contact trace capacity');const offset=row*width;let q=0,v=0;
  for(let j=2;j<d.qpos.length;j+=2){q=Math.max(q,Math.hypot(d.qpos[j],d.qpos[j+1]));v=Math.max(v,Math.hypot(d.qvel[j],d.qvel[j+1]));}
  data[offset]=d.time;data[offset+1]=o.contacts;data[offset+2]=d.nefc;data[offset+3]=o.loadedRows;data[offset+4]=o.verticalForce;data[offset+5]=o.minimumGap;data[offset+6]=o.minimumGapVelocity;
  data[offset+7]=d.qpos[0];data[offset+8]=d.qpos[1];data[offset+9]=d.qvel[0];data[offset+10]=d.qvel[1];data[offset+11]=q;data[offset+12]=v;
 }
 return {initial(d,o){sample(d,o,0);rows=1;},stage(d,o,index){sample(d,o,rows+index);},accept(d,o){sample(d,o,rows+4);rows+=5;},checkpoint:()=>rows,restore(count){rows=count;},result:()=>({format:CONTACT_TRACE,columns:TRACE_COLUMNS,rows,data:data.subarray(0,rows*width)})};
}

export function createContactStepper(mj,m,d,guard,stageGuard,{adaptive,trace,steps}){
 require(typeof adaptive==='boolean'&&typeof trace==='boolean'&&Number.isSafeInteger(steps)&&steps>0&&steps<=40960,'Unsupported contact stepper configuration');
 const baseDt=m.opt.timestep,backup=new mj.MjData(m),spec=mj.mjtState.mjSTATE_INTEGRATION.value,mask=new Uint8Array(guard.observation.contactMask.length),previousXYZ=new Float64Array(d.flexvert_xpos.length),macroXYZ=new Float64Array(d.flexvert_xpos.length);
 const metricKeys=Object.keys(guard.observation.metrics),observerKeys=Object.keys(STAGE_BUDGETS),candidate=Object.fromEntries(metricKeys.map(k=>[k,0]));
 const initialEnergy=guard.observation.energy,initialMomentum=new Float64Array(guard.observation.momentum),massGravity=-guard.totalMass*m.opt.gravity[2];
 const result={loss:0,contactWork:0,verticalImpulse:0,microsteps:0,minContacts:Infinity,maxContacts:0,maxResidual:0,maxMomentumError:0,maxIndependent:{...candidate},maxObserver:Object.fromEntries(observerKeys.map(k=>[k,0]))};
 const stats={acceptedIntervals:0,acceptedSubsteps:0,attemptedSubsteps:0,discardedContactTrials:0,deepestBisection:0,transitionLimitedSubsteps:0};
 const recorder=trace?createTrace(steps+(adaptive?CONTACT_STEP.maxExtraSubsteps:0)):null;recorder?.initial(d,guard.observation);
 let changed=false,candidateMin=Infinity,candidateMax=0,disposed=false,acceptedDepth=0,limited=0,priorLoss=0,priorWork=0,priorImpulse=0;
 const differs=o=>{for(let i=0;i<mask.length;i++)if(o.contactMask[i]!==mask[i])return true;return false;};
 let observer;try{observer=createStageObserver(mj,m,(stage,index,previous)=>{
  const o=stageGuard.observe(stage,previous);for(const k of metricKeys)candidate[k]=Math.max(candidate[k],o.metrics[k]);candidateMin=Math.min(candidateMin,o.contacts);candidateMax=Math.max(candidateMax,o.contacts);changed=changed||differs(o);recorder?.stage(stage,o,index);return o;
 });}catch(error){backup.delete();throw error;}
 function attempt(h,depth){
  m.opt.timestep=h;stats.attemptedSubsteps++;mask.set(guard.observation.contactMask);previousXYZ.set(d.flexvert_xpos);changed=false;candidateMin=Infinity;candidateMax=0;for(const k of metricKeys)candidate[k]=0;
  const prediction=observer.predict(d);
  if(adaptive&&changed&&depth<CONTACT_STEP.maxBisections){stats.discardedContactTrials++;attempt(h/2,depth+1);attempt(h/2,depth+1);return;}
  mj.mj_step(m,d);observer.compare(d);mj.mj_forward(m,d);const o=guard.observe(d,previousXYZ);changed=changed||differs(o);
  if(adaptive&&changed&&depth<CONTACT_STEP.maxBisections){stats.discardedContactTrials++;observer.restore(d);mj.mj_forward(m,d);guard.observe(d,undefined,true);attempt(h/2,depth+1);attempt(h/2,depth+1);return;}
  require(!adaptive||stats.acceptedSubsteps+result.microsteps+1-(stats.acceptedIntervals+1)<=CONTACT_STEP.maxExtraSubsteps,'Contact substep work capacity');
  recorder?.accept(d,o);result.microsteps++;acceptedDepth=Math.max(acceptedDepth,depth);if(adaptive&&changed)limited++;
  result.loss+=prediction.loss;result.contactWork+=prediction.contactWork;result.verticalImpulse+=prediction.verticalImpulse;result.minContacts=Math.min(result.minContacts,candidateMin,o.contacts);result.maxContacts=Math.max(result.maxContacts,candidateMax,o.contacts);
  const loss=priorLoss+result.loss,work=priorWork+result.contactWork,impulse=priorImpulse+result.verticalImpulse;
  result.maxResidual=Math.max(result.maxResidual,Math.abs(o.energy-initialEnergy+loss-work));result.maxMomentumError=Math.max(result.maxMomentumError,Math.abs(o.momentum[0]-initialMomentum[0]),Math.abs(o.momentum[1]-initialMomentum[1]-impulse+massGravity*d.time));
  for(const k of metricKeys)result.maxIndependent[k]=Math.max(result.maxIndependent[k],candidate[k],o.metrics[k]);for(const k of observerKeys)result.maxObserver[k]=Math.max(result.maxObserver[k],observer.comparison[k]);
 }
 return {result,stats,observer,
  advance(loss=0,work=0,impulse=0){
   require(!disposed,'Contact stepper disposed');mj.mj_copyState(m,d,backup,spec);macroXYZ.set(d.flexvert_xpos);const traceStart=recorder?.checkpoint();
   priorLoss=loss;priorWork=work;priorImpulse=impulse;result.loss=0;result.contactWork=0;result.verticalImpulse=0;result.microsteps=0;result.minContacts=Infinity;result.maxContacts=0;result.maxResidual=0;result.maxMomentumError=0;acceptedDepth=0;limited=0;for(const k of metricKeys)result.maxIndependent[k]=0;for(const k of observerKeys)result.maxObserver[k]=0;
   try{attempt(baseDt,0);require(Math.abs(d.time-backup.time-baseDt)<=1e-12,'Contact substep clock mismatch');if(adaptive)guard.observe(d,macroXYZ);stats.acceptedIntervals++;stats.acceptedSubsteps+=result.microsteps;stats.deepestBisection=Math.max(stats.deepestBisection,acceptedDepth);stats.transitionLimitedSubsteps+=limited;return result;}
   catch(error){mj.mj_copyState(m,backup,d,spec);m.opt.timestep=baseDt;mj.mj_forward(m,d);guard.observe(d,undefined,true);if(recorder)recorder.restore(traceStart);throw error;}
   finally{m.opt.timestep=baseDt;}
  },
  trace:()=>recorder?.result(),
  dispose(){if(!disposed){disposed=true;observer.dispose();backup.delete();}}
 };
}
