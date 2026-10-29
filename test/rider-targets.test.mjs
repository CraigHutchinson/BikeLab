import test from 'node:test';
import assert from 'node:assert/strict';
import {compileRiderTargets,TARGET_MODEL} from '../dist/rider-targets.js';
import {run,replay,validate,inputFromRecord,activePreset,riderTargetPreset} from '../dist/trail-bike.js';
import {ACTIVE_MODEL} from '../dist/rider-drive.js';
import {getRuntime} from '../dist/moving-wheel.js';
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const short=bike=>{const a=riderTargetPreset(bike);a.motion.duration=.02;a.riderTargets.commands=a.riderTargets.commands.slice(0,3);return a;};

test('target compilation bounds work and preserves original body, domains and command ownership',()=>{
 const a=riderTargetPreset(),v=validate(a),c=compileRiderTargets(v.riderTargets,v.articulated.passive,3200);
 assert.equal(c.commands.length,11);assert.ok(c.commands[0].q.every(x=>x===0));
 assert.deepEqual(v.articulated,validate(activePreset()).articulated);
 for(const change of [x=>x.commands[0].tick=1,x=>x.commands[1].tick=0,x=>x.commands[1].tick=.5,x=>x.commands[1].tick=99999,x=>x.commands[1].phase='bad label',x=>x.commands[1].hip=[2,2],x=>x.commands[0].hip[0]+=.001,x=>x.commands.push(...Array(64).fill(x.commands[0]))]){
  const bad=structuredClone(v.riderTargets);change(bad);assert.throws(()=>compileRiderTargets(bad,v.articulated.passive,3200));
 }
 assert.throws(()=>validate({...a,active:{joints:{hip:{targetAngle:v.active.joints.hip.targetAngle+.001}}}}),/conflicts/);
 const noDrive=structuredClone(a);delete noDrive.active;assert.throws(()=>validate(noDrive),/active launch/);
 assert.throws(()=>validate({...a,diagnostics:'tyre-motion-0.1'}));
 assert.throws(()=>{c.commands[1].angles[0]=0;},TypeError);
});

test('target transitions are right-continuous, replayable and independent of observation cadence on both bikes',async()=>{
 for(const bike of ['full','hardtail']){
  const a=riderTargetPreset(bike),r=await run(a),compiled=compileRiderTargets(r.scenario.riderTargets,r.scenario.articulated.passive,r.summary.steps);
  r.frames[0].active.actualHip.forEach((x,i)=>near(x,r.scenario.articulated.passive.posture.hip[i],1e-11));near(r.frames[0].active.actualTrunkPitch,r.scenario.articulated.passive.posture.trunkPitch,1e-11);
  assert.equal(r.model,TARGET_MODEL);assert.equal(r.status,'completed');assert.deepEqual(await replay(r),r);
  for(let i=0;i<r.scenario.riderTargets.commands.length;i++){
   const command=r.scenario.riderTargets.commands[i],f=r.frames.find(f=>Math.abs(f.time-command.tick*r.scenario.motion.dt)<1e-10);
   assert.ok(f);assert.equal(f.active.targetCommand,i);assert.deepEqual(f.active.targetAngles,compiled.commands[i].angles);
  }
  const sparse=await run({...a,motion:{...a.motion,sampleDt:.02}});
  assert.deepEqual(sparse.finalState,r.finalState);assert.equal(sparse.summary.riderWork,r.summary.riderWork);
  const wrong=structuredClone(r);wrong.model=ACTIVE_MODEL;assert.throws(()=>inputFromRecord(wrong),/Legacy/);
  const missing=structuredClone(r);delete missing.scenario.riderTargets.commands[0].phase;assert.throws(()=>inputFromRecord(missing));
  assert.throws(()=>validate({...r.scenario,initialization:{mode:'state',state:r.finalState},motion:{gravity:9.80665,duration:.02,dt:.00003125,sampleDt:.005}}),/active launch/);
 }
});

test('new scheduling with an unchanged target preserves legacy physical frames exactly',async()=>{
 for(const bike of ['full','hardtail']){
  const a=activePreset(bike,.02),old=await run(a),b=short(bike);b.riderTargets.commands=b.riderTargets.commands.slice(0,1);
  const current=await run(b);assert.notEqual(current.initialState.identity,old.initialState.identity);
  assert.deepEqual(current.frames.map(f=>({...f,active:Object.fromEntries(Object.entries(f.active).filter(([k])=>!['targetCommand','actualHip','actualCOM','targetCOM','actualTrunkPitch'].includes(k)))})),old.frames);
  assert.deepEqual(current.summary,old.summary);
 }
});

test('target and hub command rollback restores the accepted state, previous target and work',async()=>{
 const a=short();a.riderTargets.commands=a.riderTargets.commands.slice(0,2);a.riderTargets.commands[1].tick=321;
 a.commands=[{tick:0,rearDrive:0,frontBrake:0,rearBrake:0},{tick:321,rearDrive:2,frontBrake:0,rearBrake:0}];
 const reference=await run(a),expected=reference.frames.find(f=>Math.abs(f.time-.01)<1e-10),mj=await getRuntime(),forward=mj.mj_forward;let injected=false;
 mj.mj_forward=(m,d)=>{forward(m,d);if(!injected&&d.time>.01&&d.time<.01004){const id=mj.mj_name2id(m,mj.mjtObj.mjOBJ_JOINT.value,'rearwheelSpin');if(d.qfrc_applied[m.jnt_dofadr[id]]===2){injected=true;d.qacc[0]=NaN;d.eq_active[0]=0;}}};
 let r;try{r=await run(a);}finally{mj.mj_forward=forward;}
 assert.ok(injected);assert.equal(r.status,'terminated');assert.equal(r.termination.attemptedTargetTick,321);
 assert.deepEqual(r.frames.at(-1),expected);assert.equal(r.frames.at(-1).active.targetCommand,0);near(r.summary.riderWork,expected.active.work);
 for(const [i,name] of ['riderX','riderZ','riderPitch','riderHip','riderKnee','riderShoulder','riderElbow'].entries()){
  const j=r.finalState.joints.find(j=>j.name===name);near(j.position,expected.articulated.nativeCoordinates[i]);near(j.velocity,expected.articulated.nativeVelocities[i]);
 }
});

test('changing targets accounts only for held effort times actual native displacement',async()=>{
 const a=short(),mj=await getRuntime(),step=mj.mj_step,intervals=[];let joints;
 mj.mj_step=(m,d)=>{
  if(!joints)joints=['riderHip','riderKnee','riderShoulder','riderElbow'].map(name=>{const id=mj.mj_name2id(m,mj.mjtObj.mjOBJ_JOINT.value,name);return {q:m.jnt_qposadr[id],v:m.jnt_dofadr[id]};});
  const q=joints.map(j=>d.qpos[j.q]),effort=joints.map(j=>d.qfrc_applied[j.v]);step(m,d);
  intervals.push({time:d.time,work:joints.reduce((sum,j,i)=>sum+effort[i]*(d.qpos[j.q]-q[i]),0)});
 };
 let r;try{r=await run(a);}finally{mj.mj_step=step;}
 assert.equal(r.status,'completed');for(const f of r.frames){const work=intervals.filter(x=>x.time<=f.time+1e-12).reduce((s,x)=>s+x.work,0);near(f.active.work,work);near(f.residual,f.energy-r.summary.initialEnergy+f.dampingLoss-f.constraintWork-f.driveWork-work);}
});

test('timed targets in flight retain momentum bounds and refine integration error',async()=>{
 for(const bike of ['full','hardtail']){
  let previous;
  for(const dt of [.00003125,.000015625]){
   const a=short(bike);a.motion={...a.motion,dt,gravity:0,clearance:.3};a.riderTargets.commands=a.riderTargets.commands.map(c=>({...c,tick:Math.round(c.tick*.00003125/dt)}));
   const r=await run(a),f=r.frames.at(-1);assert.equal(r.status,'completed');assert.ok(r.frames.every(f=>f.contacts.length===0));
   const linear=Math.hypot(f.momentumResidual[0],f.momentumResidual[1]),energy=r.summary.maxResidual;
   assert.ok(linear<2e-4);assert.ok(Math.abs(f.momentumResidual[2])<2e-4);assert.ok(energy<.02);assert.ok(r.summary.maxSampledRootWrench<1e-7);
   if(previous){assert.ok(linear<.6*previous.linear);assert.ok(energy<.6*previous.energy);}previous={linear,energy};
  }
 }
});
