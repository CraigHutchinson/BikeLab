import test from 'node:test';
import assert from 'node:assert/strict';
import {run,replay,preset,validate,modelXML} from '../dist/trail-bike.js';
import {getRuntime} from '../dist/moving-wheel.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}; tolerance ${t}`),last=r=>r.frames.at(-1);
const short=(name,bike='full',motion={})=>{const a=preset(name,bike);a.motion={...a.motion,duration:.15,...motion};return a;};
test('connected assembly owns the declared mass and wheel spin inertia without axle duplication',async()=>{
 const mj=await getRuntime();for(const bike of ['full','hardtail'])for(const rider of ['fixed','compliant']){const a={bike:{bike,rider}},model=mj.MjModel.from_xml_string(modelXML(a)),d=new mj.MjData(model);try{
  near(Array.from(model.body_mass).reduce((a,b)=>a+b,0),89);
  for(const name of ['frontwheelSpin','rearwheelSpin']){const id=mj.mj_name2id(model,mj.mjtObj.mjOBJ_JOINT.value,name);d.qvel[model.jnt_dofadr[id]]=2;}
  mj.mj_forward(model,d);mj.mj_energyVel(model,d);near(d.energy[1],2*.5*(.04+(.36-.008)**2+.008**2/2)*4,1e-10);
 }finally{d.delete();model.delete();}}
});
test('both bike types conserve separated-flight momentum and replay independently of recording cadence',async()=>{
 for(const bike of ['full','hardtail']){const a=short('flight',bike,{duration:.04}),r=await run(a);assert.equal(r.status,'completed');near(r.massBudget.total,89);const f=last(r);near(f.momentum[0],89);near(f.momentum[1],89*.3);for(const x of f.momentumResidual)near(x,0,1e-8);assert.ok(r.summary.maxResidual<1e-8);
  const finer=await run({...a,motion:{...a.motion,sampleDt:.0025}});assert.deepEqual(last(finer),f);const saved=JSON.parse(JSON.stringify(r));saved.frames[0].frame[0]=999;assert.deepEqual(await replay(saved),r);
 }
});
test('distributed contacts drive complete bike and wheel loads with independently summed wrenches',async()=>{
 for(const bike of ['full','hardtail']){const r=await run(short('flat',bike));assert.equal(r.status,'completed');assert.ok(r.frames.some(f=>f.contacts.length>=4));assert.ok(r.summary.maxSampledRootWrench<1e-7);assert.ok(r.summary.maxSampledBearingMoment<1e-7);assert.ok(r.summary.maxDiagnosticDifference<1e-7);
  for(const f of r.frames){for(let k=0;k<2;k++){const w=f.wheels[k],sum=[0,0,0];for(const c of f.contacts.filter(c=>c.wheel===k)){assert.ok(c.normalForce>0);near(Math.hypot(...c.normal),1,1e-8);sum[0]+=c.force[0];sum[1]+=c.force[1];sum[2]+=(c.point[1]-w.hub[1])*c.force[0]-(c.point[0]-w.hub[0])*c.force[1];}for(let i=0;i<3;i++)near(sum[i],w.ground[i],1e-7);assert.ok(w.limits.penetration<=r.scenario.wheel.maxPenetration);assert.ok(w.limits.inner>0);}if(bike==='full')near(f.pivot[2],0,1e-7);}
  assert.ok(Math.max(...last(r).momentumResidual.map(Math.abs))<.03);assert.ok(r.summary.maxResidual/r.summary.initialEnergy<.001);
 }
});
test('complete wheel momentum includes bearing, ground and gravity impulses',async()=>{
 const r=await run(short('flat','full',{duration:.03,sampleDt:.000125,clearance:0}));assert.equal(r.status,'completed');
 for(let k=0;k<2;k++){const impulse=[0,0,0],M=r.massBudget.eachHub+r.massBudget.eachTyre,g=r.scenario.motion.gravity;
  const force=f=>{const w=f.wheels[k],fx=w.bearing[0]+w.ground[0],fz=w.bearing[1]+w.ground[1];return [fx,fz-M*g,w.bearing[2]+w.ground[2]+w.hub[1]*fx-w.hub[0]*fz+M*g*w.centerOfMass[0]];};
  for(let i=1;i<r.frames.length;i++){const a=r.frames[i-1],b=r.frames[i],fa=force(a),fb=force(b);for(let j=0;j<3;j++)impulse[j]+=.5*(b.time-a.time)*(fa[j]+fb[j]);}
  for(let j=0;j<3;j++)near(last(r).wheels[k].momentum[j]-r.frames[0].wheels[k].momentum[j],impulse[j],.06);
 }
});
test('configuration, unsupported terrain, initial travel and terminated replay remain explicit',async()=>{
 for(const a of [{other:1},{wheel:{radius:.4}},{bike:{tyreStiffness:1}},{motion:{gravity:NaN}},{motion:{sampleDt:.003}},{motion:{duration:1.5,sampleDt:.001}},{wheel:{nodes:128,extension:2000,foundation:600000,tyreMass:.5},motion:{dt:.0000625}}])assert.throws(()=>validate(a));
 const steep=preset('flat');steep.profile.points=[[-3,0],[0,0],[.01,.1],[5,.1]];assert.throws(()=>validate(steep));
 const bad=await run(short('flight','full',{riderOffset:.2}));assert.equal(bad.status,'initial-state-rejected');assert.equal(bad.termination.reason,'rider-travel-limit');assert.equal(bad.frames.length,0);
 const limited=await run(preset('limit'));assert.equal(limited.status,'terminated');near(last(limited).time,limited.termination.time);assert.ok(limited.termination.attemptedTime>last(limited).time);for(const w of last(limited).wheels)assert.ok(w.limits.penetration<=limited.scenario.wheel.maxPenetration);assert.deepEqual(await replay(JSON.parse(JSON.stringify(limited))),limited);
 const incomplete=JSON.parse(JSON.stringify(bad));delete incomplete.scenario.motion.dt;assert.throws(()=>replay(incomplete));
});

test('airborne angular momentum includes frame rotation, wheel spin and displaced rider',async()=>{
 const a=short('flight','full',{duration:.02,clearance:.4,forkCompression:.02,rearAngle:.04,riderOffset:-.04,pitchOffset:.06,pitchVelocity:.3,omega:1.2,velocityX:.7,velocityZ:.2});
 const r=await run(a);assert.equal(r.status,'completed');const f=r.frames[0],O=f.frame,spin=r.massBudget.eachWheelRigidSpinInertia,parts=[[12,8*12/82,O,.3],[70,8*70/82,f.rider,.3],[.5,.01,f.wheels[0].hub,.3],[1.5,.02,f.wheels[1].hub,.3],[2.5,spin,f.wheels[0].hub,1.5],[2.5,spin,f.wheels[1].hub,1.5]],expected=[0,0,0];
 for(const [mass,inertia,at,omega] of parts){const vx=.7+.3*(at[1]-O[1]),vz=.2-.3*(at[0]-O[0]);expected[0]+=mass*vx;expected[1]+=mass*vz;expected[2]+=inertia*omega+mass*(at[1]*vx-at[0]*vz);}
 for(let i=0;i<3;i++)near(r.summary.initialMomentum[i],expected[i],1e-9);for(const x of last(r).momentumResidual)near(x,0,.002);assert.ok(r.frames.every(f=>f.contacts.length===0));
});
test('contact trajectory and work remain unchanged when only observation cadence changes',async()=>{
 const a=short('flat','full',{duration:.06}),r=await run(a),fine=await run({...a,motion:{...a.motion,sampleDt:.0025}});assert.ok(r.frames.some(f=>f.contacts.length));assert.deepEqual(last(fine),last(r));
});
