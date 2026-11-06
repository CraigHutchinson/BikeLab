import test from 'node:test';
import assert from 'node:assert/strict';
import {solveMeridianEquilibrium,inspectEquilibriumTangent,BUDGETS} from '../scripts/lib/tyre-equilibrium.mjs';
import {createMeridianDiagnostic} from '../scripts/lib/tyre-meridian.mjs';
import {meridianFixture,circularMeridian} from '../scripts/lib/tyre-meridian-fixture.mjs';
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} != ${b}`);
test('pressure continuation reaches fixed-bead local equilibrium with decreasing energy',()=>{
 for(const n of [8,16]){
  let initial=meridianFixture(n).restPoints;
  for(const p of [80000,160000,240000]){
   const c={...meridianFixture(n),gaugePressure:p},r=solveMeridianEquilibrium(c,initial);
   assert.equal(r.converged,true,r.reason);assert.ok(r.metrics.maxForce<=BUDGETS.force&&r.metrics.maxForcePerArea<=BUDGETS.forcePerArea);
   assert.equal(r.state.compressiveSegments,0);assert.deepEqual(r.points[0],c.restPoints[0]);assert.deepEqual(r.points.at(-1),c.restPoints.at(-1));
   for(const [i,h] of r.history.entries()){
    if(h.acceptance==='armijo'){assert.ok(h.potential<=h.armijoBound);assert.ok(h.potential<h.potentialBefore);}
    else {assert.equal(h.acceptance,'roundoff-residual');assert.ok(h.potential<=h.potentialBefore+h.energyAllowance);const after=r.history[i+1]??r.metrics;assert.ok(after.maxForce<h.maxForce/2&&after.maxForcePerArea<h.maxForcePerArea/2);}
   }
   near(r.state.forces.reduce((s,f)=>s+f[0],0),0,1e-8);initial=r.points;
  }
 }
});
test('regularized descent is not an unshifted stability finding',()=>{
 const c=meridianFixture(8),initial=inspectEquilibriumTangent(c,c.restPoints),r=solveMeridianEquilibrium(c),stable=inspectEquilibriumTangent(c,r.points);
 assert.equal(initial.classification,'indeterminate');assert.ok(r.history.some(h=>h.shift>0));
 assert.equal(stable.classification,'positive-with-refinement-margin');assert.ok(stable.eigenvalueLowerBound>10*stable.errorEstimate);
 const m=createMeridianDiagnostic(c),energy=r.state.potential;
 for(const sign of [-1,1]){const q=structuredClone(r.points);for(let i=1;i<q.length-1;i++){q[i][0]+=sign*1e-6*Math.sin(i);q[i][1]+=sign*1e-6*Math.cos(i);}
  assert.ok(m.evaluate(q).potential>energy);
 }
});
test('mesh and different initial shapes approach the same admitted equilibrium',()=>{
 const rows=[8,16,32,64].map(n=>{const c=meridianFixture(n),r=solveMeridianEquilibrium(c);assert.ok(r.converged,r.reason);return r;});
 const fine=rows.at(-1).state.volume;
 assert.ok(Math.abs(rows[2].state.volume-fine)<Math.abs(rows[1].state.volume-fine));
 assert.ok(Math.abs(rows[1].state.volume-fine)<Math.abs(rows[0].state.volume-fine));
 const alternate=solveMeridianEquilibrium(meridianFixture(16),circularMeridian(.051,16));assert.ok(alternate.converged,alternate.reason);
 near(alternate.state.volume,rows[1].state.volume,1e-11);
 for(let i=0;i<alternate.points.length;i++)for(let k=0;k<2;k++)near(alternate.points[i][k],rows[1].points[i][k],1e-9);
});
test('zero-pressure reference, budget exhaustion and invalid constraints remain distinct',()=>{
 const c=meridianFixture(8),zero=solveMeridianEquilibrium({...c,gaugePressure:0});assert.ok(zero.converged);assert.equal(zero.iterations,0);
 const limit=solveMeridianEquilibrium(c,c.restPoints,{maxIterations:0});assert.equal(limit.converged,false);assert.equal(limit.reason,'iteration-limit');
 const search=solveMeridianEquilibrium(c,c.restPoints,{maxBacktracks:0});assert.equal(search.converged,false);assert.equal(search.reason,'line-search-exhausted');
 const bad=structuredClone(c.restPoints);bad[0][0]+=.001;assert.throws(()=>solveMeridianEquilibrium(c,bad));
 assert.throws(()=>solveMeridianEquilibrium(c,c.restPoints,{forceTolerance:1}));
 assert.throws(()=>solveMeridianEquilibrium(c,c.restPoints,{maxIterations:NaN}));
 assert.throws(()=>solveMeridianEquilibrium(meridianFixture(128)));
});
test('solver output owns its inputs and replay is deterministic',()=>{
 const c=meridianFixture(8),q=structuredClone(c.restPoints),before=structuredClone(q),r=solveMeridianEquilibrium(c,q);
 assert.deepEqual(q,before);const second=solveMeridianEquilibrium(c,q);assert.deepEqual(r,second);
 r.points[1][0]=999;r.state.forces[0][0]=999;assert.notEqual(second.points[1][0],999);assert.notEqual(second.state.forces[0][0],999);
});
