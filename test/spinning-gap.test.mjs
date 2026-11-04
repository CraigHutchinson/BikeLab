import test from 'node:test';
import assert from 'node:assert/strict';
import {spinningGapSweep,spinningGapXML,BUDGETS} from '../scripts/spinning-gap.mjs';
import {getRuntime,validate} from '../dist/moving-wheel.js';

const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
let report;
const sample=async()=>report??=await spinningGapSweep();

test('matched world states isolate even spin and odd Coriolis contact-force changes',async()=>{
 const r=await sample(),p=r.parameters.wheel,m=r.parameters.nodeMass,denominator=1/m+2/(3*m)*(1-p.contactImpedance)/p.contactImpedance,radius=p.radius-p.skin;
 for(const name of ['loaded-common','loaded-shear'])for(const angle of [0,.1]){
  const group=r.samples.filter(s=>s.name===name&&s.angle===angle),[minus,zero,plus]=group;
  assert.deepEqual(group.map(s=>s.omega),[-10,0,10]);
  for(const s of group){assert.deepEqual(s.worldOffsets,zero.worldOffsets);assert.deepEqual(s.hubPosition,zero.hubPosition);assert.deepEqual(s.nodeVelocity,zero.nodeVelocity);assert.deepEqual(s.hubVelocity,zero.hubVelocity);assert.deepEqual(s.q,zero.q);}
  const rows=group.map(s=>s.rows[0]),wx=zero.input.relativeX;
  near(rows[0].physicalLawResidual,-100*radius+20*wx);near(rows[1].physicalLawResidual,0);near(rows[2].physicalLawResidual,-100*radius-20*wx);
  near((rows[0].nativeForce+rows[2].nativeForce)/2-rows[1].nativeForce,-100*radius/denominator);
  near(rows[2].nativeForce-rows[0].nativeForce,-40*wx/denominator);
  assert.ok(Math.abs(rows[0].nativeForce-rows[1].nativeForce)>.9,'Nondegenerate centrifugal control');
  if(wx)assert.ok(Math.abs(rows[2].nativeForce-rows[0].nativeForce)>.2,'Nondegenerate Coriolis control');
 }
 // Coordinate orientation cannot change the matched physical result in this control.
 for(const s of r.samples.filter(s=>s.angle===0)){const tilted=r.samples.find(t=>t.name===s.name&&t.omega===s.omega&&t.angle===.1);for(let k=0;k<s.rows.length;k++)if(s.rows[k].row>=0)near(s.rows[k].nativeForce,tilted.rows[k].nativeForce);}
});

test('zero-force, absent, excluded and multiple vertex rows retain unilateral admission',async()=>{
 const r=await sample();assert.equal(r.samples.length,36);
 for(const s of r.samples){
  for(const [key,value] of Object.entries(s.errors))assert.ok(value<=BUDGETS[key],key);
  if(s.name==='unloading'){assert.equal(s.rows.length,1);assert.equal(s.rows[0].nativeForce,0);assert.ok(s.rows[0].complementarity>3000);}
  if(s.name==='separated-closing')assert.deepEqual(s.rows,[]);
  if(s.name==='excluded-closing'){assert.equal(s.rows.length,1);assert.equal(s.rows[0].row,-1);assert.ok(s.rows[0].exclude>0);assert.equal(s.rows[0].force,0);}
  if(s.name==='loaded-deformed'){assert.deepEqual(s.rows.map(r=>r.node),[0,1]);assert.ok(s.rows.every(r=>r.nativeForce>0));assert.deepEqual([...new Set(s.finiteDifference.map(f=>f.node))],[0,1]);}
 }
 assert.deepEqual(r.parameters.materialOverride,{foundation:0,extension:0,edgeViscosity:0});
 assert.throws(()=>validate({foundation:0}),/foundation/);assert.throws(()=>spinningGapXML('true'));
});

test('prescribed spin report repeats exactly, owns its data and exposes bounded progress',async()=>{
 const first=await sample(),saved=JSON.stringify(first),progress=[],second=await spinningGapSweep((n,total)=>progress.push([n,total]));
 assert.deepEqual(first,second);assert.deepEqual(progress,Array.from({length:36},(_,i)=>[i+1,36]));
 second.samples[0].worldOffsets[0][0]+=1;assert.equal(JSON.stringify(first),saved);
 await assert.rejects(spinningGapSweep(true));
});

test('independent spinning checks reject corrupted native bias and hinge Jacobian',async()=>{
 const mj=await getRuntime(),forward=mj.mj_forward;
 for(const field of ['bias','jacobian']){
  mj.mj_forward=(m,d)=>{forward(m,d);if(field==='bias')d.qfrc_bias[0]+=.01;else if(d.nefc)d.efc_J[2]+=.01;};
  try{await assert.rejects(spinningGapSweep(),field==='bias'?/force/:/jacobianLength/);}finally{mj.mj_forward=forward;}
 }
});
