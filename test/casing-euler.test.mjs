import test from 'node:test';
import assert from 'node:assert/strict';
import {linearAdmission,runEulerTrial,MODEL} from '../scripts/casing-euler.mjs';
import {getRuntime} from '../dist/moving-wheel.js';

test('Euler candidate rejects a viscosity-limited step that the stiffness-only rule admits',async()=>{
 const r=await runEulerTrial({nodes:128,edgeViscosity:3,mode:'alternating'});
 assert.equal(r.model,MODEL);assert.equal(r.status,'admission-rejected');assert.equal(r.summary.steps,0);assert.deepEqual(r.frames,[]);
 assert.ok(Math.sqrt(r.admission.stiffness)<.55);assert.ok(r.admission.score>4);
 assert.equal(linearAdmission({mass:1,kBound:1,cBound:0,dt:2}).admitted,false);
 assert.equal(linearAdmission({mass:1,kBound:1,cBound:0,dt:1}).admitted,true);
 for(const bad of [{mass:0},{kBound:NaN},{cBound:-1},{dt:Infinity}])assert.throws(()=>linearAdmission({mass:1,kBound:1,cBound:0,dt:1,...bad}));
 await assert.rejects(runEulerTrial({unknown:1}));
 await assert.rejects(runEulerTrial({kind:'pair',nodes:32}));
});

test('Euler retains uniform x/z motion with active edge viscosity and refines against an independent oscillator',async()=>{
 for(const mode of ['x','z']){
  const coarse=await runEulerTrial({nodes:32,mode}),fine=await runEulerTrial({nodes:32,mode,dt:.000015625});
  for(const r of [coarse,fine]){assert.equal(r.status,'completed');assert.ok(r.summary.maxNonuniformRms<1e-10);assert.ok(r.summary.dampingLoss<1e-15);assert.ok(r.summary.firstStepError<1e-12);assert.ok(r.summary.maxForceError<1e-8);assert.ok(r.summary.maxEnergyError<1e-10);}
  assert.ok(fine.summary.maxPositionError<.6*coarse.summary.maxPositionError);assert.ok(fine.summary.maxVelocityError<.6*coarse.summary.maxVelocityError);assert.ok(fine.summary.maxResidual<.6*coarse.summary.maxResidual);
 }
});

test('nonuniform damping remains active and the exact pair has the predicted discrete energy balance',async()=>{
 const ring=await runEulerTrial({mode:'alternating'});assert.equal(ring.status,'completed');assert.ok(ring.summary.dampingLoss>1e-5);assert.ok(ring.summary.maxForceError<1e-8);
 const coarse=await runEulerTrial({kind:'pair'}),fine=await runEulerTrial({kind:'pair',dt:.000015625});
 for(const r of [coarse,fine]){assert.equal(r.status,'completed');assert.ok(r.summary.dampingLoss>r.summary.initialEnergy*.9);assert.ok(r.summary.maxModifiedResidual<1e-11);assert.ok(r.summary.maxEnergyError<1e-10);}
 assert.ok(fine.summary.maxPositionError<.6*coarse.summary.maxPositionError);assert.ok(fine.summary.maxVelocityError<.6*coarse.summary.maxVelocityError);assert.ok(fine.summary.maxResidual<.6*coarse.summary.maxResidual);
 assert.deepEqual(await runEulerTrial({kind:'pair'}),coarse);
});

test('Euler rejected step rolls back accepted dynamics and work prefix',async()=>{
 const options={nodes:32},clean=await runEulerTrial(options),mj=await getRuntime(),forward=mj.mj_forward;let injected=false,native,acceptedNodes;
 mj.mj_forward=(m,d)=>{forward(m,d);native=d;if(!injected&&Math.round(d.time/.00003125)===4)acceptedNodes={q:Array.from(d.qpos),v:Array.from(d.qvel)};if(!injected&&Math.round(d.time/.00003125)===5){injected=true;d.qacc[0]=NaN;}};
 let stopped;try{stopped=await runEulerTrial(options);}finally{mj.mj_forward=forward;}
 assert.equal(injected,true);assert.equal(native.isDeleted(),true);assert.equal(stopped.status,'terminated');assert.equal(stopped.termination,'nonfinite-state');assert.equal(stopped.summary.steps,4);assert.equal(stopped.summary.acceptedTime,.000125);
 assert.deepEqual(stopped.frames,clean.frames.slice(0,2));assert.equal(stopped.summary.dampingLoss,stopped.frames.at(-1).dampingLoss);
 assert.deepEqual(stopped.finalNodes,acceptedNodes);assert.deepEqual(stopped.nativeWarnings,[]);
 assert.deepEqual(await runEulerTrial(options),clean);
});

test('finite native warnings remain visible and cannot receive completed status',async()=>{
 const mj=await getRuntime(),step=mj.mj_step;let injected=false;
 mj.mj_step=(m,d)=>{step(m,d);if(!injected){injected=true;const warnings=d.warning,stat=warnings.get(0);try{stat.number=1;stat.lastinfo=999;warnings.set(0,stat);}finally{stat.delete();}}};
 let result;try{result=await runEulerTrial({nodes:32});}finally{mj.mj_step=step;}
 assert.equal(result.status,'native-warning');assert.equal(result.summary.steps,640);assert.deepEqual(result.nativeWarnings,[{index:0,number:1,lastinfo:999}]);
});
