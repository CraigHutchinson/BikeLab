import test from 'node:test';
import assert from 'node:assert/strict';
import {getRuntime} from '../dist/moving-wheel.js';
import {passiveRiderParts} from '../dist/rider-native.js';
import {createUnboundRiderObserver,createUnboundRiderObservation,UNBOUND_RIDER_BINDING} from '../dist/rider-unbound-observer.js';
import {runUnbound,unboundExample} from '../dist/rider-unbound.js';

const names=prefix=>Object.fromEntries(Object.entries(UNBOUND_RIDER_BINDING).map(([k,v])=>[k,v.map(n=>prefix+n)]));
const renamed=(body,prefix)=>body.replace(/name="([^"]+)"/g,(_,name)=>`name="${prefix+name}"`);
const xml=(body,dt=.00003125)=>`<mujoco><compiler angle="radian" fusestatic="false"/><option timestep="${dt}" gravity="0 0 -9.80665" integrator="implicitfast"/><worldbody>${body}</worldbody></mujoco>`;
const init=(observer,data,spec)=>{for(let i=0;i<7;i++){const j=observer.joints[i];data.qpos[j.q]=spec.q[i];data.qvel[j.v]=spec.v[i];}};
const plain=value=>JSON.parse(JSON.stringify(value,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v));
const near=(a,b,path='observation')=>{
 if(typeof b==='number')assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-11*Math.max(1,Math.abs(b)),path+': '+a+' vs '+b);
 else if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a),Object.keys(b),path);for(const k of Object.keys(b))near(a[k],b[k],path+'.'+k);}
 else assert.equal(a,b,path);
};
const fields=frame=>Object.fromEntries(Object.keys(createUnboundRiderObservation()).map(k=>[k,frame[k]]));

test('rider observation ignores unrelated free/ball coordinates, contacts and forces without advancing or owning the world',async()=>{
 const mj=await getRuntime(),s=unboundExample(),parts=passiveRiderParts(s.passive),reference=(await runUnbound(s)).frames[0];
 const foreign='<geom name="ground" type="plane" size="10 10 .1"/><body name="foreign" pos="3 .4 .05"><freejoint name="foreignFree"/><geom type="sphere" size=".1" mass="2"/></body>';
 const after='<body name="after" pos="4 .7 2"><joint name="afterBall" type="ball"/><inertial pos="0 0 0" mass="3" diaginertia=".2 .3 .4"/></body>';
 let model,data,buffer;
 try{
  model=mj.MjModel.from_xml_string(xml(foreign+parts.body+after));data=new mj.MjData(model);buffer=new mj.DoubleBuffer(6);
  const observer=createUnboundRiderObserver(mj,model,data,{passive:parts.passive,velocityBuffer:buffer}),out=createUnboundRiderObservation();
  assert.equal(observer.mass,70);assert.equal(observer.bodies.length,5);assert.equal(observer.joints[0].q,7);assert.equal(observer.joints[0].v,6);
  assert.notEqual(model.nq,model.nv);init(observer,data,s);data.qvel[4]=12;data.qfrc_applied[0]=35;data.xfrc_applied[6]=4;
  mj.mj_forward(model,data);mj.mj_energyPos(model,data);mj.mj_energyVel(model,data);assert.ok(data.ncon>0);assert.ok(data.nefc>0);
  const before={q:Array.from(data.qpos),v:Array.from(data.qvel),warm:Array.from(data.qacc_warmstart),force:Array.from(data.qfrc_applied),bodyForce:Array.from(data.xfrc_applied),time:data.time,energy:Array.from(data.energy)};
  const original={step:mj.mj_step,forward:mj.mj_forward,pos:mj.mj_energyPos,vel:mj.mj_energyVel};
  try{
   mj.mj_step=mj.mj_forward=mj.mj_energyPos=mj.mj_energyVel=()=>{throw Error('Observer tried to advance/evaluate world');};
   assert.equal(observer.observe(out),null);assert.equal(observer.observe(out),null);
  }finally{mj.mj_step=original.step;mj.mj_forward=original.forward;mj.mj_energyPos=original.pos;mj.mj_energyVel=original.vel;}
  near(plain(out),fields(reference));assert.equal(Object.hasOwn(out,'energy'),false);
  assert.deepEqual({q:Array.from(data.qpos),v:Array.from(data.qvel),warm:Array.from(data.qacc_warmstart),force:Array.from(data.qfrc_applied),bodyForce:Array.from(data.xfrc_applied),time:data.time,energy:Array.from(data.energy)},before);
  // Borrowed resources remain usable; the caller alone disposes the native world.
  mj.mj_step(model,data);assert.ok(data.time>0);
 }finally{buffer?.delete();data?.delete();model?.delete();}
});

test('explicit name bindings observe two independent rider trees without mixing state, mass or output storage',async()=>{
 const mj=await getRuntime(),s=unboundExample(),other=unboundExample('translation');other.q[0]=3;other.q[1]=1;other.v[0]=-.4;
 const parts=passiveRiderParts(s.passive),otherParts=passiveRiderParts(other.passive),expected=[await runUnbound(s),await runUnbound(other)];
 let model,data,buffer;
 try{
  model=mj.MjModel.from_xml_string(xml(parts.body+renamed(otherParts.body,'guest_')));data=new mj.MjData(model);buffer=new mj.DoubleBuffer(6);
  const binding=names('guest_'),observers=[createUnboundRiderObserver(mj,model,data,{passive:parts.passive,velocityBuffer:buffer}),createUnboundRiderObserver(mj,model,data,{passive:otherParts.passive,velocityBuffer:buffer,binding})];
  binding.bodyNames.fill('changed-after-binding');
  const out=observers.map(()=>createUnboundRiderObservation());observers.forEach((o,i)=>init(o,data,i?other:s));
  assert.equal(observers[0].mass+observers[1].mass,140);assert.equal(new Set(observers.flatMap(o=>o.bodies.map(b=>b.id))).size,10);
  assert.ok(Object.isFrozen(observers[0].joints[0]));
  for(let step=0;step<=640;step++){
   mj.mj_forward(model,data);
   if(step%160===0)for(let i=0;i<2;i++){
    assert.equal(observers[i].observe(out[i]),null);near(plain(out[i]),fields(expected[i].frames[step/160]));
   }
   if(step<640)mj.mj_step(model,data);
  }
  const held=plain(out[0]);out[1].segments[0].com.fill(99);assert.deepEqual(plain(out[0]),held);
  data.qpos[observers[1].joints[6].q]=-.301;mj.mj_forward(model,data);
  assert.equal(observers[1].observe(out[1]),'rider-elbow-angle-limit');assert.equal(observers[0].observe(out[0]),null);
 }finally{buffer?.delete();data?.delete();model?.delete();}
});

test('binding rejects missing, duplicate, wrong-owner and incomplete native rider trees',async()=>{
 const mj=await getRuntime(),parts=passiveRiderParts();let model,data,buffer;
 try{
  model=mj.MjModel.from_xml_string(xml(parts.body));data=new mj.MjData(model);buffer=new mj.DoubleBuffer(6);
  const create=binding=>createUnboundRiderObserver(mj,model,data,{passive:parts.passive,velocityBuffer:buffer,binding});
  const missing=names('missing_');assert.throws(()=>create(missing),/Missing unbound/);
  const duplicate=names('');duplicate.jointNames[1]=duplicate.jointNames[0];assert.throws(()=>create(duplicate),/Invalid unbound rider binding/);
  const swapped=names('');[swapped.jointNames[0],swapped.jointNames[1]]=[swapped.jointNames[1],swapped.jointNames[0]];assert.throws(()=>create(swapped),/joint order/);
  const wrongJoint=names('');[wrongJoint.jointNames[3],wrongJoint.jointNames[4]]=[wrongJoint.jointNames[4],wrongJoint.jointNames[3]];assert.throws(()=>create(wrongJoint),/another body/);
  const wrongSite=names('');[wrongSite.endSiteNames[0],wrongSite.endSiteNames[1]]=[wrongSite.endSiteNames[1],wrongSite.endSiteNames[0]];assert.throws(()=>create(wrongSite),/endpoint belongs/);
 }finally{buffer?.delete();data?.delete();model?.delete();}
 for(const body of [
  '<body name="parent"><joint type="slide"/><inertial pos="0 0 0" mass="1" diaginertia="1 1 1"/>'+parts.body+'</body>',
  parts.body.replace('</body>','<body name="extra"><inertial pos="0 0 0" mass="1" diaginertia="1 1 1"/></body></body>')
 ]){
  model=data=buffer=undefined;
  try{
   model=mj.MjModel.from_xml_string(xml(body));data=new mj.MjData(model);buffer=new mj.DoubleBuffer(6);
   assert.throws(()=>createUnboundRiderObserver(mj,model,data,{passive:parts.passive,velocityBuffer:buffer}),/world-rooted|unowned child/);
  }finally{buffer?.delete();data?.delete();model?.delete();}
 }
});
