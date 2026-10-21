import test from 'node:test';
import assert from 'node:assert/strict';
import {run, replay, inputFromRecord, validate, modelXML, articulatedPreset, ARTICULATED_MODEL} from '../dist/trail-bike.js';
import {getRuntime} from '../dist/moving-wheel.js';
import {validateConnectedRider} from '../dist/rider-connected.js';
const near=(a,b,t=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} vs ${b} (${t})`);
const last=r=>r.frames.at(-1), cache=new Map();
const standing=bike=>{if(!cache.has(bike))cache.set(bike,run(articulatedPreset(bike)));return cache.get(bike);};
const command=(tick,rearDrive=0)=>({tick,rearDrive,frontBrake:0,rearBrake:0});

test('articulated chassis owns independent mass/COM/inertia and rejects ambiguous legacy configuration',async()=>{
 const mj=await getRuntime();
 for(const bike of ['full','hardtail'])for(const riderMass of [35,70]){
  const a=articulatedPreset(bike);a.articulated={...a.articulated,passive:{posture:{riderMass}}};
  const m=mj.MjModel.from_xml_string(modelXML(a));
  try{
   const body=name=>mj.mj_name2id(m,mj.mjtObj.mjOBJ_BODY.value,name),frame=body('frame');
   near(m.body_mass[frame],6);assert.deepEqual(Array.from(m.body_ipos.subarray(3*frame,3*frame+3)),[0,0,-.15]);
   // MuJoCo may permute principal axes; reconstruct the tensor using its quaternion.
   const d=new mj.MjData(m);try{mj.mj_forward(m,d);const R=d.ximat,I=m.body_inertia;for(let k=0;k<3;k++)near([0,1,2].reduce((sum,j)=>sum+R[9*frame+3*k+j]**2*I[3*frame+j],0),[.35,.5,.3][k]);}finally{d.delete();}
   near(Array.from(m.body_mass).reduce((sum,x)=>sum+x,0),13+riderMass);
   assert.equal(body('rider'),-1);assert.equal(m.neq,2);
  }finally{m.delete();}
 }
 for(const patch of [{chassis:{mass:NaN}},{chassis:{inertia:[.1,.1,1]}},{chassis:{com:[0,NaN]}},{closureTime:.0001},{maxClosureGap:0},{passive:undefined},{other:1}])assert.throws(()=>validateConnectedRider(patch));
 for(const a of [{bike:{rider:'articulated',mass:82}},{bike:{rider:'articulated',riderMass:70}},{bike:{rider:'articulated'},motion:{riderOffset:-.05}},{articulated:{}},{bike:{rider:'articulated'},articulated:null}])assert.throws(()=>validate(a));
});

test('both articulated bikes preserve compatible airborne launch and shared replay without a guide',async()=>{
 for(const bike of ['full','hardtail']){
  const a=articulatedPreset(bike,'flight');const r=await run(a);
  assert.equal(r.model,ARTICULATED_MODEL);assert.equal(r.status,'completed');near(r.massBudget.total,83);
  for(const f of r.frames){assert.equal(f.guide,null);assert.equal(f.contacts.length,0);for(const x of f.momentumResidual)near(x,0,1e-8);for(const c of f.articulated.interfaces.attachments){assert.ok(c.active);near(Math.hypot(...c.gap),0,1e-10);near(Math.hypot(...c.riderVelocity.map((v,k)=>v-c.bikeVelocity[k])),0,1e-10);}}
  assert.deepEqual(await replay(JSON.parse(JSON.stringify(r))),r);
  const missing=structuredClone(r);delete missing.scenario.articulated.passive.posture.segments.trunk.length;assert.throws(()=>inputFromRecord(missing));
  const wrong=structuredClone(r);wrong.model='bikelab-trail-bike-0.4';assert.throws(()=>inputFromRecord(wrong));
 }
});

test('both moving unseated riders partition closure/terrain work and render owned native geometry',async()=>{
 for(const bike of ['full','hardtail']){
  const r=await standing(bike);assert.equal(r.status,'completed');assert.ok(r.frames.some(f=>f.contacts.length));
  assert.ok(r.summary.maxClosureGap<.002);assert.ok(r.summary.maxResidual<.5);assert.ok(Math.abs(r.summary.closureAngularImpulse)<.02);
  assert.ok(r.summary.maxDiagnosticDifference<1e-7);assert.ok(r.summary.maxSampledRootWrench<1e-7);
  assert.ok(Math.max(...last(r).articulated.coordinates.map(Math.abs))>.05,'must actually move joints');
  for(const f of r.frames){
   const rider=f.articulated;assert.equal(f.guide,null);
   near(f.constraintPower,f.normalPower+f.tangentPower+f.brakePower+rider.interfaces.rowPower);
   near(f.constraintWork,f.normalWork+f.tangentWork+f.brakeWork+rider.closureWork);
   near(rider.interfaces.pairPower,rider.interfaces.rowPower);
   near(rider.momentumResidualAfterClosure[2],f.momentumResidual[2]-rider.closureAngularImpulse);
   for(const x of f.momentumResidual)assert.ok(Math.abs(x)<.1);
   const com=[0,0,0];
   for(const segment of rider.segments){const spec=r.scenario.articulated.passive.posture.segments[segment.name];near(Math.hypot(...segment.distal.map((x,k)=>x-segment.proximal[k])),spec.length);for(let k=0;k<3;k++)com[k]+=spec.massFraction*segment.com[k];}
   com.forEach((v,k)=>near(v,rider.centerOfMass[k]));near(f.rider[0],com[0]);near(f.rider[1],com[2]);
   for(let wheel=0;wheel<2;wheel++){
    const sum=[0,0,0],hub=f.wheels[wheel].hub;
    for(const c of f.contacts)if(c.wheel===wheel){sum[0]+=c.force[0];sum[1]+=c.force[1];sum[2]+=(c.point[1]-hub[1])*c.force[0]-(c.point[0]-hub[0])*c.force[1];}
    sum.forEach((v,k)=>near(v,f.wheels[wheel].ground[k],1e-7));
   }
  }
  const initial=structuredClone(r.frames[0]);const copy=structuredClone(r);last(copy).articulated.segments[0].proximal[0]=999;assert.deepEqual(copy.frames[0],initial);
  const finer=await run({...articulatedPreset(bike),motion:{...articulatedPreset(bike).motion,sampleDt:.0025}});assert.deepEqual(last(finer),last(r));
 }
});

test('rotating articulated flight has independently summed chassis, limb and wheel momentum',async()=>{
 for(const bike of ['full','hardtail']){
  const a=articulatedPreset(bike,'flight');a.motion={...a.motion,duration:.02,clearance:.4,forkCompression:.02,rearAngle:.04,pitchOffset:.06,pitchVelocity:.3,omega:1.2,velocityX:.7,velocityZ:.2};
  const r=await run(a);assert.equal(r.status,'completed');const f=r.frames[0],O=f.frame,chassis=r.scenario.articulated.chassis,co=Math.cos(O[2]),sn=Math.sin(O[2]);
  const at=[O[0]+co*chassis.com[0]+sn*chassis.com[1],O[1]-sn*chassis.com[0]+co*chassis.com[1]],parts=[[chassis.mass,chassis.inertia[1],at,.3],[.5,.01,f.wheels[0].hub,.3],[1.5,.02,f.wheels[1].hub,.3]];
  for(const w of f.wheels)parts.push([r.massBudget.eachHub+r.massBudget.eachTyre,r.massBudget.eachWheelRigidSpinInertia,w.hub,1.5]);
  for(const segment of f.articulated.segments){const spec=r.scenario.articulated.passive.posture.segments[segment.name],mass=70*spec.massFraction;parts.push([mass,mass*spec.inertiaPerMass[1],[segment.com[0],segment.com[2]],.3]);near(segment.velocity[1],.3);near(segment.velocity[3],.7+.3*(segment.com[2]-O[1]));near(segment.velocity[5],.2-.3*(segment.com[0]-O[0]));}
  const sum=[0,0,0];for(const [mass,I,point,omega] of parts){const vx=.7+.3*(point[1]-O[1]),vz=.2-.3*(point[0]-O[0]);sum[0]+=mass*vx;sum[1]+=mass*vz;sum[2]+=I*omega+mass*(point[1]*vx-point[0]*vz);}
  sum.forEach((v,k)=>near(v,r.summary.initialMomentum[k]));assert.ok(r.frames.every(f=>f.contacts.length===0));
  assert.equal(f.articulated.nativeCoordinates.length,7);assert.deepEqual(f.articulated.nativeVelocities,[0,0,0,0,0,0,0]);
  for(const x of last(r).momentumResidual)assert.ok(Math.abs(x)<.002);
 }
});

test('moving standing cases meet declared timestep and closure sensitivity budgets',async()=>{
 for(const bike of ['full','hardtail']){
  const a=articulatedPreset(bike),coarse=await standing(bike),runs=[coarse];
  for(const dt of [.000015625,.0000078125])runs.push(await run({...a,motion:{...a.motion,dt}}));
  for(const r of runs){assert.equal(r.status,'completed');assert.ok(r.summary.maxResidual<.5);assert.ok(r.summary.maxClosureGap<.002);for(const x of last(r).momentumResidual)assert.ok(Math.abs(x)<.1);}
  const mid=last(runs[1]),fine=last(runs[2]);
  for(const k of [0,1])near(mid.frame[k],fine.frame[k],.0005);
  for(const k of [0,2])near(mid.articulated.centerOfMass[k],fine.articulated.centerOfMass[k],.0005);
  assert.ok(Math.abs(mid.energy-fine.energy)<.05);
  const faster=await run({...a,articulated:{...a.articulated,closureTime:.01}});assert.equal(faster.status,'completed');assert.ok(faster.summary.maxClosureGap<.002);assert.ok(faster.summary.maxResidual<.5);
 }
});

test('joint-domain crossing stops before accepting impossible motion and replays the accepted endpoint',async()=>{
 const a=articulatedPreset();a.articulated=structuredClone(a.articulated);
 const law=a.articulated.passive.joints.elbow;law.minAngle=law.restAngle-.05;
 const r=await run(a);assert.equal(r.status,'terminated');assert.equal(r.termination.reason,'rider-elbow-angle-limit');
 near(last(r).time,r.termination.time);assert.ok(r.termination.attemptedTime>last(r).time);
 assert.ok(last(r).articulated.coordinates[3]>=-.05);assert.ok(last(r).articulated.interfaces.attachments.every(c=>c.active));
 assert.deepEqual(await replay(JSON.parse(JSON.stringify(r))),r);
});

test('failure after new-command endpoint evaluation restores activation, state, geometry and all ledgers',async()=>{
 const mj=await getRuntime(),forward=mj.mj_forward,a=articulatedPreset();a.commands=[command(0),command(1601,20)];
 for(const fault of ['state','interface']){
  let injected=false;
  // Controlled fault after the candidate passed the old-command guard.
  mj.mj_forward=(m,d)=>{forward(m,d);if(!injected&&d.time>.05&&d.time<.05004&&Array.from(d.qfrc_applied).includes(20)){
   injected=true;if(fault==='state'){d.qacc[0]=NaN;d.eq_active[0]=0;}else d.efc_force[0]=NaN;
  }};
  let r;try{r=await run(a);}finally{mj.mj_forward=forward;}
  assert.ok(injected);assert.equal(r.status,'terminated');assert.equal(r.termination.reason,fault==='state'?'nonfinite-state':'nonfinite-rider-interface');assert.equal(r.termination.attemptedCommandTick,1601);
  const reference=await standing('full'),accepted=reference.frames.find(f=>Math.abs(f.time-.05)<1e-10);
  assert.deepEqual(last(r),accepted);assert.deepEqual(last(r).command,command(0));assert.ok(last(r).articulated.interfaces.attachments.every(c=>c.active));
 }
});
