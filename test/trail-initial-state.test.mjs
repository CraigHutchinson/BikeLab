import test from 'node:test';
import assert from 'node:assert/strict';
import {run,replay,inputFromRecord,validate,modelXML,articulatedPreset} from '../dist/trail-bike.js';
import {STATE_MODEL,canonicalModelXML,scalarLayout,applyState} from '../dist/trail-initial-state.js';
import {getRuntime} from '../dist/moving-wheel.js';
const fresh=r=>({...r.scenario,motion:Object.fromEntries(['gravity','duration','dt','sampleDt'].map(k=>[k,r.scenario.motion[k]])),initialization:{mode:'state',state:r.initialState}});
const launch=bike=>{const a=articulatedPreset(bike,'flight');a.motion.duration=.02;a.initialization={mode:'launch'};return a;};
test('complete scalar state is owned, named, canonical and replayable on both bikes',async()=>{
 for(const bike of ['full','hardtail']){
  const r=await run(launch(bike));assert.equal(r.model,STATE_MODEL);assert.equal(r.status,'completed');
  const a=fresh(r),before=structuredClone(a),s=await run(a);assert.equal(s.status,'completed');assert.deepEqual(a,before);assert.deepEqual(s.frames,r.frames);assert.deepEqual(await replay(JSON.parse(JSON.stringify(s))),s);
  a.initialization.state=structuredClone(a.initialization.state);a.initialization.state.joints.reverse();assert.deepEqual(await run(a),s);
  const sparse=await run({...fresh(r),motion:{...fresh(r).motion,sampleDt:.01}});assert.deepEqual(sparse.frames.at(-1),s.frames.at(-1));
  const next={...fresh(r),initialization:{mode:'state',state:r.finalState}},t=await run(next);assert.equal(t.status,'completed');assert.equal(t.frames[0].time,0);assert.equal(t.frames[0].constraintWork,0);assert.equal(t.frames[0].dampingLoss,0);assert.equal(t.frames[0].residual,0);
  assert.deepEqual(t.initialState,r.finalState);assert.equal(t.frames[0].energy,t.summary.initialEnergy);
 }
});
test('state identity, complete coverage, unsupported payloads and admission fail closed',async()=>{
 const r=await run(launch('full')),base=fresh(r);
 for(const patch of [a=>a.bike.bike='hardtail',a=>a.wheel.nodes=32,a=>a.articulated.chassis.mass=7,a=>a.motion.gravity=1,a=>a.initialization.state.identity='0'.repeat(64),a=>a.initialization.state.joints.pop(),a=>a.initialization.state.joints[0].name='unknown',a=>a.initialization.state.joints[0].type='hinge']){
  const a=structuredClone(base);patch(a);await assert.rejects(run(a));
 }
 for(const patch of [a=>a.motion.clearance=0,a=>a.initialization.state.time=1,a=>a.initialization.state.eq_active=[0,1],a=>a.initialization.state.joints.push(a.initialization.state.joints[0]),a=>a.initialization.state.joints[0].position=NaN,a=>a.initialization.state.joints[0].velocity=Infinity,a=>a.initialization.state.joints[0].velocity=1e6,a=>a.initialization.state.joints[0].type='free']){
  const a=structuredClone(base);patch(a);assert.throws(()=>validate(a));
 }
 const bad=structuredClone(base);bad.initialization.state.joints.find(j=>j.name==='pitch').position=.4;const rejected=await run(bad);assert.equal(rejected.status,'initial-state-rejected');assert.equal(rejected.frames.length,0);assert.equal(rejected.initialState,undefined);
 const old=structuredClone(r);old.model='bikelab-trail-bike-articulated-0.1';assert.throws(()=>inputFromRecord(old));
});
test('scalar mapping uses each named position and velocity address; geometry quantization is versioned',async()=>{
 const a=launch('full'),r=await run(a),mj=await getRuntime(),m=mj.MjModel.from_xml_string(modelXML(a)),d=new mj.MjData(m);
 try{const layout=scalarLayout(mj,m),state=structuredClone(r.initialState);for(let i=0;i<state.joints.length;i++){state.joints[i].position=i*.001;state.joints[i].velocity=-i*.002;}state.joints.reverse();applyState(state,state.identity,layout,d);for(const j of layout){const entry=state.joints.find(x=>x.name===j.name);assert.equal(d.qpos[j.q],entry.position);assert.equal(d.qvel[j.v],entry.velocity);}assert.ok(Array.from(d.qacc_warmstart).every(x=>x===0));assert.ok(Array.from(d.eq_active).every(x=>x===1));}finally{d.delete();m.delete();}
 assert.equal(canonicalModelXML('<joint springref="-4.44e-16" axis="0.7387314735701102 0 1"/>'),canonicalModelXML('<joint springref="0" axis="0.73873147357011 0 1"/>'));
 const legacy=articulatedPreset();assert.notEqual(modelXML(legacy),modelXML({...legacy,initialization:{mode:'launch'}}));
});
