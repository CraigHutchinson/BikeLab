import test from 'node:test';
import assert from 'node:assert/strict';
import {runRK4Screen,SCREEN,OBSERVER_BUDGETS} from '../scripts/casing-rk4.mjs';
import {createGeometricRK4} from '../scripts/casing-refinement.mjs';
import {getRuntime} from '../dist/moving-wheel.js';
import {oscillatorState} from '../dist/suspension-reference.js';

test('native RK4 retains failing timesteps and separately screens state and stage work',async()=>{
 const r=await runRK4Screen({duration:.000125});
 assert.deepEqual(r.screenBudgets,SCREEN);assert.ok(r.referenceComparisons.every(c=>c.withinBudgets));
 assert.ok(r.cases.some(c=>!c.screenPassed));assert.ok(r.cases.some(c=>c.screenPassed));
 for(const c of r.cases){
  for(const key of Object.keys(SCREEN))assert.equal(c.checks[key],c.normalized[key]<=SCREEN[key]);
  for(const key of Object.keys(OBSERVER_BUDGETS))assert.ok(c.maxObserver[key]<=OBSERVER_BUDGETS[key]);
  assert.ok(c.endpoint.stageLoss>0);assert.ok(c.frames.every(f=>f.stageLoss>=0));
 }
 assert.deepEqual(await runRK4Screen({duration:.000125}),r);
});

test('native RK4 preserves both uniform null modes against the exact oscillator',async()=>{
 for(const mode of ['x','z']){
  const r=await runRK4Screen({nodes:32,edgeViscosity:.5,mode,duration:.001}),exact=new Float64Array(2),axis=mode==='z'?1:0;
  oscillatorState(r.physical.mass,r.physical.k,0,.001,.01,r.diagnosticDuration,exact);
  for(const c of r.cases){
   assert.equal(c.screenPassed,true);assert.ok(c.endpoint.stageLoss<1e-15);
   for(let j=0;j<c.finalNodes.q.length;j++){
    assert.ok(Math.abs(c.finalNodes.q[j]-(j%2===axis?exact[0]:0))<1e-9);
    assert.ok(Math.abs(c.finalNodes.v[j]-(j%2===axis?exact[1]:0))<1e-6);
   }
  }
 }
});

test('native/shadow disagreement preserves accepted state, frames and stage-work prefix',async()=>{
 const options={nodes:32,duration:.001},clean=await runRK4Screen(options),mj=await getRuntime(),step=mj.mj_step;
 for(const failingTick of [1,3,11]){
  let injected=false,native,accepted={q:clean.input.seed.q,v:clean.input.seed.v};
  mj.mj_step=(m,d)=>{step(m,d);native=d;if(m.opt.timestep===.00003125){const tick=Math.round(d.time/.00003125);if(!injected&&tick===failingTick-1)accepted={q:Array.from(d.qpos),v:Array.from(d.qvel)};if(!injected&&tick===failingTick){injected=true;d.qvel[0]+=.0001;}}};
  let r;try{r=await runRK4Screen(options);}finally{mj.mj_step=step;}
  const c=r.cases[0];assert.equal(injected,true);assert.equal(native.isDeleted(),true);assert.equal(c.status,'terminated');assert.equal(c.screenPassed,false);assert.equal(c.steps,failingTick-1);assert.match(c.termination.reason,/endpoint mismatch/);
  assert.deepEqual(c.finalNodes,accepted);const prefix=clean.cases[0].frames.filter(f=>f.tick<=c.steps);
  if(prefix.at(-1).tick===c.steps)assert.deepEqual(c.frames,prefix);
  else{assert.deepEqual(c.frames.slice(0,-1),prefix);assert.equal(c.frames.at(-1).tick,c.steps);assert.equal(c.frames.at(-1).time,c.steps*.00003125);assert.ok(c.endpoint.stageLoss>=prefix.at(-1).stageLoss);assert.ok(c.endpoint.stageLoss<=clean.cases[0].frames.find(f=>f.tick>c.steps).stageLoss);}
  assert.equal(c.endpoint.stageLoss,c.frames.at(-1).stageLoss);assert.deepEqual(r.cases.slice(1),clean.cases.slice(1));
 }
});

test('intermediate shadow domain rejection restores the preceding observation',()=>{
 const p={mass:.015625,k:10000,edgeK:15000,edgeC:15,rest:[-.15,1,.15,1],edges:[0,1],lengths:[.3],maxStrain:.25,maxDisplacement:.06},initial=new Float64Array([-.001,0,.001,0,-.01,0,.01,0,0]);let calls=0;
 const engine=createGeometricRK4(p,initial,()=>{if(++calls===3)throw Error('Injected intermediate domain rejection');}),energy=engine.observation.energy;
 assert.throws(()=>engine.step(.00003125),/intermediate/);assert.deepEqual(engine.state,initial);assert.equal(engine.observation.energy,energy);assert.equal(calls,4);
 engine.step(.00003125);assert.ok(engine.state.at(-1)>0);
});

test('finite native warning blocks a successful screen and invalid options fail early',async()=>{
 for(const options of [{nodes:1000000},{dt:.1},{mode:'contact'},{duration:NaN},null])await assert.rejects(runRK4Screen(options));
 const mj=await getRuntime(),step=mj.mj_step;let injected=false;
 mj.mj_step=(m,d)=>{step(m,d);if(!injected){injected=true;const w=d.warning,s=w.get(0);try{s.number=1;s.lastinfo=999;w.set(0,s);}finally{s.delete();}}};
 let r;try{r=await runRK4Screen({nodes:32,mode:'x',duration:.000125});}finally{mj.mj_step=step;}
 assert.equal(r.cases[0].status,'native-warning');assert.equal(r.cases[0].screenPassed,false);assert.deepEqual(r.cases[0].nativeWarnings,[{index:0,number:1,lastinfo:999}]);assert.ok(r.cases.slice(1).every(c=>c.screenPassed));
});
