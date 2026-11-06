import test from 'node:test';
import assert from 'node:assert/strict';
import {createSealedGas} from '../scripts/lib/tyre-gas.mjs';
import {createPressureChamber} from '../scripts/lib/tyre-pressure.mjs';
import {createMeridianDiagnostic} from '../scripts/lib/tyre-meridian.mjs';
import {meridianFixture} from '../scripts/lib/tyre-meridian-fixture.mjs';
import {solveMeridianEquilibrium,inspectEquilibriumTangent} from '../scripts/lib/tyre-equilibrium.mjs';
import {factorBand,solveBandRankOne} from '../scripts/lib/tyre-banded.mjs';
const config=()=>({referenceVolume:.005,initialGaugePressure:160000,ambientPressure:101325,exponent:1.2,minVolumeFraction:.5,maxVolumeFraction:1.5,provenance:'Illustrative gas control'});
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} != ${b}, budget ${t}`);
const integrate=(f,a,b)=>{const n=2048,h=(b-a)/n;let s=f(a)+f(b);for(let i=1;i<n;i++)s+=(i%2?4:2)*f(a+i*h);return s*h/3;};
const bandEntry=(b,i,j)=>Math.abs(i-j)>3?0:b[4*Math.max(i,j)+Math.abs(i-j)];
test('sealed gas energy and pressure derivatives cover expansion, compression and n near one',()=>{
 for(const exponent of [1,1+Number.EPSILON,1.00000001,1.2,1.4])for(const initialGaugePressure of [0,160000]){
  const c={...config(),exponent,initialGaugePressure},gas=createSealedGas(c),P0=initialGaugePressure+c.ambientPressure;
  for(const fraction of [.8,.99999,1,1.00001,1.2]){
   const V=c.referenceVolume*fraction,s=gas.evaluate(V),pressure=v=>P0*(c.referenceVolume/v)**exponent-c.ambientPressure;
   near(s.gaugePressure,pressure(V),1e-9);near(s.energy,-integrate(pressure,c.referenceVolume,V),2e-10);
   const h=1e-9;near((gas.evaluate(V+h).energy-gas.evaluate(V-h).energy)/(2*h),-s.gaugePressure,.1);
   near(-(gas.evaluate(V+h).gaugePressure-gas.evaluate(V-h).gaugePressure)/(2*h),s.coupling,.1);
  }
  if(initialGaugePressure>0)assert.ok(gas.evaluate(c.referenceVolume*1.1).energy<0);
  else assert.ok(gas.evaluate(c.referenceVolume*1.1).gaugePressure<0,'Do not clamp negative gauge pressure');
 }
});
test('prescribed and spatial gas share one pressure-energy law and own declared inputs',()=>{
 const c=config(),strip={...c,sectionRadius:.03,arcLengths:[.02,.03],provenance:{kind:'illustrative',reference:'Shared law'}};delete strip.maxVolumeFraction;
 const a=createPressureChamber(strip).evaluate([.01,.02]),gas=createSealedGas(c),b=gas.evaluate(a.volume);
 near(a.gaugePressure,b.gaugePressure,1e-9);near(a.energy,b.energy,2e-12);
 c.initialGaugePressure=1;assert.equal(gas.evaluate(c.referenceVolume).gaugePressure,160000);
 for(const volume of [NaN,0,.001,.008])assert.throws(()=>gas.evaluate(volume));
 assert.throws(()=>createSealedGas({...config(),unknown:1}));
 const bad=config();Object.defineProperty(bad,'exponent',{get(){throw Error('getter must not run');}});assert.throws(()=>createSealedGas(bad),TypeError);
});
test('spatial sealed force and full tangent match independent differences including distant nodes',()=>{
 for(const n of [8,16]){
  const c=meridianFixture(n),restVolume=createMeridianDiagnostic(c).evaluate(c.restPoints).volume;
  c.gas={referenceVolume:restVolume*1.02,ambientPressure:101325,exponent:1.00000001,minVolumeFraction:.5,maxVolumeFraction:1.5};
  const m=createMeridianDiagnostic(c),q=c.restPoints.map(([x,z])=>[x+.002*z,z*1.003]),s=m.evaluate(q),{bands,rankOne:r}=m.tangentParts(q),count=2*(q.length-2);
  assert.throws(()=>m.tangentBands(q),/global rank-one/);
  for(let node=0;node<q.length;node++)for(let axis=0;axis<2;axis++){
   const h=2e-8,a=structuredClone(q),b=structuredClone(q);a[node][axis]+=h;b[node][axis]-=h;
   const sa=m.evaluate(a),sb=m.evaluate(b);near(-(sa.potential-sb.potential)/(2*h),s.forces[node][axis],3e-5);
   if(node>0&&node<q.length-1){const j=2*(node-1)+axis,fa=sa.forces.slice(1,-1).flat(),fb=sb.forces.slice(1,-1).flat();
    for(let i=0;i<count;i++){const expected=bandEntry(bands,i,j)+r.coefficient*r.vector[i]*r.vector[j];near(-(fa[i]-fb[i])/(2*h),expected,.03+3e-8*Math.abs(expected));}}
  }
  assert.ok(Math.abs(r.coefficient*r.vector[1]*r.vector.at(-1))>1,'Distant radial nodes must remain coupled');
 }
});
test('rank-one solve satisfies a dense independently multiplied system with regularization',()=>{
 for(const n of [6,30])for(const coefficient of [0,1,1e6])for(const shift of [0,3]){
  const b=new Float64Array(4*n),g=Array.from({length:n},(_,i)=>Math.sin(i+.2)),rhs=Float64Array.from({length:n},(_,i)=>Math.cos(i));
  for(let i=0;i<n;i++){b[4*i]=9;for(let d=1;d<=Math.min(i,3);d++)b[4*i+d]=.2;}
  const x=solveBandRankOne(factorBand(b,shift),rhs,{coefficient,vector:g},b,shift);assert.ok(x);
  for(let i=0;i<n;i++){let v=shift*x[i];for(let j=0;j<n;j++)v+=(bandEntry(b,i,j)+coefficient*g[i]*g[j])*x[j];near(v,rhs[i],2e-8);}
 }
 const b=new Float64Array([1,0,0,0]);assert.equal(solveBandRankOne(factorBand(b),[1],{coefficient:Infinity,vector:[1]},b),null);
});
test('sealed equilibrium matches dense reference and sealing an inflated reference preserves its pressure',()=>{
 for(const n of [8,16,32])for(const exponent of [1,1.4]){
  const c=meridianFixture(n),inflated=solveMeridianEquilibrium(c),V0=createMeridianDiagnostic(c).evaluate(c.restPoints).volume;
  for(const referenceVolume of [V0,inflated.state.volume]){
   const sealed={...c,gas:{referenceVolume,ambientPressure:101325,exponent,minVolumeFraction:.5,maxVolumeFraction:1.5}};
   const a=solveMeridianEquilibrium(sealed,c.restPoints,{tangent:'analytic-banded'}),d=solveMeridianEquilibrium(sealed);
   assert.ok(a.converged,a.reason);assert.ok(d.converged,d.reason);assert.equal(a.state.compressiveSegments,0);
   for(let i=0;i<a.points.length;i++)for(let k=0;k<2;k++)near(a.points[i][k],d.points[i][k],2e-9);
   assert.equal(inspectEquilibriumTangent(sealed,a.points).classification,'positive-with-refinement-margin');
   if(referenceVolume===inflated.state.volume){near(a.state.gas.gaugePressure,c.gaugePressure,.01);near(a.state.volume,inflated.state.volume,1e-10);}
   else assert.ok(a.state.gas.gaugePressure<c.gaugePressure);
  }
 }
});
