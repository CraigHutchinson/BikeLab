import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {run,replay,inputFromRecord,modelXML,preset,validate} from '../dist/trail-bike.js';
import {CANONICAL_MODEL,CANONICAL_NUMERICS} from '../dist/trail-canonical.js';
import {getRuntime} from '../dist/moving-wheel.js';

test('versioned canonical launch owns native XML and named applied coordinates on both bikes and rider modes',async()=>{
 const mj=await getRuntime();
 for(const bike of ['full','hardtail'])for(const rider of ['fixed','compliant']){
  const a=preset('flight',bike);a.bike.rider=rider;a.numerics=CANONICAL_NUMERICS;a.motion.duration=.02;
  const r=await run(a);assert.equal(r.model,CANONICAL_MODEL);assert.equal(r.status,'completed');assert.equal(r.numericalPolicy.warmStart,'fresh-zero');
  assert.equal(r.numericalPolicy.xmlSha256,createHash('sha256').update(modelXML(a)).digest('hex'));
  const m=mj.MjModel.from_xml_string(modelXML(a)),d=new mj.MjData(m);
  try{
   assert.equal(r.numericalPolicy.joints.length,m.njnt);
   for(const j of r.numericalPolicy.joints){const id=mj.mj_name2id(m,mj.mjtObj.mjOBJ_JOINT.value,j.name);assert.ok(id>=0);assert.equal(j.position,Number(j.position.toPrecision(12)));assert.equal(j.velocity,Number(j.velocity.toPrecision(12)));d.qpos[m.jnt_qposadr[id]]=j.position;d.qvel[m.jnt_dofadr[id]]=j.velocity;}
   mj.mj_forward(m,d);const frame=mj.mj_name2id(m,mj.mjtObj.mjOBJ_BODY.value,'frame');assert.deepEqual(r.frames[0].frame.slice(0,2),[d.xpos[3*frame],d.xpos[3*frame+2]]);
  }finally{d.delete();m.delete();}
  assert.deepEqual(await replay(JSON.parse(JSON.stringify(r))),r);
  const dense=await run({...a,motion:{...a.motion,sampleDt:.0025}});assert.deepEqual(dense.frames.at(-1),r.frames.at(-1));
  assert.equal(r.initialState,undefined);assert.equal(r.finalState,undefined);
  const old=structuredClone(r);old.model='bikelab-trail-bike-0.4';assert.throws(()=>inputFromRecord(old),/Legacy/);
  const missing=structuredClone(r);delete missing.scenario.numerics;assert.throws(()=>inputFromRecord(missing),/Incomplete/);
 }
});

test('canonical policy is explicit and does not broaden articulated initialization',()=>{
 for(const value of [null,false,'unknown',{},[]])assert.throws(()=>validate({numerics:value}));
 assert.throws(()=>validate({bike:{rider:'articulated'},numerics:CANONICAL_NUMERICS}));
 assert.throws(()=>validate({numerics:CANONICAL_NUMERICS,initialization:{mode:'launch'}}));
 assert.equal(validate(preset('flat')).numerics,undefined);
 assert.notEqual(modelXML(preset('flat')),modelXML({...preset('flat'),numerics:CANONICAL_NUMERICS}));
});
