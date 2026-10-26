import test from 'node:test';
import assert from 'node:assert/strict';
import {bikeChassisAssembly} from '../dist/bike-assembly.js';
import {CHASSIS_DEFAULTS,validateChassis} from '../dist/bike-chassis.js';
import {validateConnectedRider} from '../dist/rider-connected.js';
import {ARTICULATED_BIKE_DEFAULTS,WHEEL_DEFAULTS} from '../dist/trail-bike.js';
import {geometryFor} from '../dist/linkage.js';
import {wheelParts,getRuntime} from '../dist/moving-wheel.js';
import {passiveRiderParts} from '../dist/rider-native.js';

const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-11*Math.max(1,Math.abs(b)),`${a} vs ${b}`);
const vector=(a,b)=>{assert.equal(a.length,b.length);b.forEach((x,i)=>near(a[i],x));};
const chassis={mass:9,com:[.12,-.22],inertia:[.6,.8,.5]};
const rotate=(q,[x,z])=>[Math.cos(q)*x+Math.sin(q)*z,-Math.sin(q)*x+Math.cos(q)*z];
const add=(a,b)=>a.map((x,i)=>x+b[i]);
function params(bike){
 const p={...ARTICULATED_BIKE_DEFAULTS,bike};delete p.rider;
 for(const key of ['mass','rider','riderMass'])Object.defineProperty(p,key,{get(){throw Error('Read legacy '+key);}});
 return p;
}
function fixture(bike,spatial,frameContents='',sibling=''){
 const p=params(bike),g=geometryFor(p);
 let wheels=null,deformable='';
 if(spatial){
  const w=WHEEL_DEFAULTS,front=wheelParts(w,'frontwheel'),rear=wheelParts(w,'rearwheel');
  const hub=(name,pos,parts)=>`<body name="${name}" pos="${pos}"><joint name="${name}Spin" type="hinge" axis="0 1 0"/><inertial pos="0 0 0" mass="${w.hubMass}" diaginertia="${w.hubInertia} ${w.hubInertia} ${w.hubInertia}"/>${parts.nodes}</body>`;
  wheels={frontMass:.5,rearMass:1.5,frontInertia:.01,rearInertia:.02,front:hub('frontwheel','0 0 0',front),rear:hub('rearwheel',bike==='full'?`${g.armX} 0 ${g.armZ}`:'0 0 0',rear)};
  deformable=`<deformable>${front.flex}${rear.flex}</deformable>`;
 }
 const tree=bikeChassisAssembly(p,wheels,chassis,frameContents);
 return {g,xml:`<mujoco><compiler angle="radian" fusestatic="false"/><worldbody>${tree.body}${sibling}</worldbody>${tree.tendon}${deformable}</mujoco>`};
}

test('explicit chassis requires complete properties; connected adapter retains defaults and rejects explicit undefined',()=>{
 assert.deepEqual(validateChassis({}),CHASSIS_DEFAULTS);
 assert.deepEqual(validateConnectedRider().chassis,CHASSIS_DEFAULTS);
 assert.deepEqual(validateConnectedRider({chassis:{mass:10}}).chassis,{...CHASSIS_DEFAULTS,mass:10});
 const input=structuredClone(chassis),c=validateChassis(input);input.com[0]=0;input.inertia[0]=1;
 assert.deepEqual(c,chassis);assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.com)&&Object.isFrozen(c.inertia));
 for(const bad of [undefined,null,[],{mass:NaN},{mass:1},{mass:31},{com:[0]},{com:[0,Infinity]},{com:[0,.51]},{inertia:[.1,.1,1]},{inertia:[0,0,0]},{unknown:1},{[Symbol('unknown')]:1}]){
  assert.throws(()=>validateChassis(bad));assert.throws(()=>validateConnectedRider({chassis:bad}));
 }
 const p=params('full');
 for(const bad of [undefined,null,{},...['mass','com','inertia'].map(k=>{const c={...chassis};delete c[k];return c;}),{...chassis,mass:undefined},Object.create(chassis),Object.defineProperty({...chassis},'mass',{enumerable:false}),Object.defineProperty({...chassis},'mass',{get(){throw Error('Accessor evaluated');}})]){
  assert.throws(()=>bikeChassisAssembly(p,null,bad),/Explicit chassis requires/);
 }
 assert.throws(()=>bikeChassisAssembly({...ARTICULATED_BIKE_DEFAULTS,bike:'unknown'},null,chassis),/bike kind/);
 assert.throws(()=>bikeChassisAssembly(p,null,chassis,{}),/Frame contents/);
});

for(const bike of ['full','hardtail'])for(const spatial of [false,true])test(`${bike} ${spatial?'spatial':'lumped'} chassis has independent mass, posed COM and central inertia without rider fallback`,async()=>{
 const mj=await getRuntime(),{g,xml}=fixture(bike,spatial);let model,data;
 try{
  model=mj.MjModel.from_xml_string(xml);data=new mj.MjData(model);
  const body=n=>mj.mj_name2id(model,mj.mjtObj.mjOBJ_BODY.value,n),joint=n=>mj.mj_name2id(model,mj.mjtObj.mjOBJ_JOINT.value,n);
  const set=(n,x)=>{const j=joint(n);assert.ok(j>=0);data.qpos[model.jnt_qposadr[j]]=x;};
  const frame=body('frame'),front=body('front'),rear=body('rear'),pitch=.2,heave=-.04,travel=spatial?.3:0,fork=.05,swing=bike==='full'?.12:0;
  set('heave',heave);set('pitch',pitch);set('fork',fork);if(spatial)set('travel',travel);if(bike==='full')set('swing',swing);
  mj.mj_forward(model,data);
  near(model.body_mass[frame],9);near(Array.from(model.body_mass).reduce((s,x)=>s+x,0),16);
  vector(Array.from(model.body_ipos.subarray(3*frame,3*frame+3)),[.12,0,-.22]);
  near(model.body_mass[front],spatial?.5:3);near(model.body_mass[rear],spatial?1.5:4);
  assert.equal(model.neq,0);assert.equal(model.ntendon,bike==='full'?1:0);assert.equal(joint('swing')>=0,bike==='full');assert.equal(joint('travel')>=0,spatial);
  for(const name of ['rider','rider_trunk'])assert.equal(body(name),-1);
  for(const name of ['riderSlide','riderX','riderZ','riderPitch','riderHip','riderKnee','riderShoulder','riderElbow'])assert.equal(joint(name),-1);
  for(const name of ['rider_hand','rider_foot','bike_hand','bike_foot'])assert.equal(mj.mj_name2id(model,mj.mjtObj.mjOBJ_SITE.value,name),-1);
  const origin=[travel,g.frameHeight+heave],world=point=>add(origin,rotate(pitch,point));
  const chassisCOM=world(chassis.com),frontCOM=world([g.frontX-fork*Math.cos(g.headAngle),g.axleZ+fork*Math.sin(g.headAngle)]);
  const rearCOM=world(bike==='full'?add([g.pivotX,g.pivotZ],rotate(swing,[g.armX,g.armZ])):[g.rearX,g.axleZ]);
  for(const [id,point] of [[frame,chassisCOM],[front,frontCOM],[rear,rearCOM]])vector(Array.from(data.xipos.subarray(3*id,3*id+3)),[point[0],0,point[1]]);
  const expected=[0,1].map(k=>(9*chassisCOM[k]+3*frontCOM[k]+4*rearCOM[k])/16),actual=[0,0,0];
  for(let b=1;b<model.nbody;b++)for(let k=0;k<3;k++)actual[k]+=model.body_mass[b]*data.xipos[3*b+k]/16;
  vector(actual,[expected[0],0,expected[1]]);
  // Native compiler may permute principal axes. Compare the complete world
  // tensor, independently rotated from the authored central frame tensor.
  const c=Math.cos(pitch),s=Math.sin(pitch),R=[[c,0,s],[0,1,0],[-s,0,c]];
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
   let actual=0,expected=0;
   for(let k=0;k<3;k++){actual+=data.ximat[9*frame+3*i+k]*model.body_inertia[3*frame+k]*data.ximat[9*frame+3*j+k];expected+=R[i][k]*chassis.inertia[k]*R[j][k];}
   near(actual,expected);
  }
 }finally{data?.delete();model?.delete();}
});

test('a separate world-rooted rider adds only its own mass and is not kinematically carried by either chassis',async()=>{
 const mj=await getRuntime(),rider=passiveRiderParts();
 for(const bike of ['full','hardtail']){let model,data;
  try{
   const {xml}=fixture(bike,true,rider.sites,rider.body);model=mj.MjModel.from_xml_string(xml);data=new mj.MjData(model);
   const body=n=>mj.mj_name2id(model,mj.mjtObj.mjOBJ_BODY.value,n),frame=body('frame'),trunk=body('rider_trunk');
   assert.equal(model.body_parentid[frame],0);assert.equal(model.body_parentid[trunk],0);assert.equal(model.neq,0);
   near(Array.from(model.body_mass).reduce((s,x)=>s+x,0),86);mj.mj_forward(model,data);
   const riderPose=Array.from(data.xpos.subarray(3*trunk,3*trunk+3));
   for(const [name,q] of [['travel',.4],['heave',.1],['pitch',.15]]){const j=mj.mj_name2id(model,mj.mjtObj.mjOBJ_JOINT.value,name);data.qpos[model.jnt_qposadr[j]]=q;}
   mj.mj_forward(model,data);vector(Array.from(data.xpos.subarray(3*trunk,3*trunk+3)),riderPose);
   for(const name of ['hand','foot']){const site=mj.mj_name2id(model,mj.mjtObj.mjOBJ_SITE.value,'bike_'+name);assert.ok(site>=0);assert.equal(model.site_bodyid[site],frame);}
  }finally{data?.delete();model?.delete();}
 }
});
