import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {createMeridianDiagnostic,MODEL} from './lib/tyre-meridian.mjs';
import {meridianFixture,circularMeridian} from './lib/tyre-meridian-fixture.mjs';
if(process.argv.length>3)throw Error('Usage: node scripts/tyre-meridian.mjs [output-directory]');
const cases=[];
for(const segments of [16,32,64]){
 const configuration=meridianFixture(segments),m=createMeridianDiagnostic(configuration),h=1e-7;
 const at=H=>{
  const points=circularMeridian(H,segments),state=m.evaluate(points),a=circularMeridian(H+h,segments),b=circularMeridian(H-h,segments);
  const tangent=a.map((p,i)=>p.map((x,k)=>(x-b[i][k])/(2*h)));
  return {height:H,points,state,restrictedForce:state.forces.reduce((sum,f,i)=>sum+f[0]*tangent[i][0]+f[1]*tangent[i][1],0)};
 };
 let lo=.05,hi=.053;assert.ok(at(lo).restrictedForce>0&&at(hi).restrictedForce<0);
 for(let i=0;i<42;i++){const mid=(lo+hi)/2;if(at(mid).restrictedForce>0)lo=mid;else hi=mid;}
 const r=at((lo+hi)/2);assert.ok(Math.abs(r.restrictedForce)<2e-5);
 const derivative=(at(r.height+h).state.potential-at(r.height-h).state.potential)/(2*h);
 assert.ok(Math.abs(derivative+r.restrictedForce)<2e-4);
 assert.ok(r.state.maxFreeResidual>1,'Circular-family stationarity must not masquerade as local equilibrium');
 const rest=configuration.restPoints,areas=rest.slice(1).map((b,i)=>2*Math.PI*(configuration.rimRadius+(rest[i][1]+b[1])/2)*Math.hypot(b[0]-rest[i][0],b[1]-rest[i][1]));
 const maxFreeForcePerReferenceArea=Math.max(...r.state.forces.slice(1,-1).map((f,i)=>Math.hypot(...f)/((areas[i]+areas[i+1])/2)));
 cases.push({segments,configuration,...r,maxFreeForcePerReferenceArea});
}
const paths=['scripts/lib/tyre-gas.mjs','scripts/lib/tyre-meridian.mjs','scripts/lib/tyre-meridian-fixture.mjs','scripts/lib/tyre-inflation.mjs','scripts/tyre-meridian.mjs','test/tyre-meridian.test.mjs','scripts/plot-tyre-meridian.py'];
const sourcesSha256=Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(new URL('../'+p,import.meta.url))).digest('hex')])));
const dir=resolve(process.argv[2]??'artifacts/tyre-meridian');await mkdir(dir,{recursive:true});
await writeFile(join(dir,'report.json'),JSON.stringify({model:MODEL,scope:'Spatial axisymmetric energy/forces, circular-family stationary shapes with nonzero free-node residuals; NOT casing equilibrium or calibration',sourcesSha256,cases},null,2)+'\n');
console.log(JSON.stringify(cases.map(c=>({segments:c.segments,height:c.height,restrictedForce:c.restrictedForce,maxFreeResidual:c.state.maxFreeResidual,maxFreeForcePerReferenceArea:c.maxFreeForcePerReferenceArea}))));
