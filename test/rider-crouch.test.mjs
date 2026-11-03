import test from 'node:test';
import assert from 'node:assert/strict';
import {riderCrouchPreset,assessRiderCrouch} from '../dist/rider-crouch.js';
import {CONTROL_MODEL} from '../dist/rider-controller.js';
import {DEFAULTS} from '../dist/rider-posture.js';
const fixture=()=>{
 const scenario=riderCrouchPreset(),commands=scenario.riderTargets.commands,weight=100*scenario.motion.gravity;let index=0;
 const frames=Array.from({length:251},(_,i)=>{const time=i*.01,tick=Math.round(time/scenario.motion.dt);while(commands[index+1]?.tick<=tick)index++;return {time,active:{actualHip:[...commands[index].hip],targetCommand:index,work:0,saturation:[0,0,0,0],contactMask:3,estimateStatus:'two-wheel-contact-estimate'},wheels:[{ground:[0,.4*weight,0]},{ground:[0,.6*weight,0]}]};});
 return {model:CONTROL_MODEL,scenario,status:'completed',massBudget:{total:100},frames};
};
test('crouch uses configured limb lengths, shared bounded drive and unchanged matched clocks',()=>{
 for(const bike of ['full','hardtail']){
  const a=riderCrouchPreset(bike),b=riderCrouchPreset(bike,{control:true}),fine=riderCrouchPreset(bike,{dt:.000015625});
  assert.equal(a.motion.duration,2.5);assert.equal(a.riderTargets.commands.length,43);
  const p=a.articulated.passive.posture,depth=p.hip[1]-a.riderTargets.commands[21].hip[1];assert.ok(Math.abs(depth-.043)<1e-12);
  assert.deepEqual(a.active,b.active);assert.deepEqual(a.articulated,b.articulated);
  a.riderTargets.commands.forEach((c,i)=>{assert.equal(c.tick,b.riderTargets.commands[i].tick);assert.equal(c.phase,b.riderTargets.commands[i].phase);assert.deepEqual(c.hip,fine.riderTargets.commands[i].hip);assert.equal(c.tick*2,fine.riderTargets.commands[i].tick);});
  assert.ok(b.riderTargets.commands.every(c=>c.hip[1]===p.hip[1]));
 }
 const posture=structuredClone(DEFAULTS);posture.segments.thighs.length=.45;posture.segments.shanksFeet.length=.45;
 const a=riderCrouchPreset('full',{passive:{posture}});assert.ok(Math.abs(a.riderTargets.commands[21].hip[1]-(posture.hip[1]-.045))<1e-12);
});
test('infeasible geometry and misaligned timing reject without changing passive domains',()=>{
 for(const options of [{depthFraction:.1},{depthFraction:NaN},{depthFraction:0},{dt:.00003},{control:'yes'}])assert.throws(()=>riderCrouchPreset('full',options));
 assert.throws(()=>riderCrouchPreset('other'));assert.throws(()=>riderCrouchPreset('full',{passive:{posture:{hip:[99,99]}}}));
});
test('independent ideal samples pass declared screen without implying physical certification',()=>{
 const r=fixture(),before=structuredClone(r),a=assessRiderCrouch(r);assert.equal(a.status,'screen-passed');assert.ok(a.checks.every(c=>c.pass));assert.match(a.scope,/Saved-sample/);assert.deepEqual(r,before);
 assert.ok(Math.abs(a.observedLoweringM-.043)<1e-12);assert.equal(a.finalHipErrorM,0);
});
test('tracking, lowering, recovery, support, saturation and scaled work fail separately',()=>{
 const check=(edit,name)=>{const r=fixture();edit(r);const a=assessRiderCrouch(r);assert.equal(a.status,'screen-failed');assert.equal(a.checks.find(c=>c.name===name).pass,false);};
 check(r=>r.frames[75].active.actualHip[0]+=.02,'tracking');
 check(r=>r.frames[150].active.actualHip[1]=r.scenario.articulated.passive.posture.hip[1],'lowering');
 check(r=>r.frames.at(-1).active.actualHip[1]+=.004,'recovery');
 check(r=>r.frames[60].wheels[0].ground[1]=0,'wheel-loads');
 check(r=>r.frames[60].active.contactMask=2,'estimate-eligibility');
 check(r=>r.frames[0].active.saturation[0]=1,'saturation');
 check(r=>r.frames.at(-1).active.work=1000,'net-work');
 check(r=>r.frames.splice(80,1),'sampling');
});
test('partial, missing and misleading protocol data never pass',()=>{
 const r=fixture();r.frames=r.frames.slice(0,101);r.status='terminated';const partial=assessRiderCrouch(r);assert.equal(partial.status,'screen-failed');assert.equal(partial.checks.find(c=>c.name==='lowering').value,null);
 for(const edit of [r=>r.frames=[],r=>r.frames[1]=null,r=>r.frames[1].wheels[0]=null,r=>r.frames[1].active.actualHip=[NaN,0],r=>r.frames[20].active.targetCommand=42,r=>r.massBudget.total=0,r=>r.scenario={...r.scenario,motion:{...r.scenario.motion,gravity:0}},r=>r.frames.reverse(),r=>r.model='legacy']){const x=fixture();edit(x);assert.equal(assessRiderCrouch(x).status,'unavailable');}
 const changed=fixture();changed.scenario=structuredClone(changed.scenario);changed.scenario.riderTargets.commands[15].hip[0]+=.001;assert.equal(assessRiderCrouch(changed).status,'unavailable');
});
test('unchanged controls and unrelated experiments cannot be reported as crouch passes',()=>{
 const r=fixture();r.scenario=riderCrouchPreset('full',{control:true});for(const f of r.frames)f.active.actualHip=[...r.scenario.articulated.passive.posture.hip];
 const sparse=fixture();sparse.scenario=structuredClone(sparse.scenario);delete sparse.scenario.riderTargets.commands[0];assert.equal(assessRiderCrouch(sparse).status,'unavailable');
 assert.equal(assessRiderCrouch(r).status,'control');r.status='terminated';assert.equal(assessRiderCrouch(r).status,'incomplete-control');assert.equal(assessRiderCrouch({}).status,'not-applicable');
});
