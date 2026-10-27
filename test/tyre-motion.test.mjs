import test from 'node:test';
import assert from 'node:assert/strict';
import {TYRE_MOTION,TYRE_MOTION_MODEL,createTyreMotion,createTyreMotionFrame,tyreMotionProbe} from '../dist/tyre-motion.js';
import {activePreset,run,replay,validate,inputFromRecord,modelXML} from '../dist/trail-bike.js';
import {getRuntime,modelXML as wheelXML} from '../dist/moving-wheel.js';
const near=(a,b,t=1e-10)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} vs ${b}`);
const short=bike=>{const a=activePreset(bike);a.motion.duration=.02;return a;};

test('tyre diagnostics are opt-in observations with unchanged physical state, work and legacy frames',async()=>{
 for(const bike of ['full','hardtail']){
  const a=short(bike),plain=await run(a),b={...a,diagnostics:TYRE_MOTION},r=await run(b);
  assert.equal(r.model,TYRE_MOTION_MODEL);assert.equal(r.status,'completed');assert.equal(modelXML(a),modelXML(b));
  assert.deepEqual(r.initialState,plain.initialState);assert.deepEqual(r.finalState,plain.finalState);assert.deepEqual(r.summary,plain.summary);
  assert.deepEqual(r.frames.map(f=>({...f,wheels:f.wheels.map(({tyreMotion,...w})=>w)})),plain.frames);
  assert.deepEqual(await replay(r),r);
  for(const f of r.frames){
   near(f.wheels.reduce((s,w)=>s+w.tyreMotion.normalPower,0),f.normalPower,1e-8);
   near(f.wheels.reduce((s,w)=>s+w.tyreMotion.tangentPower,0),f.tangentPower,1e-8);
   assert.equal(f.wheels.reduce((s,w)=>s+w.tyreMotion.contactCount,0),f.contacts.length);
   for(const w of f.wheels){const t=w.tyreMotion;near(t.rmsSpeed**2,t.residualRmsSpeed**2+Math.hypot(...t.meanVelocity)**2);assert.equal(t.foundationDampingPower,0);assert.ok(t.edgeDampingPower>=0);}
  }
  const dense=await run({...b,motion:{...b.motion,sampleDt:.000125}});assert.deepEqual(dense.frames.at(-1),r.frames.at(-1));assert.deepEqual(dense.finalState,r.finalState);
  assert.throws(()=>inputFromRecord({...r,model:plain.model}),/Legacy record/);
  const missing=structuredClone(r);delete missing.scenario.diagnostics;assert.throws(()=>inputFromRecord(missing),/Incomplete/);
 }
 for(const diagnostics of [undefined,null,{},'wrong'])assert.throws(()=>validate({...short(),diagnostics}));
 assert.throws(()=>validate({diagnostics:TYRE_MOTION}));
});

test('native ring observations match independent local edge kinematics, elastic energy and damping power',async()=>{
 const mj=await getRuntime(),model=mj.MjModel.from_xml_string(wheelXML({fixture:'flight',gravity:0,velocityX:0,nodes:32})),data=new mj.MjData(model);
 try{
  const id=(kind,name)=>mj.mj_name2id(model,kind.value,name),joint=name=>{const j=id(mj.mjtObj.mjOBJ_JOINT,name);return {q:model.jnt_qposadr[j],v:model.jnt_dofadr[j]};};
  const wheel={flex:0,edge:0,bodies:[id(mj.mjtObj.mjOBJ_BODY,'hub'),...Array.from({length:32},(_,i)=>id(mj.mjtObj.mjOBJ_BODY,'wheel_n'+i))],nodeJoints:Array.from({length:32},(_,i)=>[joint('wheel_u'+i),joint('wheel_v'+i)])};
  const observer=createTyreMotion(model,wheel),out=createTyreMotionFrame();
  // Common hub-relative translation changes no edge length; edge viscosity
  // cannot damp this mode, even though relative node kinetic energy is nonzero.
  for(const [u,v] of wheel.nodeJoints){data.qvel[u.v]=.2;data.qvel[v.v]=-.1;}
  mj.mj_forward(model,data);observer.record(data,out);near(out.rmsSpeed,Math.sqrt(.05));near(out.residualRmsSpeed,0);near(out.edgeDampingPower,0,1e-20);near(out.relativeSpeedEnergy,.025);
  for(let i=0;i<32;i++){const [u,v]=wheel.nodeJoints[i];data.qpos[u.q]=.001*Math.sin(i);data.qpos[v.q]=.002*Math.cos(i);data.qvel[u.v]=.03*Math.cos(i);data.qvel[v.v]=.05*Math.sin(i);}
  data.qvel[0]=.6;data.qvel[1]=-.4;data.qvel[2]=3;
  mj.mj_forward(model,data);mj.mj_energyPos(model,data);observer.record(data,out);
  let expectedPower=0,expectedEdges=0;
  for(let i=0;i<32;i++){
   const j=(i+1)%32,[ui,vi]=wheel.nodeJoints[i],[uj,vj]=wheel.nodeJoints[j],bi=wheel.bodies[i+1],bj=wheel.bodies[j+1];
   const x=model.body_pos[3*bj]+data.qpos[uj.q]-model.body_pos[3*bi]-data.qpos[ui.q],z=model.body_pos[3*bj+2]+data.qpos[vj.q]-model.body_pos[3*bi+2]-data.qpos[vi.q];
   const rate=(x*(data.qvel[uj.v]-data.qvel[ui.v])+z*(data.qvel[vj.v]-data.qvel[vi.v]))/Math.hypot(x,z);
   near(rate,data.flexedge_velocity[i]);expectedEdges+=rate**2;
  }
  for(let i=0;i<model.nv;i++)expectedPower-=data.qfrc_damper[i]*data.qvel[i];
  near(out.edgeRmsSpeed,Math.sqrt(expectedEdges/32));near(out.edgeDampingPower,expectedPower);near(out.foundationEnergy+out.edgeEnergy,data.energy[0]);
  const before=JSON.stringify({q:Array.from(data.qpos),v:Array.from(data.qvel),a:Array.from(data.qacc),force:Array.from(data.qfrc_applied)}),saved=structuredClone(out);
  observer.record(data,out);assert.deepEqual(out,saved);assert.equal(JSON.stringify({q:Array.from(data.qpos),v:Array.from(data.qvel),a:Array.from(data.qacc),force:Array.from(data.qfrc_applied)}),before);
 }finally{data.delete();model.delete();}
});

test('short probe owns the accepted state and holds the final command without replaying old events',async()=>{
 const a=short();a.commands=[{tick:0,rearDrive:0,frontBrake:0,rearBrake:0},{tick:320,rearDrive:2,frontBrake:0,rearBrake:0}];
 const record=await run(a),before=JSON.stringify(record),probe=tyreMotionProbe(record),r=await run(probe);
 assert.equal(JSON.stringify(record),before);assert.equal(r.status,'completed');assert.equal(r.frames.length,161);
 assert.deepEqual(probe.commands,[{tick:0,rearDrive:2,frontBrake:0,rearBrake:0}]);assert.deepEqual(r.initialState,record.finalState);
 assert.equal(r.frames[0].active.work,0);assert.equal(r.frames[0].time,0);assert.equal(r.frames[0].driveWork,0);
 assert.equal(r.summary.steps,640);assert.equal(r.scenario.diagnostics,TYRE_MOTION);assert.notEqual(probe.initialization.state,record.finalState);
 assert.throws(()=>tyreMotionProbe({scenario:a}),/accepted active/);
 probe.initialization.state.joints[0].position+=1;assert.equal(JSON.stringify(record),before);
});

test('frictional contact power and stopped diagnostics describe only the accepted state',async()=>{
 const a=short();a.surface={friction:.6};a.diagnostics=TYRE_MOTION;
 const frictional=await run(a);assert.equal(frictional.status,'completed');
 for(const f of frictional.frames){near(f.wheels.reduce((s,w)=>s+w.tyreMotion.normalPower,0),f.normalPower,1e-8);near(f.wheels.reduce((s,w)=>s+w.tyreMotion.tangentPower,0),f.tangentPower,1e-8);}
 a.active={joints:{knee:{maxNegativePower:.01}}};
 const stopped=await run(a),plainInput={...a};delete plainInput.diagnostics;const plain=await run(plainInput);
 assert.equal(stopped.status,'terminated');assert.deepEqual(stopped.termination,plain.termination);assert.deepEqual(stopped.finalState,plain.finalState);
 assert.deepEqual(stopped.frames.map(f=>({...f,wheels:f.wheels.map(({tyreMotion,...w})=>w)})),plain.frames);
 assert.deepEqual(await replay(stopped),stopped);
});
