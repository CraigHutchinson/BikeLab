import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {run,replay,preset,validate,modelXML} from '../dist/trail-bike.js';
import {getRuntime,wheelParts,terrainParts,validate as wheelParams} from '../dist/moving-wheel.js';
import {fixture} from '../dist/terrain.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}, tolerance ${t}`);
const last=r=>r.frames.at(-1);

test('surface configuration is bounded and old records retain exact frictionless motion',async()=>{
 for(const surface of [[],{other:1},{friction:null},{friction:NaN},{friction:-.1},{friction:2.1},{friction:1e-6}])assert.throws(()=>validate({surface}));
 assert.ok(!modelXML().includes('cone="elliptic"'));assert.ok(modelXML({surface:{friction:.6}}).includes('cone="elliptic"'));
 const saved=JSON.parse(await readFile(new URL('./fixtures/trail-bike-0.2.json',import.meta.url),'utf8')),r=await replay(saved);
 const compare=(a,b)=>{if(a&&typeof a==='object')for(const k of Object.keys(a))compare(a[k],b[k]);else assert.equal(b,a);};
 compare(saved.frames,r.frames);assert.equal(r.scenario.surface.friction,0);assert.equal(last(r).tangentWork,0);assert.ok(r.frames.every(f=>f.contacts.every(c=>c.slip===null)));
 const bad=structuredClone(r);delete bad.scenario.surface;assert.throws(()=>replay(bad),/surface/);bad.model='bikelab-trail-bike-0.2';bad.scenario.surface={friction:.6};assert.throws(()=>replay(bad),/Legacy/);
});

test('rigid sliding reference has Coulomb force, dissipative work and correct reversal sign',async()=>{
 const mj=await getRuntime();
 for(const direction of [-1,1]){const model=mj.MjModel.from_xml_string('<mujoco><option gravity="0 0 0" cone="elliptic" timestep=".00001" tolerance="1e-12"/><worldbody><geom type="plane" size="2 2 .1" condim="3" friction=".4 0 0"/><body pos="0 0 .09999"><joint type="slide" axis="1 0 0"/><geom type="sphere" size=".1" mass="1" condim="3" friction=".4 0 0"/></body></worldbody></mujoco>'),d=new mj.MjData(model),buffer=new mj.DoubleBuffer(6);
  try{d.qvel[0]=direction;mj.mj_forward(model,d);const list=d.contact;try{const c=list.get(0);try{mj.mj_contactForce(model,d,0,buffer);const F=buffer.GetView(),fx=c.frame[0]*F[0]+c.frame[3]*F[1]+c.frame[6]*F[2];assert.ok(F[0]>0);near(fx,-direction*.4*F[0],1e-8);near(d.qfrc_constraint[0],fx);let work=0;for(let k=0;k<3;k++)work+=F[k]*d.efc_vel[c.efc_address+k];near(work,fx*direction);assert.ok(work<0);}finally{c.delete();}}finally{list.delete();}}
  finally{buffer.delete();d.delete();model.delete();}
 }
});

test('deformed flex contact velocity matches independent weighted point velocities',async()=>{
 const mj=await getRuntime(),p=wheelParams(),parts=wheelParts(p,'wheel',.6),ground=terrainParts(p,fixture('flat'),.6);
 const model=mj.MjModel.from_xml_string(`<mujoco><option cone="elliptic" gravity="0 0 0"/><asset>${ground.assets}</asset><worldbody>${ground.geoms}<body pos="0 0 .358"><joint name="travel" type="slide" axis="1 0 0"/><joint name="spin" type="hinge" axis="0 1 0"/><inertial pos="0 0 0" mass="3" diaginertia=".08 .08 .08"/>${parts.nodes}</body></worldbody><deformable>${parts.flex}</deformable></mujoco>`),d=new mj.MjData(model),velocity=new mj.DoubleBuffer(6);let checked=0,skinContribution=0;
 try{d.qpos[1]=.04;d.qvel[0]=.7;d.qvel[1]=1.2;for(let i=2;i<model.nv;i++){d.qpos[i]=.0002*Math.sin(i);d.qvel[i]=.03*Math.cos(i);}mj.mj_forward(model,d);const list=d.contact;
  try{for(let i=0;i<list.size();i++){const c=list.get(i);try{if(c.efc_address<0)continue;const side=c.flex[0]>=0?0:1,flex=c.flex[side],element=c.elem[side];if(element<0)continue;assert.equal(c.vert[side],-1);const nodes=[model.flex_elem[model.flex_elemdataadr[flex]+2*element],model.flex_elem[model.flex_elemdataadr[flex]+2*element+1]],weights=nodes.map(n=>{const v=3*(model.flex_vertadr[flex]+n);return 1/Math.max(1e-15,Math.hypot(...[0,1,2].map(k=>c.pos[k]-d.flexvert_xpos[v+k])));}),sum=weights[0]+weights[1],expected=[0,0,0],comOnly=[0,0,0];
   nodes.forEach((n,j)=>{const b=model.flex_vertbodyid[model.flex_vertadr[flex]+n];mj.mj_objectVelocity(model,d,mj.mjtObj.mjOBJ_BODY.value,b,velocity,0);const v=velocity.GetView(),r=[0,1,2].map(k=>c.pos[k]-d.xipos[3*b+k]),weight=weights[j]/sum;const point=[v[3]+v[1]*r[2]-v[2]*r[1],v[4]+v[2]*r[0]-v[0]*r[2],v[5]+v[0]*r[1]-v[1]*r[0]];for(let k=0;k<3;k++){expected[k]+=weight*point[k];comOnly[k]+=weight*v[k+3];}});
   for(let axis=0;axis<3;axis++){let local=0;for(let k=0;k<3;k++)local+=c.frame[3*axis+k]*expected[k]*(side?1:-1);near(d.efc_vel[c.efc_address+axis],local,1e-10);}skinContribution=Math.max(skinContribution,Math.hypot(...expected.map((v,k)=>v-comOnly[k])));checked++;
  }finally{c.delete();}}}finally{list.delete();}
  assert.ok(checked>0);assert.ok(skinContribution>.001,'control must exercise rotation at the skin contact point');
 }finally{velocity.delete();d.delete();model.delete();}
});

test('connected sliding tyres close contact wrenches, Coulomb bounds and signed work on both bikes',async()=>{
 for(const bike of ['full','hardtail']){const a=preset('sliding',bike);a.motion.duration=.08;const r=await run(a);assert.equal(r.status,'completed');assert.ok(r.frames[0].contacts.length===0);assert.ok(r.frames.some(f=>f.contacts.length>=4));assert.ok(last(r).tangentWork<-.5);assert.ok(r.summary.maxPowerResidual<1e-8);assert.ok(r.summary.maxSampledRootWrench<1e-7);assert.ok(r.summary.maxSampledBearingMoment<1e-7);
  for(const f of r.frames){near(f.normalWork+f.tangentWork,f.constraintWork,1e-8);for(let k=0;k<2;k++){const w=f.wheels[k],sum=[0,0,0];for(const c of f.contacts.filter(c=>c.wheel===k)){near(c.force[0]*c.normal[0]+c.force[1]*c.normal[1],c.normalForce);assert.ok(Math.abs(c.tangentForce)<=r.scenario.surface.friction*c.normalForce+1e-7);assert.ok(Number.isFinite(c.slip));sum[0]+=c.force[0];sum[1]+=c.force[1];sum[2]+=(c.point[1]-w.hub[1])*c.force[0]-(c.point[0]-w.hub[0])*c.force[1];}for(let j=0;j<3;j++)near(sum[j],w.ground[j],1e-7);}}
  const finer=await run({...a,motion:{...a.motion,sampleDt:.0025}});assert.deepEqual(last(finer),last(r));assert.deepEqual(await replay(JSON.parse(JSON.stringify(r))),r);
 }
});

