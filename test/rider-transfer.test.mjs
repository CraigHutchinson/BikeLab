import test from 'node:test';
import assert from 'node:assert/strict';
import {riderTransferPreset,summarizeRiderTracking,compareRiderTransfers} from '../dist/rider-transfer.js';
import {TARGET_MODEL} from '../dist/rider-targets.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
function fixture(){
 return {model:TARGET_MODEL,status:'completed',initialState:{format:'fixture',identity:'same',joints:[{position:0,velocity:0}]},scenario:{motion:{dt:.01,duration:.04},articulated:{passive:{posture:{hip:[0,0],trunkPitch:0}}},riderTargets:{commands:[{tick:0,phase:'hold',hip:[0,0],trunkPitch:0},{tick:2,phase:'return',hip:[0,0],trunkPitch:0}]}},
 frames:[0,1,2,3,4].map(t=>({time:t*.01,active:{targetCommand:t<2?0:1,actualHip:[t,0],actualCOM:[0,2*t],targetCOM:[0,0],error:[0,0,0,-t/10],saturation:[t===3?1:0,0,0,0],work:t*t,totalPower:t},wheels:[{ground:[0,10-t]},{ground:[0,20-t]}]}))};
}
test('transfer and control retain identical mechanics and clocks with meaningful hold intervals',()=>{
 for(const bike of ['full','hardtail']){
  const a=riderTransferPreset(bike),b=riderTransferPreset(bike,{control:true}),ac=a.riderTargets.commands,bc=b.riderTargets.commands;
  assert.equal(ac.length,43);assert.equal(a.motion.duration,1);
  assert.deepEqual(ac.map(({tick,phase})=>({tick,phase})),bc.map(({tick,phase})=>({tick,phase})));
  const posture=a.articulated.passive.posture;
  assert.ok(bc.every(c=>JSON.stringify(c.hip)===JSON.stringify(posture.hip)&&c.trunkPitch===posture.trunkPitch));
  assert.deepEqual(ac.at(-1).hip,posture.hip);close(ac.at(-1).tick*a.motion.dt,.8);
  const end=ac.find(c=>c.phase==='target-hold');close(end.tick*a.motion.dt,.4);close(end.hip[0]-posture.hip[0],.002);close(end.hip[1]-posture.hip[1],-.002);
  delete a.riderTargets;delete b.riderTargets;assert.deepEqual(a,b);
 }
});
test('step refinement preserves physical command times and all target values',()=>{
 const a=riderTransferPreset(),b=riderTransferPreset('full',{dt:.000015625});
 a.riderTargets.commands.forEach((c,i)=>assert.deepEqual({...c,tick:c.tick*2},b.riderTargets.commands[i]));
 for(const options of [{dt:0},{dt:NaN},{dt:.003},{control:1}])assert.throws(()=>riderTransferPreset('full',options));
 assert.throws(()=>riderTransferPreset('tricycle'));
});
test('phase boundaries are right-continuous; work spans exact boundary samples',()=>{
 const r=fixture(),before=structuredClone(r),s=summarizeRiderTracking(r),[a,b]=s.phases;
 assert.equal(a.samples,2);assert.equal(b.samples,3);assert.equal(a.lastSampleTick,1);assert.equal(b.lastSampleTick,4);
 assert.equal(a.sampleMaxHipErrorM,1);assert.equal(b.sampleMaxHipErrorM,4);assert.equal(b.sampleMaxCOMErrorM,8);close(b.sampleMaxJointErrorRad,.4);
 assert.equal(a.riderWorkJ,4);assert.equal(b.riderWorkJ,12);assert.equal(a.saturatedSamples,0);assert.equal(b.saturatedSamples,1);assert.equal(b.sampleMinWheelLoadN,6);
 assert.ok(a.complete&&b.complete);assert.deepEqual(r,before);
});
test('partial and unreached intervals never imply zero error or completed recovery',()=>{
 const r=fixture();r.status='terminated';r.frames=r.frames.slice(0,2);
 const [a,b]=summarizeRiderTracking(r).phases;
 assert.equal(a.complete,false);assert.equal(a.riderWorkJ,1);assert.equal(b.complete,false);assert.equal(b.samples,0);
 assert.equal(b.sampleMaxHipErrorM,null);assert.equal(b.sampleMaxCOMErrorM,null);assert.equal(b.sampleMinWheelLoadN,null);assert.equal(b.riderWorkJ,null);
});
test('missing boundary observations do not fabricate work by interpolation',()=>{
 const r=fixture();r.frames=r.frames.filter(f=>f.time!==.02);
 const [a,b]=summarizeRiderTracking(r).phases;assert.equal(a.riderWorkJ,null);assert.equal(b.riderWorkJ,null);
});
test('malformed or misidentified observations fail explicitly',()=>{
 for(const edit of [r=>r.frames[1].time=.015,r=>r.frames.reverse(),r=>r.frames.shift(),r=>r.frames[2].active.targetCommand=0,r=>r.frames[1].active.actualHip=[NaN,0],r=>r.frames[1].active.actualCOM=Array(2),r=>r.frames[1].active.work=Infinity,r=>r.frames[0].wheels[0].ground[1]=NaN,r=>r.scenario.motion.duration=.03]){
  const r=fixture();edit(r);assert.throws(()=>summarizeRiderTracking(r));
 }
});
test('matched differences retain baseline error without changing either source',()=>{
 const control=fixture(),target=fixture();target.initialState.identity='different-target-sequence';target.scenario.riderTargets.commands[1].hip=[1,-1];
 for(const f of target.frames)if(f.time>=.02){f.active.actualHip[0]+=.5;f.active.actualCOM[1]-=.25;f.active.work+=2;}
 const before=structuredClone([target,control]),c=compareRiderTransfers(target,control);
 assert.deepEqual(c.samples[1].actualHipDelta,[0,0]);assert.deepEqual(c.samples[2].requestedHipDelta,[1,-1]);assert.deepEqual(c.samples[2].actualHipDelta,[.5,0]);assert.deepEqual(c.samples[2].actualCOMDelta,[0,-.25]);assert.equal(c.samples[2].riderWorkDelta,2);
 assert.deepEqual([target,control],before);
});
test('comparison rejects changed mechanics, schedules, native states and moving controls',()=>{
 for(const edit of [r=>r.scenario.motion.gravity=0,r=>r.scenario.riderTargets.commands[1].tick=3,r=>r.frames.pop(),r=>r.initialState.joints[0].position=1]){
  const r=fixture();edit(r);assert.throws(()=>compareRiderTransfers(r,fixture()));
 }
 const control=fixture();control.scenario.riderTargets.commands[1].hip=[.1,0];assert.throws(()=>compareRiderTransfers(fixture(),control),/original target/);
});
