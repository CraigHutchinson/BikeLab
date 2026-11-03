import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMoment,addMoment,createIntervals,recordingTicks,MEASUREMENT,MEASURED_MODEL} from '../dist/tyre-fixture-observation.js';
import {validate,run,replay,inputFromRecord,MODEL} from '../dist/tyre-fixture.js';
import {getRuntime} from '../dist/moving-wheel.js';
const bundle=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url)));
const example=()=>structuredClone(bundle.cases[0].input);
const close=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}, budget ${tol}`);
function measured(duration=.002,binDt=.001){const a=example();a.motion.duration=duration;a.motion.sampleDt=a.motion.dt;a.measurement={format:MEASUREMENT,binDt,window:null};return a;}
function reference(frames,dt){
 const n=frames.length-1,weight=frames.map((_,i)=>i===0||i===n?.5:1),sum=key=>frames.reduce((s,f,i)=>s+weight[i]*key(f),0)/n;
 const mean=sum(f=>f.ground[1]);return {mean,variance:sum(f=>(f.ground[1]-mean)**2),kinetic:sum(f=>f.kineticEnergy),speed:Math.sqrt(sum(f=>f.tyreMotion.rmsSpeed**2)),maxSpeed:Math.max(...frames.map(f=>f.tyreMotion.maxNodeSpeed)),maxAcceleration:Math.max(...frames.map(f=>f.tyreMotion.maxNodeAcceleration)),duration:n*dt};
}
test('weighted central moments match independent two-pass arithmetic including large offsets and duration weights',()=>{
 for(const offset of [0,1e9]){
  const xs=[1,-2,3,3,-4].map(x=>x+offset),weights=[.1,.3,.2,.1,.7],W=weights.reduce((a,b)=>a+b),mean=xs.reduce((s,x,i)=>s+x*weights[i],0)/W,variance=xs.reduce((s,x,i)=>s+weights[i]*(x-mean)**2,0)/W,s=createMoment();
  xs.forEach((x,i)=>addMoment(s,x,weights[i]));close(s.weight,W);close(s.mean,mean,3e-7);close(s.m2/s.weight,variance,3e-7);
 }
 const s=createMoment();for(let i=0;i<100;i++)addMoment(s,470,.01);assert.equal(s.mean,470);assert.equal(s.m2,0);const before={...s};assert.throws(()=>addMoment(s,NaN,1));assert.throws(()=>addMoment(s,1,-1));assert.deepEqual(s,before);
 const observer=createIntervals(.1,.4,.2),at=i=>({kineticEnergy:i,meanSquareSpeed:i*i,verticalForce:10+i,maxSpeed:i,maxSpeedIndex:0,maxAcceleration:2*i,maxAccelerationIndex:1});
 for(let i=1;i<=4;i++)observer.accept(i,at(i-1),at(i),i-1,2*(i-1),3*(i-1),i,2*i,3*i);
 const bins=observer.result();assert.equal(bins.length,2);close(bins[0].timeMeanKineticEnergy,1);close(bins[1].timeMeanKineticEnergy,3);close(bins[0].timeRmsNodeSpeed,Math.sqrt(1.5));close(bins[0].timeStdVerticalForce,Math.sqrt(.5));for(const b of bins){close(b.residualIncrement,0);assert.equal(b.acceptedIntervals,2);}
 const saved=JSON.stringify(bins);assert.throws(()=>observer.accept(4,at(3),at(4),3,6,9,4,8,12));assert.equal(JSON.stringify(observer.result()),saved);
 const still=createIntervals(.1,.4,.2),zero={...at(0),maxSpeedIndex:3,maxAccelerationIndex:4};for(let i=1;i<=4;i++)still.accept(i,zero,zero,0,0,0,0,0,0);assert.deepEqual(still.result()[1].maxEndpointNodeSpeed,{value:0,tick:2,node:3});assert.deepEqual(still.result()[1].maxEndpointNodeAcceleration,{value:0,tick:2,node:4});
});
test('measured input keeps legacy admission strict and bounds long controls, bins and dense storage',()=>{
 const legacy=example();legacy.motion.duration=.5;legacy.motion.sampleDt=.0025;assert.throws(()=>validate(legacy));
 const a=measured(5,.5);a.motion.sampleDt=.025;a.measurement.window={startTick:159360,endTick:160000,strideTicks:4};assert.doesNotThrow(()=>validate(a));assert.equal(recordingTicks(a.motion,a.measurement).length,361);
 const copy=validate(a);a.measurement.window.startTick++;assert.notEqual(copy.measurement.window.startTick,a.measurement.window.startTick);
 for(const change of [x=>x.motion.duration=5.1,x=>x.measurement.extra=1,x=>x.measurement.binDt=.000001,x=>x.measurement.window={startTick:1,endTick:1000,strideTicks:1},x=>x.measurement.window={startTick:0,endTick:1,strideTicks:2},x=>x.measurement.window={startTick:-1,endTick:1,strideTicks:1}]){const x=measured();change(x);assert.throws(()=>validate(x));}
 assert.throws(()=>inputFromRecord({model:MODEL,scenario:measured()}),/discriminator/);assert.throws(()=>inputFromRecord({model:MEASURED_MODEL,scenario:example()}),/discriminator/);
});
test('every-step intervals match independent dense traces and preserve dynamics under observation changes',async()=>{
 const a=measured(),r=await run(a);assert.equal(r.model,MEASURED_MODEL);assert.equal(r.status,'completed');assert.equal(r.frames.length,65);assert.equal(r.observation.intervals.length,2);
 for(const b of r.observation.intervals){const fs=r.frames.slice(b.startTick,b.endTick+1),expected=reference(fs,a.motion.dt);close(b.timeMeanVerticalForce,expected.mean);close(b.timeStdVerticalForce**2,expected.variance,1e-8);close(b.timeMeanKineticEnergy,expected.kinetic,1e-15);close(b.timeRmsNodeSpeed,expected.speed,1e-15);close(b.maxEndpointNodeSpeed.value,expected.maxSpeed);close(b.maxEndpointNodeAcceleration.value,expected.maxAcceleration);const first=fs[0],last=fs.at(-1);close(b.deltaEnergy,last.energy-first.energy);close(b.dampingLoss,last.dampingLoss-first.dampingLoss);close(b.signedContactWork,last.contactWork-first.contactWork);}
 close(r.observation.intervals.reduce((s,b)=>s+b.residualIncrement,0),r.frames.at(-1).residual);
 a.motion.sampleDt=.0005;const sparse=await run(a);assert.deepEqual(sparse.observation,r.observation);assert.deepEqual(sparse.finalNodes,r.finalNodes);assert.deepEqual(sparse.summary,r.summary);assert.deepEqual(await replay(sparse),sparse);
 const legacy=example(),old=await run(legacy);legacy.measurement={format:MEASUREMENT,binDt:.005,window:{startTick:480,endTick:640,strideTicks:1}};const observed=await run(legacy);assert.equal(old.identity,observed.identity);assert.deepEqual(old.finalNodes,observed.finalNodes);assert.deepEqual(old.summary,observed.summary);const byTick=new Map(observed.frames.map(f=>[Math.round(f.time/legacy.motion.dt),f]));for(const f of old.frames)assert.deepEqual(f,byTick.get(Math.round(f.time/legacy.motion.dt)));assert.equal(observed.observation.windowFrameIndices.length,161);assert.equal(new Set(observed.frames.map(f=>Math.round(f.time/legacy.motion.dt))).size,observed.frames.length);
});
test('failed candidates cannot enter interval maxima, work or dense windows at bin boundaries',async()=>{
 const a=measured(),clean=await run(a),mj=await getRuntime(),forward=mj.mj_forward;
 for(const failed of [32,33]){
  let once=false;mj.mj_forward=(m,d)=>{forward(m,d);if(!once&&Math.round(d.time/a.motion.dt)===failed){once=true;d.qacc[0]=NaN;}};
  let r;try{r=await run(a);}finally{mj.mj_forward=forward;}
  assert.equal(r.status,'terminated');assert.equal(r.summary.steps,failed-1);assert.deepEqual(r.frames,clean.frames.slice(0,failed));assert.equal(r.observation.intervals.length,1);const b=r.observation.intervals[0];assert.equal(b.endTick,failed-1);assert.equal(b.complete,failed===33);
  const expected=reference(clean.frames.slice(0,failed),a.motion.dt);close(b.timeMeanVerticalForce,expected.mean);close(b.timeRmsNodeSpeed,expected.speed);assert.ok(b.maxEndpointNodeAcceleration.tick<failed);
  if(failed===33)assert.deepEqual(b,clean.observation.intervals[0]);
 }
 a.seed.hub.position[2]=.2;const rejected=await run(a);assert.equal(rejected.status,'initial-state-rejected');assert.deepEqual(rejected.observation.intervals,[]);assert.deepEqual(rejected.observation.windowFrameIndices,[]);
});
