import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PLANE_MODEL,PLANE_NUMERICS,PLANE_STEPS,RK4_MODEL,RK4_NUMERICS,MODEL,MEASUREMENT,validate,modelXML,run,replay,inputFromRecord} from '../dist/tyre-fixture.js';
import {fixtureControls} from '../dist/tyre-fixture-ui.js';
import {runLoaded} from '../scripts/casing-loaded.mjs';
import {getRuntime} from '../dist/moving-wheel.js';
const examples=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))).cases;
function input(index=0){const a=structuredClone(examples[index].input);a.numerics={...PLANE_NUMERICS};a.motion={dt:PLANE_STEPS[0],duration:.001,sampleDt:.000125};a.measurement={format:MEASUREMENT,binDt:.001,window:null};return a;}

test('plane policy cannot reinterpret mesh records or exceed its received horizon and clocks',async()=>{
 const a=input();assert.match(modelXML(a),/type="plane"/);assert.doesNotMatch(modelXML(a),/type="mesh"/);
 for(const mutate of [a=>delete a.numerics.contact,a=>a.numerics.format=RK4_NUMERICS.format,a=>a.numerics.contact='mesh',a=>a.motion.duration=.1,a=>a.motion.dt=.00000390625,a=>a.motion.dt=.00000048828125,a=>a.seed.profile.points[1][1]=.01]){const bad=input();mutate(bad);assert.throws(()=>validate(bad));}
 const accessor=input();Object.defineProperty(accessor.numerics,'contact',{enumerable:true,get(){throw Error('getter invoked');}});assert.throws(()=>validate(accessor),/non-data numerics/);
 const r=await run(a);assert.equal(r.status,'completed');assert.equal(r.model,PLANE_MODEL);assert.deepEqual(await replay(r),r);assert.ok(r.frames.every(f=>f.contacts.every(c=>c.edge===-1&&c.vertex>=0)));
 for(const mutate of [r=>r.model=MODEL,r=>r.model=RK4_MODEL,r=>r.numericalPolicy.contact='mesh',r=>delete r.scenario.numerics.contact]){const bad=structuredClone(r);mutate(bad);assert.throws(()=>inputFromRecord(bad));}
 const domain=input();domain.seed.profile.points=[[-4,0],[6,0]];const other=await run(domain);assert.notEqual(other.identity,r.identity);assert.deepEqual(other.finalNodes,r.finalNodes);
 const mesh=input();mesh.numerics={...RK4_NUMERICS};assert.notEqual((await run(mesh)).identity,r.identity);
});

test('all supplied wheels and rates retain independent plane diagnostic state and work',async()=>{
 for(let i=0;i<4;i++)for(const rates of ['imported','zero']){
  const a=input(i);a.rates=rates;const r=await run(a),legacy=structuredClone(examples[i].input);legacy.rates=rates;const d=await runLoaded(legacy,{dt:a.motion.dt,contactGeometry:'plane'});
  assert.equal(r.status,'completed');assert.deepEqual(r.finalNodes.q,d.finalNodes.q);assert.deepEqual(r.finalNodes.v,d.finalNodes.v);
  for(let j=0;j<r.frames.length;j++){assert.equal(r.frames[j].contactWork,d.frames[j].contactWork);assert.equal(r.frames[j].dampingLoss,d.frames[j].dampingLoss);assert.ok(Math.abs(r.frames[j].residual-d.frames[j].residual)<1e-12);assert.ok(Math.abs(r.frames[j].ground[1]-d.frames[j].verticalForce)<1e-9);}
 }
});

test('plane keeps finite terrain/rim guards and rejects bad stage contacts without losing accepted work',async()=>{
 const outside=input();outside.seed.hub.position[0]=9;const rejected=await run(outside);assert.equal(rejected.status,'initial-state-rejected');assert.match(rejected.termination.reason,/authored-domain/);
 const rim=input();rim.seed.hub.position[2]=.2;assert.match((await run(rim)).termination.reason,/rim-contact/);
 const mj=await getRuntime(),forward=mj.mj_forwardSkip,clean=await run(input());let calls=0;
 mj.mj_forwardSkip=(m,d,stage,sensors)=>{forward(m,d,stage,sensors);if(++calls===3*64+2)d.geom_xpos[2]+=.01;};
 let r;try{r=await run(input());}finally{mj.mj_forwardSkip=forward;}
 assert.equal(r.status,'terminated');assert.equal(r.summary.steps,64);assert.match(r.termination.reason,/Vertex-plane gap mismatch/);assert.deepEqual(r.frames,clean.frames.slice(0,2));assert.equal(r.summary.finalEnergy,r.frames.at(-1).energy);
});

test('controls retain plane policy and require an explicit change for longer mesh/legacy runs',()=>{
 const a=fixtureControls(examples[0].input,{solver:'plane',rates:'zero',dt:PLANE_STEPS[0],duration:.02,measure:true});assert.deepEqual(a.numerics,PLANE_NUMERICS);
 const fine=fixtureControls(a,{rates:'imported',dt:PLANE_STEPS[1],duration:.02,measure:true});assert.deepEqual(fine.numerics,PLANE_NUMERICS);
 assert.throws(()=>fixtureControls(a,{rates:'zero',dt:PLANE_STEPS[0],duration:.1,measure:true}));
 const mesh=fixtureControls(a,{solver:'RK4',rates:'zero',dt:PLANE_STEPS[0],duration:.1,measure:true});assert.deepEqual(mesh.numerics,RK4_NUMERICS);
});

test('translated plane height and rotated local axes retain world force and signed work',async()=>{
 const a=input();a.seed.hub.quaternion=[Math.cos(.001/2),0,Math.sin(.001/2),0];
 const b=structuredClone(a);b.seed.hub.position[2]+=.75;for(const p of b.seed.profile.points)p[1]+=.75;
 const x=await run(a),y=await run(b),legacy=structuredClone(b);delete legacy.numerics;legacy.motion={...examples[0].input.motion};delete legacy.measurement;
 const d=await runLoaded(legacy,{dt:a.motion.dt,contactGeometry:'plane'});assert.equal(x.status,'completed');assert.equal(y.status,'completed');assert.deepEqual(y.finalNodes.q,d.finalNodes.q);assert.deepEqual(y.finalNodes.v,d.finalNodes.v);
 for(const key of ['q','v'])assert.ok(Math.max(...x.finalNodes[key].map((v,i)=>Math.abs(v-y.finalNodes[key][i])))<(key==='q'?1e-12:1e-9));
 assert.ok(Math.abs(y.summary.initialEnergy-x.summary.initialEnergy-.75*a.seed.gravity*a.seed.wheel.tyreMass)<1e-12);
 for(let i=0;i<y.frames.length;i++){assert.equal(y.frames[i].contactWork,d.frames[i].contactWork);assert.ok(Math.abs(y.frames[i].ground[1]-d.frames[i].verticalForce)<1e-9);}
});
