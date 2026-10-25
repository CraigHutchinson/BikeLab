import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runUnbound,validateUnbound,unboundExample,DEFAULTS,TIMESTEPS} from '../dist/rider-unbound.js';
import {getRuntime} from '../dist/moving-wheel.js';
const reference=JSON.parse(await readFile(new URL('../docs/evidence/rider-unbound-review.json',import.meta.url),'utf8'));
const near=(a,b,t=1e-10)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} vs ${b}`);
const last=r=>r.frames.at(-1);

test('unbound native snapshots match independently reviewed kinematics and nine archived launches',async()=>{
 for(const archived of reference.cases){
  const r=await runUnbound({q:archived.launch.q,v:archived.launch.v,gravity:archived.gravity,dt:archived.dt});
  assert.equal(r.status,'completed');assert.equal(r.mass,70);assert.equal(r.bodyMasses.reduce((s,b)=>s+b.mass,0),70);assert.equal(r.frames.length,5);
  for(const [actual,expected] of [[r.frames[0],archived.initial],[last(r),archived.final]]){
   for(const [axis,k] of [[0,0],[2,1]]){near(actual.com[axis],expected.com[k]);near(actual.momentum[axis],expected.P[k]);}
   near(actual.angularMomentumCOM[1],expected.H);near(actual.energy,expected.energy);near(actual.lossPower,expected.lossPower);
   for(let i=0;i<5;i++){
    const a=actual.segments[i],b=expected.bodies[i];assert.equal(a.name,b.name);
    for(const key of ['proximal','distal','com']){near(a[key][0],b[key][0]);near(a[key][1],0);near(a[key][2],b[key][1]);}
    near(a.velocity[1],b.omega);near(a.velocity[3],b.velocity[0]);near(a.velocity[5],b.velocity[1]);
   }
  }
  near(r.summary.maxEnergyResidual,archived.maxEnergyResidual);near(r.summary.maxCOMResidual,archived.maxCOMResidual);
  near(r.summary.maxMomentumResidual,archived.maxMomentumResidual);near(r.summary.maxAngularMomentumResidual,archived.maxAngularMomentumResidual);
 }
});

test('constant-gravity discrete motion and energy, finite spin budgets and independent timestep refinement',async()=>{
 for(const gravity of [0,9.80665,15]){
  const s=unboundExample('translation');s.gravity=gravity;const r=await runUnbound(s),first=r.frames[0];
  for(const f of r.frames){
   const t=f.time;near(f.com[0],first.com[0]+.7*t);near(f.com[2],first.com[2]+.2*t-.5*gravity*t*(t+s.dt));
   near(f.momentum[2]-first.momentum[2],-r.mass*gravity*t);near(f.energy-first.energy,-.5*r.mass*gravity**2*s.dt*t,1e-9);near(f.dampingLoss,0);
  }
 }
 for(const name of ['spin','zero-gravity']){
  let previous;
  for(const dt of TIMESTEPS){
   const r=await runUnbound({...unboundExample(name),dt});assert.equal(r.status,'completed');
   // Declared controls for this illustrative launch, not all admissible inputs.
   assert.ok(r.summary.maxCOMResidual<3.2e-6);assert.ok(r.summary.maxMomentumResidual<2e-5);
   assert.ok(r.summary.maxAngularMomentumResidual<1e-5);assert.ok(r.summary.maxEnergyResidual<.0025);
   if(previous)for(const key of ['maxMomentumResidual','maxAngularMomentumResidual','maxEnergyResidual']){
    const ratio=r.summary[key]/previous[key];assert.ok(ratio>.48&&ratio<.52,key+': '+ratio);
   }
   previous=r.summary;
  }
 }
});

test('joint limits keep an owned accepted prefix and initial rejection has no recorded pose',async()=>{
 const rejected=await runUnbound(unboundExample('initial-rejection'));assert.equal(rejected.status,'initial-state-rejected');assert.equal(rejected.frames.length,0);assert.equal(rejected.summary.steps,0);
 const r=await runUnbound(unboundExample('joint-limit'));assert.equal(r.status,'terminated');assert.equal(r.termination.reason,'rider-elbow-angle-limit');
 assert.equal(r.summary.steps,33);assert.equal(r.frames.length,2);assert.equal(last(r).time,r.termination.time);
 assert.ok(last(r).q[6]>=-.3);assert.ok(r.termination.attemptedTime>r.termination.time);
 const first=structuredClone(r.frames[0]);last(r).segments[0].com[0]=99;assert.deepEqual(r.frames[0],first);
 const before=JSON.stringify(DEFAULTS),s=structuredClone(DEFAULTS),p=runUnbound(s);s.q[0]=9;s.passive.posture.riderMass=35;
 const accepted=await p;assert.equal(accepted.spec.q[0],DEFAULTS.q[0]);assert.equal(accepted.mass,70);assert.equal(JSON.stringify(DEFAULTS),before);
 assert.deepEqual(await runUnbound(accepted.spec),accepted);
});

test('candidate failure at/on-between recording ticks restores state, accounting and progress',async()=>{
 const mj=await getRuntime(),nativeStep=mj.mj_step,baseline=await runUnbound(unboundExample('spin'));
 for(const failedStep of [160,161,321,640]){
  let calls=0;const progress=[];
  try{
   mj.mj_step=(model,data)=>{nativeStep(model,data);if(++calls===failedStep)data.qpos[0]=NaN;};
   const r=await runUnbound(unboundExample('spin'),p=>progress.push(p));
   assert.equal(r.status,'terminated');assert.equal(r.summary.steps,failedStep-1);near(last(r).time,(failedStep-1)*DEFAULTS.dt,1e-12);
   assert.equal(progress.at(-1).acceptedSteps,failedStep-1);assert.ok(progress.every(p=>p.acceptedSteps<=failedStep-1));
   if(failedStep===161){assert.equal(r.frames.length,2);assert.deepEqual(last(r),baseline.frames[1]);}
   const acceptedFrames=r.frames.slice(0,-1);for(let i=0;i<acceptedFrames.length;i++)assert.deepEqual(acceptedFrames[i],baseline.frames[i]);
   const again=await runUnbound(unboundExample('spin'));assert.deepEqual(again,baseline);
  }finally{mj.mj_step=nativeStep;}
 }
 // A forbidden applied force is part of the rejected native candidate too.
 try{
  let count=0;mj.mj_step=(model,data)=>{nativeStep(model,data);if(++count===161)data.qfrc_applied[0]=1;};
  const r=await runUnbound(unboundExample('spin'));assert.equal(r.termination.reason,'unsupported-unbound-applied-force');assert.deepEqual(last(r),baseline.frames[1]);
 }finally{mj.mj_step=nativeStep;}
 // Reversal must reject the candidate even when its coordinates remain finite.
 try{
  let count=0;mj.mj_step=(model,data)=>{nativeStep(model,data);if(++count===161)data.time=0;};
  const r=await runUnbound(unboundExample('spin'));assert.equal(r.termination.reason,'unbound-clock-reset');assert.equal(r.summary.steps,160);assert.deepEqual(last(r),baseline.frames[1]);
 }finally{mj.mj_step=nativeStep;}
});

test('strict specifications, true world-root bounds and independent repeated observations',async()=>{
 for(const input of [null,[],{other:1},{format:'old'},{dt:.001},{duration:.1},{q:[]},{v:[0,0,0,0,0,0,NaN]},{passive:undefined},{gravity:-1}])assert.throws(()=>validateUnbound(input));
 const s=structuredClone(DEFAULTS);Object.defineProperty(s,'q',{value:s.q,enumerable:false});assert.throws(()=>validateUnbound(s));
 const outside=unboundExample('translation');outside.q[0]=-10;const r=await runUnbound(outside);assert.equal(r.termination.reason,'unbound-world-hip-limit');assert.equal(r.frames.length,0);
 const pitch=unboundExample('translation');pitch.q[2]=Math.PI+.001;assert.equal((await runUnbound(pitch)).termination.reason,'unbound-pitch-deviation-limit');
 const progress=[],plain=await runUnbound(),observed=await runUnbound({},p=>progress.push(p));assert.deepEqual(observed,plain);
 assert.equal(progress[0].phase,'preparing');assert.equal(progress.at(-1).phase,'finalizing');assert.ok(progress.length<=8);
});
