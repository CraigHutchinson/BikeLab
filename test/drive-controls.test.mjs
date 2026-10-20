import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {run,replay,preset,validate} from '../dist/trail-bike.js';
import {getRuntime} from '../dist/moving-wheel.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}; tolerance ${t}`);
const command=(tick,rearDrive=0,frontBrake=0,rearBrake=0)=>({tick,rearDrive,frontBrake,rearBrake});
const last=r=>r.frames.at(-1);

test('commands reject incomplete, unordered, unbounded and sparse schedules; legacy traction replays exactly',async()=>{
 for(const commands of [null,[],new Array(1),[command(1)],[command(0),command(0)],[command(0),command(.5)],[command(0),command(999999)],[{tick:0,rearDrive:0}],[{...command(0),other:1}],[command(0,NaN)],[command(0,121)],[command(0,0,-1)],[command(0,0,0,201)],Array.from({length:65},(_,i)=>command(i))])assert.throws(()=>validate({commands}));
 const owned=[command(0),command(5,4)];const a=validate({commands:owned});owned[1].rearDrive=9;assert.equal(a.commands[1].rearDrive,4);assert.ok(Object.isFrozen(a.commands[1]));
 const saved=JSON.parse(await readFile(new URL('./fixtures/trail-bike-0.3.json',import.meta.url),'utf8')),r=await replay(saved);
 const walk=(a,b)=>{if(a&&typeof a==='object')for(const k of Object.keys(a))walk(a[k],b[k]);else assert.equal(a,b);};walk(saved.frames,r.frames);assert.equal(last(r).driveWork,0);assert.equal(last(r).brakeWork,0);
 const bad=structuredClone(r);delete bad.scenario.commands;assert.throws(()=>replay(bad),/commands/);saved.scenario.commands=[command(0,1)];assert.throws(()=>replay(saved),/Legacy/);
});

test('native rotor brakes bound solved torque through reversal, near rest, release and capacity changes',async()=>{
 const mj=await getRuntime(),model=mj.MjModel.from_xml_string('<mujoco><option gravity="0 0 0" timestep=".0001"/><worldbody><body><joint type="hinge" axis="0 1 0"/><inertial pos="0 0 0" mass="1" diaginertia=".4 .4 .4"/></body></worldbody></mujoco>'),d=new mj.MjData(model);
 try{
  assert.deepEqual(Array.from(model.dof_solref),[.02,1]);assert.deepEqual(Array.from(model.dof_solimp),[.9,.95,.001,.5,2]);
  const observe=(speed,drive,capacity)=>{d.qvel[0]=speed;d.qfrc_applied[0]=drive;model.dof_frictionloss[0]=capacity;mj.mj_forward(model,d);let torque=0,rows=0;for(let i=0;i<d.nefc;i++){assert.equal(d.efc_type[i],mj.mjtConstraint.mjCNSTR_FRICTION_DOF.value);assert.equal(d.efc_id[i],0);near(d.efc_vel[i],speed);torque+=d.efc_force[i];rows++;}near(d.qacc[0],(drive+torque)/.4);assert.ok(Math.abs(torque)<=capacity+1e-12);assert.equal(rows,capacity?1:0);return torque;};
  for(const sign of [-1,1]){near(observe(2*sign,0,.8),-.8*sign);const rest=observe(1e-8*sign,0,.8);assert.ok(rest*sign<=0);const hold=observe(0,.4*sign,.8);assert.ok(hold*sign<0&&Math.abs(hold)<=.4);near(observe(0,2*sign,.8),-.8*sign);near(observe(sign,.4*sign,0),0);}
  observe(1,0,.8);for(let i=0;i<6000;i++)mj.mj_step(model,d);assert.ok(Math.abs(d.qvel[0])<.01,'regularized braking should approach rest');
  observe(d.qvel[0],-.4,0);const before=d.qvel[0];for(let i=0;i<200;i++)mj.mj_step(model,d);assert.ok(d.qvel[0]<before-.019,'released rotor reverses under drive');
 }finally{d.delete();model.delete();}
});

test('free carrier and rotor receive equal opposite drive with relative-coordinate work and refinement',async()=>{
 const mj=await getRuntime(),errors=[];
 for(const dt of [.0001,.00005]){const model=mj.MjModel.from_xml_string(`<mujoco><option gravity="0 0 0" timestep="${dt}" integrator="implicitfast"/><worldbody><body><joint type="hinge" axis="0 1 0"/><inertial pos="0 0 0" mass="1" diaginertia="2 2 2"/><body><joint type="hinge" axis="0 1 0"/><inertial pos="0 0 0" mass="1" diaginertia=".5 .5 .5"/></body></body></worldbody></mujoco>`),d=new mj.MjData(model);
  try{d.qfrc_applied[1]=3;mj.mj_forward(model,d);near(d.qacc[0],-1.5);near(d.qacc[1],7.5);mj.mj_rnePostConstraint(model,d);near(d.cfrc_int[6+1],0);near(d.cfrc_int[12+1],3);
   for(let i=0;i<Math.round(.01/dt);i++)mj.mj_step(model,d);mj.mj_forward(model,d);mj.mj_energyVel(model,d);near(2*d.qvel[0]+.5*(d.qvel[0]+d.qvel[1]),0,1e-12);const work=3*d.qpos[1];assert.ok(work>0);errors.push(Math.abs(d.energy[1]-work));assert.ok(Math.abs(work-3*(d.qpos[0]+d.qpos[1]))>1e-4,'world spin work is not the internal actuator work');
   model.dof_frictionloss[1]=4;d.qfrc_applied[1]=0;mj.mj_forward(model,d);mj.mj_rnePostConstraint(model,d);near(d.cfrc_int[12+1],d.qfrc_constraint[1]);near(d.cfrc_int[6+1],0);
  }finally{d.delete();model.delete();}
 }
 assert.ok(errors[1]<errors[0]*.51&&errors[0]<2e-5);
});

test('connected commands preserve contact attribution, carrier reactions, work, replay and recording invariance',async()=>{
 for(const bike of ['full','hardtail']){
  const a=preset('coast',bike);a.motion.duration=.12;a.commands=[command(0),command(321,8),command(1200,0,12,8),command(2400),command(3840,3,4,5)];const r=await run(a);assert.equal(r.status,'completed');assert.ok(last(r).driveWork>0);assert.ok(last(r).brakeWork<0);assert.ok(r.summary.maxPowerResidual<1e-8);assert.ok(r.summary.maxSampledRootWrench<1e-7);assert.ok(r.summary.maxSampledBearingMoment<1e-7);
  for(const c of a.commands){const f=r.frames.find(f=>Math.abs(f.time-c.tick*r.scenario.motion.dt)<1e-10);assert.ok(f,'command boundary must be recorded');assert.deepEqual(f.command,c);}
  let drive=0;
  for(let i=0;i<r.frames.length;i++){const f=r.frames[i];near(f.normalWork+f.tangentWork+f.brakeWork,f.constraintWork);near(f.normalPower+f.tangentPower+f.brakePower,f.constraintPower);near(f.residual,f.energy-r.summary.initialEnergy+f.dampingLoss-f.constraintWork-f.driveWork);
   if(i){const prev=r.frames[i-1];drive+=prev.command.rearDrive*(f.wheels[1].spinAngle-prev.wheels[1].spinAngle);near(drive,f.driveWork);}
   for(let k=0;k<2;k++){const w=f.wheels[k],sum=[0,0,0];near(w.carrier[2]-w.bearing[2],w.driveTorque+w.brakeTorque,1e-8);assert.ok(Math.abs(w.brakeTorque)<=w.brakeCapacity+1e-8);if(!w.brakeCapacity)near(w.brakeTorque,0);for(const c of f.contacts.filter(c=>c.wheel===k)){sum[0]+=c.force[0];sum[1]+=c.force[1];sum[2]+=(c.point[1]-w.hub[1])*c.force[0]-(c.point[0]-w.hub[0])*c.force[1];}for(let j=0;j<3;j++)near(sum[j],w.ground[j],1e-7);}
  }
  const fine=await run({...a,motion:{...a.motion,sampleDt:.0025}});assert.deepEqual(last(fine),last(r));assert.deepEqual(await replay(JSON.parse(JSON.stringify(r))),r);
  const noFinal=await run({...a,commands:a.commands.slice(0,-1)});near(last(noFinal).driveWork,last(r).driveWork,0);near(last(noFinal).brakeWork,last(r).brakeWork,0);assert.deepEqual(last(noFinal).frame,last(r).frame);for(let k=0;k<2;k++){assert.deepEqual(last(noFinal).wheels[k].nodes,last(r).wheels[k].nodes);near(last(noFinal).wheels[k].spinVelocity,last(r).wheels[k].spinVelocity,0);}
 }
});

test('airborne drive/brake pairs preserve whole-bike momentum; rejected intervals retain no future command or work',async()=>{
 for(const bike of ['full','hardtail']){const flight=preset('flight',bike);flight.motion={...flight.motion,duration:.02,omega:2,forkCompression:.02,rearAngle:.04,riderOffset:-.02};flight.commands=[command(0,2,1,1),command(500,-2,0,0)];const r=await run(flight);assert.equal(r.status,'completed');assert.ok(r.frames.every(f=>f.contacts.length===0));for(const x of last(r).momentumResidual)near(x,0,1e-4);
  const a=preset('limit',bike);a.surface={friction:.6};a.commands=[command(0,5,4,3)];const stopped=await run(a);assert.equal(stopped.status,'terminated');const failTick=Math.round(stopped.termination.attemptedTime/stopped.scenario.motion.dt);a.commands.push(command(failTick,-120,200,200));const guarded=await run(a);assert.deepEqual(guarded.frames,stopped.frames);assert.deepEqual(last(guarded).command,command(0,5,4,3));assert.deepEqual(await replay(JSON.parse(JSON.stringify(guarded))),guarded);
 }
});
