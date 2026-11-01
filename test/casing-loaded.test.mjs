import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runLoaded,createLoadedGuard,compareLoaded,STEPS} from '../scripts/casing-loaded.mjs';
import {createStageObserver} from '../dist/casing-rk4-observer.js';
import {getRuntime} from '../dist/moving-wheel.js';
import {modelXML} from '../dist/tyre-fixture.js';
const examples=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))).cases;
const input=(i=0)=>structuredClone(examples[i].input);
const difference=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));

test('loaded native stage work covers both bikes/wheels and independent force/energy/power maps',async()=>{
 for(let i=0;i<4;i++)for(const rates of ['imported','zero']){
  const a=input(i);a.rates=rates;const r=await runLoaded(a,{duration:.000125});assert.equal(r.status,'completed');assert.equal(r.summary.stageObservations,4*r.summary.steps);assert.ok(r.summary.stageMinContacts>0);assert.ok(r.summary.maxResidual<1e-10);assert.ok(r.frames.at(-1).dampingLoss>=0);assert.ok(r.frames.at(-1).verticalImpulse>0);
  assert.ok(Object.values(r.summary.maxObserver).every(x=>x===0));assert.ok(r.summary.maxContactPowerError<1e-10);
 }
});

test('observer does not feed state into native and preserves native fourth-stage warm starts',async()=>{
 const a=input(1),r=await runLoaded(a,{duration:.000125}),mj=await getRuntime(),m=mj.MjModel.from_xml_string(modelXML(a).replace('integrator="implicitfast"','integrator="RK4"'));let d;
 try{m.opt.timestep=STEPS[0];d=new mj.MjData(m);d.qpos.set(a.seed.q);d.qvel.set(a.seed.v);for(let i=0;i<r.summary.steps;i++){mj.mj_step(m,d);mj.mj_forward(m,d);}assert.deepEqual(r.finalNodes,{q:Array.from(d.qpos),v:Array.from(d.qvel),warmstart:Array.from(d.qacc_warmstart)});assert.ok(d.qacc_warmstart.some(x=>Math.abs(x)>1e-3));}finally{d?.delete();m.delete();}
 assert.deepEqual(await runLoaded(a,{duration:.000125}),r);
});

test('native mismatch or warning preserves first/later/off-grid accepted state and work',async()=>{
 const a=input(),clean=await runLoaded(a),mj=await getRuntime(),step=mj.mj_step;
 for(const tick of [1,33,34])for(const warning of [false,true]){
  let count=0,accepted={q:a.seed.q,v:a.seed.v,warmstart:Array(a.seed.q.length).fill(0)};
  mj.mj_step=(m,d)=>{if(++count===tick)accepted={q:Array.from(d.qpos),v:Array.from(d.qvel),warmstart:Array.from(d.qacc_warmstart)};step(m,d);if(count===tick){if(warning){const w=d.warning,s=w.get(0);try{s.number=1;w.set(0,s);}finally{s.delete();}}else d.qvel[0]+=.001;}};
  let r;try{r=await runLoaded(a);}finally{mj.mj_step=step;}
  assert.equal(r.status,'terminated');assert.equal(r.summary.steps,tick-1);assert.equal(r.summary.stageObservations,4*(tick-1));assert.deepEqual(r.finalNodes,accepted);assert.match(r.termination.reason,warning?/warning/:/mismatch/);const prefix=clean.frames.filter(f=>f.tick<=tick-1);
  assert.deepEqual(r.frames.slice(0,prefix.length),prefix);assert.equal(r.frames.at(-1).tick,tick-1);assert.equal(r.nativeWarnings.length,warning?1:0);
 }
});

test('stage rejection and invalid-input rejection restore the current trial snapshot',async()=>{
 const a=input(),mj=await getRuntime(),m=mj.MjModel.from_xml_string(modelXML(a).replace('integrator="implicitfast"','integrator="RK4"'));let d,observer;
 try{
  m.opt.timestep=STEPS[0];d=new mj.MjData(m);d.qpos.set(a.seed.q);d.qvel.set(a.seed.v);mj.mj_forward(m,d);const guard=createLoadedGuard(mj,m,a);let reject=false;
  observer=createStageObserver(mj,m,(s,index,old)=>{if(reject&&index===2)throw Error('Injected stage-three domain exit');return guard.observe(s,old);});
  assert.throws(()=>observer.restore(d),/backup/);
  for(let i=0;i<3;i++){observer.predict(d);mj.mj_step(m,d);observer.compare(d);mj.mj_forward(m,d);}
  const q=Array.from(d.qpos),v=Array.from(d.qvel),warm=Array.from(d.qacc_warmstart),time=d.time;reject=true;assert.throws(()=>observer.predict(d),/stage-three/);observer.restore(d);assert.deepEqual(Array.from(d.qpos),q);assert.deepEqual(Array.from(d.qvel),v);assert.deepEqual(Array.from(d.qacc_warmstart),warm);assert.equal(d.time,time);
  reject=false;d.qfrc_applied[0]=1;assert.throws(()=>observer.predict(d),/Applied work/);d.qpos[0]+=1;observer.restore(d);assert.deepEqual(Array.from(d.qpos),q);assert.equal(d.qfrc_applied[0],1);assert.equal(d.time,time);
 }finally{observer?.dispose();d?.delete();m.delete();}
});

test('loaded balance and characteristic scale are invariant to the world-height datum',async()=>{
 const a=input(),b=input();b.seed.hub.position[2]+=1;for(const p of b.seed.profile.points)p[1]+=1;
 const x=await runLoaded(a,{duration:.000125}),y=await runLoaded(b,{duration:.000125});assert.equal(y.status,'completed');assert.ok(Math.abs(y.summary.initialEnergy-x.summary.initialEnergy-a.seed.gravity)<1e-12);assert.ok(Math.abs(y.summary.energyScale-x.summary.energyScale)<1e-12);assert.ok(difference(x.finalNodes.q,y.finalNodes.q)<1e-12);assert.ok(difference(x.finalNodes.v,y.finalNodes.v)<1e-9);assert.ok(Math.abs(x.frames.at(-1).contactWork-y.frames.at(-1).contactWork)<1e-10);
 for(const options of [{dt:.01},{duration:1},{bogus:true}])await assert.rejects(runLoaded(a,options));
});

test('analytic-plane isolation has its own identity and retains finite terrain guards',async()=>{
 const a=input(),plane=await runLoaded(a,{duration:.000125,contactGeometry:'plane'}),mesh=await runLoaded(a,{duration:.000125});
 assert.equal(plane.status,'completed');assert.notEqual(plane.model,mesh.model);assert.notEqual(plane.xmlSha256,mesh.xmlSha256);assert.equal(plane.diagnostic.finiteProfileGuardRetained,true);assert.equal(plane.summary.stageMinContacts,5);assert.ok(plane.summary.maxResidual<1e-10);
 a.seed.hub.position[0]=9;await assert.rejects(runLoaded(a,{duration:.000125,contactGeometry:'plane'}),/authored-domain/);await assert.rejects(runLoaded(input(),{contactGeometry:'unknown'}));
});

test('refinement refuses different contact models or authored inputs',async()=>{
 const a=await runLoaded(input(),{duration:.000125,comparison:true}),b=await runLoaded(input(),{duration:.000125,dt:STEPS[1],comparison:true});
 assert.equal(compareLoaded(a,b).samples,33);
 const changed=structuredClone(b);changed.model='different-contact-law';assert.throws(()=>compareLoaded(a,changed),/contact model/);changed.model=b.model;changed.input.seed.gravity+=1;assert.throws(()=>compareLoaded(a,changed),/authored inputs/);
});
