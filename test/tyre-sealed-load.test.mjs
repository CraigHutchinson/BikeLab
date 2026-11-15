import test from 'node:test';
import assert from 'node:assert/strict';
import {preset} from '../dist/moving-wheel.js';
import {createSweptCasing} from '../dist/sealed-casing.js';
import {solveSealedPlane,BUDGETS} from '../scripts/lib/tyre-sealed-load.mjs';
const config=(nodes=32,pressure=160000)=>({...preset('sealed').casing,nodes,gaugePressure:pressure});
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} vs ${b}, budget ${t}`);
test('static surface contact satisfies unilateral KKT, decomposition and value-function reaction',()=>{
 for(const n of [32,64])for(const pressure of [120000,160000,200000]){
  const c=config(n,pressure),m=createSweptCasing(c),height=m.reference.radius-.001,s=solveSealedPlane(c,height);
  assert.ok(s.converged);assert.ok(s.locallyAdmissible);assert.ok(s.metrics.maxKktForce<=BUDGETS.force);assert.ok(s.metrics.minGap>=-BUDGETS.gap);
  assert.ok(s.contacts.every(a=>a.reaction>=0));near(s.materialReaction+s.gasReaction,s.reaction,2*n*BUDGETS.force);assert.ok(s.state.gaugePressure>pressure);
  for(const h of [2e-7,1e-7]){const a=solveSealedPlane(c,height+h,s.coordinates),b=solveSealedPlane(c,height-h,s.coordinates);assert.ok(a.converged&&b.converged);near(-(a.state.potential-b.state.potential)/(2*h),s.reaction,.002);}
  // Every transverse vertex is a convex combination of bead and crown.
  const H=Math.max(...c.section.map(p=>p[1]));for(let i=0;i<n;i++)for(const [,z] of c.section){const alpha=z/H;assert.ok(height+(1-alpha)*c.rimRadius*m.directions[2*i+1]+alpha*s.coordinates[2*i+1]>=-BUDGETS.gap);}
 }
});
test('load and unload retrace the conservative branch and alternate starts agree',()=>{
 for(const nodes of [32,64]){
  const c=config(nodes),R=createSweptCasing(c).reference.radius,states=[];let q;
  for(const d of [0,.0005,.001,.0015,.002,.0015,.001,.0005,0]){const s=solveSealedPlane(c,R-d,q);assert.ok(s.converged,s.reason);states.push(s);q=s.coordinates;}
  for(let i=0;i<4;i++){const a=states[i],b=states[8-i];near(a.reaction,b.reaction,.001);near(a.state.potential,b.state.potential,1e-8);for(let j=0;j<a.coordinates.length;j++)near(a.coordinates[j],b.coordinates[j],1e-8);}
  const perturbed=states[2].coordinates.map((v,i)=>v+1e-5*Math.sin(i));const alternate=solveSealedPlane(c,R-.001,perturbed);assert.ok(alternate.converged);near(alternate.reaction,states[2].reaction,.001);
 }
});
test('compression and failed refinement are retained despite converged positive tangents',()=>{
 const a=config(32),b=config(64),ra=createSweptCasing(a).reference.radius,rb=createSweptCasing(b).reference.radius;
 const coarse=solveSealedPlane(a,ra-.002),fine=solveSealedPlane(b,rb-.002);assert.ok(coarse.converged&&fine.converged);assert.ok(Math.abs(fine.reaction-coarse.reaction)>100,'Known refinement failure must stay visible');
 const rejected=solveSealedPlane(b,rb-.003);assert.ok(rejected.converged);assert.equal(rejected.locallyAdmissible,false);assert.equal(rejected.admission,'compressive-resultant');assert.ok(rejected.state.compressiveCells>0);assert.equal(rejected.stability.classification,'positive-with-refinement-margin');
});
test('static solver owns reports, repeats deterministically, and rejects invalid or exhausted work',()=>{
 const c=config(),R=createSweptCasing(c).reference.radius,r=solveSealedPlane(c,R-.001);assert.deepEqual(solveSealedPlane(c,R-.001),r);const original=r.coordinates[0];r.state.forces[0]=999;r.coordinates[0]=999;assert.equal(solveSealedPlane(c,R-.001).coordinates[0],original);
 for(const h of [NaN,c.rimRadius,R+.1])assert.throws(()=>solveSealedPlane(c,h));
 assert.throws(()=>solveSealedPlane(c,R,[],{}));assert.throws(()=>solveSealedPlane(c,R,undefined,{unknown:1}));assert.throws(()=>solveSealedPlane(c,R,undefined,{maxIterations:-1}));
 const exhausted=solveSealedPlane(c,R-.001,undefined,{maxIterations:0});assert.equal(exhausted.converged,false);assert.equal(exhausted.locallyAdmissible,false);assert.equal(exhausted.reason,'iteration-limit');assert.equal(exhausted.stability.classification,'not-evaluated');
});
