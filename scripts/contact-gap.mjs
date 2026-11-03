// Prescribed two-vertex capsule geometry: no trajectory or integrator change.
import assert from 'node:assert/strict';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {getRuntime} from '../dist/moving-wheel.js';
import {nativeWarnings} from '../dist/casing-rk4-observer.js';

export const GAP_MODEL='bikelab-prescribed-capsule-gap-0.1';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const PARAMETERS=Object.freeze({span:.04,radius:.008,penetration:.0001,nodeMass:.015625,contactTime:.0005,impedance:.99,velocity:.01});
export function gapXML(kind){
 assert.ok(['mesh','plane'].includes(kind));const contact='condim="1" friction="0 0 0" solref=".0005 1" solimp=".99 .99 .001"';
 const ground=kind==='mesh'?'<asset><mesh name="ground" vertex="-3 -.1 -1 5 -.1 -1 5 -.1 0 -3 -.1 0 -3 .1 -1 5 .1 -1 5 .1 0 -3 .1 0"/></asset>':'';
 const shape=kind==='mesh'?'type="mesh" mesh="ground"':'type="plane" size="0 0 .1"';
 return '<mujoco><option timestep=".000001953125" gravity="0 0 0" integrator="RK4" solver="Newton" iterations="100" tolerance="1e-10" ccd_tolerance="1e-12" ccd_iterations="100"><flag autoreset="disable"/></option>'+ground+'<worldbody><geom '+shape+' '+contact+'/>'+[-1,1].map((side,i)=>'<body name="node'+i+'" pos="'+side*.02+' 0 .0079"><joint type="slide" axis="1 0 0"/><joint type="slide" axis="0 0 1"/><inertial pos="0 0 0" mass=".015625" diaginertia=".0000005 .0000005 .0000005"/></body>').join('')+'</worldbody><deformable><flex dim="1" radius=".008" body="node0 node1" element="0 1"><contact '+contact+' selfcollide="none"/></flex></deformable></mujoco>';
}

export async function gapSweep(){
 const mj=await getRuntime(),samples=[],deltas=[-1e-4,-1e-6,-1e-8,-1e-10,0,1e-10,1e-8,1e-6,1e-4],models=[];
 for(const kind of ['mesh','plane']){
  const xml=gapXML(kind),m=mj.MjModel.from_xml_string(xml);let d;
  try{
   d=new mj.MjData(m);assert.equal(m.nv,4);const v=PARAMETERS.velocity;
   function apply(delta,time=0){mj.mj_resetData(m,d);d.qpos[1]=-delta/2+v*time;d.qpos[3]=delta/2-v*time;d.qvel[1]=v;d.qvel[3]=-v;mj.mj_forward(m,d);for(const iterations of d.solver_niter)assert.ok(iterations<100);assert.deepEqual(nativeWarnings(d),[]);}
   for(const delta of deltas){
    apply(delta);const positions=Array.from(d.flexvert_xpos),contacts=[],list=d.contact;let rowPower=0;
    try{for(let i=0;i<list.size();i++){const c=list.get(i);try{
     const side=c.flex[0]>=0?0:1,row=c.efc_address;assert.ok(row>=0);const normalSign=side?1:-1,normal=Array.from(c.frame.slice(0,3),x=>normalSign*x),point=Array.from(c.pos);
     let w0=0,w1=0;if(c.vert[side]>=0){w0=c.vert[side]===0?1:0;w1=1-w0;}else{const a=1/Math.max(1e-15,Math.hypot(positions[0]-point[0],positions[1]-point[1],positions[2]-point[2])),b=1/Math.max(1e-15,Math.hypot(positions[3]-point[0],positions[4]-point[1],positions[5]-point[2]));w0=a/(a+b);w1=b/(a+b);}
     const weightedVelocity=normal[2]*(w0*v-w1*v),exactGapDerivative=c.vert[side]>=0?(c.vert[side]===0?v:-v):delta>0?v:delta<0?-v:null;
     rowPower+=d.efc_force[row]*d.efc_vel[row];contacts.push({element:c.elem[side],vertex:c.vert[side],gap:c.dist,point,normal,weights:[w0,w1],rowVelocity:d.efc_vel[row],weightedVelocity,exactGapDerivative,derivativeMismatch:exactGapDerivative===null?null:d.efc_vel[row]-exactGapDerivative,force:d.efc_force[row]});
    }finally{c.delete();}}}finally{list.delete();}
    const generalizedPower=d.qvel[1]*d.qfrc_constraint[1]+d.qvel[3]*d.qfrc_constraint[3],forces=Array.from(d.qfrc_constraint),analyticGap=Math.min(positions[2],positions[5])-PARAMETERS.radius;
    // Keep a branch-preserving displacement for nonzero endpoint-height offset.
    // At the equal-height tie the minimum has no two-sided time derivative.
    let finiteDifference=null,epsilon=null;
    if(delta!==0){epsilon=Math.min(1e-7,Math.abs(delta)/(10*v));const nativeGap=()=>{const list=d.contact;let gap=Infinity;try{for(let i=0;i<list.size();i++){const c=list.get(i);try{gap=Math.min(gap,c.dist);}finally{c.delete();}}}finally{list.delete();}return gap;};apply(delta,epsilon);const plus=nativeGap();apply(delta,-epsilon);finiteDifference=(plus-nativeGap())/(2*epsilon);}
    const warnings=nativeWarnings(d);assert.deepEqual(warnings,[]);samples.push({kind,delta,positions,analyticGap,contacts,forces,generalizedPower,rowPower,powerDifference:generalizedPower-rowPower,finiteDifference,finiteDifferenceTime:epsilon});
   }
   models.push({kind,xml,xmlSha256:hash(xml)});
  }finally{d?.delete();m.delete();}
 }
 return {model:GAP_MODEL,nativeVersion:mj.mj_versionString(),parameters:PARAMETERS,scope:'Prescribed synthetic two-vertex capsule; no trajectory, calibrated material, complete bike or general terrain qualification. Mesh/plane contact representations differ.',models,samples};
}
async function main(){const dir=resolve(process.argv[2]??'artifacts/contact-gap');assert.ok(process.argv.length<=3);await mkdir(dir,{recursive:true});const sources=['scripts/contact-gap.mjs','dist/casing-rk4-observer.js','dist/moving-wheel.js','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm'],sourcesSha256=Object.fromEntries(await Promise.all(sources.map(async path=>[path,hash(await readFile(new URL('../'+path,import.meta.url)))])));const report=await gapSweep();await writeFile(join(dir,'report.json'),JSON.stringify({...report,sourcesSha256},null,2)+'\n');console.log(JSON.stringify(report.samples.map(s=>({kind:s.kind,delta:s.delta,fd:s.finiteDifference,rows:s.contacts.map(c=>({gap:c.gap,velocity:c.rowVelocity,analytic:c.exactGapDerivative,weights:c.weights,force:c.force}))})),null,2));}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
