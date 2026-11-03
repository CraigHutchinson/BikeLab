// Native-force stage observer for the fixed-hub diagnostic, not a second solver.
// Source: pinned MuJoCo engine_forward.c mj_RungeKutta and mj_advance.
export const STAGE_WORK='bikelab-native-rk4-stage-work-0.1';
export const STAGE_BUDGETS=Object.freeze({position:1e-12,velocity:1e-9,warmstart:1e-6,acceleration:1e-6,force:1e-8});
const comparisonKeys=Object.keys(STAGE_BUDGETS);
const require=(ok,message)=>{if(!ok)throw Error(message);};
// The binding exposes warning values through owned temporary wrappers. Release
// each immediately; retain detailed warning records only outside the step loop.
export function hasNativeWarning(d){const w=d.warning;for(let i=0;i<w.size();i++){const s=w.get(i);try{if(s.number)return true;}finally{s.delete();}}return false;}
export function createStageObserver(mj,m,guard){
 require(m.opt.integrator===mj.mjtIntegrator.mjINT_RK4.value,'Stage observer requires native RK4.');
 require(m.nq===m.nv&&m.na===0&&m.nu===0&&m.neq===0&&m.ntendon===0&&m.nmocap===0&&m.nplugin===0&&m.nhistory===0&&m.nsensor===0,'Unsupported stage-observer state.');
 for(let j=0;j<m.njnt;j++)require(m.jnt_type[j]===mj.mjtJoint.mjJNT_SLIDE.value&&!m.jnt_limited[j],'Stage observer requires unlimited fixed-hub slides.');
 require(m.dof_frictionloss.every(x=>x===0),'Constraint work must contain only frictionless terrain contacts.');
 require(!(m.opt.enableflags & mj.mjtEnableBit.mjENBL_SLEEP.value),'Sleeping is outside the stage observer contract.');
 require(typeof guard==='function','Stage guard is required.');
 const d=new mj.MjData(m),backup=new mj.MjData(m),nv=m.nv,spec=mj.mjtState.mjSTATE_INTEGRATION.value;
 const q=new Float64Array(nv),v=new Float64Array(nv),vel=Array.from({length:4},()=>new Float64Array(nv)),acc=Array.from({length:4},()=>new Float64Array(nv));
 const coefficients=[0,.5,.5,1],weights=[1/6,1/3,1/3,1/6],stages=Array.from({length:4},()=>({})),result={q,v,warmstart:acc[3],stages,loss:0,contactWork:0,verticalImpulse:0},comparison={position:0,velocity:0,warmstart:0,acceleration:0,force:0};
 let ready=false,hasBackup=false,disposed=false;
 return {result,comparison,data:d,backup,
  predict(source){
   require(!disposed,'Stage observer is disposed.');ready=false;mj.mj_copyState(m,source,backup,spec);hasBackup=true;
   require(Number.isFinite(m.opt.timestep)&&m.opt.timestep>0,'Invalid stage timestep.');
   require(source.qfrc_applied.every(x=>x===0)&&source.xfrc_applied.every(x=>x===0),'Applied work is outside this observer contract.');
   require(!hasNativeWarning(source),'Native warning before RK4 stage.');
   mj.mj_copyState(m,source,d,spec);const h=m.opt.timestep,time=source.time;
   result.loss=0;result.contactWork=0;result.verticalImpulse=0;
   for(let stage=0;stage<4;stage++){
    if(stage){const c=coefficients[stage];for(let j=0;j<nv;j++){d.qpos[j]=backup.qpos[j]+h*c*vel[stage-1][j];d.qvel[j]=backup.qvel[j]+h*c*acc[stage-1][j];}d.time=time+c*h;}
    // Native forward calls leave the pre-step warm start unchanged at all stages.
    if(stage)mj.mj_forwardSkip(m,d,mj.mjtStage.mjSTAGE_NONE.value,1);else mj.mj_forward(m,d);
    require(!hasNativeWarning(d),'Native warning in reconstructed RK4 stage.');
    const observation=guard(d,stage,source.flexvert_xpos);let lossPower=0,contactPower=0;
    for(let j=0;j<nv;j++){
     require(Number.isFinite(d.qpos[j])&&Number.isFinite(d.qvel[j])&&Number.isFinite(d.qacc[j]),'Nonfinite RK4 stage.');
     require(d.qacc_warmstart[j]===backup.qacc_warmstart[j],'Stage changed the pre-step warm start.');
     vel[stage][j]=d.qvel[j];acc[stage][j]=d.qacc[j];lossPower-=d.qfrc_damper[j]*d.qvel[j];contactPower+=d.qfrc_constraint[j]*d.qvel[j];
    }
    require(Number.isFinite(lossPower)&&lossPower>=-1e-12&&Number.isFinite(contactPower),'Invalid stage power.');
    require(Number.isFinite(observation.verticalForce),'Invalid stage vertical force.');
    const s=stages[stage];s.time=d.time;s.lossPower=lossPower;s.contactPower=contactPower;s.contacts=d.ncon;s.rows=d.nefc;s.verticalForce=observation.verticalForce;
    result.loss+=h*weights[stage]*lossPower;result.contactWork+=h*weights[stage]*contactPower;
    result.verticalImpulse+=h*weights[stage]*observation.verticalForce;
   }
   for(let j=0;j<nv;j++){let dq=0,dv=0;for(let stage=0;stage<4;stage++){dq+=weights[stage]*vel[stage][j];dv+=weights[stage]*acc[stage][j];}q[j]=backup.qpos[j]+h*dq;v[j]=backup.qvel[j]+h*dv;}
   result.time=time+h;ready=true;return result;
  },
  compare(source){
   require(ready&&!disposed,'No complete stage prediction.');for(const key of comparisonKeys)comparison[key]=0;
   require(!hasNativeWarning(source),'Native warning in RK4 step.');
   for(let j=0;j<nv;j++){
    comparison.position=Math.max(comparison.position,Math.abs(q[j]-source.qpos[j]));comparison.velocity=Math.max(comparison.velocity,Math.abs(v[j]-source.qvel[j]));comparison.warmstart=Math.max(comparison.warmstart,Math.abs(acc[3][j]-source.qacc_warmstart[j]));
    comparison.acceleration=Math.max(comparison.acceleration,Math.abs(acc[3][j]-source.qacc[j]));comparison.force=Math.max(comparison.force,Math.abs(d.qfrc_constraint[j]-source.qfrc_constraint[j]),Math.abs(d.qfrc_damper[j]-source.qfrc_damper[j]));
   }
   require(Math.abs(source.time-result.time)<=1e-12,'Native RK4 clock mismatch.');
   for(const key of comparisonKeys)require(comparison[key]<=STAGE_BUDGETS[key],'Native RK4 '+key+' mismatch.');return comparison;
  },
  restore(source){require(hasBackup&&!disposed,'No stage backup to restore.');mj.mj_copyState(m,backup,source,spec);ready=false;},
  dispose(){if(!disposed){disposed=true;d.delete();backup.delete();}}
 };
}
