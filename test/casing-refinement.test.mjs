import test from 'node:test';
import assert from 'node:assert/strict';
import {createGeometricRK4,geometricRhs,decompose,runRefinement} from '../scripts/casing-refinement.mjs';
import {oscillatorState} from '../dist/suspension-reference.js';

const pair=()=>({mass:.015625,k:10000,edgeK:15000,edgeC:15,rest:[-.15,1,.15,1],edges:[0,1],lengths:[.3],maxStrain:.25,maxDisplacement:.06});
const initial=()=>new Float64Array([-.001,0,.001,0,-.01,0,.01,0,0]);

test('independent Cartesian force and RK4 loss refine against the exact damped pair',()=>{
 const p=pair(),state=initial(),rhs=new Float64Array(9),observation={xyz:new Float64Array(6)};
 geometricRhs(p,state,rhs,observation);assert.ok(Math.abs(rhs[4]-2579.2)<1e-9);assert.ok(Math.abs(rhs[6]+2579.2)<1e-9);assert.ok(Math.abs(rhs[8]-.006)<1e-14);
 const results=[];
 for(const dt of [.00003125,.000015625]){
  const engine=createGeometricRK4(p,state),e0=engine.observation.energy,exact=new Float64Array(2);let position=0,velocity=0,loss=0;
  for(let tick=1;tick<=Math.round(.002/dt);tick++){
   engine.step(dt);oscillatorState(p.mass,p.k+2*p.edgeK,2*p.edgeC,.001,.01,tick*dt,exact);
   const exactEnergy=(p.k+2*p.edgeK)*exact[0]**2+p.mass*exact[1]**2;
   position=Math.max(position,Math.abs(engine.state[2]-exact[0]));velocity=Math.max(velocity,Math.abs(engine.state[6]-exact[1]));loss=Math.max(loss,Math.abs(engine.state[8]-(e0-exactEnergy)));
   assert.equal(engine.state[1],0);assert.equal(engine.state[3],0);assert.ok(Math.abs(engine.state[0]+engine.state[2])<1e-14);
  }
  results.push({position,velocity,loss});
 }
 for(const key of ['position','velocity','loss'])assert.ok(results[1][key]<.08*results[0][key],key+' fourth-order refinement');
 assert.ok(results[0].position<1e-8);assert.ok(results[0].velocity<1e-5);assert.ok(results[0].loss<1e-7);
});

test('reference failures do not commit a candidate and invalid inputs fail early',async()=>{
 const engine=createGeometricRK4(pair(),initial()),before=Array.from(engine.state),beforeEnergy=engine.observation.energy;
 assert.throws(()=>engine.step(1));assert.deepEqual(Array.from(engine.state),before);assert.equal(engine.observation.energy,beforeEnergy);
 assert.throws(()=>engine.step(NaN));assert.throws(()=>createGeometricRK4({...pair(),mass:0},initial()));
 for(const options of [{duration:Infinity},{nodes:10000000},{dt:.01},{edgeViscosity:NaN},null])await assert.rejects(runRefinement(options));
});

test('signed decomposition exposes cancellation rather than adding separate maxima',()=>{
 // Exact reference closes; Euler's energy and loss errors cancel in the residual.
 const r=decompose(10,6,4,5,5,5.5);
 assert.equal(r.residual,0);assert.equal(r.energyDifference,1);assert.equal(r.sampledPowerDifference,-1.5);assert.equal(r.referenceQuadrature,.5);assert.equal(r.closure,0);
});

test('matched-grid ring reference closes, converges and separates sampled-power quadrature',async()=>{
 const r=await runRefinement({nodes:32,duration:.000125});
 assert.equal(r.referenceLevels.length,3);assert.ok(r.referenceComparisons.every(c=>c.withinBudgets));assert.equal(r.cases.length,5);
 for(const c of r.cases){assert.ok(c.maxForceError<1e-8);assert.ok(c.maxNativeEnergyError<1e-12);assert.ok(c.maxima.closure<1e-16);assert.equal(c.frames.at(-1).time,.000125);assert.ok(c.maxima.referenceQuadrature>0);}
 for(let i=1;i<r.cases.length;i++){
  assert.ok(r.cases[i].maxPositionError<.6*r.cases[i-1].maxPositionError);assert.ok(r.cases[i].maxVelocityError<.6*r.cases[i-1].maxVelocityError);
  assert.ok(r.cases[i].maxima.referenceQuadrature<.3*r.cases[i-1].maxima.referenceQuadrature);
 }
 assert.deepEqual(await runRefinement({nodes:32,duration:.000125}),r);
});
