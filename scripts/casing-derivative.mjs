// Isolated qualification of the pinned native damping derivative. No solver patch.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {getRuntime} from '../dist/moving-wheel.js';
import {validate,modelXML,run} from '../dist/tyre-fixture.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const maxAbs=a=>a.reduce((max,v)=>Math.max(max,Math.abs(v)),0);
const difference=(a,b)=>maxAbs(a.map((v,i)=>v-b[i]));
const multiply=(a,v)=>Float64Array.from(v,(_,i)=>v.reduce((sum,x,j)=>sum+a[i*v.length+j]*x,0));
const seedFile=new URL('../dist/tyre-fixture-examples.json',import.meta.url);

export async function controlInput({nodes=64,dt=.00003125,edgeViscosity=.5,deformed=false}={}){
 assert.ok([32,64,128].includes(nodes),'Unsupported diagnostic node count');assert.equal(typeof deformed,'boolean');
 const a=structuredClone(JSON.parse(await readFile(seedFile,'utf8')).cases[0].input);
 a.seed.gravity=0;a.seed.hub={position:[0,0,1],quaternion:[1,0,0,0]};
 a.seed.wheel.nodes=nodes;a.seed.wheel.edgeViscosity=edgeViscosity;
 a.seed.q=Array.from({length:2*nodes},(_,i)=>i%2?0:.001);
 a.seed.v=Array.from({length:2*nodes},(_,i)=>i%2?0:.01);
 // Deliberately nonuniform shape, while uniform velocity remains a damping null mode.
 if(deformed){a.seed.q[0]+=.0002;a.seed.q[7]-=.00015;}
 a.rates='imported';a.motion={dt,duration:.02,sampleDt:.000125};
 return validate(a);
}

function uniformMetrics(vel){
 const n=vel.length/2,mean=[0,0];for(let i=0;i<n;i++){mean[0]+=vel[2*i]/n;mean[1]+=vel[2*i+1]/n;}
 let residual=0;for(let i=0;i<n;i++)residual+=(vel[2*i]-mean[0])**2+(vel[2*i+1]-mean[1])**2;
 return {mean,nonuniformRms:Math.sqrt(residual/n)};
}

// Independent planar edge geometry: f = -c J^T J v; no native edge Jacobian.
// Each node has the named world-x/world-z slides, and the hub is unrotated/fixed.
function geometricDerivative(model,data,bodies,coordinates){
 const nv=model.nv,n=bodies.length,c=model.flex_edgedamping[0],D=new Float64Array(nv*nv);
 for(let i=0;i<n;i++){
  const j=(i+1)%n,a=bodies[i],b=bodies[j],dx=data.xpos[3*b]-data.xpos[3*a],dz=data.xpos[3*b+2]-data.xpos[3*a+2],length=Math.hypot(dx,dz);
  assert.ok(length>0);const indices=[...coordinates[i],...coordinates[j]],J=[-dx/length,-dz/length,dx/length,dz/length];
  for(let r=0;r<4;r++)for(let col=0;col<4;col++)D[indices[r]*nv+indices[col]]-=c*J[r]*J[col];
 }
 return D;
}

export async function auditCasingDerivative(options={}){
 const {integrator='implicitfast',...controls}=options;
 assert.ok(['implicitfast','implicit'].includes(integrator),'Diagnostic integrator unsupported');
 const input=await controlInput(controls),dt=input.motion.dt,n=input.seed.wheel.nodes;
 const xml=modelXML(input).replace('integrator="implicitfast"',`integrator="${integrator}"`),mj=await getRuntime();
 let model,data;
 try{
  model=mj.MjModel.from_xml_string(xml);data=new mj.MjData(model);
  const nv=model.nv,id=(kind,name)=>{const i=mj.mj_name2id(model,kind,name);assert.ok(i>=0,name);return i;};
  const joints=Array.from({length:n},(_,i)=>['u','v'].map(axis=>id(mj.mjtObj.mjOBJ_JOINT.value,'casing_'+axis+i)));
  const coordinates=joints.map(pair=>pair.map(j=>model.jnt_dofadr[j]));
  const bodies=Array.from({length:n},(_,i)=>id(mj.mjtObj.mjOBJ_BODY.value,'casing_n'+i));
  assert.equal(nv,2*n);assert.equal(model.nq,nv);assert.equal(model.nC,nv,'This diagnostic requires diagonal fixed-hub mass');
  assert.equal(model.nflex,1);assert.equal(model.flex_vertnum[0],n);assert.equal(model.flex_edgenum[0],n);
  const edges=new Set();for(let i=0;i<n;i++)edges.add([model.flex_edge[2*i],model.flex_edge[2*i+1]].sort((a,b)=>a-b).join(','));
  const hub=id(mj.mjtObj.mjOBJ_BODY.value,'hub');assert.equal(model.body_jntnum[hub],0);
  for(let i=0;i<n;i++){
   assert.ok(edges.has([i,(i+1)%n].sort((a,b)=>a-b).join(',')),'Expected a closed ring');
   assert.equal(model.body_parentid[bodies[i]],hub);assert.equal(model.flex_vertbodyid[i],bodies[i]);
   assert.deepEqual(Array.from(model.body_quat.slice(4*bodies[i],4*bodies[i]+4)),[1,0,0,0]);
   for(let k=0;k<2;k++){const j=joints[i][k];assert.equal(model.jnt_bodyid[j],bodies[i]);assert.equal(model.jnt_type[j],mj.mjtJoint.mjJNT_SLIDE.value);assert.equal(coordinates[i][k],2*i+k);assert.equal(model.jnt_qposadr[j],2*i+k);assert.deepEqual(Array.from(model.jnt_axis.slice(3*j,3*j+3)),k?[0,0,1]:[1,0,0]);}
  }
  assert.ok(Array.from(model.dof_damping).every(v=>v===0));assert.equal(model.nu,0);assert.equal(model.ntendon,0);
  for(let i=0;i<n;i++)for(let k=0;k<2;k++){const j=joints[i][k];data.qpos[model.jnt_qposadr[j]]=input.seed.q[2*i+k];data.qvel[coordinates[i][k]]=input.seed.v[2*i+k];}
  mj.mj_forward(model,data);assert.equal(data.ncon,0);assert.equal(data.nefc,0);
  for(let i=0;i<n;i++)assert.deepEqual(Array.from(data.flexvert_xpos.slice(3*i,3*i+3)),Array.from(data.xpos.slice(3*bodies[i],3*bodies[i]+3)));
  const q0=Float64Array.from(data.qpos),v0=Float64Array.from(data.qvel),force=Float64Array.from(data.qfrc_smooth),damper=Float64Array.from(data.qfrc_damper);
  const D=geometricDerivative(model,data,bodies,coordinates),mass=Float64Array.from({length:nv},(_,i)=>{assert.equal(model.M_rownnz[i],1);assert.equal(model.M_colind[model.M_rowadr[i]],i);return data.M[model.M_rowadr[i]];});
  const unmodifiedAccelerationStep=Float64Array.from(v0,(v,i)=>v+dt*force[i]/mass[i]);
  const explicitUniformity=uniformMetrics(unmodifiedAccelerationStep);
  if(!controls.deformed)assert.ok(explicitUniformity.nonuniformRms<1e-12,'Baseline force must preserve uniform motion');
  // The public WASM does not expose mjd_smooth_vel. mj_step constructs qDeriv
  // at the pre-step state; copy it before restoring that exact state for FD.
  mj.mj_step(model,data);
  const firstVelocity=Float64Array.from(data.qvel),native=new Float64Array(nv*nv),pattern=new Uint8Array(nv*nv);
  for(let i=0;i<nv;i++)for(let k=model.D_rowadr[i];k<model.D_rowadr[i]+model.D_rownnz[i];k++){
   const index=i*nv+model.D_colind[k];native[index]=data.qDeriv[k];pattern[index]=1;
  }
  const effective=new Float64Array(nv*nv);
  if(integrator==='implicit')effective.set(native);
  else for(let i=0;i<nv;i++)for(let k=model.M_rowadr[i];k<model.M_rowadr[i]+model.M_rownnz[i];k++){
   const j=model.M_colind[k],v=data.qDeriv[model.mapD2M[k]];effective[i*nv+j]=v;effective[j*nv+i]=v;
  }
  // Predict the actual sparse solve with independent closed-form 2x2 blocks.
  // This is an audit of one step, not a replacement integration path.
  const predicted=Float64Array.from(v0),nodeOf=new Int32Array(nv);
  for(let i=0;i<n;i++)for(const k of coordinates[i])nodeOf[k]=i;
  for(let i=0;i<nv;i++)for(let j=0;j<nv;j++)if(nodeOf[i]!==nodeOf[j])assert.equal(effective[i*nv+j],0);
  for(const [x,z] of coordinates){
   const a=mass[x]-dt*effective[x*nv+x],b=-dt*effective[x*nv+z],c=-dt*effective[z*nv+x],d=mass[z]-dt*effective[z*nv+z],det=a*d-b*c;
   assert.ok(det>0);predicted[x]+=dt*(d*force[x]-b*force[z])/det;predicted[z]+=dt*(a*force[z]-c*force[x])/det;
  }
  let maxContacts=data.ncon;
  for(let tick=1;tick<Math.round(input.motion.duration/dt);tick++){
   mj.mj_step(model,data);maxContacts=Math.max(maxContacts,data.ncon);const q=data.qpos,v=data.qvel;
   for(let i=0;i<nv;i++)assert.ok(Number.isFinite(q[i])&&Number.isFinite(v[i]));
  }
  const end=uniformMetrics(data.qvel);assert.equal(maxContacts,0);
  data.qpos.set(q0);data.qvel.set(v0);data.time=0;data.qacc_warmstart.fill(0);mj.mj_forward(model,data);
  const finiteDifferences=[];
  for(const epsilon of [1e-4,1e-5,1e-6]){
   let error=0,nativeError=0;
   for(let j=0;j<nv;j++){
    data.qvel.set(v0);data.qvel[j]+=epsilon;mj.mj_forward(model,data);const plus=Float64Array.from(data.qfrc_damper);
    data.qvel[j]=v0[j]-epsilon;mj.mj_forward(model,data);
    for(let i=0;i<nv;i++){const value=(plus[i]-data.qfrc_damper[i])/(2*epsilon);error=Math.max(error,Math.abs(value-D[i*nv+j]));nativeError=Math.max(nativeError,Math.abs(value-native[i*nv+j]));}
   }
   finiteDifferences.push({epsilon,geometryMaxError:error,nativeMaxError:nativeError});
  }
  const nullspace={};
  for(const [name,axis] of [['x',0],['z',1]]){
   const translation=new Float64Array(nv);for(const p of coordinates)translation[p[axis]]=1;
   data.qvel.set(translation);mj.mj_forward(model,data);
   nullspace[name]={geometricMax:maxAbs(multiply(D,translation)),forceMax:maxAbs(data.qfrc_damper),nativeMax:maxAbs(multiply(native,translation)),effectiveMax:maxAbs(multiply(effective,translation))};
  }
  let presentError=0,omittedCount=0,omittedMax=0,omittedSameNode=0;
  for(let i=0;i<nv;i++)for(let j=0;j<nv;j++){
   const k=i*nv+j;if(pattern[k])presentError=Math.max(presentError,Math.abs(native[k]-D[k]));
   else if(Math.abs(D[k])>1e-12){omittedCount++;omittedMax=Math.max(omittedMax,Math.abs(D[k]));if(nodeOf[i]===nodeOf[j])omittedSameNode++;}
  }
  return {options:{nodes:n,dt,edgeViscosity:input.seed.wheel.edgeViscosity,deformed:!!controls.deformed,integrator},input,xmlSha256:hash(xml),nativeVersion:mj.mj_versionString(),nv,massNonzeros:model.nC,derivativeNonzeros:model.nD,
   derivative:{finiteDifferences,presentMaxError:presentError,omittedCount,omittedMax,omittedSameNode,nativeMaxError:difference(native,D),forceReconstructionMaxError:difference(multiply(D,v0),damper),nullspace},
   firstStep:{...uniformMetrics(firstVelocity),explicitUniformity,sparsePredictionMaxError:difference(firstVelocity,predicted),unmodifiedAccelerationVelocityMaxDifference:difference(firstVelocity,unmodifiedAccelerationStep)},end,maxContacts,
   derivativeQualified:finiteDifferences.every(x=>x.geometryMaxError<1e-7)&&difference(native,D)<1e-7};
 }finally{data?.delete();model?.delete();}
}

async function main(){
 if(process.argv.length>3)throw Error('Usage: node scripts/casing-derivative.mjs [output-directory]');
 const dir=resolve(process.argv[2]??'artifacts/casing-derivative');await mkdir(dir,{recursive:true});
 const paths=['scripts/casing-derivative.mjs','dist/tyre-fixture.js','dist/moving-wheel.js','dist/trail-initial-state.js','dist/tyre-fixture-examples.json','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm'];
 const sourcesSha256=Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))])));
 const cases=[];
 for(const integrator of ['implicitfast','implicit']){
  const configs=[];
  for(const edgeViscosity of [0,.5])for(const dt of [.00003125,.000015625,.0000078125])configs.push({edgeViscosity,dt});
  configs.push({nodes:32},{nodes:128},{deformed:true});
  for(const config of configs){const r=await auditCasingDerivative({...config,integrator});cases.push(r);console.log(`${cases.length}/18 ${JSON.stringify(r.options)}: derivative ${r.derivativeQualified?'qualified':'not qualified'}`);}
 }
 const viewer=[];
 for(const edgeViscosity of [0,.5]){
  const input=await controlInput({edgeViscosity}),record=await run(input),name=edgeViscosity?'viscous':'inviscid';
  assert.equal(record.status,'completed');assert.ok(record.frames.every(f=>f.contacts.length===0));
  const bytes=JSON.stringify(record,null,2)+'\n';await writeFile(join(dir,name+'.json'),bytes);
  const audit=cases.find(r=>r.options.integrator==='implicitfast'&&r.options.dt===input.motion.dt&&r.options.edgeViscosity===edgeViscosity&&r.options.nodes===64&&!r.options.deformed);
  assert.ok(Math.abs(record.frames.at(-1).tyreMotion.residualRmsSpeed-audit.end.nonuniformRms)<1e-12);
  viewer.push({file:name+'.json',sha256:hash(bytes),steps:record.summary.steps,finalNonuniformRms:record.frames.at(-1).tyreMotion.residualRmsSpeed});
 }
 const report={format:'bikelab-casing-derivative-audit-0.1',sourcesSha256,cases,viewer,scope:'Contact-free fixed-hub derivative qualification only. Source identifiers in authored control inputs identify their seed lineage, not unmodified captured states. No production solver change, connected-bike acceptance, calibration or performance claim.'};
 await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
 // Deliberately distinguish a completed diagnostic from a qualified derivative.
 if(cases.some(c=>!c.derivativeQualified))process.exitCode=2;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
