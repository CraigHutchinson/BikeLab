import test from 'node:test';import assert from 'node:assert/strict';
import {internalFrequencyBound,casingTangent} from '../scripts/lib/tyre-mass-frequency.mjs';
import {inverseMass} from '../scripts/spinning-gap.mjs';
import {getRuntime,modelXML,validate,preset} from '../dist/moving-wheel.js';
import {createSweptCasing,RELAXED_MODEL} from '../dist/sealed-casing.js';
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} vs ${b}; budget ${t}`);
test('coupled internal frequency includes hub recoil and scales with configured mass',()=>{
 const masses={hubMass:3,tyreMass:1,hubInertia:.08,skin:.008},K=[[100,0],[0,200]],q=[0,0],a=internalFrequencyBound(K,q,masses);near(a.lambdaBound,200*(1+1/3),1e-12);assert.ok(a.lambdaBound>a.fixedHubLambdaBound);
 for(const scale of [.5,2,4]){const b=internalFrequencyBound(K,q,{...masses,hubMass:masses.hubMass*scale,tyreMass:masses.tyreMass*scale,hubInertia:masses.hubInertia*scale});near(b.oscillatorScaleSeconds/a.oscillatorScaleSeconds,Math.sqrt(scale),1e-14);}
 const offset=internalFrequencyBound(K,[.2,-.3],masses);assert.ok(offset.lambdaBound>a.lambdaBound);assert.throws(()=>internalFrequencyBound(K,q,{...masses,hubMass:0}));assert.throws(()=>internalFrequencyBound([[NaN,0],[0,1]],q,masses));
});
test('semi-implicit oscillator discriminant changes at h omega equal to two',()=>{
 // Independent 2x2 amplification matrix: determinant one, trace 2-h*h*omega².
 for(const omega of [2,200,20000])for(const ratio of [.5,.99,1.01,1.5]){const h=2*ratio/omega,trace=2-h*h*omega*omega,discriminant=trace*trace-4;assert.equal(discriminant>0,ratio>1);}
});
test('configured coupled inverse satisfies full native mass matrix across meshes, masses and spin angles',async()=>{
 const mj=await getRuntime();assert.equal(mj.mj_versionString(),'3.16.0');
 for(const nodes of [32,128])for(const masses of [{hubMass:1,tyreMass:.5,hubInertia:.02},{hubMass:30,tyreMass:3,hubInertia:.5}]){
  const c={...preset('sealed').casing,nodes},casing=createSweptCasing(c,RELAXED_MODEL),p=validate({...masses,nodes,rimRadius:c.rimRadius,radius:casing.reference.radius+.008,height:1,dt:.0000078125,duration:.02,gravity:0}),model=mj.MjModel.from_xml_string(modelXML(p,undefined,casing));let data,full;
  try{data=new mj.MjData(model);const nv=model.nv;assert.equal(nv,3+2*nodes);full=new mj.DoubleBuffer(nv*nv);
   for(const angle of [0,.37]){mj.mj_resetData(model,data);data.qpos[2]=angle;data.qpos[3]=.0003;data.qpos[6]=-.0002;mj.mj_forward(model,data);mj.mj_fullM(model,data,full);const M=full.GetView(),b=Array.from({length:nodes},(_,i)=>[casing.initial[2*i]+data.qpos[3+2*i],casing.initial[2*i+1]+data.qpos[4+2*i]]),force=Array.from({length:nv},(_,i)=>Math.sin(i*.71)),a=inverseMass(force,b,masses.tyreMass/nodes,masses.hubMass,masses.hubInertia+masses.tyreMass*p.skin*p.skin/2,angle);
    for(let i=0;i<nv;i++){let value=0;for(let j=0;j<nv;j++)value+=M[i*nv+j]*a[j];near(value,force[i],2e-9);}
   }
  }finally{full?.delete();data?.delete();model.delete();}
 }
});

test('offline tangent has the energy Hessian sign and preserves inputs',()=>{
 const q=[.2,-.4],model={evaluate(p){return {forces:[-3*p[0]-p[1],-p[0]-4*p[1]]};}},a=casingTangent(model,q);
 near(a.matrix[0][0],3,1e-8);near(a.matrix[0][1],1,1e-8);near(a.matrix[1][1],4,1e-8);assert.deepEqual(q,[.2,-.4]);assert.throws(()=>casingTangent(model,q,0));
});
