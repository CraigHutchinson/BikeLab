import test from 'node:test';
import assert from 'node:assert/strict';
import {getRuntime} from '../dist/moving-wheel.js';
import {run,replay,articulatedPreset,modelXML} from '../dist/trail-bike.js';
import {validateSaddle,saddleParts,createSaddleObserver} from '../dist/rider-saddle.js';
const near=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const scenario=bike=>({...articulatedPreset(bike),initialization:{mode:'launch'},saddle:{}});
test('finite saddle is mass neutral, isolated and partitions contact work on both connected bikes',async()=>{
 const mj=await getRuntime();
 for(const bike of ['full','hardtail']){
  const a=scenario(bike),r=await run(a);assert.equal(r.status,'completed');assert.equal(r.massBudget.total,83);assert.ok(r.frames.some(f=>f.saddle.supported));assert.ok(r.frames.some(f=>!f.saddle.supported));assert.ok(r.summary.maxPowerResidual<1e-8);assert.ok(r.summary.maxResidual<.2);
  for(const f of r.frames){const s=f.saddle;assert.ok(s.normalForce>=0);near(s.power,s.pairPower);near(s.pairPower,s.riderPower+s.bikePower);near(f.constraintWork,f.normalWork+f.tangentWork+f.brakeWork+f.articulated.closureWork+s.work);assert.ok(s.gap>-.01);assert.equal(f.contacts.some(c=>c.wheel!==0&&c.wheel!==1),false);}
  assert.ok(r.frames.some(f=>f.saddle.power>1),'rebound energy must remain signed');assert.deepEqual(await replay(JSON.parse(JSON.stringify(r))),r);
  const {saddle,...bare}=a,m=mj.MjModel.from_xml_string(modelXML(a)),without=mj.MjModel.from_xml_string(modelXML(bare));
  try{assert.deepEqual(Array.from(m.body_mass),Array.from(without.body_mass));assert.deepEqual(Array.from(m.body_inertia),Array.from(without.body_inertia));assert.equal(m.npair,1);for(const name of ['rider_pelvis','rider_saddle']){const id=mj.mj_name2id(m,mj.mjtObj.mjOBJ_GEOM.value,name);assert.equal(m.geom_contype[id],0);assert.equal(m.geom_conaffinity[id],0);}}finally{m.delete();without.delete();}
 }
});
test('rigid saddle force, common-point power and separation are invariant to geom ordering',async()=>{
 const mj=await getRuntime(),spec=validateSaddle({padCenter:[0,0]}),parts=saddleParts(spec);
 for(const swapped of [false,true])for(const jacobian of ['dense','sparse']){
  let pair=parts.pair;if(swapped)pair=pair.replace('geom1="rider_saddle" geom2="rider_pelvis"','geom1="rider_pelvis" geom2="rider_saddle"');
  const xml=`<mujoco><option gravity="0 0 0" jacobian="${jacobian}"/><worldbody><body name="frame"><joint name="x" type="slide" axis="1 0 0"/><joint name="z" type="slide" axis="0 0 1"/><joint name="pitch" type="hinge" axis="0 1 0"/><inertial mass="10" pos="0 0 0" diaginertia="1 1 1"/>${parts.pad}<body name="rider_trunk" pos="0 0 .099"><joint name="riderX" type="slide" axis="1 0 0"/><joint name="riderZ" type="slide" axis="0 0 1"/><joint name="riderPitch" type="hinge" axis="0 1 0"/><inertial mass="1" pos=".02 0 .02" diaginertia=".01 .01 .01"/>${parts.pelvis}</body></body></worldbody>${pair}</mujoco>`;
  const m=mj.MjModel.from_xml_string(xml),d=new mj.MjData(m),o=createSaddleObserver(mj,m,d,spec);
  try{d.qvel[1]=.1;d.qvel[2]=.2;d.qvel[4]=-.1;d.qvel[5]=.3;mj.mj_forward(m,d);assert.equal(o.observe(),null);assert.ok(o.out.force[2]>0);near(o.out.power,o.out.pairPower);near(d.qfrc_constraint[0],0);near(d.qfrc_constraint[1],0);near(d.qfrc_constraint[2],0);near(d.qfrc_constraint[4],o.out.force[2]);
   d.qpos[4]=.03;mj.mj_forward(m,d);assert.equal(o.observe(),null);assert.equal(o.out.supported,false);assert.equal(o.out.normalForce,0);assert.ok(o.rows.every(x=>x===0));
   d.qpos[4]=0;mj.mj_forward(m,d);assert.equal(o.observe(),null);assert.ok(o.out.supported);
   d.qpos[4]=-.02;mj.mj_forward(m,d);assert.equal(o.observe(),'saddle-penetration-limit');
   d.qpos[3]=.18;d.qpos[4]=-.08;mj.mj_forward(m,d);assert.equal(o.observe(),'saddle-side-contact');
  }finally{o.delete();d.delete();m.delete();}
 }
});
test('saddle configuration rejects unsupported geometry and remains opt-in',()=>{
 for(const value of [null,{friction:.5},{halfSize:[.1,.1,0]},{padCenter:[NaN,0]},{contactTime:0},{maxPenetration:Infinity}])assert.throws(()=>validateSaddle(value));
 assert.throws(()=>modelXML({...articulatedPreset(),saddle:{}}));
});

test('both bikes unload, separate and recontact with unchanged guards and refined timestep',async()=>{
 for(const bike of ['full','hardtail']){
  const a=scenario(bike);a.articulated={...a.articulated,closureTime:.01};a.saddle={padCenter:[-.15,.1505]};const seed=await run(a),state=structuredClone(seed.initialState);state.joints.find(j=>j.name==='riderZ').velocity=.15;
  const input={...seed.scenario,motion:{gravity:9.80665,dt:.00003125,duration:.1,sampleDt:.0005},initialization:{mode:'state',state}},r=await run(input);
  assert.equal(r.status,'completed');assert.deepEqual(r.frames.map(f=>Number(f.saddle.supported)).filter((v,i,a)=>!i||v!==a[i-1]),[1,0,1]);assert.ok(r.frames.some(f=>f.saddle.gap>0&&f.saddle.normalForce===0));
  const fine=await run({...input,motion:{...input.motion,dt:.000015625}});assert.equal(fine.status,'completed');assert.ok(fine.frames.some(f=>f.saddle.gap>0&&f.saddle.normalForce===0));
  for(const x of [r,fine]){assert.ok(x.summary.maxResidual<.1);assert.ok(x.summary.maxClosureGap<.002);assert.ok(x.summary.maxPowerResidual<1e-8);}
  near(r.frames.at(-1).saddle.gap,fine.frames.at(-1).saddle.gap,2e-5);assert.ok(Math.abs(r.frames.at(-1).saddle.work-fine.frames.at(-1).saddle.work)<.02);
  const sparse=await run({...input,motion:{...input.motion,sampleDt:.005}});assert.deepEqual(sparse.frames.at(-1),r.frames.at(-1));
 }
});
test('saddle fault at a command boundary restores accepted geometry, activation and work',async()=>{
 const mj=await getRuntime(),forward=mj.mj_forward,contactForce=mj.mj_contactForce,a=scenario('full'),reference=await run(a);a.commands=[{tick:0,rearDrive:0,frontBrake:0,rearBrake:0},{tick:2401,rearDrive:20,frontBrake:0,rearBrake:0}];let injected=false;
 mj.mj_contactForce=(m,d,i,out)=>{contactForce(m,d,i,out);if(!injected&&d.time>.075&&d.time<.07504&&Array.from(d.qfrc_applied).includes(20)){const list=d.contact,c=list.get(i);try{if(c.flex[0]<0&&c.flex[1]<0){out.GetView()[0]=NaN;d.eq_active[0]=0;injected=true;}}finally{c.delete();list.delete();}}};
 let r;try{r=await run(a);}finally{mj.mj_forward=forward;mj.mj_contactForce=contactForce;}
 assert.ok(injected);assert.equal(r.status,'terminated');assert.equal(r.termination.reason,'nonfinite-saddle-force');assert.equal(r.termination.attemptedCommandTick,2401);assert.deepEqual(r.frames.at(-1),reference.frames.find(f=>Math.abs(f.time-.075)<1e-10));assert.ok(r.frames.at(-1).articulated.interfaces.attachments.every(a=>a.active));
});

