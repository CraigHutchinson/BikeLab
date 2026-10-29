import test from 'node:test';
import assert from 'node:assert/strict';
import {riderLoadSample,summarizeRiderLoads} from '../dist/rider-loads.js';
import {riderTransferPreset} from '../dist/rider-transfer.js';
import {SEGMENTS} from '../dist/rider-posture.js';
import {JOINTS} from '../dist/rider-passive.js';
import {TARGET_MODEL} from '../dist/rider-targets.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function fixture(){
 const scenario=structuredClone(riderTransferPreset('full',{control:true}));
 const fractions=[.1,.2,.3,.15,.25];SEGMENTS.forEach((name,i)=>scenario.articulated.passive.posture.segments[name].massFraction=fractions[i]);
 JOINTS.forEach(name=>Object.assign(scenario.active.joints[name],{kp:10,kd:3}));
 const frame={time:0,articulated:{interfaces:{attachments:[{name:'foot',forceOnRider:[-10,3,500]},{name:'hand',forceOnRider:[10,-2,200]}]},segments:SEGMENTS.map((name,i)=>({name,velocity:[100,200,300,i+1,10*(i+1),-i-1]}))},
 active:{error:[2,-1,0,.5],velocities:[1,2,-1,0],requestedTorque:[17,-16,3,5],torque:[8,-16,3,5],saturation:[1,0,0,0],actualHip:[0,0],actualCOM:[0,0],targetCOM:[0,0],work:0,totalPower:0,targetCommand:0},wheels:[{ground:[0,100]},{ground:[0,100]}]};
 return {scenario,frame};
}
test('world support includes gravity once and COM uses mass-weighted linear velocities',()=>{
 const {scenario,frame}=fixture(),s=riderLoadSample(scenario,frame);
 assert.deepEqual(s.hand,[10,-2,200]);assert.deepEqual(s.support,[0,1,700]);close(s.weight,686.4655);close(s.netForce[2],13.5345);
 assert.deepEqual(s.comVelocity,[3.25,32.5,-3.25]);
});
test('PD decomposition keeps signed terms and applied saturation separate',()=>{
 const {scenario,frame}=fixture(),s=riderLoadSample(scenario,frame);
 assert.deepEqual(s.joints[0],{name:'hip',proportional:20,damping:-3,requested:17,applied:8,saturation:1,decompositionResidual:0});
 assert.equal(s.joints[1].proportional,-10);assert.equal(s.joints[1].damping,-6);assert.equal(s.joints[2].proportional,0);assert.equal(s.joints[2].damping,3);
 frame.active.requestedTorque[0]+=2;assert.equal(riderLoadSample(scenario,frame).joints[0].decompositionResidual,2);
});
test('zero-gravity and passive records retain honest support semantics',()=>{
 const {scenario,frame}=fixture();scenario.motion.gravity=0;delete scenario.active;delete frame.active;
 const s=riderLoadSample(scenario,frame);assert.equal(s.weight,0);assert.deepEqual(s.netForce,s.support);assert.deepEqual(s.joints,[]);
});
test('named segments and attachments are order-independent and input remains unchanged',()=>{
 const {scenario,frame}=fixture(),before=structuredClone({scenario,frame}),a=riderLoadSample(scenario,frame);
 assert.deepEqual({scenario,frame},before);frame.articulated.segments.reverse();frame.articulated.interfaces.attachments.reverse();assert.deepEqual(riderLoadSample(scenario,frame),a);
 a.hand[0]=999;assert.equal(frame.articulated.interfaces.attachments[0].forceOnRider[0],10);
});
test('missing, duplicated, sparse and nonfinite data are rejected',()=>{
 for(const change of [x=>x.frame.articulated.segments.pop(),x=>x.frame.articulated.segments[0].name='thighs',x=>x.frame.articulated.interfaces.attachments[0].name='hand',x=>x.frame.articulated.interfaces.attachments[0].forceOnRider=Array(3),x=>x.frame.articulated.segments[0].velocity[5]=NaN,x=>x.frame.active.error[0]=Infinity,x=>x.scenario.articulated.passive.posture.segments.trunk.massFraction=.2,x=>x.scenario.articulated.passive.posture.riderMass=0]){
  const x=fixture();change(x);assert.throws(()=>riderLoadSample(x.scenario,x.frame));
 }
});
function record(){
 const {scenario,frame}=fixture();return {model:TARGET_MODEL,scenario,status:'completed',frames:[0,.2,.4,.6,.8,1].map(time=>{
  const f=structuredClone(frame);f.time=time;f.active.targetCommand=scenario.riderTargets.commands.findLastIndex(c=>c.tick<=Math.round(time/scenario.motion.dt));f.articulated.interfaces.attachments[0].forceOnRider[2]=500+time*10;return f;
 })};
}
test('phase loads use right-continuous observations and include the final endpoint',()=>{
 const r=record(),s=summarizeRiderLoads(r);assert.deepEqual(s.phases.map(p=>p.samples),[1,1,1,1,2]);
 assert.deepEqual(s.phases[0].footVerticalN,{min:500,max:500});assert.deepEqual(s.phases[4].footVerticalN,{min:508,max:510});assert.equal(s.phases[4].last.tick,32000);
 assert.ok(s.phases.every(p=>p.complete));assert.equal(s.phases[4].joints[0].maxDecompositionResidualNm,0);
});
test('unreached load phases have null ranges and cannot pass as stationary',()=>{
 const r=record();r.status='terminated';r.frames=r.frames.slice(0,1);
 const s=summarizeRiderLoads(r);assert.equal(s.status,'terminated');assert.ok(s.phases.every(p=>!p.complete));assert.equal(s.phases[1].samples,0);assert.equal(s.phases[1].netVerticalN,null);assert.equal(s.phases[1].last,null);assert.equal(s.phases[1].joints[0].appliedNm,null);
});
