import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {targetSweep} from '../scripts/spinning-gap-target.mjs';
import {getRuntime} from '../dist/moving-wheel.js';

const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
let saved;
const report=async()=>saved??=await targetSweep();

test('physical target removes matched-state force changes and preserves the archived native controls',async()=>{
 const r=await report(),baseline=JSON.parse(await readFile(new URL('../docs/evidence/spinning-gap.json',import.meta.url)));
 assert.equal(r.samples.length,48);assert.equal(r.models.length,2);
 for(const s of r.samples){
  const mass=r.parameters.nodeMass,g=r.parameters.wheel.gravity;
  for(const row of s.corrected.rows){near(row.nativeForce,Math.max(0,(row.aref+g)/(1/mass+row.r)));near(row.physicalAcceleration,-g+row.nativeForce/mass);if(row.nativeForce>0)near(row.physicalResidual,0,1e-7);else assert.ok(row.physicalResidual>=0);}
  const old=baseline.samples.find(b=>b.name===s.input.name&&b.angle===s.input.angle&&b.omega===s.input.omega);
  if(old){assert.deepEqual(s.input.q,old.q);assert.deepEqual(s.input.v,old.v);assert.deepEqual(s.native.qacc,old.coordinateAcceleration);assert.deepEqual(s.native.rows.map(r=>r.nativeForce),old.rows.filter(r=>r.row>=0).map(r=>r.nativeForce));}
 }
 assert.ok(r.samples.filter(s=>s.input.name==='loaded-common'&&s.input.omega!==0).every(s=>s.corrected.rows[0].nativeForce-s.native.rows[0].nativeForce>1));
 assert.ok(r.summary.matchedForce<=1e-8);assert.ok(r.summary.matchedAcceleration<=1e-7);
});

test('target controls include nonzero signed power, unilateral gates and seeded solve reversals',async()=>{
 const r=await report();assert.equal(r.summary.constraintResolves,1248);
 for(const s of r.samples){
  assert.deepEqual(s.warmResults.map(w=>w.warm),['zero','baseline','corrected','unrelated','disabled']);assert.ok(s.referenceRebuildRestoresNative);
  for(const w of s.warmResults)for(const [key,value] of Object.entries(w.differences))assert.ok(value<=r.budgets[key]);
  if(s.input.name==='loaded-closing')assert.ok(s.corrected.contactPower<-.1);
  if(s.input.name==='loaded-opening')assert.ok(s.corrected.contactPower>.1);
  if(s.input.name==='unloading'){assert.equal(s.corrected.rows.length,1);assert.equal(s.corrected.rows[0].nativeForce,0);assert.ok(s.corrected.rows[0].slack>3000);}
  if(s.input.name==='separated-closing')assert.equal(s.contacts.length,0);
  if(s.input.name==='excluded-closing'){assert.equal(s.contacts.length,1);assert.equal(s.contacts[0].row,-1);assert.equal(s.corrected.rows.length,0);}
  if(s.input.name==='loaded-deformed')assert.deepEqual(s.corrected.rows.map(r=>r.node),[0,1]);
 }
});

test('target evidence repeats, owns returned data and reports all completed states',async()=>{
 const first=await report(),serialized=JSON.stringify(first),progress=[],second=await targetSweep((n,total)=>progress.push([n,total]));assert.deepEqual(second,first);assert.deepEqual(progress,Array.from({length:48},(_,i)=>[i+1,48]));second.samples[0].input.v[0]+=1;assert.equal(JSON.stringify(first),serialized);await assert.rejects(targetSweep(true));
});

test('missing solve API, omitted re-solve and modified physical state fail closed',async()=>{
 const mj=await getRuntime(),solve=mj.mj_fwdConstraint;
 for(const mode of ['missing','no-solve','state','coefficient']){
  mj.mj_fwdConstraint=mode==='missing'?undefined:mode==='no-solve'?()=>{}:(m,d)=>{solve(m,d);if(mode==='state')d.qpos[0]+=.001;else if(d.nefc)d.efc_R[0]+=.001;};
  try{await assert.rejects(targetSweep(),mode==='missing'?/API unavailable/:mode==='no-solve'?/force/:/Intervention changed/);}finally{mj.mj_fwdConstraint=solve;}
 }
});
