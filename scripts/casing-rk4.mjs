// Offline contact-free screen; production physics/admission are unchanged.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {controlInput} from './casing-derivative.mjs';
import {GRID,REFERENCE_BUDGETS,geometricRhs,createGeometricRK4,compiledPhysical,integrateReference,compareReferences,warningCounters} from './casing-refinement.mjs';
import {getRuntime,validate as wheelParameters,geometryLimits} from '../dist/moving-wheel.js';
import {modelXML} from '../dist/tyre-fixture.js';

export const MODEL='bikelab-contact-free-rk4-screen-0.1';
// Declared before candidate measurements: one part in 1000 of fixed initial
// scales. A diagnostic numerical screen, not calibrated physical acceptance.
export const SCREEN=Object.freeze({position:1e-3,velocity:1e-3,residual:1e-3,loss:1e-3});
export const OBSERVER_BUDGETS=Object.freeze({position:1e-12,velocity:1e-10,force:1e-8,energy:1e-12});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function runRK4Screen(options={}){
 assert.ok(options&&typeof options==='object'&&!Array.isArray(options));for(const key of Object.keys(options))assert.ok(['nodes','edgeViscosity','mode','duration','onProgress'].includes(key),'Unknown screen option: '+key);
 const {nodes=128,edgeViscosity=3,mode='alternating',duration=.02,onProgress}=options;
 assert.ok([32,64,128].includes(nodes));assert.ok([.5,3].includes(edgeViscosity));assert.ok(['alternating','x','z'].includes(mode));assert.ok([.000125,.001,.02].includes(duration));assert.ok(onProgress===undefined||typeof onProgress==='function');
 const input=await controlInput({nodes,edgeViscosity,dt:.00003125});input.seed.q.fill(0);input.seed.v.fill(0);
 for(let i=0;i<nodes;i++){if(mode==='alternating')input.seed.v[2*i]=i%2?-.01:.01;else{const axis=mode==='z'?1:0;input.seed.q[2*i+axis]=.001;input.seed.v[2*i+axis]=.01;}}
 const xml=modelXML(input).replace('integrator="implicitfast"','integrator="RK4"'),mj=await getRuntime();let m,d;
 try{
  m=mj.MjModel.from_xml_string(xml);d=new mj.MjData(m);mj.mj_forward(m,d);
  const p=compiledPhysical(mj,m,d,nodes,'RK4'),nv=m.nv,initial=new Float64Array(2*nv+1),wheel=wheelParameters({...input.seed.wheel,dt:input.motion.dt}),hub=new Float64Array([0,1]),limits={};initial.set(input.seed.q);initial.set(input.seed.v,nv);
  const guard=(xyz,previous)=>{geometryLimits(wheel,input.seed.profile,hub,xyz,previous,limits);assert.equal(limits.reason,null,'Geometry domain: '+limits.reason);assert.equal(limits.penetration,0,'Contact-free domain exit');};
  const referenceLevels=[],referenceComparisons=[];let reference;
  for(const divisor of [2,4,8]){
   onProgress?.('reference-start',{dt:GRID/divisor});const next=integrateReference(p,initial,duration,GRID/divisor,guard,fraction=>onProgress?.('reference-progress',{dt:GRID/divisor,fraction}));
   if(reference)referenceComparisons.push(compareReferences(reference,next,nv));referenceLevels.push({dt:next.dt,steps:next.steps,maxResidual:next.maxResidual,finalEnergy:next.energy.at(-1),finalLoss:next.loss.at(-1)});reference=next;
  }
  assert.ok(referenceComparisons.at(-1).withinBudgets,'Reference not converged');
  const E0=reference.initialEnergy,scales={position:Math.sqrt(2*E0/(nodes*p.k)),velocity:Math.sqrt(2*E0/(nodes*p.mass)),energy:E0};
  for(const key of ['position','velocity'])assert.ok(REFERENCE_BUDGETS[key]<SCREEN[key]*scales[key]/10,'Reference budget too large for screen');
  assert.ok(REFERENCE_BUDGETS.energy<SCREEN.residual*E0/10&&REFERENCE_BUDGETS.loss<SCREEN.loss*E0/10);
  const cases=[],state=new Float64Array(2*nv+1),rhs=new Float64Array(2*nv+1),observation={xyz:new Float64Array(3*nodes)},oldQ=new Float64Array(nv),oldV=new Float64Array(nv),oldWarm=new Float64Array(nv),oldXYZ=new Float64Array(3*nodes);
  const shadow=createGeometricRK4(p,initial,xyz=>guard(xyz));
  for(const multiple of [32,16,8,4]){
   const dt=GRID*multiple,steps=Math.round(duration/dt);m.opt.timestep=dt;mj.mj_resetData(m,d);d.qpos.set(input.seed.q);d.qvel.set(input.seed.v);mj.mj_forward(m,d);
   const observe=()=>{
    state.set(d.qpos);state.set(d.qvel,nv);state[2*nv]=0;geometricRhs(p,state,rhs,observation);guard(observation.xyz);
    assert.equal(d.ncon,0);assert.equal(d.nefc,0);mj.mj_energyPos(m,d);mj.mj_energyVel(m,d);
    const energyError=Math.abs(observation.energy-d.energy[0]-d.energy[1]);let forceError=0;
    for(let j=0;j<nv;j++){assert.ok(Number.isFinite(d.qacc[j])&&Number.isFinite(d.qfrc_smooth[j]),'Nonfinite native dynamics');forceError=Math.max(forceError,Math.abs(p.mass*rhs[nv+j]-d.qfrc_smooth[j]));}
    assert.ok(forceError<=OBSERVER_BUDGETS.force&&energyError<=OBSERVER_BUDGETS.energy,'Independent native force/energy mismatch');observation.forceError=forceError;observation.energyError=energyError;
   };
   observe();assert.equal(observation.energy,E0);
   const maxima={position:0,velocity:0,residual:0,loss:0},maxObserver={position:0,velocity:0,force:observation.forceError,energy:observation.energyError},keys=Object.keys(maxima),last={},peak={},frames=Array.from({length:Math.ceil(.00025/dt)+Math.ceil(duration/.000125)+2},()=>({}));
   let tick=0,count=0,loss=0,trapezoidLoss=0,termination=null,previousPower=observation.power;
   Object.assign(frames[count++],{tick:0,time:0,energy:E0,stageLoss:0,trapezoidLoss:0,referenceLoss:0,position:0,velocity:0,residual:0,loss:0});
   for(let next=1;next<=steps;next++){
    oldQ.set(d.qpos);oldV.set(d.qvel);oldWarm.set(d.qacc_warmstart);oldXYZ.set(observation.xyz);const oldTime=d.time;
    let observerPosition=0,observerVelocity=0;
    try{
     // Independently reconstructed stage work, not native-exposed telemetry.
     // Restart from native pre-step state; never feed shadow q/v back to native.
     shadow.state.set(d.qpos);shadow.state.set(d.qvel,nv);shadow.state[2*nv]=0;shadow.step(dt);
     mj.mj_step(m,d);mj.mj_forward(m,d);observe();guard(observation.xyz,oldXYZ);assert.ok(Math.abs(d.time-next*dt)<1e-10,'Native clock reset');
     for(let j=0;j<nv;j++){observerPosition=Math.max(observerPosition,Math.abs(shadow.state[j]-d.qpos[j]));observerVelocity=Math.max(observerVelocity,Math.abs(shadow.state[nv+j]-d.qvel[j]));}
     assert.ok(observerPosition<=OBSERVER_BUDGETS.position&&observerVelocity<=OBSERVER_BUDGETS.velocity,'Native/shadow endpoint mismatch');assert.ok(Number.isFinite(shadow.state[2*nv])&&shadow.state[2*nv]>=0,'Invalid stage loss');
    }catch(error){
     termination={attemptedTick:next,reason:error.message};d.qpos.set(oldQ);d.qvel.set(oldV);d.qacc_warmstart.set(oldWarm);d.time=oldTime;mj.mj_forward(m,d);observe();break;
    }
    tick=next;loss+=shadow.state[2*nv];trapezoidLoss+=dt*(previousPower+observation.power)/2;previousPower=observation.power;
    maxObserver.position=Math.max(maxObserver.position,observerPosition);maxObserver.velocity=Math.max(maxObserver.velocity,observerVelocity);maxObserver.force=Math.max(maxObserver.force,observation.forceError);maxObserver.energy=Math.max(maxObserver.energy,observation.energyError);
    const index=tick*multiple,offset=index*2*nv;let position=0,velocity=0;
    for(let j=0;j<nv;j++){position=Math.max(position,Math.abs(d.qpos[j]-reference.trajectory[offset+j]));velocity=Math.max(velocity,Math.abs(d.qvel[j]-reference.trajectory[offset+nv+j]));}
    last.tick=tick;last.time=tick*dt;last.energy=observation.energy;last.stageLoss=loss;last.trapezoidLoss=trapezoidLoss;last.referenceLoss=reference.loss[index];last.position=position;last.velocity=velocity;last.residual=observation.energy-E0+loss;last.loss=loss-reference.loss[index];
    for(const key of keys)maxima[key]=Math.max(maxima[key],Math.abs(last[key]));if(tick===1||Math.abs(last.residual)>Math.abs(peak.residual))Object.assign(peak,last);
    if(tick*dt<=.00025||tick%Math.round(.000125/dt)===0||tick===steps)Object.assign(frames[count++],last);
   }
   if(frames[count-1].tick!==tick)Object.assign(frames[count++],last);
   const nativeWarnings=warningCounters(d),normalized={position:maxima.position/scales.position,velocity:maxima.velocity/scales.velocity,residual:maxima.residual/E0,loss:maxima.loss/E0},checks=Object.fromEntries(keys.map(key=>[key,normalized[key]<=SCREEN[key]]));
   const passed=tick===steps&&!termination&&!nativeWarnings.length&&Object.values(checks).every(Boolean);
   cases.push({dt,steps:tick,requestedSteps:steps,status:termination?'terminated':nativeWarnings.length?'native-warning':'completed',termination,nativeWarnings,screenPassed:passed,checks,normalized,maxima,maxObserver,endpoint:tick?{...last}:{...frames[0]},atPeakResidual:tick?{...peak}:null,finalNodes:{q:Array.from(d.qpos),v:Array.from(d.qvel)},frames:frames.slice(0,count)});
   onProgress?.('candidate-completed',{dt,steps:tick,screenPassed:passed,normalized,termination});
  }
  return {model:MODEL,scope:'Offline contact-free RK4 screening with independently reconstructed stage loss; no prior stability certificate, calibrated material, loaded contact, production or real-time qualification.',input,mode,diagnosticDuration:duration,observationGrid:GRID,nativeVersion:mj.mj_versionString(),xmlSha256:hash(xml),physical:p,initialEnergy:E0,scales,screenBudgets:SCREEN,observerBudgets:OBSERVER_BUDGETS,referenceBudgets:REFERENCE_BUDGETS,referenceLevels,referenceComparisons,cases};
 }finally{d?.delete();m?.delete();}
}

async function main(){
 if(process.argv.length>3)throw Error('Usage: node scripts/casing-rk4.mjs [output-directory]');const dir=resolve(process.argv[2]??'artifacts/casing-rk4');await mkdir(dir,{recursive:true});
 const sources=['scripts/casing-rk4.mjs','scripts/casing-refinement.mjs','scripts/casing-euler.mjs','scripts/casing-derivative.mjs','dist/moving-wheel.js','dist/tyre-fixture.js','dist/tyre-fixture-examples.json','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm'];
 const sourcesSha256=Object.fromEntries(await Promise.all(sources.map(async path=>[path,hash(await readFile(new URL('../'+path,import.meta.url)))])));
 const result=await runRK4Screen({onProgress:(stage,value)=>console.log(stage,JSON.stringify(value))}),cases=[];
 for(let i=0;i<result.cases.length;i++){const c=result.cases[i],file='case-'+(i+1)+'.json',bytes=JSON.stringify(c,null,2)+'\n';await writeFile(join(dir,file),bytes);const {frames,finalNodes,...receipt}=c;cases.push({file,sha256:hash(bytes),...receipt});}
 await writeFile(join(dir,'report.json'),JSON.stringify({...result,sourcesSha256,cases},null,2)+'\n');if(!cases.some(c=>c.screenPassed))process.exitCode=2;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
