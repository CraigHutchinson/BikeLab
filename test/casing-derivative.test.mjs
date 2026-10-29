import test from 'node:test';
import assert from 'node:assert/strict';
import {auditCasingDerivative,controlInput} from '../scripts/casing-derivative.mjs';

test('pinned native audit isolates omitted sibling damping couplings with independent force differences',async()=>{
 for(const integrator of ['implicitfast','implicit']){
  const r=await auditCasingDerivative({nodes:32,integrator}),d=r.derivative;
  assert.equal(r.nativeVersion,'3.16.0');assert.equal(r.derivativeQualified,false);assert.equal(r.maxContacts,0);
  assert.ok(d.finiteDifferences.every(f=>f.geometryMaxError<1e-7&&f.nativeMaxError>1));
  assert.ok(d.presentMaxError<1e-10);assert.equal(d.omittedCount,256);assert.equal(d.omittedSameNode,0);assert.ok(d.omittedMax>1);
  for(const axis of ['x','z']){assert.ok(d.nullspace[axis].geometricMax<1e-10);assert.ok(d.nullspace[axis].forceMax<1e-10);assert.ok(d.nullspace[axis].nativeMax>1);}
  assert.ok(r.firstStep.explicitUniformity.nonuniformRms<1e-12);assert.ok(r.firstStep.nonuniformRms>1e-5);assert.ok(r.firstStep.sparsePredictionMaxError<1e-12);
 }
 // Translation remains a null damping mode even in a nonuniform shape;
 // its elastic force is deliberately not used as a uniform-motion reference.
 const warped=await auditCasingDerivative({nodes:32,deformed:true});
 assert.ok(warped.derivative.finiteDifferences.every(f=>f.geometryMaxError<1e-7));
 assert.ok(warped.derivative.nullspace.x.forceMax<1e-10);assert.ok(warped.firstStep.explicitUniformity.nonuniformRms>1e-4);
 assert.ok(warped.firstStep.sparsePredictionMaxError<1e-12);
});

test('zero-viscosity control retains the independent uniform oscillator recurrence',async()=>{
 const r=await auditCasingDerivative({nodes:32,edgeViscosity:0}),p=r.input.seed.wheel;
 assert.equal(r.derivativeQualified,true);assert.equal(r.derivative.nativeMaxError,0);assert.equal(r.derivative.omittedCount,0);
 // The fixture inherits the moving-wheel 0.36 m radius; its seed schema does
 // not contain a radius field. Canonical XML uses twelve significant digits.
 const stiffness=Number((p.foundation*2*Math.PI*(.36-p.skin)/p.nodes).toPrecision(12)),mass=p.tyreMass/p.nodes,dt=r.input.motion.dt;
 let q=.001,v=.01;for(let tick=0;tick<Math.round(r.input.motion.duration/dt);tick++){v-=dt*stiffness*q/mass;q+=dt*v;}
 assert.ok(Math.abs(r.end.mean[0]-v)<1e-11);assert.ok(Math.abs(r.end.mean[1])<1e-12);assert.ok(r.end.nonuniformRms<1e-10);
 await assert.rejects(controlInput({nodes:1e8}),/node count/);
 await assert.rejects(controlInput({dt:NaN}));
 await assert.rejects(controlInput({deformed:'yes'}));
 await assert.rejects(auditCasingDerivative({integrator:'RK4'}),/integrator/);
});
