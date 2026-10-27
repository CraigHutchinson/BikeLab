// Bounded diagnostic only; production mechanics remain unchanged.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MODEL,prepare} from '../dist/fixed-hub.js';
import {getRuntime} from '../dist/moving-wheel.js';
import {stateIdentity} from '../dist/trail-initial-state.js';
import {modelXML,validate} from '../dist/trail-bike.js';
const dir=process.argv[2]||'artifacts/fixed-hub-nullspace';await mkdir(dir,{recursive:true});
const source=JSON.parse(await readFile('dist/fixed-hub-full.json'));source.motion.gravity=0;
for(const j of source.initialization.state.joints){if(j.name==='heave')j.position+=1;if(j.name.startsWith('frontwheel_')){j.position=j.name.startsWith('frontwheel_u')?.001:0;j.velocity=j.name.startsWith('frontwheel_u')?.01:0;}}
source.initialization.state.identity=await stateIdentity(modelXML(source),validate(source));
const mj=await getRuntime(),cases=[];
for(const integrator of ['implicitfast','implicit'])for(const dt of [.00003125,.000015625,.0000078125]){
 const s=await prepare({format:MODEL,source,wheel:'front',velocityMode:'imported',motion:{duration:.02,dt,sampleDt:.000125}});
 const xml=s.xml.replace('integrator="implicitfast"','integrator="'+integrator+'"'),m=mj.MjModel.from_xml_string(xml),d=new mj.MjData(m);
 try{
  const u=[],z=[];
  for(let i=0;i<m.njnt;i++){const name=mj.mj_id2name(m,mj.mjtObj.mjOBJ_JOINT.value,i),j=s.joints.find(j=>j.name===name);d.qpos[m.jnt_qposadr[i]]=j.position;d.qvel[m.jnt_dofadr[i]]=j.velocity;(name.includes('_u')?u:z).push(m.jnt_dofadr[i]);}
  function metrics(){mj.mj_forward(m,d);let meanU=0,meanZ=0,nonuniform=0;for(let i=0;i<u.length;i++){meanU+=d.qvel[u[i]]/u.length;meanZ+=d.qvel[z[i]]/u.length;}for(let i=0;i<u.length;i++)nonuniform+=(d.qvel[u[i]]-meanU)**2+(d.qvel[z[i]]-meanZ)**2;return {nonuniformRms:Math.sqrt(nonuniform/u.length),meanU,meanZ,maxEdgeRate:Math.max(...Array.from(d.flexedge_velocity,Math.abs)),q0:d.qpos[u[0]]};}
  const initial=metrics();mj.mj_step(m,d);const firstStep=metrics();for(let step=1;step<Math.round(.02/dt);step++)mj.mj_step(m,d);
  cases.push({integrator,dt,nv:m.nv,massNonzeros:m.nC,derivativeNonzeros:m.nD,initial,firstStep,end:metrics(),xmlSha256:createHash('sha256').update(xml).digest('hex')});
 }finally{d.delete();m.delete();}
}
const native={};for(const file of ['mujoco.js','mujoco.wasm'])native[file]=createHash('sha256').update(await readFile('dist/vendor/mujoco-3.16.0/'+file)).digest('hex');
await writeFile(dir+'/report.json',JSON.stringify({native,source,cases,scope:'Contact-free uniform local translation with edge viscosity .5. Integrator diagnostic; not connected-bike acceptance.'},null,2)+'\n');
console.log(cases.map(c=>({integrator:c.integrator,dt:c.dt,nC:c.massNonzeros,nD:c.derivativeNonzeros,first:c.firstStep.nonuniformRms,last:c.end.nonuniformRms})));

