import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MODEL,RK4_MODEL,RK4_NUMERICS,RK4_STEPS,MEASUREMENT,validate,modelXML,run,replay,inputFromRecord} from '../dist/tyre-fixture.js';
import {fixtureControls} from '../dist/tyre-fixture-ui.js';
import {runLoaded} from '../scripts/casing-loaded.mjs';
import {controlInput} from '../scripts/casing-derivative.mjs';
import {oscillatorState} from '../dist/suspension-reference.js';
import {getRuntime} from '../dist/moving-wheel.js';
const example=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))).cases[0].input;
function input(){const a=structuredClone(example);a.numerics={...RK4_NUMERICS};a.motion={dt:RK4_STEPS[0],duration:.001,sampleDt:.000125};a.measurement={format:MEASUREMENT,binDt:.001,window:null};return a;}

test('RK4 policy is explicit, rejects unqualified clocks and cannot reinterpret legacy records',async()=>{
 const a=input();assert.match(modelXML(a),/integrator="RK4"/);assert.match(modelXML(example),/integrator="implicitfast"/);
 for(const mutate of [a=>delete a.numerics,a=>a.numerics.integrator='implicitfast',a=>a.numerics.extra=1,a=>a.motion.dt=.00000390625,a=>a.numerics.work='trapezoid']){const bad=input();mutate(bad);assert.throws(()=>validate(bad));}
 const r=await run(a);assert.equal(r.model,RK4_MODEL);assert.equal(r.status,'completed');assert.deepEqual(await replay(r),r);assert.equal(r.numericalPolicy.dt,a.motion.dt);assert.equal(r.observation.intervals.length,1);
 for(const mutate of [r=>r.model=MODEL,r=>delete r.numericalPolicy,r=>r.numericalPolicy.dt*=2,r=>r.numericalPolicy.stageComparisonBudgets.position=1]){const bad=structuredClone(r);mutate(bad);assert.throws(()=>inputFromRecord(bad));}
 const bad=input();bad.seed.hub.position[2]=.2;const rejected=await run(bad);assert.equal(rejected.status,'initial-state-rejected');assert.deepEqual(rejected.frames,[]);assert.equal(rejected.summary.steps,0);
});

test('runtime path matches loaded diagnostic q/v and stage ledgers',async()=>{
 for(const rates of ['imported','zero']){
  const a=input();a.rates=rates;const r=await run(a),legacy=structuredClone(example);legacy.rates=rates;const diagnostic=await runLoaded(legacy,{dt:a.motion.dt});
  assert.deepEqual(r.finalNodes.q,diagnostic.finalNodes.q);assert.deepEqual(r.finalNodes.v,diagnostic.finalNodes.v);
  for(let i=0;i<r.frames.length;i++){assert.equal(r.frames[i].dampingLoss,diagnostic.frames[i].dampingLoss);assert.equal(r.frames[i].contactWork,diagnostic.frames[i].contactWork);assert.ok(Math.abs(r.frames[i].residual-diagnostic.frames[i].residual)<1e-12);}
 }
});

test('corrected runtime preserves the physical uniform damping null mode',async()=>{
 const a=await controlInput({nodes:32,edgeViscosity:3});a.numerics={...RK4_NUMERICS};a.motion={...input().motion};a.measurement={...input().measurement};const r=await run(a),mj=await getRuntime(),m=mj.MjModel.from_xml_string(modelXML(a));
 try{const exact=new Float64Array(2);oscillatorState(a.seed.wheel.tyreMass/32,m.jnt_stiffness[0],0,.001,.01,.001,exact);assert.equal(r.status,'completed');for(let i=0;i<32;i++){assert.ok(Math.abs(r.finalNodes.q[2*i]-exact[0])<1e-11);assert.ok(Math.abs(r.finalNodes.v[2*i]-exact[1])<1e-8);}assert.ok(r.frames.at(-1).dampingLoss<1e-15);assert.equal(r.frames.at(-1).contactWork,0);}finally{m.delete();}
});

test('corrected runtime rejects intermediate geometry and restores accepted prefixes',async()=>{
 const a=input(),mj=await getRuntime(),forward=mj.mj_forwardSkip,clean=await run(a);let calls=0;
 mj.mj_forwardSkip=(m,d,stage,sensors)=>{forward(m,d,stage,sensors);if(++calls===3*64+2)d.qpos[0]=.1;};let r;
 try{r=await run(a);}finally{mj.mj_forwardSkip=forward;}
 assert.equal(r.status,'terminated');assert.equal(r.summary.steps,64);assert.match(r.termination.reason,/displacement/);assert.deepEqual(r.frames,clean.frames.slice(0,2));assert.deepEqual(r.summary,{...clean.summary,steps:64,acceptedTime:r.frames.at(-1).time,finalEnergy:r.frames.at(-1).energy,maxResidual:r.summary.maxResidual,maxForceResidual:r.summary.maxForceResidual,peakForce:r.summary.peakForce});
 assert.ok(r.summary.maxResidual<=clean.summary.maxResidual);
});

test('viewer controls select and preserve the versioned policy and aligned schedules',()=>{
 const a=fixtureControls(example,{solver:'RK4',rates:'zero',dt:RK4_STEPS[0],duration:.02,measure:true});assert.deepEqual(a.numerics,RK4_NUMERICS);assert.equal(a.motion.dt,RK4_STEPS[0]);
 const fine=fixtureControls(a,{rates:'imported',dt:RK4_STEPS[1],duration:.1,measure:true});assert.deepEqual(fine.numerics,RK4_NUMERICS);assert.equal(fine.measurement.window.endTick,102400);
 const legacy=fixtureControls(a,{solver:'legacy',rates:'zero',dt:.00003125,duration:.02,measure:false});assert.equal(legacy.numerics,undefined);assert.equal(legacy.measurement,undefined);assert.throws(()=>fixtureControls(a,{solver:'unknown'}));
});

test('RK4 rejects initial warnings and limits on another solver island before recording',async()=>{
 const mj=await getRuntime(),forward=mj.mj_forward;
 for(const warning of [true,false]){
  let injected=false;mj.mj_forward=(m,d)=>{forward(m,d);if(!injected){injected=true;if(warning){const w=d.warning,s=w.get(0);try{s.number=1;s.lastinfo=42;w.set(0,s);}finally{s.delete();}}else d.solver_niter[1]=m.opt.iterations;}};
  let r;try{r=await run(input());}finally{mj.mj_forward=forward;}
  assert.equal(r.status,'initial-state-rejected');assert.equal(r.frames.length,0);assert.equal(r.summary.steps,0);assert.equal(r.termination.reason,warning?'native-warning':'native-solver-iteration-limit');assert.equal(r.attemptedWarnings.native.length,warning?1:0);
 }
});
