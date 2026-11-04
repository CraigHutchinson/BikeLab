// Restricted diagnostic driver: native contact targets, not production stepping.
// Pinned source: MuJoCo a892750516336d8358949f4518fcc4fbbd85beae,
// engine_forward.c mj_RungeKutta/mj_advance. Scalar joints only.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {getRuntime,geometryLimits} from '../dist/moving-wheel.js';
import {checkFlatVertexContacts} from '../dist/flat-vertex-contact.js';
import {hasNativeWarning,nativeWarnings,STAGE_BUDGETS} from '../dist/casing-rk4-observer.js';
import {spinningGapXML} from './spinning-gap.mjs';

export const MODEL='bikelab-scalar-spinning-rk4-stage-0.1';
export const BUDGETS=Object.freeze({...STAGE_BUDGETS,angle:1e-12,angularVelocity:1e-9,angularAcceleration:1e-6,angularWarmstart:1e-6,torque:1e-8,time:1e-12,power:1e-9,jacobian:1e-12,jacobianLength:1e-12,regularizer:1e-12});
export const UNITS=Object.freeze({position:'m',velocity:'m/s',warmstart:'m/s²',acceleration:'m/s²',force:'N',angle:'rad',angularVelocity:'rad/s',angularAcceleration:'rad/s²',angularWarmstart:'rad/s²',torque:'N m',time:'s',power:'W',jacobian:'dimensionless',jacobianLength:'m',regularizer:'1/kg'});
const baselineURL=new URL('../docs/evidence/spinning-gap.json',import.meta.url);
const baselineBytes=await readFile(baselineURL),baseline=JSON.parse(baselineBytes),p=Object.freeze(baseline.parameters.wheel);
const NV=3+2*p.nodes,H=.000001953125,PROFILE={points:[[-2,0],[2,0]]};
const C=[0,.5,.5,1],B=[1/6,1/3,1/3,1/6];
const hash=x=>createHash('sha256').update(x).digest('hex');
const arrays=['qpos','qvel','qacc','qacc_warmstart','qfrc_constraint','qfrc_passive','qfrc_smooth','qacc_smooth','qfrc_bias','qfrc_applied','xfrc_applied','flexvert_xpos','efc_J','efc_R','efc_aref','efc_force','efc_pos','efc_vel'];
export const capture=d=>Object.fromEntries(arrays.map(k=>[k,Array.from(d[k])]).concat([['time',d.time],['ncon',d.ncon],['nefc',d.nefc],['warnings',nativeWarnings(d)]]));

function admit(mj,m){
 assert.equal(m.nq,NV);assert.equal(m.nv,NV);assert.equal(m.njnt,NV);
 for(const k of ['na','nu','neq','ntendon','nmocap','nplugin','nhistory','nsensor','nuserdata'])assert.equal(m[k],0,k);
 assert.equal(m.nflex,1);assert.equal(m.nflexvert,p.nodes);assert.equal(m.ngeom,1);
 assert.equal(m.opt.integrator,mj.mjtIntegrator.mjINT_RK4.value);assert.equal(m.opt.solver,mj.mjtSolver.mjSOL_NEWTON.value);assert.equal(m.opt.jacobian,mj.mjtJacobian.mjJAC_DENSE.value);
 assert.equal(m.opt.timestep,H);assert.equal(m.opt.enableflags,0);assert.equal(m.opt.disableflags,mj.mjtDisableBit.mjDSBL_AUTORESET.value);assert.equal(m.opt.iterations,100);assert.equal(m.opt.tolerance,1e-20);
 assert.deepEqual(Array.from(m.opt.gravity),[0,0,-p.gravity]);
 for(const k of ['jnt_stiffness','dof_damping','dof_frictionloss','dof_armature','flex_edgestiffness','flex_edgedamping'])assert.ok(m[k].every(x=>x===0),k);
 for(let j=0;j<NV;j++){
  assert.equal(m.jnt_qposadr[j],j);assert.equal(m.jnt_dofadr[j],j);assert.equal(m.jnt_limited[j],0);
  assert.equal(m.jnt_type[j],j===2?mj.mjtJoint.mjJNT_HINGE.value:mj.mjtJoint.mjJNT_SLIDE.value);
  assert.deepEqual(Array.from(m.jnt_axis.slice(3*j,3*j+3)),j===2?[0,1,0]:j===0||j>=3&&j%2===1?[1,0,0]:[0,0,1]);
 }
}

function guard(mj,m,d,hub,previous,out){
 assert.ok(Number.isFinite(d.time)&&d.time>=0,'Invalid time');
 assert.ok(!hasNativeWarning(d),'Native warning');
 for(const k of ['qpos','qvel','qacc','qacc_warmstart'])assert.ok(d[k].every(Number.isFinite),'Nonfinite '+k);
 for(const k of ['qfrc_applied','xfrc_applied','qfrc_passive'])assert.ok(d[k].every(x=>x===0),'Unsupported '+k);
 assert.ok(d.solver_niter.every(n=>n<100),'Solver iteration limit');
 checkFlatVertexContacts(mj,m,d,0,p.nodes);
 const limit=geometryLimits(p,PROFILE,[d.xpos[3*hub],d.xpos[3*hub+2]],d.flexvert_xpos,previous,out);
 assert.equal(limit.reason,null,'Physical limit: '+limit.reason);
 for(let i=0;i<p.nodes;i++){
  assert.ok(Math.hypot(d.qpos[3+2*i],d.qpos[4+2*i])<=p.maxDisplacement,'Casing displacement');
  assert.ok(Math.abs(d.flexedge_length[i]/m.flexedge_length0[i]-1)<=p.maxStrain,'Casing strain');
 }
}

export function createSpinningStageDriver(mj,input,options={}){
 assert.ok(options&&Object.getPrototypeOf(options)===Object.prototype&&Object.keys(options).every(k=>['excluded','onCheckpoint'].includes(k)),'Unknown options');
 const {excluded=false,onCheckpoint}=options;
 assert.ok(input&&Object.keys(input).length===4&&Object.keys(input).every(k=>['q','v','warmstart','time'].includes(k)),'Unknown state fields');
 assert.equal(typeof excluded,'boolean');assert.ok(onCheckpoint===undefined||typeof onCheckpoint==='function');
 for(const k of ['q','v','warmstart'])assert.ok(Array.isArray(input?.[k])&&input[k].length===NV&&input[k].every(Number.isFinite),'Invalid '+k);
 assert.ok(Number.isFinite(input.time)&&input.time>=0,'Invalid time');
 for(const name of ['mj_copyState','mj_resetData','mj_forward','mj_forwardSkip'])assert.equal(typeof mj[name],'function','Missing native API: '+name);
 // The model is built privately from the exact received XML. Callers cannot
 // supply arbitrary topology or mutate options through this driver.
 const m=mj.MjModel.from_xml_string(spinningGapXML(excluded));let accepted,trial,observation;
 try{
  admit(mj,m);accepted=new mj.MjData(m);trial=new mj.MjData(m);observation=new mj.MjData(m);
  const spec=mj.mjtState.mjSTATE_INTEGRATION.value,hub=mj.mj_name2id(m,mj.mjtObj.mjOBJ_BODY.value,'hub');
  const q=new Float64Array(NV),v=new Float64Array(NV),warm=new Float64Array(NV),vel=Array.from({length:4},()=>new Float64Array(NV)),acc=Array.from({length:4},()=>new Float64Array(NV));
  const previous=new Float64Array(3*p.nodes),limits={},stageTrace=Array.from({length:4},()=>({time:0,rows:0,contacts:0,contactPower:0,verticalForce:0}));
  let disposed=false,stepping=false,steps=0,slot=0,contactWork=0,verticalImpulse=0,lastStages=[];
  accepted.qpos.set(input.q);accepted.qvel.set(input.v);accepted.qacc_warmstart.set(input.warmstart);accepted.time=input.time;
  mj.mj_forward(m,accepted);guard(mj,m,accepted,hub,null,limits);
  function observe(source,previous=null){
   mj.mj_resetData(m,observation);mj.mj_copyState(m,source,observation,spec);mj.mj_forward(m,observation);guard(mj,m,observation,hub,previous,limits);return observation;
  }
  function snapshot(){assert.ok(!disposed,'Driver disposed');return {...capture(accepted),steps,slot,contactWork,verticalImpulse,lastStages:structuredClone(lastStages)};}
  return {
   snapshot,
   observe(){assert.ok(!disposed&&!stepping,'Driver unavailable');return capture(observe(accepted));},
   step(){
    assert.ok(!disposed&&!stepping,'Driver unavailable');stepping=true;
    try{
     admit(mj,m);mj.mj_resetData(m,trial);mj.mj_copyState(m,accepted,trial,spec);
     q.set(accepted.qpos);v.set(accepted.qvel);warm.set(accepted.qacc_warmstart);const time=accepted.time;
     assert.ok(time+H>time,'Timestep cannot advance time');let work=0,impulse=0;
     for(let stage=0;stage<4;stage++){
      if(stage){for(let j=0;j<NV;j++){trial.qpos[j]=q[j]+H*(C[stage]*vel[stage-1][j]);trial.qvel[j]=v[j]+H*(C[stage]*acc[stage-1][j]);}trial.time=time+C[stage]*H;}
      if(stage)mj.mj_forwardSkip(m,trial,mj.mjtStage.mjSTAGE_NONE.value,1);else mj.mj_forward(m,trial);
      guard(mj,m,trial,hub,stage?previous:null,limits);if(!stage)previous.set(trial.flexvert_xpos);
      let power=0,force=0;for(let j=0;j<NV;j++){
       assert.equal(trial.qacc_warmstart[j],warm[j],'Stage changed incoming warmstart');
       vel[stage][j]=trial.qvel[j];acc[stage][j]=trial.qacc[j];power+=trial.qfrc_constraint[j]*trial.qvel[j];
      }
      let rowPower=0;for(let row=0;row<trial.nefc;row++){force+=trial.efc_force[row];rowPower+=trial.efc_force[row]*trial.efc_vel[row];}
      assert.ok(Math.abs(power-rowPower)<=BUDGETS.power,'Stage contact power mismatch');
      assert.ok(Number.isFinite(power)&&Number.isFinite(force));
      Object.assign(stageTrace[stage],{time:trial.time,rows:trial.nefc,contacts:trial.ncon,contactPower:power,verticalForce:force});
      work+=H*B[stage]*power;impulse+=H*B[stage]*force;
      onCheckpoint?.(stage);
     }
     // Preserve fourth-stage qacc/force/contact caches. Only q/v/time advance;
     // native mj_advance stores F[3], not the weighted acceleration, as warmstart.
     for(let j=0;j<NV;j++){
      let dq=0,dv=0;for(let s=0;s<4;s++){dq+=B[s]*vel[s][j];dv+=B[s]*acc[s][j];}
      trial.qpos[j]=q[j]+H*dq;trial.qvel[j]=v[j]+H*dv;trial.qacc_warmstart[j]=acc[3][j];
     }
     trial.time=time+H;
     observe(trial,previous);onCheckpoint?.(4); // endpoint checked in separate native data
     const committedTrace=structuredClone(stageTrace); // allocate before commit
     const old=accepted;accepted=trial;trial=old;steps++;slot=1-slot;contactWork+=work;verticalImpulse+=impulse;lastStages=committedTrace;
    }finally{stepping=false;}
   },
   dispose(){assert.ok(!stepping,'Cannot dispose during step');if(!disposed){disposed=true;observation.delete();trial.delete();accepted.delete();m.delete();}}
  };
 }catch(error){observation?.delete();trial?.delete();accepted?.delete();m.delete();throw error;}
}

function compare(a,b){
 const errors=Object.fromEntries(Object.keys(BUDGETS).map(k=>[k,0]));
 const check=(k,x,y)=>{assert.ok(Number.isFinite(x)&&Number.isFinite(y),k);errors[k]=Math.max(errors[k],Math.abs(x-y));};
 for(const [key,linear,angular] of [['qpos','position','angle'],['qvel','velocity','angularVelocity'],['qacc','acceleration','angularAcceleration'],['qacc_warmstart','warmstart','angularWarmstart'],['qfrc_constraint','force','torque'],['qfrc_smooth','force','torque'],['qacc_smooth','acceleration','angularAcceleration'],['qfrc_bias','force','torque']]){
  assert.equal(a[key].length,b[key].length);for(let j=0;j<NV;j++)check(j===2?angular:linear,a[key][j],b[key][j]);
 }
 for(const key of ['efc_force','efc_aref','efc_R','efc_J','efc_pos','efc_vel','flexvert_xpos']){
  assert.equal(a[key].length,b[key].length,key);
  // Native parity is also required for the retained stage cache, not just q/v.
  const budget=key==='efc_force'?'force':key==='efc_aref'?'acceleration':key==='efc_vel'?'velocity':key==='efc_R'?'regularizer':'position';
  for(let j=0;j<a[key].length;j++)check(key==='efc_J'?(j%NV===2?'jacobianLength':'jacobian'):budget,a[key][j],b[key][j]);
 }
 check('time',a.time,b.time);assert.equal(a.nefc,b.nefc);assert.equal(a.ncon,b.ncon);assert.deepEqual(a.warnings,[]);assert.deepEqual(b.warnings,[]);
 let pa=0,pb=0;for(let j=0;j<a.nefc;j++){pa+=a.efc_force[j]*a.efc_vel[j];pb+=b.efc_force[j]*b.efc_vel[j];}check('power',pa,pb);
 for(const [k,v] of Object.entries(errors))assert.ok(v<=BUDGETS[k],k+': '+v);return errors;
}

export async function stageSweep(onProgress){
 assert.ok(onProgress===undefined||typeof onProgress==='function');const mj=await getRuntime();assert.equal(mj.mj_versionString(),baseline.nativeVersion);
 for(const [path,h] of Object.entries(baseline.sourcesSha256))assert.equal(hash(await readFile(new URL('../'+path,import.meta.url))),h,'Baseline source changed: '+path);
 const samples=[],maxima=Object.fromEntries(Object.keys(BUDGETS).map(k=>[k,0]));
 for(const source of baseline.samples){
  const input={q:[...source.q],v:[...source.v],warmstart:Array.from({length:NV},(_,i)=>(i%7-3)*.125),time:.25},excluded=Boolean(source.input.excluded);
  const driver=createSpinningStageDriver(mj,input,{excluded}),m=mj.MjModel.from_xml_string(spinningGapXML(excluded));let native;
  try{
   native=new mj.MjData(m);native.qpos.set(input.q);native.qvel.set(input.v);native.qacc_warmstart.set(input.warmstart);native.time=input.time;mj.mj_forward(m,native);
   const steps=[];
   for(let n=0;n<16;n++){
    driver.step();mj.mj_step(m,native);const state=driver.snapshot(),reference=capture(native),errors=compare(state,reference);
    assert.deepEqual(state.qacc,state.qacc_warmstart);for(const [k,e] of Object.entries(errors))maxima[k]=Math.max(maxima[k],e);
    steps.push({time:state.time,errors,stages:state.lastStages,contactWork:state.contactWork,verticalImpulse:state.verticalImpulse});
   }
   const final=driver.snapshot(),endpoint=driver.observe();assert.deepEqual(driver.snapshot(),final,'Observation mutated accepted state');
   samples.push({name:source.name,angle:source.angle,omega:source.omega,excluded,input,steps,final,nativeFinal:capture(native),endpoint});onProgress?.(samples.length,36);
  }finally{native?.delete();m.delete();driver.dispose();}
 }
 return {model:MODEL,nativeVersion:mj.mj_versionString(),scope:'Native-target stage parity and transactional ownership only. No corrected target, trajectory law, material, rider, browser or performance qualification.',baselineReportSha256:hash(baselineBytes),parameters:{wheel:structuredClone(p),timestep:H,steps:16,warmstart:'nonzero deterministic seed',nativeCache:'stage four retained; endpoint observation uses third data slot'},budgets:BUDGETS,budgetUnits:UNITS,samples,maxima};
}

export async function ballisticSweep(){
 const mj=await getRuntime(),cases=[];
 for(const source of baseline.samples.filter(s=>s.name==='separated-closing')){
  const input={q:[...source.q],v:[...source.v],warmstart:new Array(NV).fill(.125),time:0},driver=createSpinningStageDriver(mj,input);
  const errors={position:0,velocity:0,angle:0,angularVelocity:0},check=(key,a,b)=>{errors[key]=Math.max(errors[key],Math.abs(a-b));assert.ok(errors[key]<=BUDGETS[key],key+' ballistic mismatch');};
  const cs=Math.cos(source.angle),sn=Math.sin(source.angle),rest=source.worldOffsets.map(([x,z],i)=>[cs*x-sn*z-input.q[3+2*i],sn*x+cs*z-input.q[4+2*i]]);
  try{
   for(let n=0;n<128;n++){
    driver.step();const d=driver.observe(),t=d.time,theta=d.qpos[2],omega=d.qvel[2],c=Math.cos(theta),s=Math.sin(theta);
    assert.equal(d.nefc,0);assert.equal(d.ncon,0);assert.ok(d.qfrc_constraint.every(x=>x===0));
    check('position',.125+d.qpos[0],source.hubPosition[0]+source.hubVelocity[0]*t);
    check('position',p.radius+d.qpos[1],source.hubPosition[1]+source.hubVelocity[1]*t-.5*p.gravity*t*t);
    check('velocity',d.qvel[0],source.hubVelocity[0]);check('velocity',d.qvel[1],source.hubVelocity[1]-p.gravity*t);
    check('angle',theta,source.angle+source.omega*t);check('angularVelocity',omega,source.omega);
    for(let i=0;i<p.nodes;i++){
     check('position',d.flexvert_xpos[3*i],source.hubPosition[0]+source.worldOffsets[i][0]+source.nodeVelocity[0]*t);
     check('position',d.flexvert_xpos[3*i+2],source.hubPosition[1]+source.worldOffsets[i][1]+source.nodeVelocity[1]*t-.5*p.gravity*t*t);
     const x=rest[i][0]+d.qpos[3+2*i],z=rest[i][1]+d.qpos[4+2*i],vx=d.qvel[3+2*i]+omega*z,vz=d.qvel[4+2*i]-omega*x;
     check('velocity',d.qvel[0]+c*vx+s*vz,source.nodeVelocity[0]);check('velocity',d.qvel[1]-s*vx+c*vz,source.nodeVelocity[1]-p.gravity*t);
    }
   }
   const final=driver.snapshot();assert.equal(final.contactWork,0);assert.equal(final.verticalImpulse,0);
   cases.push({angle:source.angle,omega:source.omega,input,steps:128,duration:128*H,errors,final,endpoint:driver.observe()});
  }finally{driver.dispose();}
 }
 return cases;
}

async function main(){
 assert.ok(process.argv.length<=3,'Usage: node scripts/spinning-rk4-stage.mjs [output-directory]');const dir=resolve(process.argv[2]??'artifacts/spinning-rk4-stage');await mkdir(dir,{recursive:true});
 const sources=['scripts/spinning-rk4-stage.mjs','test/spinning-rk4-stage.test.mjs','docs/evidence/spinning-gap.json',...Object.keys(baseline.sourcesSha256)];
 const hashes=async()=>Object.fromEntries(await Promise.all(sources.map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))]))),sourcesSha256=await hashes();
 assert.equal(sourcesSha256['docs/evidence/spinning-gap.json'],hash(baselineBytes),'Baseline changed since module import');
 const report=await stageSweep((n,total)=>console.log('native RK4 parity',n+'/'+total)),ballistic=await ballisticSweep();assert.deepEqual(await hashes(),sourcesSha256,'Sources changed during run');
 await writeFile(join(dir,'report.json'),JSON.stringify({...report,ballistic,sourcesSha256})+'\n');console.log(JSON.stringify({cases:report.samples.length,steps:report.samples.length*16,ballisticCases:ballistic.length,ballisticSteps:ballistic.length*128,maxima:report.maxima},null,2));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
