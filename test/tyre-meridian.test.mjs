import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeridianDiagnostic} from '../scripts/lib/tyre-meridian.mjs';
import {circularMeridian,meridianFixture} from '../scripts/lib/tyre-meridian-fixture.mjs';
import {sectionGeometry} from '../scripts/lib/tyre-inflation.mjs';
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} != ${b}`);
test('meridian energy and volume gradients match every node including closure/beads',()=>{
 const m=createMeridianDiagnostic(meridianFixture(8)),q=circularMeridian(.051,8);q[3][0]+=.00002;
 const s=m.evaluate(q),h=1e-7;
 for(let i=0;i<q.length;i++)for(let k=0;k<2;k++){
  const a=structuredClone(q),b=structuredClone(q);a[i][k]+=h;b[i][k]-=h;
  const plus=m.evaluate(a),minus=m.evaluate(b);
  near((plus.volume-minus.volume)/(2*h),s.volumeGradient[i][k],2e-10);
  near(-(plus.potential-minus.potential)/(2*h),s.forces[i][k],2e-4);
 }
});
test('stress-free material, axial invariance and fixed-bead support signs are explicit',()=>{
 const c=meridianFixture(),m=createMeridianDiagnostic(c),rest=m.evaluate(c.restPoints);
 near(rest.materialEnergy,0,0);assert.ok(rest.materialForces.flat().every(x=>x===0));assert.ok(rest.maxFreeResidual>0);
 const q=circularMeridian(.051),s=m.evaluate(q),shift=m.evaluate(q.map(([x,z])=>[x+.1,z]));
 near(s.potential,shift.potential,1e-10);near(s.forces.reduce((sum,f)=>sum+f[0],0),0,1e-10);
 for(let i=0;i<2;i++)for(let k=0;k<2;k++)near(s.beadLoads[i][k]+s.supportForces[i][k],0,0);
 near(s.forces.slice(1,-1).reduce((sum,f)=>sum+f[0],0)+s.beadLoads.reduce((sum,f)=>sum+f[0],0),0,1e-10);
});
test('polygon revolution and material integration converge under meridian refinement',()=>{
 const rows=[16,32,64,128,256].map(n=>createMeridianDiagnostic(meridianFixture(n)).evaluate(circularMeridian(.051,n)));
 const exact=sectionGeometry(.311,.015,.051).volume;
 for(let i=1;i<rows.length;i++)assert.ok(Math.abs(rows[i].volume-exact)<Math.abs(rows[i-1].volume-exact));
 near(rows.at(-1).volume,exact,3e-7);
 assert.ok(Math.abs(rows[3].materialEnergy-rows[4].materialEnergy)<Math.abs(rows[1].materialEnergy-rows[2].materialEnergy));
});
test('hoop rigidity is a separate consumed energy/force contribution',()=>{
 const c=meridianFixture(),q=circularMeridian(.051),a=createMeridianDiagnostic(c).evaluate(q),b=createMeridianDiagnostic({...c,hoopRigidity:200000}).evaluate(q);
 assert.ok(b.materialEnergy>a.materialEnergy);assert.notDeepEqual(a.materialForces,b.materialForces);assert.deepEqual(a.pressureForces,b.pressureForces);
});
test('invalid material/geometry rejects and compression and ownership stay visible',()=>{
 const c=meridianFixture();assert.throws(()=>createMeridianDiagnostic({...c,couplingRigidity:Math.sqrt(c.meridionalRigidity*c.hoopRigidity)}));
 assert.throws(()=>createMeridianDiagnostic({...c,restPoints:[...c.restPoints].reverse()}));
 const m=createMeridianDiagnostic(c);c.restPoints[1][0]=999;
 const q=circularMeridian(.049),s=m.evaluate(q);assert.ok(s.compressiveSegments>0);
 assert.throws(()=>m.evaluate(circularMeridian(.08)));assert.throws(()=>m.evaluate([[0,0]]));
 s.forces[0][0]=999;assert.notEqual(m.evaluate(q).forces[0][0],999);
 const bad=circularMeridian(.051);bad[3]=[...bad[2]];assert.throws(()=>m.evaluate(bad));
});
