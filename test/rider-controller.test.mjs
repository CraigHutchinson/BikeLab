import test from 'node:test';
import assert from 'node:assert/strict';
import {auditNativeStatic} from '../scripts/rider-static-native.mjs';
import {CONTROL_FORMAT,CONTROL_MODEL,createControlFrame,wheelContactMask} from '../dist/rider-controller.js';
import {createRiderDrive,createDriveFrame,evaluateDrive} from '../dist/rider-drive.js';
import {staticRiderReference} from '../dist/rider-static-reference.js';
import {JOINTS} from '../dist/rider-passive.js';
import {riderControllerPreset} from '../dist/rider-transfer.js';
import {riderLoadSample} from '../dist/rider-loads.js';
import {activePreset,validate,modelXML,run,replay,inputFromRecord} from '../dist/trail-bike.js';
import {getRuntime} from '../dist/moving-wheel.js';
const near=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} vs ${b}`);
const short=(bike='full')=>{const a=structuredClone(activePreset(bike,.02));a.active={format:CONTROL_FORMAT};a.motion.dt=.00003125;return a;};

test('native independent seven-coordinate balance covers mass, tilt, preload, goals and sign control',async()=>{
 const inputs=[];
 for(const riderMass of [20,70,100])for(const framePitch of [-.3,0,.3])inputs.push({passive:{posture:{riderMass}},framePitch});
 const passive=structuredClone(staticRiderReference().input.passive);passive.joints.hip.restAngle+=.05;
 inputs.push({passive},{goal:{hip:[-.148,.248],trunkPitch:.552}},{gravity:0},{drive:{joints:{hip:{maxTorque:1}}}});
 for(const input of inputs){const r=await auditNativeStatic(input);assert.equal(r.status,'audited');assert.equal(r.nv,7);assert.equal(r.equalities,0);assert.ok(r.velocity.every(v=>v===0));assert.ok(r.maxResidual<1e-7);assert.ok(r.maxAcceleration<1e-6);}
 const wrong=await auditNativeStatic({},-1);assert.ok(wrong.maxResidual>1000);
});

test('control configuration is explicit, rejects ignored gains, and binds record version and completeness',async()=>{
 const {wheelParams,...a}=validate(short());assert.equal(a.active.response.frequencyHz,4);assert.ok(!Object.hasOwn(a.active.joints.hip,'kp'));
 const accessor=Object.defineProperty({},'format',{get(){throw Error('Getter evaluated');},enumerable:true});assert.throws(()=>validate({...short(),active:accessor}),/enumerable data properties/);
 for(const active of [{format:CONTROL_FORMAT,joints:{hip:{kp:200}}},{format:CONTROL_FORMAT,response:null},{format:CONTROL_FORMAT,response:{frequencyHz:NaN}},{format:CONTROL_FORMAT,response:{dampingRatio:-1}},{format:CONTROL_FORMAT,response:{compensation:'flight'}}])assert.throws(()=>validate({...short(),active}));
 const r=await run(a);const broken=structuredClone(r.frames[0]);broken.active.estimate=[];assert.throws(()=>riderLoadSample(r.scenario,broken),/controller estimate/);assert.equal(r.model,CONTROL_MODEL);assert.equal(r.status,'completed');assert.deepEqual(await replay(r),r);
 const incomplete=structuredClone(r);delete incomplete.scenario.active.response.compensation;assert.throws(()=>inputFromRecord(incomplete),/Incomplete/);
 const disguised=structuredClone(r);disguised.model='bikelab-trail-bike-active-0.1';assert.throws(()=>inputFromRecord(disguised),/Legacy/);
 assert.throws(()=>validate({...a,motion:{duration:.02},initialization:{mode:'state',state:r.finalState}}),/requires launch/);
});

test('native runtime estimate matches independent static reference; gains scale with mass and current geometry',async()=>{
 const mj=await getRuntime(),frames=[];
 for(const riderMass of [20,70,100]){
  const input=short();input.articulated.passive.posture.riderMass=riderMass;const {wheelParams,...a}=validate(input);let model,data;
  try{
   model=mj.MjModel.from_xml_string(modelXML(a));data=new mj.MjData(model);mj.mj_forward(model,data);
   const drive=createRiderDrive(mj,model,a.active,a.articulated.passive);drive.apply(data,null,3);
   const reference=staticRiderReference({passive:a.articulated.passive,drive:a.active});
   const topology=[[1,2],[2],[3,4],[4]];
   for(let i=0;i<4;i++){near(drive.frame.estimate[i],reference.joints[i].active,1e-7);const origin=reference.pose.points[JOINTS[i]],inertia=topology[i].reduce((sum,j)=>{const b=reference.pose.bodies[j];return sum+b.inertiaBody[1]+b.mass*((b.com[0]-origin[0])**2+(b.com[1]-origin[1])**2);},0);near(drive.frame.inertia[i],inertia,1e-8);near(drive.frame.kp[i],inertia*(2*Math.PI*4)**2,1e-7);near(drive.frame.kd[i],2*inertia*(2*Math.PI*4),1e-7);}
   const frame=structuredClone(drive.frame);frames.push(frame);
   // Only internal hinge torques; never apply the ideal support force or root gravity cancellation.
   for(let i=0;i<model.nv;i++)if(!drive.laws.some(l=>l.v===i))assert.equal(data.qfrc_applied[i],0);
   data.qpos[drive.laws[1].q]=.02;mj.mj_forward(model,data);drive.apply(data,null,3);assert.notEqual(drive.frame.inertia[0],frame.inertia[0]);
   for(const mask of [0,1,2]){drive.apply(data,null,mask);assert.equal(drive.frame.estimateStatus,'requires-two-wheel-contact');assert.ok(drive.frame.estimate.every(v=>v===0));assert.ok(drive.frame.handEstimate.every(v=>v===0));}
  }finally{data?.delete();model?.delete();}
 }
 for(let i=0;i<4;i++)for(const key of ['kp','kd','inertia','estimate']){near(frames[0][key][i]/20,frames[1][key][i]/70,1e-7);near(frames[2][key][i]/100,frames[1][key][i]/70,1e-7);}
});

test('combined estimate and feedback pass through the same signed torque/power bounds',()=>{
 const control=createControlFrame();control.kp.fill(100);control.kd.fill(10);control.estimate.set([20,-20,20,-20]);
 const laws=JOINTS.map(()=>({angle0:0,targetQ:.1,drive:{targetAngle:.1,maxTorque:6,maxPositivePower:3,maxNegativePower:4}}));
 const out=createDriveFrame();evaluateDrive(laws,[0,0,0,0],[2,-2,.1,0],out,null,control);
 assert.deepEqual(Array.from(out.requestedTorque),[10,10,29,-10]);assert.deepEqual(Array.from(out.torque),[1.5,2,6,-6]);
 for(let i=0;i<4;i++)near(out.requestedTorque[i],control.estimate[i]+control.proportional[i]+control.damping[i]);
});

test('contact mask ignores separated and flex-flex pairs and disposes native wrappers',()=>{
 let deleted=0;const rows=[{flex:[-1,4],dist:0},{flex:[5,-1],dist:-.01},{flex:[-1,6],dist:-1},{flex:[4,5],dist:-1}];
 const data={get contact(){return {size:()=>rows.length,get:i=>({...rows[i],delete(){deleted++;}}),delete(){deleted++;}};}};
 assert.equal(wheelContactMask(data,4,5),3);assert.equal(deleted,5);rows[0].dist=.001;assert.equal(wheelContactMask(data,4,5),2);
});

test('both-bike recording cadence is passive, with finite decomposition and explicit infeasible fallback',async()=>{
 for(const bike of ['full','hardtail']){
  const a=short(bike),coarse=await run(a);a.motion.sampleDt=.0025;const fine=await run(a);
  assert.deepEqual(coarse.finalState,fine.finalState);assert.deepEqual(coarse.frames.at(-1).active,fine.frames.at(-1).active);
  for(const f of fine.frames){for(const j of riderLoadSample(fine.scenario,f).joints)near(j.decompositionResidual,0);assert.ok(f.active.estimate.every(Number.isFinite));}
  const zero=short(bike);zero.active.joints=Object.fromEntries(JOINTS.map(n=>[n,{maxTorque:0}]));const r=await run(zero);
  assert.ok(r.frames.some(f=>f.active.estimateStatus==='torque-limits'));assert.ok(r.frames.every(f=>f.active.torque.every(x=>x===0)));assert.equal(r.summary.riderWork,0);
 }
});

test('flight disables static estimate and preserves momentum without root actuation',async()=>{
 const a=short();a.motion.clearance=.3;a.motion.gravity=0;a.motion.velocityX=.4;
 a.active.joints={hip:{targetAngle:a.articulated.passive.joints.hip.restAngle+.01}};
 const r=await run(a);assert.equal(r.status,'completed');assert.ok(r.frames.every(f=>f.active.contactMask===0&&f.active.estimate.every(v=>v===0)));
 const error=record=>Math.hypot(...record.frames.at(-1).momentum.slice(0,2).map((v,i)=>v-record.frames[0].momentum[i]));
 const refined=await run({...a,motion:{...a.motion,dt:a.motion.dt/2}});assert.equal(refined.status,'completed');assert.ok(error(r)<1e-3);assert.ok(error(refined)<.8*error(r));
 assert.ok(Math.abs(r.frames.at(-1).active.work)>0);
});

test('scheduled controller targets share target identity and replay',async()=>{
 const a=structuredClone(riderControllerPreset());a.motion.duration=.02;a.riderTargets.commands=a.riderTargets.commands.filter(c=>c.tick<=640);
 const r=await run(a);assert.equal(r.status,'completed');assert.equal(r.frames.at(-1).active.targetCommand,0);assert.deepEqual(await replay(r),r);
});

test('estimated controller work equals the independently intercepted held native torque times actual displacement',async()=>{
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

test('rejected post-command estimated controller endpoint restores state, effort, command and work exactly',async()=>{
 const a=short();a.commands=[{tick:0,rearDrive:0,frontBrake:0,rearBrake:0},{tick:321,rearDrive:2,frontBrake:0,rearBrake:0}];
 const reference=await run(a),expected=reference.frames.find(f=>Math.abs(f.time-.01)<1e-10),mj=await getRuntime(),forward=mj.mj_forward;let injected=false;
 mj.mj_forward=(m,d)=>{forward(m,d);if(!injected&&d.time>.01&&d.time<.01004){const id=mj.mj_name2id(m,mj.mjtObj.mjOBJ_JOINT.value,'rearwheelSpin');if(d.qfrc_applied[m.jnt_dofadr[id]]===2){injected=true;d.qacc[0]=NaN;d.eq_active[0]=0;}}};
 let r;try{r=await run(a);}finally{mj.mj_forward=forward;}
 assert.ok(injected);assert.equal(r.status,'terminated');assert.equal(r.termination.reason,'nonfinite-state');assert.deepEqual(r.frames.at(-1),expected);near(r.summary.riderWork,expected.active.work);for(const [i,name] of ['riderX','riderZ','riderPitch','riderHip','riderKnee','riderShoulder','riderElbow'].entries()){const j=r.finalState.joints.find(j=>j.name===name);near(j.position,expected.articulated.nativeCoordinates[i]);near(j.velocity,expected.articulated.nativeVelocities[i]);}
});

