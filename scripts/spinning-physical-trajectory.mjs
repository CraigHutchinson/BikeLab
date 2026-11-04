// Short corrected-trajectory receiving; not a production wheel model.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {getRuntime} from '../dist/moving-wheel.js';
import {createSpinningStageDriver} from './spinning-rk4-stage.mjs';
const baseline=JSON.parse(await readFile(new URL('../docs/evidence/spinning-gap.json',import.meta.url)));
const p=baseline.parameters.wheel,mass=baseline.parameters.nodeMass,J0=baseline.parameters.J0;
// Original flat translating acceptance budgets, retained for this bounded screen.
const budgets={position:1e-7,velocity:1e-4,momentum:1e-5,angularMomentum:1e-5,angle:1e-12,angularVelocity:1e-9,work:1e-6};
function totals(d,rest){
 const q=d.qpos,v=d.qvel,w=v[2],c=Math.cos(q[2]),s=Math.sin(q[2]),hx=.125+q[0],hz=p.radius+q[1];
 let px=p.hubMass*v[0],pz=p.hubMass*v[1],angular=J0*w+p.hubMass*(hz*v[0]-hx*v[1]);
 let energy=.5*p.hubMass*(v[0]**2+v[1]**2)+.5*J0*w*w+p.hubMass*p.gravity*hz;
 for(let i=0;i<p.nodes;i++){
  const u=3+2*i,x=rest[i][0]+q[u],z=rest[i][1]+q[u+1],lx=v[u]+w*z,lz=v[u+1]-w*x;
  const vx=v[0]+c*lx+s*lz,vz=v[1]-s*lx+c*lz,X=d.flexvert_xpos[3*i],Z=d.flexvert_xpos[3*i+2];
  px+=mass*vx;pz+=mass*vz;angular+=mass*(Z*vx-X*vz);energy+=.5*mass*(vx*vx+vz*vz)+mass*p.gravity*Z;
 }
 return {px,pz,angular,energy};
}
const output=resolve(process.argv[2]??'artifacts/spinning-physical-trajectory');await mkdir(output,{recursive:true});
const sourcePaths=['scripts/spinning-rk4-stage.mjs','scripts/spinning-physical-trajectory.mjs','docs/evidence/spinning-gap.json'];
const hashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex')])));
const sourceHashes=await hashes(),mj=await getRuntime(),cases=[];
for(const source of baseline.samples){
 const runs=[],c=Math.cos(source.angle),s=Math.sin(source.angle);
 const rest=source.worldOffsets.map(([x,z],i)=>[c*x-s*z-source.q[3+2*i],s*x+c*z-source.q[4+2*i]]);
 for(const divisor of [1,2,4]){
  const driver=createSpinningStageDriver(mj,{q:source.q,v:source.v,warmstart:source.v.map(()=>.125),time:0},{targetPolicy:'physical-gap-0.1',excluded:Boolean(source.input.excluded),stepDivisor:divisor});
  const errors={momentum:0,angularMomentum:0,work:0},frames=[];let failure=null;
  try{
   const initial=totals(driver.observe(),rest);
   for(let i=0;i<128*divisor;i++){
    driver.step();const endpoint=driver.observe(),state=driver.snapshot(),t=totals(endpoint,rest);
    errors.momentum=Math.max(errors.momentum,Math.abs(t.px-initial.px),Math.abs(t.pz-initial.pz+(p.hubMass+p.tyreMass)*p.gravity*endpoint.time-state.verticalImpulse));
    errors.angularMomentum=Math.max(errors.angularMomentum,Math.abs(t.angular-initial.angular-state.angularImpulse));
    errors.work=Math.max(errors.work,Math.abs(t.energy-initial.energy-state.contactWork));
    if((i+1)%divisor===0)frames.push({time:endpoint.time,q:endpoint.qpos,v:endpoint.qvel,work:state.contactWork});
   }
  }catch(error){failure=error.message;}
  finally{const final=driver.snapshot();driver.dispose();runs.push({divisor,errors,frames,failure,lastStages:final.lastStages,steps:final.steps});}
 }
 const comparisons=[];
 for(let i=0;i<2;i++){
  const a=runs[i],b=runs[i+1],error={position:0,velocity:0,angle:0,angularVelocity:0,work:0};
  if(a.frames.length===128&&b.frames.length===128)for(let k=0;k<128;k++){
   for(let j=0;j<a.frames[k].q.length;j++){const qp=j===2?'angle':'position',vp=j===2?'angularVelocity':'velocity';error[qp]=Math.max(error[qp],Math.abs(a.frames[k].q[j]-b.frames[k].q[j]));error[vp]=Math.max(error[vp],Math.abs(a.frames[k].v[j]-b.frames[k].v[j]));}
   error.work=Math.max(error.work,Math.abs(a.frames[k].work-b.frames[k].work));
  }
  const factor=i===0?1:.1;comparisons.push({error,pass:a.frames.length===128&&b.frames.length===128&&Object.entries(error).every(([k,v])=>v<=factor*budgets[k])});
 }
 cases.push({name:source.name,angle:source.angle,omega:source.omega,runs,comparisons});console.log('trajectory',cases.length+'/'+baseline.samples.length);
}
const unchanged=JSON.stringify(sourceHashes)===JSON.stringify(await hashes());
const success=unchanged&&cases.every(c=>c.runs.every(r=>!r.failure&&r.steps===128*r.divisor&&r.errors.momentum<=budgets.momentum&&r.errors.angularMomentum<=budgets.angularMomentum&&r.errors.work<=budgets.work)&&c.comparisons.every(x=>x.pass));
await writeFile(join(output,'report.json'),JSON.stringify({success,scope:'0.25 ms corrected zero-material flat contact only; linear/angle/work refinement and independent balance screens, not calibrated tyre qualification',sourceHashes,unchanged,budgets,units:{position:"m",velocity:"m/s",angle:"rad",angularVelocity:"rad/s",momentum:"N s",angularMomentum:"N m s",work:"J"},cases}));
console.log(JSON.stringify({success,cases:cases.length,failedRuns:cases.flatMap(c=>c.runs).filter(r=>r.failure||r.errors.momentum>budgets.momentum||r.errors.angularMomentum>budgets.angularMomentum||r.errors.work>budgets.work).length,failedComparisons:cases.flatMap(c=>c.comparisons).filter(c=>!c.pass).length}));
if(!success)process.exitCode=1;
