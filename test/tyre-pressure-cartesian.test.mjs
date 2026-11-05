import test from 'node:test';
import assert from 'node:assert/strict';
import {createRadialPressureDiagnostic} from '../scripts/lib/tyre-pressure-cartesian.mjs';
import {FIXTURE} from '../scripts/lib/tyre-pressure-checks.mjs';
const near=(a,b,tol=2e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${a} != ${b}`);
const hub=[.12,-.04],positions=[[.46,-.04],[.12,.29],[-.084,-.312]],radii=[.35,.35,.35];
const make=()=>createRadialPressureDiagnostic(FIXTURE,radii);
test('Cartesian node and hub forces independently match the complete energy gradient',()=>{
 const model=make(),state=model.evaluate(hub,positions),h=1e-7;
 for(let i=-1;i<positions.length;i++)for(let axis=0;axis<2;axis++){
  const plus=structuredClone(positions),minus=structuredClone(positions),hp=[...hub],hm=[...hub];
  (i<0?hp:plus[i])[axis]+=h;(i<0?hm:minus[i])[axis]-=h;
  const gradient=(model.evaluate(hp,plus).pressure.energy-model.evaluate(hm,minus).pressure.energy)/(2*h);
  near(-gradient,i<0?state.hubForce[axis]:state.nodeForces[i][axis]);
 }
});
test('radial mapping conserves total force and torque and transforms with the geometry',()=>{
 const model=make(),s=model.evaluate(hub,positions),angle=.71,c=Math.cos(angle),sn=Math.sin(angle);
 const rotate=([x,z])=>[c*x-sn*z,sn*x+c*z],transform=p=>rotate(p).map((v,i)=>v+[.8,-.3][i]);
 const t=model.evaluate(transform(hub),positions.map(transform));
 near(t.pressure.energy,s.pressure.energy,1e-11);
 for(let j=0;j<2;j++){
  near(s.hubForce[j]+s.nodeForces.reduce((sum,f)=>sum+f[j],0),0,1e-12);
  near(t.hubForce[j],rotate(s.hubForce)[j],1e-10);
  for(let i=0;i<positions.length;i++)near(t.nodeForces[i][j],rotate(s.nodeForces[i])[j],1e-10);
 }
 const cross=(p,f)=>p[0]*f[1]-p[1]*f[0];
 near(cross(hub,s.hubForce)+positions.reduce((sum,p,i)=>sum+cross(p,s.nodeForces[i]),0),0,1e-12);
});
test('moving hub and tangential node motion obey pressure power and closed path work',()=>{
 const model=make(),s=model.evaluate(hub,positions),vh=[.3,-.2],velocities=[[.4,.6],[-.8,.1],[.2,-.9]],h=1e-7;
 const at=t=>model.evaluate(hub.map((x,j)=>x+t*vh[j]),positions.map((p,i)=>p.map((x,j)=>x+t*velocities[i][j])));
 const dot=(a,b)=>a.reduce((sum,x,j)=>sum+x*b[j],0);
 const power=dot(s.hubForce,vh)+s.nodeForces.reduce((sum,f,i)=>sum+dot(f,velocities[i]),0);
 near(power,-(at(h).pressure.energy-at(-h).pressure.energy)/(2*h));
 // Closed radial cycle on different nodes; trapezoid work converges to zero.
 let work=0;const p=structuredClone(positions),steps=1000;
 for(const [i,d] of [[0,-.002],[1,-.003],[0,.002],[1,.003]]){
  const axis=i===0?0:1;let before=model.evaluate(hub,p);
  for(let k=0;k<steps;k++){
   p[i][axis]+=d/steps;const after=model.evaluate(hub,p);
   work+=(before.nodeForces[i][axis]+after.nodeForces[i][axis])*.5*d/steps;before=after;
  }
 }
 near(work,0,1e-8);
});
test('reference strip has no inflation prestress and rejects unsupported geometry',()=>{
 const model=createRadialPressureDiagnostic({...FIXTURE,arcLengths:[.02]},[.35]);
 const zero=model.evaluate([0,0],[[.35,0]]);near(zero.nodeForces[0][0],0,0);assert.equal(zero.pressure.tangentDefined,false);
 for(const p of [[[.351,0]],[[.31,0]],[[0,0]],[[NaN,0]],[]])assert.throws(()=>model.evaluate([0,0],p));
 assert.throws(()=>model.evaluate([Infinity,0],[[.34,0]]));
 assert.throws(()=>createRadialPressureDiagnostic(FIXTURE,[.35]));
 const rs=[.35,.35,.35],m=createRadialPressureDiagnostic(FIXTURE,rs);rs[0]=.8;
 const first=m.evaluate(hub,positions),second=m.evaluate(hub,positions);first.nodeForces[0][0]=0;
 assert.notEqual(second.nodeForces[0][0],0);assert.deepEqual(second,m.evaluate(hub,positions));
});
