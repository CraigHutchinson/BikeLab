// Loaded fixed-hub native RK4 work/convergence study. Not production acceptance.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {getRuntime,geometryLimits,validate as wheelParameters} from '../dist/moving-wheel.js';
import {validate,modelXML} from '../dist/tyre-fixture.js';
import {createStageObserver,STAGE_WORK,STAGE_BUDGETS} from '../dist/casing-rk4-observer.js';
import {warningCounters} from './casing-refinement.mjs';

export const MODEL='bikelab-loaded-rk4-work-0.1';
export const STEPS=Object.freeze([.00000390625,.000001953125,.0000009765625]);
export const FORCE_BUDGETS=Object.freeze({energy:1e-10,force:1e-8,power:1e-8,balance:1e-8,contactPower:1e-8});
// Fixed before the longer loaded sweep. SI absolute budgets, independent of
// potential-energy datum. The finer halving must fit one tenth of each budget.
export const LOADED_BUDGETS=Object.freeze({position:1e-7,velocity:1e-4,force:.05,impulse:1e-5,loss:1e-6,work:1e-6,residual:1e-6});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

// Reconstruct conservative energy, full passive forces and edge damping from
// Cartesian geometry. Contacts remain native; their signed work is not loss.
export function createLoadedGuard(mj,m,input){
 const n=input.seed.wheel.nodes,nv=2*n,hubID=mj.mj_name2id(m,mj.mjtObj.mjOBJ_BODY.value,'hub'),wheel=wheelParameters({...input.seed.wheel,dt:input.motion.dt}),hub=new Float64Array([input.seed.hub.position[0],input.seed.hub.position[2]]),limits={};
 assert.equal(m.nv,nv);assert.equal(m.nq,nv);assert.equal(m.nC,nv);assert.equal(m.nflex,1);assert.equal(m.nflexedge,n);assert.equal(m.body_jntnum[hubID],0);assert.equal(m.opt.gravity[0],0);assert.equal(m.opt.gravity[1],0);assert.equal(m.opt.gravity[2],-input.seed.gravity);
 const masses=new Float64Array(n),forces=new Float64Array(nv),velocity=new Float64Array(nv),observation={energy:0,lossPower:0,contactPower:0,verticalForce:0,elasticEnergy:0,kineticEnergy:0,energyError:0,forceError:0,powerError:0,balance:0,contacts:0,limits};
 for(let i=0;i<n;i++){const body=mj.mj_name2id(m,mj.mjtObj.mjOBJ_BODY.value,'casing_n'+i);assert.equal(m.body_parentid[body],hubID);assert.equal(m.flex_vertbodyid[i],body);masses[i]=m.body_mass[body];for(let axis=0;axis<2;axis++){const j=2*i+axis;assert.equal(m.jnt_bodyid[j],body);assert.equal(m.jnt_qposadr[j],j);assert.equal(m.jnt_dofadr[j],j);assert.equal(m.M_rownnz[j],1);assert.equal(m.M_colind[m.M_rowadr[j]],j);assert.deepEqual(Array.from(m.jnt_axis.slice(3*j,3*j+3)),axis?[0,0,1]:[1,0,0]);assert.equal(m.qpos_spring[j],0);assert.equal(m.dof_damping[j],0);}}
 const keys=Object.keys(FORCE_BUDGETS),metrics={energy:0,force:0,power:0,balance:0,contactPower:0};
 function observe(d,previous){
  const xyz=d.flexvert_xpos,R=d.xmat,ri=9*hubID,xx=R[ri],xz=R[ri+2],zx=R[ri+6],zz=R[ri+8];
  geometryLimits(wheel,input.seed.profile,hub,xyz,previous,limits);assert.equal(limits.reason,null,'Loaded geometry: '+limits.reason);
  for(let i=0;i<d.solver_niter.length;i++)assert.ok(d.solver_niter[i]<m.opt.iterations,'Native solver iteration limit');assert.ok(d.ncon<=256,'Contact capacity limit');
  let kinetic=0,elastic=0,gravity=0,power=0,contact=0,vertical=0,forceError=0,balance=0,nativeLoss=0;
  for(let i=0;i<n;i++){
   const u=2*i,v=u+1,mass=masses[i];assert.ok(Math.abs(d.M[m.M_rowadr[u]]-mass)<=8*Number.EPSILON*mass);assert.ok(Math.abs(d.M[m.M_rowadr[v]]-mass)<=8*Number.EPSILON*mass);
   assert.ok(Math.hypot(d.qpos[u],d.qpos[v])<=wheel.maxDisplacement,'Casing displacement limit');
   kinetic+=.5*mass*(d.qvel[u]**2+d.qvel[v]**2);gravity+=mass*input.seed.gravity*xyz[3*i+2];
   velocity[u]=xx*d.qvel[u]+xz*d.qvel[v];velocity[v]=zx*d.qvel[u]+zz*d.qvel[v];
   for(let j=u;j<=v;j++){elastic+=.5*m.jnt_stiffness[j]*d.qpos[j]**2;forces[j]=-m.jnt_stiffness[j]*d.qpos[j];contact+=d.qfrc_constraint[j]*d.qvel[j];nativeLoss-=d.qfrc_damper[j]*d.qvel[j];balance=Math.max(balance,Math.abs(mass*d.qacc[j]-d.qfrc_smooth[j]-d.qfrc_constraint[j]));}
   vertical+=zx*d.qfrc_constraint[u]+zz*d.qfrc_constraint[v];
  }
  for(let e=0;e<n;e++){
   const a=m.flex_edge[2*e],b=m.flex_edge[2*e+1],dx=xyz[3*b]-xyz[3*a],dz=xyz[3*b+2]-xyz[3*a+2],length=Math.hypot(dx,dz),rest=m.flexedge_length0[e],extension=length-rest;
   assert.ok(length>1e-12&&Math.abs(extension/rest)<=wheel.maxStrain,'Casing strain limit');const ex=dx/length,ez=dz/length,rate=ex*(velocity[2*b]-velocity[2*a])+ez*(velocity[2*b+1]-velocity[2*a+1]),f=m.flex_edgestiffness[0]*extension+m.flex_edgedamping[0]*rate,fu=f*(xx*ex+zx*ez),fv=f*(xz*ex+zz*ez);
   forces[2*a]+=fu;forces[2*a+1]+=fv;forces[2*b]-=fu;forces[2*b+1]-=fv;elastic+=.5*m.flex_edgestiffness[0]*extension**2;power+=m.flex_edgedamping[0]*rate**2;
  }
  for(let j=0;j<nv;j++)forceError=Math.max(forceError,Math.abs(forces[j]-d.qfrc_passive[j]));
  let rowPower=0;for(let i=0;i<d.nefc;i++){assert.equal(d.efc_type[i],mj.mjtConstraint.mjCNSTR_CONTACT_FRICTIONLESS.value,'Unsupported contact row');assert.ok(d.efc_force[i]>=0,'Tensile normal force');rowPower+=d.efc_force[i]*d.efc_vel[i];}
  mj.mj_energyPos(m,d);mj.mj_energyVel(m,d);observation.energy=kinetic+elastic+gravity;observation.elasticEnergy=elastic;observation.kineticEnergy=kinetic;observation.lossPower=power;observation.contactPower=contact;observation.verticalForce=vertical;observation.contacts=d.ncon;
  metrics.energy=observation.energyError=Math.abs(observation.energy-d.energy[0]-d.energy[1]);metrics.force=observation.forceError=forceError;metrics.power=observation.powerError=Math.abs(power-nativeLoss);metrics.balance=observation.balance=balance;
  metrics.contactPower=observation.contactPowerError=Math.abs(rowPower-contact);
  for(const key of keys)assert.ok(Number.isFinite(metrics[key])&&metrics[key]<=FORCE_BUDGETS[key],'Independent loaded '+key+' mismatch');
  return observation;
 }
 return {observe,observation};
}

export async function runLoaded(input,options={}){
 for(const key of Object.keys(options))assert.ok(['dt','duration','onProgress','comparison','contactGeometry'].includes(key),'Unknown loaded option: '+key);
 const {dt=STEPS[0],duration=.001,onProgress,comparison=false,contactGeometry='mesh'}=options;assert.ok(STEPS.includes(dt));assert.ok([.000125,.001,.02].includes(duration));assert.ok(onProgress===undefined||typeof onProgress==='function');assert.equal(typeof comparison,'boolean');assert.ok(['mesh','plane'].includes(contactGeometry));
 const a=validate(input);let xml=modelXML(a).replace('integrator="implicitfast"','integrator="RK4"').replace(/timestep="[^"]*"/,'timestep="'+dt+'"');
 if(contactGeometry==='plane'){
  const w=a.seed.wheel,geom='<geom name="ground1" type="plane" pos="0 0 '+a.seed.profile.points[0][1]+'" size="0 0 .1" condim="1" friction="0 0 0" solref="'+w.contactTime+' 1" solimp="'+w.contactImpedance+' '+w.contactImpedance+' .001"/>';
  assert.equal((xml.match(/<geom name="ground\d+"/g)||[]).length,1,'Plane isolation requires one flat canonical segment');xml=xml.replace(/<geom name="ground1"[^>]*\/>/,geom);
 }
 const mj=await getRuntime();let m,d,observer;
 try{
  m=mj.MjModel.from_xml_string(xml);d=new mj.MjData(m);d.qpos.set(a.seed.q);if(a.rates==='imported')d.qvel.set(a.seed.v);mj.mj_forward(m,d);
  const guard=createLoadedGuard(mj,m,a),stageGuard=createLoadedGuard(mj,m,a),o=guard.observe(d),initialEnergy=o.energy,energyScale=o.elasticEnergy+o.kineticEnergy,steps=Math.round(duration/dt),stride=Math.round(.000125/dt),oldXYZ=new Float64Array(d.flexvert_xpos.length),maxObserver=Object.fromEntries(Object.keys(STAGE_BUDGETS).map(k=>[k,0])),observerKeys=Object.keys(maxObserver),frames=Array.from({length:steps/stride+2},()=>({q:new Float64Array(m.nq),v:new Float64Array(m.nv)}));
  let stageObservations=0,stageMinContacts=Infinity,stageMaxContacts=0,minContactPower=Infinity,maxContactPower=-Infinity,maxForceError=0,maxEnergyError=0,maxPowerError=0,maxBalance=0,maxContactPowerError=0;
  let trialCount=0,trialMinContacts=Infinity,trialMaxContacts=0,trialMinPower=Infinity,trialMaxPower=-Infinity,trialForce=0,trialEnergy=0,trialPower=0,trialBalance=0,trialContactPower=0;
  observer=createStageObserver(mj,m,(stage,index,previous)=>{const p=stageGuard.observe(stage,previous);trialCount++;trialMinContacts=Math.min(trialMinContacts,p.contacts);trialMaxContacts=Math.max(trialMaxContacts,p.contacts);trialMinPower=Math.min(trialMinPower,p.contactPower);trialMaxPower=Math.max(trialMaxPower,p.contactPower);trialForce=Math.max(trialForce,p.forceError);trialEnergy=Math.max(trialEnergy,p.energyError);trialPower=Math.max(trialPower,p.powerError);trialBalance=Math.max(trialBalance,p.balance);trialContactPower=Math.max(trialContactPower,p.contactPowerError);return p;});
  let accepted=0,count=0,loss=0,work=0,impulse=0,trapLoss=0,trapWork=0,maxResidual=0,maxTrapezoidResidual=0,peakForce=o.verticalForce,termination=null;
  const comparisonStride=Math.round(STEPS[0]/dt),width=2*m.nv+4,trajectory=comparison?new Float64Array((Math.round(duration/STEPS[0])+1)*width):null;let comparisonCount=0;
  const compareSample=()=>{if(!trajectory)return;const offset=comparisonCount++*width;trajectory.set(d.qpos,offset);trajectory.set(d.qvel,offset+m.nv);trajectory[offset+2*m.nv]=o.verticalForce;trajectory[offset+2*m.nv+1]=impulse;trajectory[offset+2*m.nv+2]=loss;trajectory[offset+2*m.nv+3]=work;};compareSample();
  const record=()=>{const f=frames[count++];f.q.set(d.qpos);f.v.set(d.qvel);Object.assign(f,{tick:accepted,time:d.time,energy:o.energy,dampingLoss:loss,contactWork:work,verticalImpulse:impulse,residual:o.energy-initialEnergy+loss-work,trapezoidResidual:o.energy-initialEnergy+trapLoss-trapWork,verticalForce:o.verticalForce,contacts:o.contacts,kineticEnergy:o.kineticEnergy});};record();
  for(let tick=1;tick<=steps;tick++){
   oldXYZ.set(d.flexvert_xpos);const previousLoss=o.lossPower,previousWork=o.contactPower;let prediction;
   trialCount=trialMaxContacts=trialForce=trialEnergy=trialPower=trialBalance=trialContactPower=0;trialMinContacts=trialMinPower=Infinity;trialMaxPower=-Infinity;
   try{prediction=observer.predict(d);mj.mj_step(m,d);observer.compare(d);mj.mj_forward(m,d);guard.observe(d,oldXYZ);}
   catch(error){termination={attemptedTick:tick,reason:error.message};observer.restore(d);mj.mj_forward(m,d);guard.observe(d);break;}
   accepted=tick;loss+=prediction.loss;work+=prediction.contactWork;impulse+=prediction.verticalImpulse;trapLoss+=dt*(previousLoss+o.lossPower)/2;trapWork+=dt*(previousWork+o.contactPower)/2;
   stageObservations+=trialCount;stageMinContacts=Math.min(stageMinContacts,trialMinContacts);stageMaxContacts=Math.max(stageMaxContacts,trialMaxContacts);minContactPower=Math.min(minContactPower,trialMinPower);maxContactPower=Math.max(maxContactPower,trialMaxPower);maxForceError=Math.max(maxForceError,trialForce);maxEnergyError=Math.max(maxEnergyError,trialEnergy);maxPowerError=Math.max(maxPowerError,trialPower);maxBalance=Math.max(maxBalance,trialBalance);maxContactPowerError=Math.max(maxContactPowerError,trialContactPower);
   for(const key of observerKeys)maxObserver[key]=Math.max(maxObserver[key],observer.comparison[key]);maxResidual=Math.max(maxResidual,Math.abs(o.energy-initialEnergy+loss-work));maxTrapezoidResidual=Math.max(maxTrapezoidResidual,Math.abs(o.energy-initialEnergy+trapLoss-trapWork));peakForce=Math.max(peakForce,o.verticalForce);
   if(tick%comparisonStride===0)compareSample();
   if(tick%stride===0)record();if(tick%Math.max(1,Math.floor(steps/10))===0)onProgress?.(tick,steps);
  }
  if(frames[count-1].tick!==accepted)record();const nativeWarnings=warningCounters(d),observerWarnings=warningCounters(observer.data);
  return {model:contactGeometry==='plane'?'bikelab-loaded-rk4-plane-work-0.1':MODEL,stageWork:STAGE_WORK,scope:'Fixed stationary hub; signed native normal-contact work, no contact-storage/loss decomposition, physical calibration or convergence certification.',input:a,diagnostic:{dt,duration,...(contactGeometry==='plane'?{contactGeometry:'plane-vertices',finiteProfileGuardRetained:true}:{})},nativeVersion:mj.mj_versionString(),xmlSha256:hash(xml),budgets:{observer:STAGE_BUDGETS,independent:FORCE_BUDGETS},status:termination?'terminated':nativeWarnings.length||observerWarnings.length?'native-warning':'completed',termination,nativeWarnings,observerWarnings,summary:{steps:accepted,initialEnergy,energyScale,maxResidual,maxTrapezoidResidual,peakForce,maxObserver,stageObservations,stageMinContacts:stageObservations?stageMinContacts:null,stageMaxContacts:stageObservations?stageMaxContacts:null,minContactPower:stageObservations?minContactPower:null,maxContactPower:stageObservations?maxContactPower:null,maxForceError,maxEnergyError,maxPowerError,maxBalance,maxContactPowerError},rejectedStages:termination?{completed:trialCount,minContacts:trialCount?trialMinContacts:null,maxContacts:trialCount?trialMaxContacts:null}:null,frames:frames.slice(0,count).map(f=>({...f,q:Array.from(f.q),v:Array.from(f.v)})),finalNodes:{q:Array.from(d.qpos),v:Array.from(d.qvel),warmstart:Array.from(d.qacc_warmstart)},...(comparison?{comparison:{dt:STEPS[0],count:comparisonCount,width,trajectory}}:{})};
 }finally{observer?.dispose();d?.delete();m?.delete();}
}

export function compareLoaded(a,b,fraction=1){
 assert.equal(a.status,'completed');assert.equal(b.status,'completed');assert.equal(a.comparison.count,b.comparison.count);assert.equal(a.comparison.width,b.comparison.width);assert.equal(a.comparison.dt,b.comparison.dt);
 const av=a.comparison.trajectory,bv=b.comparison.trajectory,nv=a.finalNodes.q.length,width=a.comparison.width,maxima={position:0,velocity:0,force:0,impulse:0,loss:0,work:0,residual:Math.max(a.summary.maxResidual,b.summary.maxResidual)},names=['force','impulse','loss','work'];
 for(let i=0;i<a.comparison.count;i++){const o=i*width;for(let j=0;j<nv;j++){maxima.position=Math.max(maxima.position,Math.abs(av[o+j]-bv[o+j]));maxima.velocity=Math.max(maxima.velocity,Math.abs(av[o+nv+j]-bv[o+nv+j]));}for(let j=0;j<4;j++)maxima[names[j]]=Math.max(maxima[names[j]],Math.abs(av[o+2*nv+j]-bv[o+2*nv+j]));}
 return {coarseDt:a.diagnostic.dt,fineDt:b.diagnostic.dt,comparisonDt:a.comparison.dt,samples:a.comparison.count,budgetFraction:fraction,maxima,withinBudgets:Object.entries(maxima).every(([key,value])=>value<=fraction*LOADED_BUDGETS[key])};
}

async function main(){
 assert.ok(process.argv.length<=4,'Usage: node scripts/casing-loaded.mjs [output-directory] [duration]');const dir=resolve(process.argv[2]??'artifacts/casing-loaded'),duration=Number(process.argv[3]??.001);assert.ok([.001,.02].includes(duration));await mkdir(dir,{recursive:true});
 const examples=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))),cases=[],refinement=[];
 for(const example of examples.cases)for(const rates of ['imported','zero']){let previous;for(const dt of STEPS){
  const input=structuredClone(example.input);input.rates=rates;const name=input.seed.source.bike+'-'+input.seed.source.wheel+'-'+rates+'-'+STEPS.indexOf(dt);console.log('starting',name);
  const result=await runLoaded(input,{dt,duration,comparison:true,onProgress:(tick,total)=>console.log(name,Math.round(100*tick/total)+'%')}),{comparison,...record}=result,bytes=JSON.stringify(record,null,2)+'\n',file=name+'.json';await writeFile(join(dir,file),bytes);const {frames,finalNodes,...summary}=record;cases.push({file,sha256:hash(bytes),...summary});if(previous&&previous.status==='completed'&&result.status==='completed')refinement.push({name,...compareLoaded(previous,result,dt===STEPS[2]?.1:1)});previous=result;console.log('completed',name,result.status,result.summary.maxResidual);
 }}
 const sources=['scripts/casing-loaded.mjs','dist/casing-rk4-observer.js','dist/tyre-fixture.js','dist/moving-wheel.js','dist/tyre-fixture-examples.json','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm'],sourcesSha256=Object.fromEntries(await Promise.all(sources.map(async path=>[path,hash(await readFile(new URL('../'+path,import.meta.url)))])));
 await writeFile(join(dir,'report.json'),JSON.stringify({model:MODEL,loadedBudgets:LOADED_BUDGETS,cases,refinement,sourcesSha256},null,2)+'\n');if(cases.some(c=>c.status!=='completed')||refinement.some(c=>!c.withinBudgets))process.exitCode=2;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
