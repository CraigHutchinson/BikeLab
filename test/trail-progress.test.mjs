import test from 'node:test';
import assert from 'node:assert/strict';
import {run,preset,articulatedPreset} from '../dist/trail-bike.js';

function check(events,r){
 const total=Math.round(r.scenario.motion.duration/r.scenario.motion.dt),accepted=r.summary?.steps??0;
 assert.ok(events.length<=105,'bounded progress callbacks');assert.equal(events[0].phase,'preparing');assert.equal(events.at(-1).phase,'finalizing');
 assert.equal(events.at(-1).acceptedSteps,accepted);
 let previous=0;
 for(const e of events){
  assert.equal(e.totalSteps,total);assert.equal(e.dt,r.scenario.motion.dt);
  assert.ok(Number.isSafeInteger(e.acceptedSteps)&&e.acceptedSteps>=previous&&e.acceptedSteps<=accepted);
  previous=e.acceptedSteps;
 }
 const integration=events.filter(e=>e.phase==='integrating');
 if(r.frames.length)assert.equal(integration.at(-1).acceptedSteps,accepted);else assert.equal(integration.length,0);
}
const observer=events=>(phase,acceptedSteps,totalSteps,dt)=>events.push({phase,acceptedSteps,totalSteps,dt});

test('progress observes both rider modes/bikes without changing complete output or replay configuration',async()=>{
 for(const bike of ['full','hardtail'])for(const articulated of [false,true]){
  const a=articulated?articulatedPreset(bike):preset('flat',bike);a.motion={...a.motion,duration:.02};
  a.commands=[{tick:0,rearDrive:0,frontBrake:0,rearBrake:0},{tick:320,rearDrive:2,frontBrake:1,rearBrake:0}];
  const events=[],expected=await run(a),actual=await run(a,observer(events));
  assert.deepEqual(actual,expected);assert.equal(actual.status,'completed');check(events,actual);
  assert.ok(events.some(e=>e.phase==='integrating'&&e.acceptedSteps>0&&e.acceptedSteps<e.totalSteps));
 }
});

test('progress retains only accepted steps on guarded stops and zero on rejected launch/assembly',async()=>{
 const stopped=articulatedPreset();stopped.motion.duration=.3;
 const rejected=preset('flat');rejected.motion={...rejected.motion,riderOffset:.2,duration:.02};
 const assembly=preset('flat');assembly.assembly={pairApproved:false};
 const inputs=[stopped,rejected,assembly];
 for(const a of inputs){
  const events=[],r=await run(a,observer(events));check(events,r);
  assert.notEqual(r.status,'completed');assert.ok(events.at(-1).acceptedSteps<events.at(-1).totalSteps);
  assert.deepEqual(await run(a),r);
 }
});

test('invalid observers and observer failures reject without publishing a result; later runs remain identical',async()=>{
 const a=preset('flight');a.motion={...a.motion,duration:.02};
 await assert.rejects(run(a,{}),/observer must be a function/);
 const expected=await run(a);let reached=false;
 await assert.rejects(run(a,(phase,steps)=>{if(phase==='integrating'&&steps>0){reached=true;throw Error('observer failure');}}),/observer failure/);
 assert.ok(reached);assert.deepEqual(await run(a),expected);
});
