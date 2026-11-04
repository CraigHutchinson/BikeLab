import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getRuntime} from '../dist/moving-wheel.js';
import {createSpinningStageDriver,stageSweep,ballisticSweep} from '../scripts/spinning-rk4-stage.mjs';

const baseline=JSON.parse(await readFile(new URL('../docs/evidence/spinning-gap.json',import.meta.url)));
const source=baseline.samples.find(s=>s.name==='loaded-deformed'&&s.angle===.1&&s.omega===10);
const initial=()=>({q:[...source.q],v:[...source.v],warmstart:source.v.map((_,i)=>(i%7-3)*.125),time:.25});

test('scalar spinning stages match native RK4 across all 36 regimes for 16 consecutive steps',async()=>{
 const progress=[],r=await stageSweep((n,total)=>progress.push([n,total]));
 assert.equal(r.samples.length,36);assert.deepEqual(progress,Array.from({length:36},(_,i)=>[i+1,36]));
 for(const s of r.samples){
  assert.equal(s.steps.length,16);assert.equal(s.final.steps,16);assert.deepEqual(s.final.qacc,s.final.qacc_warmstart);
  for(const [key,e] of Object.entries(r.maxima))assert.ok(e<=r.budgets[key]);
  assert.deepEqual(s.steps[0].stages.map(s=>s.time),[.25,.25+r.parameters.timestep/2,.25+r.parameters.timestep/2,.25+r.parameters.timestep]);
 }
});

test('rejection at every stage and endpoint preserves the accepted slot, caches and ledgers before deterministic retry',async()=>{
 const mj=await getRuntime();
 for(let checkpoint=0;checkpoint<=4;checkpoint++){
  let enabled=false;const driver=createSpinningStageDriver(mj,initial(),{onCheckpoint:s=>{if(enabled&&s===checkpoint)throw Error('Injected rejection '+s);}}),control=createSpinningStageDriver(mj,initial());
  try{
   for(let n=0;n<2;n++){driver.step();control.step();}const before=driver.snapshot();enabled=true;
   assert.throws(()=>driver.step(),/Injected rejection/);assert.deepEqual(driver.snapshot(),before);
   enabled=false;driver.step();control.step();assert.deepEqual(driver.snapshot(),control.snapshot());
  }finally{driver.dispose();control.dispose();}
 }
});

test('endpoint observations own their outputs and preserve native fourth-stage caches',async()=>{
 const mj=await getRuntime(),input=initial(),driver=createSpinningStageDriver(mj,input);
 try{
  input.q[0]=999;input.warmstart[0]=999;driver.step();const before=driver.snapshot(),endpoint=driver.observe();
  assert.deepEqual(driver.snapshot(),before);assert.deepEqual(endpoint.qpos,before.qpos);assert.deepEqual(endpoint.qvel,before.qvel);
  assert.ok(endpoint.qacc.some((x,i)=>x!==before.qacc[i]),'Endpoint and stage-four accelerations must be distinguished');
  assert.ok(endpoint.flexvert_xpos.some((x,i)=>x!==before.flexvert_xpos[i]));
  endpoint.qpos[0]=999;before.qvel[0]=999;before.lastStages[0].time=999;
  assert.notEqual(driver.snapshot().qvel[0],999);assert.notEqual(driver.snapshot().lastStages[0].time,999);
 }finally{driver.dispose();driver.dispose();}assert.throws(()=>driver.step(),/unavailable/);assert.throws(()=>driver.snapshot(),/disposed/);
});

test('zero-material flight follows independent world ballistics for both orientations and spin signs',async()=>{
 const cases=await ballisticSweep();assert.equal(cases.length,6);
 for(const c of cases){assert.equal(c.steps,128);assert.equal(c.duration,.00025);assert.equal(c.final.contactWork,0);assert.equal(c.final.verticalImpulse,0);assert.ok(c.errors.position<=1e-12);assert.ok(c.errors.velocity<=1e-9);}
});

test('corrupted stage warmstart, native warnings and invalid endpoint roll back without contaminating retries',async()=>{
 const mj=await getRuntime(),skip=mj.mj_forwardSkip,forward=mj.mj_forward;
 for(const mode of ['warmstart','warning','endpoint']){
  const driver=createSpinningStageDriver(mj,initial()),control=createSpinningStageDriver(mj,initial());
  try{
   driver.step();control.step();const before=driver.snapshot();let calls=0;
   if(mode==='warmstart')mj.mj_forwardSkip=(m,d,...args)=>{skip(m,d,...args);d.qacc_warmstart[0]+=.001;};
   else if(mode==='warning')mj.mj_forwardSkip=(m,d,...args)=>{skip(m,d,...args);const w=d.warning,s=w.get(0);try{s.number=1;s.lastinfo=99;w.set(0,s);}finally{s.delete();}};
   else mj.mj_forward=(m,d)=>{forward(m,d);if(++calls===2)d.qpos[0]=NaN;};
   assert.throws(()=>driver.step(),mode==='warmstart'?/incoming warmstart/:mode==='warning'?/Native warning/:/Nonfinite/);assert.deepEqual(driver.snapshot(),before);
   mj.mj_forwardSkip=skip;mj.mj_forward=forward;driver.step();control.step();assert.deepEqual(driver.snapshot(),control.snapshot());
  }finally{mj.mj_forwardSkip=skip;mj.mj_forward=forward;driver.dispose();control.dispose();}
 }
});

test('unsupported inputs, unavailable native copying and physical limits fail closed',async()=>{
 const mj=await getRuntime(),copy=mj.mj_copyState;
 for(const input of [{...initial(),q:[0]},{...initial(),time:NaN},{...initial(),force:1},{...initial(),v:new Array(67).fill(Infinity)}])assert.throws(()=>createSpinningStageDriver(mj,input));
 assert.throws(()=>createSpinningStageDriver(mj,initial(),{target:'physical'}),/Unknown options/);
 const rim=initial();rim.q[1]=-.1;assert.throws(()=>createSpinningStageDriver(mj,rim),/Physical limit/);
 const displacement=initial();displacement.q[3]=.07;assert.throws(()=>createSpinningStageDriver(mj,displacement),/Casing displacement|Physical limit/);
 mj.mj_copyState=undefined;try{assert.throws(()=>createSpinningStageDriver(mj,initial()),/Missing native API/);}finally{mj.mj_copyState=copy;}
});
