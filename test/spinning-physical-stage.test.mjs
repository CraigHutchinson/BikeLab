import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getRuntime} from '../dist/moving-wheel.js';
import {createSpinningStageDriver} from '../scripts/spinning-rk4-stage.mjs';
const baseline=JSON.parse(await readFile(new URL('../docs/evidence/spinning-gap.json',import.meta.url)));
const input=s=>({q:[...s.q],v:[...s.v],warmstart:s.v.map(()=>.125),time:0});
const policy={targetPolicy:'physical-gap-0.1'};

test('corrected initialization reproduces independently audited prescribed-state force and acceleration',async()=>{
 const mj=await getRuntime(),reference=JSON.parse(await readFile(new URL('../docs/evidence/spinning-gap-target.json',import.meta.url)));
 for(const sample of reference.samples){
  const driver=createSpinningStageDriver(mj,input(sample.input),{...policy,excluded:sample.input.excluded});
  try{const actual=driver.snapshot();
   for(let j=0;j<actual.qacc.length;j++){
    assert.ok(Math.abs(actual.qacc[j]-sample.corrected.qacc[j])<=reference.budgets[j===2?'angularAcceleration':'acceleration']);
    assert.ok(Math.abs(actual.qfrc_constraint[j]-sample.corrected.generalizedForce[j])<=reference.budgets[j===2?'torque':'force']);
   }
  }finally{driver.dispose();}
 }
});

test('physical target is solved at each stage and separately at endpoint observation',async()=>{
 const mj=await getRuntime(),source=baseline.samples.find(s=>s.name==='loaded-shear'&&s.omega===10),solve=mj.mj_fwdConstraint;
 const driver=createSpinningStageDriver(mj,input(source),policy);let calls=0;
 mj.mj_fwdConstraint=(m,d)=>{calls++;solve(m,d);};
 try{driver.step();assert.equal(calls,5);const state=driver.snapshot();assert.equal(state.targetPolicy,policy.targetPolicy);driver.observe();assert.equal(calls,6);assert.deepEqual(driver.snapshot(),state);}
 finally{mj.mj_fwdConstraint=solve;driver.dispose();}
});

test('corrected stages retain accepted state on rejection and reproduce deterministic retry',async()=>{
 const mj=await getRuntime(),source=baseline.samples.find(s=>s.name==='loaded-deformed'&&s.omega===10);
 for(let stage=0;stage<5;stage++){
  let reject=false;const a=createSpinningStageDriver(mj,input(source),{...policy,onCheckpoint:n=>{if(reject&&n===stage)throw Error('reject');}}),b=createSpinningStageDriver(mj,input(source),policy);
  try{a.step();b.step();const before=a.snapshot();reject=true;assert.throws(()=>a.step(),/reject/);assert.deepEqual(a.snapshot(),before);reject=false;a.step();b.step();assert.deepEqual(a.snapshot(),b.snapshot());}
  finally{a.dispose();b.dispose();}
 }
});

test('corrected flight preserves native ballistic evolution with no contact work',async()=>{
 const mj=await getRuntime();
 for(const source of baseline.samples.filter(s=>s.name==='separated-closing')){
  const a=createSpinningStageDriver(mj,input(source),policy),b=createSpinningStageDriver(mj,input(source));
  try{for(let i=0;i<128;i++){a.step();b.step();}const x=a.snapshot(),y=b.snapshot();assert.equal(x.contactWork,0);assert.equal(x.verticalImpulse,0);delete x.targetPolicy;delete y.targetPolicy;assert.deepEqual(x,y);}
  finally{a.dispose();b.dispose();}
 }
});
