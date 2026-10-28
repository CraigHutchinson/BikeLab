import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MODEL,validate,modelXML,fromWindow,run,replay} from '../dist/tyre-fixture.js';
import {getRuntime,wheelParts,validate as validateWheel} from '../dist/moving-wheel.js';
import {run as runTrail} from '../dist/trail-bike.js';
import {TYRE_WINDOW} from '../dist/tyre-window.js';
const examples=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))).cases;
const example=(i=0)=>structuredClone(examples[i].input);
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b} (budget ${tol})`);

test('fixed-hub input admission owns complete arrays and rejects unsupported boundaries',()=>{
 const input=example(),copy=validate(input);input.seed.q[0]+=1;assert.notEqual(input.seed.q[0],copy.seed.q[0]);
 const patches=[a=>a.extra=1,a=>delete a.seed.v,a=>a.seed.q.pop(),a=>a.seed.v[0]=NaN,a=>delete a.seed.v[0],a=>a.seed.hub.quaternion=[1,0,.01,0],a=>a.seed.hub.position[1]=1e-12,a=>a.seed.source.nativeBuild='other',a=>a.seed.profile.points[1][1]=.1,a=>a.motion.duration=.2,a=>a.motion.sampleDt=.0001,a=>a.motion.dt=.00003,a=>a.rates='clamped',a=>a.seed.wheel.forceZ=1,a=>Object.defineProperty(a.seed,'q',{get(){throw Error('getter evaluated');}})];
 for(const patch of patches){const a=example();patch(a);assert.throws(()=>validate(a));}
 const dense=example();dense.motion.duration=.1;assert.throws(()=>validate(dense),/time\/recording/);dense.motion.sampleDt=.0005;assert.doesNotThrow(()=>validate(dense));
 assert.match(modelXML(copy),/<body name="hub" pos="[^"]+" quat="[^"]+"><body/);assert.ok(!modelXML(copy).includes('Spin'));
});

test('source adapter verifies complete bike state and preserves both wheels on both bikes',async()=>{
 for(const bike of ['full','hardtail']){
  const a=JSON.parse(await readFile(new URL('../docs/evidence/tyre-window-inputs/'+bike+'-fresh.json',import.meta.url)));
  a.observationWindow={format:TYRE_WINDOW,startTick:0,endTick:640,strideTicks:4};const source=await runTrail(a),before=JSON.stringify(source);
  for(const wheel of ['front','rear']){const {input,transfer}=await fromWindow(source,wheel);assert.ok(transfer.geometryMaxAbsolute<=1e-10);assert.ok(transfer.restLengthMaxAbsolute<=1e-10);assert.equal(transfer.compiledMassInertiaSpringDampingMatch,true);assert.equal(input.seed.source.wheel,wheel);assert.equal(input.seed.source.bike,bike);const joints=new Map(source.initialState.joints.map(j=>[j.name,j]));for(let i=0;i<input.seed.wheel.nodes;i++)for(let k=0;k<2;k++){const j=joints.get(wheel+'wheel_'+(k?'v':'u')+i);assert.equal(input.seed.q[2*i+k],j.position);assert.equal(input.seed.v[2*i+k],j.velocity);}input.seed.q[0]+=1;assert.equal(JSON.stringify(source),before);}
  for(const mutate of [r=>r.windowObservation.start.state.identity='0'.repeat(64),r=>r.windowObservation.start.state.joints.pop(),r=>r.windowObservation.start.state.joints.push({...r.windowObservation.start.state.joints[0]}),r=>r.frames[0].time=NaN,r=>delete r.frames[0].time,r=>r.summary.steps=1,r=>r.summary.steps=10000000]){const bad=structuredClone(source);mutate(bad);await assert.rejects(fromWindow(bad));}
 }
});

test('fixed-hub control keeps positions and stored energy while distinguishing imported and zero rates',async()=>{
 for(let i=0;i<examples.length;i++){
  const a=example(i),progress=[],r=await run(a,(phase,tick,total,dt)=>progress.push({phase,tick,total,dt}));assert.equal(r.model,MODEL);assert.equal(r.status,'completed');assert.equal(r.frames.length,161);assert.equal(r.summary.steps,640);assert.equal(r.dynamicMass,1);assert.equal(progress[0].phase,'preparing');assert.equal(progress.at(-1).tick,640);assert.ok(progress.length<=105);
  assert.deepEqual(await replay(r),r);a.rates='zero';const zero=await run(a);assert.equal(zero.status,'completed');assert.equal(zero.identity,r.identity);assert.deepEqual(zero.frames[0].nodes,r.frames[0].nodes);assert.equal(zero.frames[0].kineticEnergy,0);assert.equal(zero.frames[0].tyreMotion.rmsSpeed,0);close(r.frames[0].energy-zero.frames[0].energy,r.frames[0].kineticEnergy,1e-12);assert.notDeepEqual(r.finalNodes,zero.finalNodes);
  for(const f of r.frames){const t=f.tyreMotion;close(f.kineticEnergy,t.relativeSpeedEnergy,1e-12);close(f.energy,t.foundationEnergy+t.edgeEnergy+f.kineticEnergy+a.seed.gravity*f.nodes.reduce((sum,p)=>sum+p[1]/f.nodes.length,0),1e-10);assert.equal(f.fixtureWork,0);assert.ok(f.dampingLoss>=0);close(f.residual,f.energy-r.frames[0].energy+f.dampingLoss-f.contactWork,1e-14);const gx=f.contacts.reduce((s,c)=>s+c.force[0],0),gz=f.contacts.reduce((s,c)=>s+c.force[1],0),my=f.contacts.reduce((s,c)=>s+(c.point[1]-a.seed.hub.position[2])*c.force[0]-(c.point[0]-a.seed.hub.position[0])*c.force[1],0);close(f.ground[0],gx,1e-7);close(f.ground[1],gz,1e-7);close(f.ground[2],my,1e-7);}
  // Independently reconstruct native flex contact weights from the pinned
  // engine's inverse-distance rule, rather than repeating the node-force path.
  for(const f of r.frames){let predicted=0;for(const c of f.contacts){const ids=c.vertex>=0?[c.vertex]:[c.edge,(c.edge+1)%f.nodes.length],weights=ids.map(i=>1/Math.max(1e-15,Math.hypot(f.nodes[i][0]-c.point[0],f.nodes[i][1]-c.point[1]))),sum=weights.reduce((a,b)=>a+b);for(let k=0;k<ids.length;k++){const p=f.nodes[ids[k]];predicted+=weights[k]/sum*((p[1]-c.point[1])*c.force[0]-(p[0]-c.point[0])*c.force[1]);}}close(f.contactMomentDifference,predicted,1e-8);close(f.nodalGroundMoment-f.ground[2],f.contactMomentDifference,1e-14);}
  assert.ok(r.summary.maxForceResidual<1e-8);
 }
});

test('tilted stationary hub obeys independent spring recurrence and clamp wrench without contact',async()=>{
 const a=example();a.seed.gravity=0;a.seed.hub={position:[0,0,1],quaternion:[Math.cos(.2),0,Math.sin(.2),0]};a.seed.wheel.extension=0;a.seed.wheel.edgeViscosity=0;a.seed.q.fill(0);a.seed.v.fill(0);
 for(let i=0;i<a.seed.wheel.nodes;i++){a.seed.q[2*i]=.001;a.seed.v[2*i]=.05;}
 const p=validateWheel({...a.seed.wheel,dt:a.motion.dt}),mass=p.tyreMass/p.nodes,k=Number((p.foundation*wheelParts(p).reference.arcWeight).toPrecision(12));let q=.001,v=.05;
 const r=await run(a);assert.equal(r.status,'completed');for(let tick=1;tick<=r.summary.steps;tick++){v-=a.motion.dt*k/mass*q;q+=a.motion.dt*v;}
 for(let i=0;i<p.nodes;i++){close(r.finalNodes.q[2*i],q,2e-14);close(r.finalNodes.v[2*i],v,2e-11);close(r.finalNodes.q[2*i+1],0,1e-14);}
 const f=r.frames[0],fx=-k*.001*p.nodes*Math.cos(.4),fz=k*.001*p.nodes*Math.sin(.4);close(f.clamp[0],fx,1e-9);close(f.clamp[1],fz,1e-9);close(f.clamp[2],0,1e-9);assert.ok(r.frames.every(f=>f.contactWork===0&&f.dampingLoss===0&&f.contacts.length===0));
 // Physical identity binds admission limits, but excludes run cadence/timestep.
 const fine=structuredClone(a);fine.motion.dt/=2;assert.equal((await run(fine)).identity,r.identity);fine.seed.wheel.maxStrain-=.01;assert.notEqual((await run(fine)).identity,r.identity);
});

test('fixed-hub rejection retains accepted state, owned snapshots and work',async()=>{
 const a=example(),mj=await getRuntime(),forward=mj.mj_forward;let native,once=false;
 mj.mj_forward=(m,d)=>{forward(m,d);native=d;if(!once&&Math.round(d.time/a.motion.dt)===9){once=true;d.qacc[0]=NaN;}};
 let r;try{r=await run(a);}finally{mj.mj_forward=forward;}
 assert.ok(once);assert.equal(r.status,'terminated');assert.equal(r.termination.reason,'nonfinite-state');assert.equal(r.summary.steps,8);assert.deepEqual(r.frames.map(f=>Math.round(f.time/a.motion.dt)),[0,4,8]);assert.ok(r.frames.every(f=>Number.isFinite(f.energy)));assert.equal(native.isDeleted(),true);
 const clean=await run(a);assert.deepEqual(r.frames,clean.frames.slice(0,3));const saved=JSON.stringify(r);await run({...a,rates:'zero'});assert.equal(JSON.stringify(r),saved);
 const bad=example();bad.seed.hub.position[2]=.2;const rejected=await run(bad);assert.equal(rejected.status,'initial-state-rejected');assert.equal(rejected.frames.length,0);assert.equal(rejected.summary.steps,0);
 await assert.rejects(run(a,()=>{throw Error('observer failed');}),/observer failed/);assert.equal((await run(a)).status,'completed');
});
