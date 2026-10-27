import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDrive,evaluateDrive,createDriveFrame,createRiderDrive,ACTIVE_MODEL} from '../dist/rider-drive.js';
import {JOINTS} from '../dist/rider-passive.js';
import {activePreset,articulatedPreset,validate,modelXML,run,replay,inputFromRecord} from '../dist/trail-bike.js';
import {getRuntime} from '../dist/moving-wheel.js';
const near=(a,b,t=1e-10)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} vs ${b}`);
const short=bike=>{const a=activePreset(bike);a.motion.duration=.02;return a;};

test('drive configuration owns absolute targets and rejects unsupported or ambiguous modes',()=>{
 const passive=articulatedPreset().articulated.passive,c=validateDrive({},passive);
 assert.ok(Object.isFrozen(c.joints.hip));
 const patch={joints:{hip:{kp:123}}},copy=validateDrive(patch,passive);patch.joints.hip.kp=99;assert.equal(copy.joints.hip.kp,123);
 for(const bad of [null,[],{format:'other'},{slewRate:1},{joints:undefined},{joints:{ankle:{}}},{joints:{hip:{kp:NaN}}},{joints:{hip:{kp:-1}}},{joints:{hip:{targetAngle:100}}},{joints:{hip:{maxSpeed:0}}}])assert.throws(()=>validateDrive(bad,passive));
 for(const bad of [Object.defineProperty({},'joints',{value:{},enumerable:false}),{joints:{hip:Object.defineProperty({},'kp',{get(){throw Error('Getter evaluated');},enumerable:true})}}])assert.throws(()=>validateDrive(bad,passive),/enumerable data properties/);
 assert.throws(()=>validate({active:{}}));assert.throws(()=>validate({...articulatedPreset(),active:{}}));assert.throws(()=>validate({...short(),active:undefined}));
 const long=activePreset('full',10);assert.equal(validate(long).motion.sampleDt,.05);
 const passiveLong={...long};delete passiveLong.active;assert.throws(()=>validate(passiveLong));
});

test('sampled PD has independent torque and signed power limits with owned repeatable output',()=>{
 const laws=JOINTS.map(()=>({angle0:1,targetQ:.1,drive:{targetAngle:1.1,kp:100,kd:10,maxTorque:6,maxPositivePower:3,maxNegativePower:4}}));
 const out=createDriveFrame(),q=[0,0,0,0],v=[2,-2,.1,0];evaluateDrive(laws,q,v,out);
 assert.deepEqual(Array.from(out.requestedTorque),[-10,30,9,10]);
 assert.deepEqual(Array.from(out.torque),[-2,2,6,6]);assert.deepEqual(Array.from(out.saturation),[3,3,1,1]);near(out.totalPower,-7.4);
 const held=structuredClone(out);evaluateDrive(laws,q,v,out);assert.deepEqual(out,held);
 // A smaller positive power budget limits driving without reducing static torque.
 laws[2].drive.maxPositivePower=.3;evaluateDrive(laws,q,v,out);near(out.torque[2],3);near(out.power[2],.3);assert.equal(out.torque[3],6);
});

test('native drive binding affects only four relative joints and guards held endpoint power/speed',async()=>{
 const mj=await getRuntime(),a=validate(short());let model,data;
 try{
  model=mj.MjModel.from_xml_string(modelXML(short()));data=new mj.MjData(model);
  const drive=createRiderDrive(mj,model,a.active,a.articulated.passive);data.qfrc_applied.fill(0);data.qpos[drive.laws[0].q]=-.02;drive.apply(data);
  assert.deepEqual(Array.from(data.qfrc_applied).map((x,i)=>x?i:-1).filter(i=>i>=0),[drive.laws[0].v]);
  const effort=new Float64Array(4);effort[0]=100;data.qvel[drive.laws[0].v]=7;
  assert.equal(drive.issue(data.qvel,effort),'rider-drive-hip-held-power-limit');data.qvel[drive.laws[0].v]=-7;assert.equal(drive.issue(data.qvel,effort),'rider-drive-hip-held-power-limit');
  data.qvel[drive.laws[0].v]=13;assert.equal(drive.issue(data.qvel,effort),'rider-drive-hip-speed-limit');
 }finally{data?.delete();model?.delete();}
});

test('zero effort preserves passive complete frames on both bikes; active identity and replay are explicit',async()=>{
 for(const bike of ['full','hardtail']){
  const a=short(bike);a.active={joints:Object.fromEntries(JOINTS.map(name=>[name,{maxTorque:0}]))};
  const b=structuredClone(a);delete b.active;
  const active=await run(a),passive=await run(b);assert.equal(active.model,ACTIVE_MODEL);assert.equal(active.status,'completed');
  assert.equal(modelXML(a),modelXML(b));assert.notEqual(active.initialState.identity,passive.initialState.identity);
  assert.deepEqual(active.frames.map(({active,...f})=>f),passive.frames);assert.equal(active.summary.riderWork,0);
  assert.deepEqual(await replay(active),active);
  const wrong=structuredClone(active);wrong.model=passive.model;assert.throws(()=>inputFromRecord(wrong),/Legacy record/);
  const missing=structuredClone(active);delete missing.scenario.active.joints.hip.maxTorque;assert.throws(()=>inputFromRecord(missing),/Incomplete/);
  const restart={...active.scenario,initialization:{mode:'state',state:active.finalState},motion:{gravity:9.80665,duration:.02,dt:.00003125,sampleDt:.005}};
  assert.equal((await run(restart)).frames[0].active.work,0);
  restart.active=structuredClone(restart.active);restart.active.joints.hip.kp+=1;await assert.rejects(()=>run(restart),/identity/);
 }
});

test('active work equals the independently intercepted held native torque times actual displacement',async()=>{
 const mj=await getRuntime(),step=mj.mj_step,a=short(),intervals=[];let joints;
 mj.mj_step=(m,d)=>{
  if(!joints)joints=['riderHip','riderKnee','riderShoulder','riderElbow'].map(name=>{const id=mj.mj_name2id(m,mj.mjtObj.mjOBJ_JOINT.value,name);return {q:m.jnt_qposadr[id],v:m.jnt_dofadr[id]};});
  const q=joints.map(j=>d.qpos[j.q]),tau=joints.map(j=>d.qfrc_applied[j.v]);step(m,d);
  intervals.push({time:d.time,work:joints.map((j,i)=>tau[i]*(d.qpos[j.q]-q[i]))});
 };
 let r;try{r=await run(a);}finally{mj.mj_step=step;}
 assert.equal(r.status,'completed');assert.ok(Math.abs(r.summary.riderWork)>1e-4);
 for(const f of r.frames){let work=0;for(const interval of intervals)if(interval.time<=f.time+1e-12)for(const w of interval.work)work+=w;near(f.active.work,work,1e-13);near(f.residual,f.energy-r.summary.initialEnergy+f.dampingLoss-f.constraintWork-f.driveWork-work,1e-12);}
 assert.ok(r.summary.maxSampledRootWrench<1e-7);assert.ok(r.summary.maxDiagnosticDifference<1e-8);
 const sparse=await run({...a,motion:{...a.motion,sampleDt:.01}});assert.deepEqual(sparse.frames.at(-1),r.frames.at(-1));
});

test('rejected post-command active endpoint restores state, effort, command and work exactly',async()=>{
 const a=short();a.commands=[{tick:0,rearDrive:0,frontBrake:0,rearBrake:0},{tick:321,rearDrive:2,frontBrake:0,rearBrake:0}];
 const reference=await run(a),expected=reference.frames.find(f=>Math.abs(f.time-.01)<1e-10),mj=await getRuntime(),forward=mj.mj_forward;let injected=false;
 mj.mj_forward=(m,d)=>{forward(m,d);if(!injected&&d.time>.01&&d.time<.01004){const id=mj.mj_name2id(m,mj.mjtObj.mjOBJ_JOINT.value,'rearwheelSpin');if(d.qfrc_applied[m.jnt_dofadr[id]]===2){injected=true;d.qacc[0]=NaN;d.eq_active[0]=0;}}};
 let r;try{r=await run(a);}finally{mj.mj_forward=forward;}
 assert.ok(injected);assert.equal(r.status,'terminated');assert.equal(r.termination.reason,'nonfinite-state');assert.deepEqual(r.frames.at(-1),expected);near(r.summary.riderWork,expected.active.work);for(const [i,name] of ['riderX','riderZ','riderPitch','riderHip','riderKnee','riderShoulder','riderElbow'].entries()){const j=r.finalState.joints.find(j=>j.name===name);near(j.position,expected.articulated.nativeCoordinates[i]);near(j.velocity,expected.articulated.nativeVelocities[i]);}
});

test('a genuine held-effort power rejection excludes attempted work and replays its accepted prefix',async()=>{
 const a=short();a.active={joints:{knee:{maxNegativePower:.01}}};
 const mj=await getRuntime(),step=mj.mj_step,intervals=[];let joints;
 mj.mj_step=(m,d)=>{
  if(!joints)joints=['riderHip','riderKnee','riderShoulder','riderElbow'].map(name=>{const id=mj.mj_name2id(m,mj.mjtObj.mjOBJ_JOINT.value,name);return {q:m.jnt_qposadr[id],v:m.jnt_dofadr[id]};});
  const q=joints.map(j=>d.qpos[j.q]),effort=joints.map(j=>d.qfrc_applied[j.v]);step(m,d);
  intervals.push({time:d.time,q:joints.map(j=>d.qpos[j.q]),work:joints.map((j,i)=>effort[i]*(d.qpos[j.q]-q[i]))});
 };
 let r;try{r=await run(a);}finally{mj.mj_step=step;}
 assert.equal(r.status,'terminated');assert.equal(r.termination.reason,'rider-drive-knee-held-power-limit');assert.ok(intervals.at(-1).time>r.summary.acceptedTime);
 const accepted=intervals.filter(x=>x.time<=r.summary.acceptedTime+1e-12);let work=0;for(const x of accepted)for(const value of x.work)work+=value;
 near(r.summary.riderWork,work,1e-13);assert.deepEqual(r.frames.at(-1).articulated.coordinates,accepted.at(-1).q);
 assert.ok(r.frames.at(-1).active.power[1]>=-.01-1e-10);assert.deepEqual(await replay(r),r);
});

test('active flight refines numerical momentum and energy errors without root actuation',async()=>{
 for(const bike of ['full','hardtail']){
  let previous;
  for(const dt of [.00003125,.000015625,.0000078125]){
   const a=short(bike);a.motion={...a.motion,dt,gravity:0,clearance:.3};
   const spec=validate(a).active;
   a.active={joints:{hip:{targetAngle:spec.joints.hip.targetAngle+.005},knee:{targetAngle:spec.joints.knee.targetAngle-.005}}};
   const r=await run(a);assert.equal(r.status,'completed');assert.ok(Math.abs(r.summary.riderWork)>1e-5);
   for(const f of r.frames)assert.equal(f.contacts.length,0);
   const f=r.frames.at(-1),errors=[Math.hypot(f.momentumResidual[0],f.momentumResidual[1]),Math.abs(f.articulated.momentumResidualAfterClosure[2]),r.summary.maxResidual];
   // Explicit native integration does not preserve continuous momentum exactly
   // while the articulated shape changes. Check absolute budgets and refinement.
   assert.ok(errors[0]<2e-4);assert.ok(errors[1]<2e-4);assert.ok(errors[2]<.02);
   if(previous)errors.forEach((error,i)=>assert.ok(error<.6*previous[i],bike+' refinement '+i));
   assert.ok(r.summary.maxSampledRootWrench<1e-7);previous=errors;
  }
 }
});
