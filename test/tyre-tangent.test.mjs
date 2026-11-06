import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeridianDiagnostic} from '../scripts/lib/tyre-meridian.mjs';
import {meridianFixture} from '../scripts/lib/tyre-meridian-fixture.mjs';
import {solveMeridianEquilibrium} from '../scripts/lib/tyre-equilibrium.mjs';
import {factorBand,solveBand,bandNorm} from '../scripts/lib/tyre-banded.mjs';
const entry=(b,i,j)=>Math.abs(i-j)>3?0:b[4*Math.max(i,j)+Math.abs(i-j)];
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} != ${b} budget ${t}`);
test('analytic tangent matches every force derivative including asymmetric and compressed states',()=>{
 for(const segments of [8,16,32])for(const pressure of [0,160000])for(const coupling of [-20000,20000]){
  const c={...meridianFixture(segments),gaugePressure:pressure,couplingRigidity:coupling},m=createMeridianDiagnostic(c);
  const q=c.restPoints.map(([x,z])=>[x*1.002+.003*z,z*.998]),b=m.tangentBands(q),n=2*(q.length-2);
  assert.equal(b.length,4*n);
  for(const h of [4e-8,2e-8])for(let j=0;j<n;j++){
   const a=structuredClone(q),d=structuredClone(q);a[1+(j>>1)][j%2]+=h;d[1+(j>>1)][j%2]-=h;
   const fa=m.evaluate(a).forces.slice(1,-1).flat(),fb=m.evaluate(d).forces.slice(1,-1).flat();
   for(let i=0;i<n;i++)near(entry(b,i,j),-(fa[i]-fb[i])/(2*h),.02+3e-8*Math.abs(entry(b,i,j)));
  }
 }
});
test('band Cholesky reconstructs coupled linear systems and rejects nonpositive pivots',()=>{
 for(const n of [6,30,126]){
  const b=new Float64Array(n*4);for(let i=0;i<n;i++){b[4*i]=8;for(let d=1;d<=Math.min(i,3);d++)b[4*i+d]=Math.sin(i+d);}
  for(const shift of [0,2]){const L=factorBand(b,shift),rhs=Float64Array.from({length:n},(_,i)=>Math.cos(i)),x=solveBand(L,rhs);
   for(let i=0;i<n;i++){let value=shift*x[i];for(let j=0;j<n;j++)value+=entry(b,i,j)*x[j];near(value,rhs[i],1e-14);}}
  assert.ok(bandNorm(b)>=8);const before=[...b];factorBand(b,2);assert.deepEqual([...b],before);
 }
 assert.equal(factorBand(new Float64Array([-1,0,0,0])),null);
 assert.equal(factorBand(new Float64Array([0,0,0,0])),null);
});
test('analytic banded solves retain force gates and match dense equilibria across pressure and mesh',()=>{
 for(const n of [8,16,32,64])for(const gaugePressure of [80000,160000,240000]){
  const c={...meridianFixture(n),gaugePressure},a=solveMeridianEquilibrium(c,c.restPoints,{tangent:'analytic-banded'}),b=solveMeridianEquilibrium(c);
  assert.ok(a.converged,a.reason);assert.ok(b.converged,b.reason);assert.equal(a.state.compressiveSegments,0);
  assert.ok(a.metrics.maxForce<=1e-5&&a.metrics.maxForcePerArea<=.01);
  for(let i=0;i<a.points.length;i++)for(let k=0;k<2;k++)near(a.points[i][k],b.points[i][k],2e-9);
  assert.deepEqual(a.points[0],c.restPoints[0]);assert.deepEqual(a.points.at(-1),c.restPoints.at(-1));
 }
});
test('analytic tangent preserves admission, output ownership and solver failure controls',()=>{
 const c=meridianFixture(8),m=createMeridianDiagnostic(c),q=structuredClone(c.restPoints),before=structuredClone(q),b=m.tangentBands(q);
 assert.deepEqual(q,before);b[0]=NaN;assert.ok(m.tangentBands(q).every(Number.isFinite));
 const bad=structuredClone(q);bad[2]=[NaN,0];assert.throws(()=>m.tangentBands(bad));
 assert.throws(()=>solveMeridianEquilibrium(c,q,{tangent:'unknown'}));
 const r=solveMeridianEquilibrium(c,q,{tangent:'analytic-banded',maxBacktracks:0});assert.equal(r.reason,'line-search-exhausted');
 const zero=solveMeridianEquilibrium({...c,gaugePressure:0},q,{tangent:'analytic-banded'});assert.equal(zero.iterations,0);assert.ok(zero.converged);
 assert.equal(factorBand(m.tangentBands(q)),null,'Initial pressure tangent must not be declared positive');
});
