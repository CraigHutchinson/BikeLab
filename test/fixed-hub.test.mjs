import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MODEL,validate,prepare,run,replay,fromTrailRecord} from '../dist/fixed-hub.js';
import {getRuntime} from '../dist/moving-wheel.js';
import {validate as trailValidate,modelXML,run as trailRun,activePreset} from '../dist/trail-bike.js';
import {stateIdentity} from '../dist/trail-initial-state.js';
const near=(a,b,t=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t, `${a} vs ${b}`);
const input=async(bike='full',wheel='front',velocityMode='imported')=>({format:MODEL,source:JSON.parse(await readFile(new URL('../dist/fixed-hub-'+bike+'.json',import.meta.url))),wheel,velocityMode,motion:{duration:.02,dt:.00003125,sampleDt:.000125}});
test('source admission binds the full named topology and rejects malformed or incompatible sources',async()=>{
 const a=await input();for(const patch of [{format:'wrong'},{wheel:'both'},{velocityMode:'world'},{unknown:1},{motion:{...a.motion,dt:NaN}},{motion:{...a.motion,sampleDt:.00013}},{motion:{...a.motion,duration:1}}])assert.throws(()=>validate({...a,...patch}));
 const before=JSON.stringify(a),b=validate(a);b.source.initialization.state.joints[0].position+=1;assert.equal(JSON.stringify(a),before);
 for(const edit of [x=>x.source.initialization.state.identity='0'.repeat(64),x=>x.source.initialization.state.joints.pop(),x=>x.source.initialization.state.joints.push(x.source.initialization.state.joints[0]),x=>x.source.wheel.foundation+=1,x=>x.source.initialization.state.joints[0].velocity=Infinity,x=>x.source.profile.points[1][1]=.01]){
  const x=structuredClone(a);edit(x);await assert.rejects(()=>prepare(x));
 }
 const shuffled=structuredClone(a);shuffled.source.initialization.state.joints.reverse();assert.equal((await prepare(a)).xml,(await prepare(shuffled)).xml);
 const bad=structuredClone(a);bad.source.initialization.state.joints.find(j=>j.name==='frontwheel_u0').position=.07;await assert.rejects(()=>run(bad),/initial state rejected/);
});
test('both bikes and wheels transfer geometry, preserve local rates, own output and replay exactly',async()=>{
 for(const bike of ['full','hardtail'])for(const wheel of ['front','rear']){
  const a=await input(bike,wheel),before=JSON.stringify(a),r=await run(a),z=await run({...a,velocityMode:'zero'});
  assert.equal(JSON.stringify(a),before);assert.equal(r.status,'completed');assert.equal(z.status,'completed');assert.equal(r.frames.length,161);assert.equal(r.summary.steps,640);assert.ok(r.summary.geometryError<1e-13);
  assert.deepEqual(r.frames[0].nodes,z.frames[0].nodes);assert.ok(r.frames[0].motion.rmsSpeed>0);assert.equal(z.frames[0].motion.rmsSpeed,0);assert.equal(r.identity,z.identity);
  assert.deepEqual(await replay(JSON.parse(JSON.stringify(r))),r);
  const sparse=await run({...a,motion:{...a.motion,sampleDt:.001}});assert.deepEqual(sparse.finalState,r.finalState);assert.deepEqual(sparse.frames.at(-1),r.frames.at(-1));
  for(const f of r.frames){assert.equal(f.fixtureWork,0);assert.ok(f.dampingLoss>=0);near(f.residual,f.energy-r.summary.initialEnergy+f.dampingLoss-f.contactWork);for(const v of f.balance)near(v,0,1e-8);
   const sum=f.contacts.reduce((v,c)=>[v[0]+c.force[0],v[1]+c.force[1],v[2]+(c.point[1]-r.hub[1])*c.force[0]-(c.point[0]-r.hub[0])*c.force[1]],[0,0,0]);near(sum[0],f.ground[0],1e-7);near(sum[1],f.ground[1],1e-7);near(sum[2],f.contactWrench[2],1e-9);near(f.contactMomentDifference,f.ground[2]-sum[2]);
  }
  r.input.source.initialization.state.joints[0].position=7;assert.equal(JSON.stringify(a),before);
 }
});
async function uniform(){
 const a=await input();a.source.motion.gravity=0;a.source.wheel.edgeViscosity=0;
 for(const j of a.source.initialization.state.joints){if(j.name==='heave')j.position+=1;if(j.name.startsWith('frontwheel_')){j.position=j.name.startsWith('frontwheel_u')?.001:0;j.velocity=j.name.startsWith('frontwheel_u')?.01:0;}}
 a.source.initialization.state.identity=await stateIdentity(modelXML(a.source),trailValidate(a.source));return a;
}
test('isolated uniform casing translation follows the undamped oscillator and refines energy error',async()=>{
 const a=await uniform(),setup=await prepare(a),mj=await getRuntime(),model=mj.MjModel.from_xml_string(setup.xml);
 let stiffness,mass;try{stiffness=model.jnt_stiffness[0];mass=model.body_mass[2];assert.equal(model.nv,128);assert.equal(model.dof_damping[0],0);}finally{model.delete();}
 const omega=Math.sqrt(stiffness/mass),expected=.001*Math.cos(omega*.02)+.01/omega*Math.sin(omega*.02),errors=[],energy=[];
 for(const dt of [.00003125,.000015625,.0000078125]){
  const r=await run({...a,motion:{...a.motion,dt}});assert.equal(r.status,'completed');assert.ok(r.frames.every(f=>f.contacts.length===0));assert.ok(r.frames.every(f=>Math.abs(f.dampingLoss)<1e-14));
  const q=r.finalState.find(j=>j.name==='frontwheel_u0').position;errors.push(Math.abs(q-expected));energy.push(r.summary.maxResidual);
  for(const f of r.frames){const mean=f.motion.node0Position[0];near(Math.hypot(f.fixture[0],f.fixture[1]),Math.abs(64*stiffness*mean),1e-7);near(f.fixture[2],0,1e-8);}
 }
 assert.ok(errors[2]<errors[1]&&errors[1]<errors[0],JSON.stringify(errors));assert.ok(energy[2]<energy[1]&&energy[1]<energy[0],JSON.stringify(energy));assert.ok(errors[2]<1e-5);
});
test('rejected integration restores accepted state, work and warm seed; progress is observational',async()=>{
 const a=await input(),base=await run(a),mj=await getRuntime(),step=mj.mj_step;let n=0;
 mj.mj_step=(m,d)=>{step(m,d);if(++n===9)d.qvel[0]=100;};
 let stopped;try{stopped=await run(a);}finally{mj.mj_step=step;}
 assert.equal(stopped.status,'terminated');assert.equal(stopped.summary.steps,8);assert.equal(stopped.termination.reason,'state-rate-limit');assert.deepEqual(stopped.frames.at(-1),base.frames[2]);
 const progress=[];assert.deepEqual(await run(a,(...args)=>progress.push(args)),base);assert.ok(progress.length>2);assert.equal(progress.at(-1)[0],'finalizing');
});
test('trail adapter owns a final accepted state and fixture records cannot be used as trail states',async()=>{
 const a=activePreset();a.motion.duration=.02;const r=await trailRun(a),before=JSON.stringify(r),x=fromTrailRecord(r,'rear','zero');
 assert.equal(JSON.stringify(r),before);assert.deepEqual(x.source.initialization.state,r.finalState);assert.equal(x.wheel,'rear');assert.equal(x.velocityMode,'zero');assert.throws(()=>trailValidate(x));assert.throws(()=>fromTrailRecord({model:MODEL}));assert.equal((await run(x)).status,'completed');
});

