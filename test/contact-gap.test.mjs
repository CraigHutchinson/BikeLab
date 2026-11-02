import test from 'node:test';
import assert from 'node:assert/strict';
import {gapSweep,gapXML} from '../scripts/contact-gap.mjs';

test('mesh constraint velocity follows inverse-distance weights rather than actual gap derivative',async()=>{
 const r=await gapSweep();assert.equal(r.samples.length,18);
 for(const s of r.samples){const force=[0,0,0,0];assert.ok(Math.abs(s.powerDifference)<1e-12);for(const c of s.contacts){assert.ok(c.force>=0);assert.ok(Math.abs(c.rowVelocity-c.weightedVelocity)<1e-12);assert.ok(Math.abs(c.weights[0]+c.weights[1]-1)<1e-15);for(let i=0;i<2;i++){force[2*i]+=c.weights[i]*c.force*c.normal[0];force[2*i+1]+=c.weights[i]*c.force*c.normal[2];}}for(let j=0;j<4;j++)assert.ok(Math.abs(force[j]-s.forces[j])<1e-10);}
 for(const s of r.samples.filter(s=>s.kind==='mesh'&&Math.abs(s.delta)>=1e-6)){
  assert.equal(s.contacts.length,1);const c=s.contacts[0];assert.equal(c.element,0);assert.equal(c.vertex,-1);assert.ok(Math.abs(c.normal[0])<1e-9);assert.ok(Math.abs(c.normal[2]-1)<1e-12);assert.ok(Math.abs(c.gap-s.analyticGap)<1e-10);
  assert.ok(Math.abs(s.finiteDifference-c.exactGapDerivative)<1e-8);assert.ok(Math.abs(c.derivativeMismatch)>.0032);assert.ok(Math.abs(c.derivativeMismatch)<.0033);
 }
 assert.equal(r.samples.find(s=>s.kind==='mesh'&&s.delta===0).contacts[0].exactGapDerivative,null);
});

test('plane rows have exact vertex gap derivatives including the equal-height configuration',async()=>{
 const r=await gapSweep();for(const s of r.samples.filter(s=>s.kind==='plane')){
  assert.equal(s.contacts.length,2);assert.deepEqual(s.contacts.map(c=>c.vertex),[0,1]);
  for(const c of s.contacts){assert.equal(c.element,-1);assert.deepEqual(c.normal,[0,0,1]);assert.equal(c.rowVelocity,c.exactGapDerivative);assert.equal(c.derivativeMismatch,0);assert.ok(Math.abs(c.gap-(s.positions[3*c.vertex+2]-r.parameters.radius))<1e-15);}
 }
 assert.throws(()=>gapXML('sphere'));
});

test('prescribed contact sweep is deterministic and leaves its returned data owned',async()=>{
 const a=await gapSweep(),saved=JSON.stringify(a),b=await gapSweep();assert.deepEqual(a,b);b.samples[0].positions[0]+=1;assert.equal(JSON.stringify(a),saved);
});
