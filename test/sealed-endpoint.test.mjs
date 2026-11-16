import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createSweptCasing,MODEL,ENDPOINT_MODEL} from '../dist/sealed-casing.js';
import {inspectCasingStrains,alternatingCurvature} from '../scripts/lib/tyre-casing-modes.mjs';
import {preset} from '../dist/moving-wheel.js';
import {solveSealedPlane} from '../scripts/lib/tyre-sealed-load.mjs';
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} versus ${b}, budget ${t}`);
function difference(c,q){
 const n=c.nodes,L=c.rimRadius,H=Math.max(...c.section.map(p=>p[1]));let energy=0;
 // Independently reconstruct meridian lengths using section-height differences
 // and the norm of each bead-to-crown vector, without material vertex forces.
 for(let i=0;i<n;i++){
  const next=(i+1)%n,a=2*Math.PI*i/n,b=2*Math.PI*next/n;
  const ra=Math.hypot(q[2*i]-L*Math.sin(a),q[2*i+1]+L*Math.cos(a)),rb=Math.hypot(q[2*next]-L*Math.sin(b),q[2*next+1]+L*Math.cos(b));
  for(let j=0;j<c.section.length-1;j++){
   const [x,z]=c.section[j],[xx,zz]=c.section[j+1],dx=xx-x,dz=zz-z,l0=Math.hypot(dx,dz),ea=Math.hypot(dx,dz*ra/H)/l0-1,eb=Math.hypot(dx,dz*rb/H)/l0-1,A=2*Math.PI/n*(L+(z+zz)/2)*l0;
   energy+=A*c.meridionalRigidity*(ea-eb)**2/8;
  }
 }
 return energy;
}
test('endpoint quadrature recovers exactly the independently reconstructed missing strain energy',()=>{
 for(const nodes of [16,32,64])for(const couplingRigidity of [-20000,0,20000]){
  const c={...preset('sealed').casing,nodes,couplingRigidity},a=createSweptCasing(c),b=createSweptCasing(c,ENDPOINT_MODEL),q=Float64Array.from(a.initial);
  for(let i=0;i<nodes;i++){q[2*i]+=.0001*Math.sin(1.3*i);q[2*i+1]+=.00015*(i%2?1:-1);}
  const x=a.evaluate(q),y=b.evaluate(q);near(y.materialEnergy-x.materialEnergy,difference(c,q),2e-11);
  assert.ok(difference(c,q)>0);near(a.reference.radius,b.reference.radius,1e-14);near(a.reference.referenceVolume,b.reference.referenceVolume,1e-15);
 }
});
test('endpoint material and gas forces differentiate their own energies at each coordinate',()=>{
 for(const nodes of [16,32]){
  const c={...preset('sealed').casing,nodes},m=createSweptCasing(c,ENDPOINT_MODEL),q=Float64Array.from(m.initial);q[1]+=.0003;q[6]+=.0001;
  const s=m.evaluate(q),forces=Float64Array.from(s.forces),material=Float64Array.from(s.materialForces),gas=Float64Array.from(s.gasForces);
  for(let j=0;j<q.length;j++){const old=q[j],h=2e-8;q[j]=old+h;const a=m.evaluate(q),u=a.potential,um=a.materialEnergy,ug=a.gasEnergy;q[j]=old-h;const b=m.evaluate(q);near(-(u-b.potential)/(2*h),forces[j],3e-4);near(-(um-b.materialEnergy)/(2*h),material[j],3e-4);near(-(ug-b.gasEnergy)/(2*h),gas[j],3e-4);q[j]=old;}
 }
});
test('uniform inflation preserves equilibrium while alternating radial motion gains the missing energy',()=>{
 for(const nodes of [32,64,128]){
  const c={...preset('sealed').casing,nodes},a=createSweptCasing(c),b=createSweptCasing(c,ENDPOINT_MODEL);
  for(const offset of [0,.0001]){const q=Float64Array.from(a.initial,(v,i)=>v+offset*a.directions[i]);const x=a.evaluate(q),y=b.evaluate(q);near(x.materialEnergy,y.materialEnergy,1e-11);for(let i=0;i<q.length;i++)near(x.materialForces[i],y.materialForces[i],1e-8);}
  const q=Float64Array.from(a.initial,(v,i)=>v+1e-5*(Math.floor(i/2)%2?1:-1)*a.directions[i]);const x=a.evaluate(q).materialEnergy,y=b.evaluate(q).materialEnergy;assert.ok(y>x);near(y-x,difference(c,q),2e-11);
 }
});
test('default discretization reproduces every archived loaded force state exactly',async()=>{
 const archive=JSON.parse(gunzipSync(Buffer.from((await readFile(new URL('../docs/evidence/sealed-load-report.json.gz.b64',import.meta.url),'utf8')).trim(),'base64')));
 for(const c of archive.cases){const m=createSweptCasing(c.configuration);assert.equal(m.model,MODEL);for(const s of c.states){const state=m.evaluate(s.coordinates);for(const key of ['forces','materialForces','gasForces'])assert.deepEqual(Array.from(state[key]),s.state[key]);for(const key of ['materialEnergy','gasEnergy','volume','potential','gaugePressure','maxStrain','compressiveCells'])assert.equal(state[key],s.state[key]);}}
 assert.throws(()=>createSweptCasing(preset('sealed').casing,'unknown'));
});
test('candidate static identity stays separate and compression still rejects loaded states',()=>{
 const c=preset('sealed').casing,m=createSweptCasing(c,ENDPOINT_MODEL),h=m.reference.radius-.002;
 const r=solveSealedPlane(c,h,undefined,{casingModel:ENDPOINT_MODEL});assert.ok(r.converged);assert.equal(r.model,'bikelab-sealed-plane-equilibrium-endpoint-0.1');assert.equal(r.state.model,ENDPOINT_MODEL);assert.equal(r.locallyAdmissible,false);assert.equal(r.admission,'compressive-resultant');
 const epsilon=1e-7,a=solveSealedPlane(c,h+epsilon,r.coordinates,{casingModel:ENDPOINT_MODEL}),b=solveSealedPlane(c,h-epsilon,r.coordinates,{casingModel:ENDPOINT_MODEL});assert.ok(a.converged&&b.converged);near(-(a.state.potential-b.state.potential)/(2*epsilon),r.reaction,.002);
});

test('independent station diagnostics expose averaged-away strain and directional stiffness',()=>{
 const c=preset('sealed').casing,m=createSweptCasing(c),q=Float64Array.from(m.initial,(v,i)=>v+.0001*(Math.floor(i/2)%2?1:-1)*m.directions[i]);
 const s=inspectCasingStrains(c,q);near(s.missingEnergy,difference(c,q),1e-12);near(Math.abs(s.alternatingRadialAmplitude),.0001,1e-15);
 for(const model of [MODEL,ENDPOINT_MODEL])near(alternatingCurvature(c,model),alternatingCurvature(c,model,5e-7),.01);
 assert.ok(alternatingCurvature(c,ENDPOINT_MODEL)>10*alternatingCurvature(c,MODEL));assert.throws(()=>alternatingCurvature(c,MODEL,0));
});
