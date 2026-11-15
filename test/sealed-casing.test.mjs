import test from 'node:test';
import assert from 'node:assert/strict';
import {createSweptCasing} from '../dist/sealed-casing.js';
import {meridianFixture} from '../scripts/lib/tyre-meridian-fixture.mjs';
import {createMeridianDiagnostic} from '../scripts/lib/tyre-meridian.mjs';
export function sweptFixture(nodes=32,segments=8,gaugePressure=160000){const c=meridianFixture(segments);return {nodes,rimRadius:c.rimRadius,section:c.restPoints,meridionalRigidity:c.meridionalRigidity,hoopRigidity:c.hoopRigidity,couplingRigidity:c.couplingRigidity,gaugePressure,ambientPressure:101325,exponent:1.2,provenance:'Illustrative swept casing, no measured tyre'};}
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} != ${b} budget ${t}`);
test('closed swept reference volume approaches independent revolution volume',()=>{
 for(const n of [16,32,64])for(const k of [8,16]){
  const c=sweptFixture(n,k,0),m=createSweptCasing(c),meridian=meridianFixture(k),v=createMeridianDiagnostic(meridian).evaluate(meridian.restPoints).volume;
  near(m.reference.restVolume,v*Math.sin(2*Math.PI/n)/(2*Math.PI/n),1e-15);
  near(m.reference.radius,c.rimRadius+.05,1e-15);assert.ok(m.reference.unloadedResidual<1e-5);
 }
});
test('swept material and sealed pressure force match every tread coordinate energy derivative',()=>{
 for(const n of [16,32]){
  const m=createSweptCasing(sweptFixture(n)),q=Float64Array.from(m.initial);q[1]+=.0003;q[6]+=.0002;
  const s=m.evaluate(q),forces=Float64Array.from(s.forces),material=Float64Array.from(s.materialForces),gas=Float64Array.from(s.gasForces);
  for(let j=0;j<q.length;j++){const old=q[j],h=2e-8;q[j]=old+h;const a=m.evaluate(q),u=a.potential,um=a.materialEnergy,ug=a.gasEnergy;q[j]=old-h;const b=m.evaluate(q);near(-(u-b.potential)/(2*h),forces[j],3e-4);near(-(um-b.materialEnergy)/(2*h),material[j],3e-4);near(-(ug-b.gasEnergy)/(2*h),gas[j],3e-4);q[j]=old;}
 }
});
test('inflation prestress is balanced and local squash changes shared pressure without foundation',()=>{
 for(const pressure of [120000,160000,200000]){
  const m=createSweptCasing(sweptFixture(32,8,pressure)),q=Float64Array.from(m.initial),s=m.evaluate(q),initialV=s.volume;
  near(s.gaugePressure,pressure,1e-9);assert.equal(s.compressiveCells,0);assert.ok(Math.max(...s.forces.map(Math.abs))<1e-5);
  assert.ok(s.materialEnergy>0);q[1]+=.001;const compressed=m.evaluate(q);assert.ok(compressed.volume<initialV);assert.ok(compressed.gaugePressure>pressure);
  const restored=m.evaluate(m.initial);near(restored.gaugePressure,pressure,1e-9);near(restored.volume,initialV,0);
 }
});
test('owned configuration and reused buffers reject invalid reduced shapes',()=>{
 const c=sweptFixture(),m=createSweptCasing(c),s=m.evaluate(m.initial),f=s.forces;c.section[1][0]=999;c.gaugePressure=0;
 assert.equal(m.evaluate(m.initial),s);assert.equal(s.forces,f);assert.equal(s.gaugePressure,160000);
 const q=Float64Array.from(m.initial);q[0]=NaN;assert.throws(()=>m.evaluate(q));q.set(m.initial);q[0]+=.1;assert.throws(()=>m.evaluate(q));q.set(m.initial);q[1]=-.30;assert.throws(()=>m.evaluate(q));
 assert.throws(()=>createSweptCasing({...sweptFixture(),section:[...sweptFixture().section].reverse()}));
});

test('unloaded full tread tangents include tangential modes and stay positive at two difference scales',()=>{
 for(const nodes of [32,64])for(const pressure of [120000,160000,200000]){
  const m=createSweptCasing(sweptFixture(nodes,8,pressure)),q=Float64Array.from(m.initial),n=q.length;
  const tangents=[];
  for(const h of [1e-7,5e-8]){
   const H=new Float64Array(n*n);
   for(let j=0;j<n;j++){const v=q[j];q[j]=v+h;const plus=Float64Array.from(m.evaluate(q).forces);q[j]=v-h;const minus=m.evaluate(q).forces;for(let i=0;i<n;i++)H[i*n+j]=-(plus[i]-minus[i])/(2*h);q[j]=v;}
   for(let i=0;i<n;i++)for(let j=0;j<i;j++){near(H[i*n+j],H[j*n+i],.001);const v=(H[i*n+j]+H[j*n+i])/2;H[i*n+j]=v;H[j*n+i]=v;}
   tangents.push(Float64Array.from(H));
   // Independent dense Cholesky over all Cartesian coordinates, no shift.
   for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let v=H[i*n+j];for(let k=0;k<j;k++)v-=H[i*n+k]*H[j*n+k];if(i===j){assert.ok(v>1000,`unloaded pivot ${v}, nodes ${nodes}, pressure ${pressure}`);H[i*n+j]=Math.sqrt(v);}else H[i*n+j]=v/H[j*n+j];}
  }
  for(let i=0;i<n*n;i++)near(tangents[0][i],tangents[1][i],.002);
 }
});
