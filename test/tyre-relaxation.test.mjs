import test from 'node:test';import assert from 'node:assert/strict';
import {relaxEndpointInto} from '../dist/tyre-relaxation.js';
import {createSweptCasing,MODEL,ENDPOINT_MODEL,RELAXED_MODEL} from '../dist/sealed-casing.js';
import {preset} from '../dist/moving-wheel.js';
import {solveSealedPlane} from '../scripts/lib/tyre-sealed-load.mjs';
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} vs ${b}; budget ${t}`);
const energy=(a,b,h,Cm,Ch,Cc)=>(Cm*(a*a+b*b)/2+Cc*(a+b)*h+Ch*h*h)/2;
test('relaxed energy satisfies KKT, independent coordinate minimization and energy derivatives',()=>{
 for(const Cc of [-80000,-20000,0,20000,80000])for(let i=0;i<100;i++){
  const Cm=200000,Ch=100000,e=[.04*Math.sin(i*1.71),.04*Math.sin(i*2.13+.3),.04*Math.cos(i*.71)],r=relaxEndpointInto(Cm,Ch,Cc,...e,new Float64Array(7));
  // Independent cyclic exact coordinate minimization, not active-set enumeration.
  let [a,b,h]=e;for(let j=0;j<200;j++){a=Math.max(e[0],-Cc*h/Cm);b=Math.max(e[1],-Cc*h/Cm);h=Math.max(e[2],-Cc*(a+b)/(2*Ch));}
  near(r[0],energy(a,b,h,Cm,Ch,Cc),1e-9);assert.ok(r[0]<=energy(...e,Cm,Ch,Cc)+1e-10);
  for(let j=0;j<3;j++){assert.ok(r[1+j]>=0&&r[4+j]>=0);near(r[1+j]*r[4+j],0,1e-8);const x=[...e],d=1e-7;x[j]+=d;const plus=relaxEndpointInto(Cm,Ch,Cc,...x,new Float64Array(7))[0];x[j]-=2*d;const minus=relaxEndpointInto(Cm,Ch,Cc,...x,new Float64Array(7))[0];near((plus-minus)/(2*d),r[j+1]*(j===2?1:.5),.003);}
 }
});
test('relaxation retains tensile parent and is continuous across active-set boundaries',()=>{
 for(const Cc of [-20000,0,20000]){const Cm=200000,Ch=100000,h=.01,a=-Cc*h/Cm;let prior;
  for(const d of [-1e-8,0,1e-8]){const r=relaxEndpointInto(Cm,Ch,Cc,a+d,.02,h,new Float64Array(7));if(prior){near(r[0],prior[0],.001);for(let k=1;k<=3;k++)near(r[k],prior[k],.003);}prior=r;}
  const r=relaxEndpointInto(Cm,Ch,Cc,.01,.02,.01,new Float64Array(7));near(r[0],energy(.01,.02,.01,Cm,Ch,Cc),1e-12);assert.deepEqual(Array.from(r.slice(4)),[0,0,0]);
 }
});
test('relaxed geometry forces differentiate material and gas energies in loaded relaxed states',()=>{
 for(const nodes of [32,64]){const c={...preset('sealed').casing,nodes},m=createSweptCasing(c,RELAXED_MODEL),q=Float64Array.from(m.initial);q[1]+=.003;const s=m.evaluate(q),f=Float64Array.from(s.forces),fm=Float64Array.from(s.materialForces);assert.ok(s.relaxedCells>0);
  for(let i=0;i<q.length;i++){const v=q[i],h=2e-8;q[i]=v+h;const a=m.evaluate(q),u=a.potential,um=a.materialEnergy;q[i]=v-h;const b=m.evaluate(q);near(-(u-b.potential)/(2*h),f[i],.001);near(-(um-b.materialEnergy)/(2*h),fm[i],.001);q[i]=v;}
 }
});
test('rotated plane preserves zero-phase identity, phase reflection and reaction work',()=>{
 const c=preset('sealed').casing,m=createSweptCasing(c,RELAXED_MODEL),height=m.reference.radius-.002,angle=Math.PI/c.nodes;
 const a=solveSealedPlane(c,height,undefined,{casingModel:RELAXED_MODEL,planeAngle:angle}),b=solveSealedPlane(c,height,undefined,{casingModel:RELAXED_MODEL,planeAngle:-angle});assert.ok(a.converged&&b.converged);near(a.reaction,b.reaction,1e-5);near(a.state.potential,b.state.potential,1e-9);
 const h=1e-7,p=solveSealedPlane(c,height+h,a.coordinates,{casingModel:RELAXED_MODEL,planeAngle:angle}),n=solveSealedPlane(c,height-h,a.coordinates,{casingModel:RELAXED_MODEL,planeAngle:angle});assert.ok(p.converged&&n.converged);near(-(p.state.potential-n.state.potential)/(2*h),a.reaction,.003);
 assert.deepEqual(solveSealedPlane(c,height,undefined,{casingModel:ENDPOINT_MODEL}),solveSealedPlane(c,height,undefined,{casingModel:ENDPOINT_MODEL,planeAngle:0}));assert.throws(()=>solveSealedPlane(c,height,undefined,{planeAngle:1}));
});
test('fine meshes are explicit candidate controls and do not broaden legacy runtime geometry',()=>{
 assert.throws(()=>createSweptCasing({...preset('sealed').casing,nodes:256},MODEL));
 for(const nodes of [256,512])for(const model of [ENDPOINT_MODEL,RELAXED_MODEL]){const m=createSweptCasing({...preset('sealed').casing,nodes},model);assert.ok(m.reference.unloadedResidual<=1e-5);assert.equal(m.initial.length,2*nodes);}
});
