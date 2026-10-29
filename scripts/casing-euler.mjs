// Contact-free qualification only: no production integrator or record changes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {controlInput} from './casing-derivative.mjs';
import {getRuntime,validate as wheelParameters,geometryLimits} from '../dist/moving-wheel.js';
import {modelXML} from '../dist/tyre-fixture.js';
import {oscillatorState} from '../dist/suspension-reference.js';

export const MODEL='bikelab-contact-free-euler-trial-0.1';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// Read warning counters outside integration. get() returns an owned stat copy;
// the vector itself is borrowed from MjData and must not be deleted separately.
function nativeWarnings(data){
 const warnings=[],vector=data.warning;
 for(let i=0;i<vector.size();i++){const stat=vector.get(i);try{if(stat.number)warnings.push({index:i,number:stat.number,lastinfo:stat.lastinfo});}finally{stat.delete();}}
 return warnings;
}
// Sufficient bound for constant linear M>0, K>0, C>=0, not a contact or
// nonlinear stability certificate. The compiled coefficients supply these bounds.
export function linearAdmission({mass,kBound,cBound,dt}){
 for(const [key,value] of Object.entries({mass,kBound,cBound,dt}))assert.ok(Number.isFinite(value)&&(key==='cBound'?value>=0:value>0),'Invalid '+key);
 const stiffness=dt*dt*kBound/mass,damping=2*dt*cBound/mass,score=stiffness+damping;
 return {mass,kBound,cBound,dt,stiffness,damping,score,strictLimit:4,admitted:score<4,scope:'Constant linear rest-shape sufficient bound only; no contact/nonlinear guarantee.'};
}

async function setup({kind='ring',mode='x',nodes=64,dt=.00003125,edgeViscosity=.5}={}){
 assert.ok(['ring','pair'].includes(kind));assert.ok(['x','z','alternating'].includes(mode));
 assert.ok([.00003125,.000015625,.0000078125].includes(dt));assert.ok(Number.isFinite(edgeViscosity)&&edgeViscosity>=0&&edgeViscosity<=3);
 const input=await controlInput({nodes,dt,edgeViscosity});
 if(kind==='ring'){
  if(mode==='z')for(let i=0;i<nodes;i++){input.seed.q[2*i]=0;input.seed.q[2*i+1]=.001;input.seed.v[2*i]=0;input.seed.v[2*i+1]=.01;}
  if(mode==='alternating'){input.seed.q.fill(0);input.seed.v.fill(0);for(let i=0;i<nodes;i++)input.seed.v[2*i]=i%2?-.01:.01;}
  return {kind,mode,input,n:nodes,dim:2,xml:modelXML(input).replace('integrator="implicitfast"','integrator="Euler"')};
 }
 assert.equal(mode,'x','Pair uses antisymmetric x motion only');
 // Two collinear nodes: an exactly linear relative oscillator with real edge
 // damping, so a disabled-damping implementation cannot pass this reference.
 const mass=.015625,k=10000,edgeK=15000,edgeC=30*edgeViscosity;
 const body=(i,x)=>`<body name="casing_n${i}" pos="${x} 0 1"><joint type="slide" axis="1 0 0" stiffness="${k}"/><inertial pos="0 0 0" mass="${mass}" diaginertia=".001 .001 .001"/></body>`;
 const xml=`<mujoco><compiler angle="radian" fusestatic="false"/><option timestep="${dt}" gravity="0 0 0" integrator="Euler"><flag autoreset="disable"/></option><worldbody>${body(0,-.15)}${body(1,.15)}</worldbody><deformable><flex name="pair" dim="1" radius=".008" body="casing_n0 casing_n1" element="0 1"><edge stiffness="${edgeK}" damping="${edgeC}"/><contact selfcollide="none"/></flex></deformable></mujoco>`;
 return {kind,mode,n:2,dim:1,xml,input:{mass,foundation:k,edgeStiffness:edgeK,edgeDamping:edgeC,q:[-.001,.001],v:[-.01,.01],motion:input.motion}};
}

export async function runEulerTrial(options={}){
 assert.ok(options&&typeof options==='object'&&!Array.isArray(options));
 for(const key of Object.keys(options))assert.ok(['kind','mode','nodes','dt','edgeViscosity'].includes(key),'Unknown trial option: '+key);
 assert.ok(options.kind!=='pair'||!Object.hasOwn(options,'nodes'),'Pair topology has exactly two nodes; omit the ring node-count option');
 const s=await setup(options),{n,dim}=s,dt=s.input.motion.dt,steps=Math.round(.02/dt),stride=Math.round(.000125/dt),mj=await getRuntime();let m,d;
 try{
  m=mj.MjModel.from_xml_string(s.xml);d=new mj.MjData(m);const nv=m.nv;
  assert.equal(nv,n*dim);assert.equal(m.nq,nv);assert.equal(m.nu,0);assert.equal(m.ntendon,0);assert.equal(m.nflex,1);
  assert.equal(m.opt.integrator,mj.mjtIntegrator.mjINT_EULER.value);assert.ok(Array.from(m.opt.gravity).every(x=>x===0));
  assert.ok(Array.from(m.qpos_spring).every(x=>x===0));assert.equal(m.nC,nv,'Diagnostic requires diagonal mass');
  assert.equal(m.flex_vertnum[0],n);assert.equal(m.nflexedge,s.kind==='ring'?n:1);
  assert.ok(Array.from(m.dof_damping).every(x=>x===0));assert.ok(Array.from(m.dof_dampingpoly).every(x=>x===0));
  const bodies=Array.from({length:n},(_,i)=>{const b=mj.mj_name2id(m,mj.mjtObj.mjOBJ_BODY.value,'casing_n'+i);assert.ok(b>=0);return b;});
  for(let i=0;i<nv;i++){assert.equal(m.jnt_type[i],mj.mjtJoint.mjJNT_SLIDE.value);assert.equal(m.jnt_dofadr[i],i);assert.equal(m.jnt_qposadr[i],i);assert.equal(m.jnt_bodyid[i],bodies[Math.floor(i/dim)]);assert.deepEqual(Array.from(m.jnt_axis.slice(3*i,3*i+3)),i%dim?[0,0,1]:[1,0,0]);}
  const edges=new Set();for(let i=0;i<m.nflexedge;i++)edges.add([m.flex_edge[2*i],m.flex_edge[2*i+1]].sort((a,b)=>a-b).join(','));
  for(let i=0;i<(s.kind==='ring'?n:1);i++)assert.ok(edges.has([i,(i+1)%n].sort((a,b)=>a-b).join(',')),'Expected ring/pair connectivity');
  const q0=s.kind==='ring'?s.input.seed.q:s.input.q,v0=s.kind==='ring'?s.input.seed.v:s.input.v;
  d.qpos.set(q0);d.qvel.set(v0);mj.mj_forward(m,d);
  const mass=m.body_mass[bodies[0]],k=m.jnt_stiffness[0],edgeK=m.flex_edgestiffness[0],edgeC=m.flex_edgedamping[0],degree=s.kind==='ring'?4:2;
  for(const b of bodies)assert.equal(m.body_mass[b],mass);assert.ok(Array.from(m.jnt_stiffness).every(x=>x===k));
  for(let i=0;i<n;i++){
   assert.equal(m.flex_vertbodyid[i],bodies[i]);assert.deepEqual(Array.from(d.xmat.slice(9*bodies[i],9*bodies[i]+9)),[1,0,0,0,1,0,0,0,1]);
   assert.deepEqual(Array.from(d.flexvert_xpos.slice(3*i,3*i+3)),Array.from(d.xpos.slice(3*bodies[i],3*bodies[i]+3)));
  }
  for(let i=0;i<nv;i++){assert.equal(m.M_rownnz[i],1);assert.equal(m.M_colind[m.M_rowadr[i]],i);assert.equal(d.M[m.M_rowadr[i]],mass);}
  const admission=linearAdmission({mass,kBound:k+degree*edgeK,cBound:degree*edgeC,dt});
  const report={model:MODEL,kind:s.kind,mode:s.mode,nodes:n,input:s.input,xmlSha256:hash(s.xml),nativeVersion:mj.mj_versionString(),nativeWarnings:nativeWarnings(d),coefficients:{nodeMass:mass,foundationStiffness:k,edgeStiffness:edgeK,edgeDamping:edgeC},admission,scope:'Authored contact-free diagnostic. Euler numerical identity; not a legacy fixture record, loaded contact, physical calibration or real-time qualification.'};
  assert.deepEqual(report.nativeWarnings,[],'Initial native warnings');
  if(!admission.admitted)return {...report,status:'admission-rejected',termination:'linear-rest-step-bound',summary:{steps:0},frames:[]};
  const oldQ=new Float64Array(nv),oldV=new Float64Array(nv),oldWarm=new Float64Array(nv),oldXYZ=new Float64Array(3*n),force=new Float64Array(nv),firstAcceleration=new Float64Array(nv),reference=new Float64Array(2),limits={};
  const wheel=s.kind==='ring'?wheelParameters({...s.input.seed.wheel,dt}):null,hub=new Float64Array([0,1]);
  const frames=Array.from({length:Math.round(.02/.000125)+2},()=>({}));let count=0,tick=0,termination=null;
  let energy=0,power=0,forceError=0,energyError=0,meanX=0,meanZ=0,nonuniformRms=0,posError=0,velError=0,loss=0,initialEnergy=0,maxResidual=0,maxForceError=0,maxEnergyError=0,maxPosError=0,maxVelError=0,maxNonuniform=0,firstStepError=null,modified=0,modifiedLoss=0,initialModified=0,maxModifiedResidual=0;
  const referenceAvailable=s.kind==='pair'||s.mode!=='alternating';
  function observe(withPrevious=false){
   mj.mj_forward(m,d);mj.mj_energyPos(m,d);mj.mj_energyVel(m,d);energy=d.energy[0]+d.energy[1];power=0;force.fill(0);let independentEnergy=0;
   const q=d.qpos,v=d.qvel,xyz=d.flexvert_xpos;
   for(let i=0;i<nv;i++)independentEnergy+=.5*k*q[i]*q[i]+.5*mass*v[i]*v[i];
   for(let e=0;e<m.nflexedge;e++){
    const a=m.flex_edge[2*e],b=m.flex_edge[2*e+1],dx=xyz[3*b]-xyz[3*a],dz=xyz[3*b+2]-xyz[3*a+2],length=Math.hypot(dx,dz);
    if(!(length>1e-12))return 'collapsed-edge';
    const ex=dx/length,ez=dz/length,rate=ex*(v[dim*b]-v[dim*a])+(dim===2?ez*(v[dim*b+1]-v[dim*a+1]):0),f=edgeC*rate;
    force[dim*a]+=ex*f;force[dim*b]-=ex*f;if(dim===2){force[dim*a+1]+=ez*f;force[dim*b+1]-=ez*f;}
    power+=edgeC*rate*rate;independentEnergy+=.5*edgeK*(length-m.flexedge_length0[e])**2;
   }
   forceError=0;for(let i=0;i<nv;i++)forceError=Math.max(forceError,Math.abs(force[i]-d.qfrc_damper[i]));energyError=Math.abs(energy-independentEnergy);
   meanX=0;meanZ=0;for(let i=0;i<n;i++){meanX+=v[dim*i]/n;if(dim===2)meanZ+=v[dim*i+1]/n;}
   nonuniformRms=0;for(let i=0;i<n;i++)nonuniformRms+=(v[dim*i]-meanX)**2+(dim===2?(v[dim*i+1]-meanZ)**2:0);nonuniformRms=Math.sqrt(nonuniformRms/n);
   posError=0;velError=0;
   if(referenceAvailable){
    oscillatorState(mass,s.kind==='pair'?k+2*edgeK:k,s.kind==='pair'?2*edgeC:0,.001,.01,d.time,reference);
    for(let i=0;i<nv;i++){const sign=s.kind==='pair'?(i?1:-1):(i%2===(s.mode==='z'?1:0)?1:0);posError=Math.max(posError,Math.abs(q[i]-sign*reference[0]));velError=Math.max(velError,Math.abs(v[i]-sign*reference[1]));}
   }
   if(s.kind==='pair')modified=independentEnergy-dt/4*edgeC*(v[1]-v[0])**2-dt/2*(k*(q[0]*v[0]+q[1]*v[1])+edgeK*(q[1]-q[0])*(v[1]-v[0]));
   if(!Number.isFinite(energy)||!Number.isFinite(power)||!Number.isFinite(forceError)||!Number.isFinite(energyError)||!Number.isFinite(nonuniformRms)||!Number.isFinite(posError)||!Number.isFinite(velError)||!Number.isFinite(modified))return 'nonfinite-observation';
   for(let i=0;i<nv;i++)if(!Number.isFinite(q[i])||!Number.isFinite(v[i])||!Number.isFinite(d.qacc[i]))return 'nonfinite-state';
   if(d.ncon||d.nefc)return 'contact-free-domain-exit';
   if(s.kind==='pair')return Math.abs(q[0])>.01||Math.abs(q[1])>.01?'pair-displacement-limit':null;
   geometryLimits(wheel,s.input.seed.profile,hub,xyz,withPrevious?oldXYZ:undefined,limits);if(limits.reason)return limits.reason;
   for(let e=0;e<m.nflexedge;e++)if(Math.abs(d.flexedge_length[e]/m.flexedge_length0[e]-1)>wheel.maxStrain)return 'casing-strain-limit';
   for(let i=0;i<n;i++)if(Math.hypot(q[2*i],q[2*i+1])>wheel.maxDisplacement)return 'casing-displacement-limit';
   return null;
  }
  function record(){Object.assign(frames[count++],{tick,time:d.time,energy,dampingLoss:loss,residual:energy-initialEnergy+loss,meanX,meanZ,nonuniformRms,positionError:referenceAvailable?posError:null,velocityError:referenceAvailable?velError:null});}
  const initialIssue=observe();if(initialIssue)return {...report,status:'initial-state-rejected',termination:initialIssue,summary:{steps:0},frames:[]};
  initialEnergy=energy;initialModified=modified;maxForceError=forceError;maxEnergyError=energyError;maxPosError=posError;maxVelError=velError;maxNonuniform=nonuniformRms;record();
  for(let next=1;next<=steps;next++){
   oldQ.set(d.qpos);oldV.set(d.qvel);oldWarm.set(d.qacc_warmstart);oldXYZ.set(d.flexvert_xpos);const oldTime=d.time,oldPower=power;if(next===1)firstAcceleration.set(d.qacc);
   mj.mj_step(m,d);const issue=observe(true)||(Math.abs(d.time-oldTime-dt)>1e-10?'native-clock-reset':null);
   if(issue){termination=issue;d.qpos.set(oldQ);d.qvel.set(oldV);d.qacc_warmstart.set(oldWarm);d.time=oldTime;observe();break;}
   tick=next;loss+=.5*dt*(oldPower+power);
   if(next===1){firstStepError=0;for(let i=0;i<nv;i++)firstStepError=Math.max(firstStepError,Math.abs(d.qvel[i]-oldV[i]-dt*firstAcceleration[i]));}
   if(s.kind==='pair'){const delta=(d.qvel[1]+oldV[1])-(d.qvel[0]+oldV[0]);modifiedLoss+=dt/4*edgeC*delta*delta;maxModifiedResidual=Math.max(maxModifiedResidual,Math.abs(modified-initialModified+modifiedLoss));}
   maxResidual=Math.max(maxResidual,Math.abs(energy-initialEnergy+loss));maxForceError=Math.max(maxForceError,forceError);maxEnergyError=Math.max(maxEnergyError,energyError);maxPosError=Math.max(maxPosError,posError);maxVelError=Math.max(maxVelError,velError);maxNonuniform=Math.max(maxNonuniform,nonuniformRms);
   if(tick%stride===0)record();
  }
  if(frames[count-1].tick!==tick)record();
  const warnings=nativeWarnings(d);
  return {...report,nativeWarnings:warnings,status:termination?'terminated':warnings.length?'native-warning':'completed',termination,summary:{steps:tick,acceptedTime:d.time,initialEnergy,finalEnergy:energy,dampingLoss:loss,maxResidual,maxForceError,maxEnergyError,maxPositionError:referenceAvailable?maxPosError:null,maxVelocityError:referenceAvailable?maxVelError:null,maxNonuniformRms:maxNonuniform,firstStepError,maxModifiedResidual:s.kind==='pair'?maxModifiedResidual:null},finalNodes:{q:Array.from(d.qpos),v:Array.from(d.qvel)},frames:frames.slice(0,count)};
 }finally{d?.delete();m?.delete();}
}

async function main(){
 if(process.argv.length>3)throw Error('Usage: node scripts/casing-euler.mjs [output-directory]');
 const dir=resolve(process.argv[2]??'artifacts/casing-euler');await mkdir(dir,{recursive:true});
 const configs=[];for(const nodes of [32,64,128])for(const mode of ['x','z'])for(const dt of [.00003125,.000015625,.0000078125])configs.push({nodes,mode,dt});
 for(const mode of ['x','z'])configs.push({mode,edgeViscosity:0});
 for(const dt of [.00003125,.000015625,.0000078125]){configs.push({nodes:128,edgeViscosity:3,mode:'alternating',dt});configs.push({mode:'alternating',dt});configs.push({kind:'pair',dt});}
 const sources=['scripts/casing-euler.mjs','scripts/casing-derivative.mjs','dist/tyre-fixture.js','dist/moving-wheel.js','dist/trail-initial-state.js','dist/suspension-reference.js','dist/tyre-fixture-examples.json','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm'];
 const sourcesSha256=Object.fromEntries(await Promise.all(sources.map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))]))),cases=[];
 for(let i=0;i<configs.length;i++){
  const record=await runEulerTrial(configs[i]),file='case-'+String(i+1).padStart(2,'0')+'.json',bytes=JSON.stringify(record,null,2)+'\n';await writeFile(join(dir,file),bytes);
  const {frames,finalNodes,...receipt}=record;cases.push({file,sha256:hash(bytes),config:configs[i],...receipt});console.log(`${i+1}/${configs.length} ${file}: ${record.status}`);
 }
 await writeFile(join(dir,'report.json'),JSON.stringify({model:MODEL,sourcesSha256,cases,scope:'Isolated candidate qualification; no production change, loaded contact, browser receiving, calibration or performance claim.'},null,2)+'\n');
 if(cases.some(r=>r.status!=='completed'&&r.status!=='admission-rejected'))process.exitCode=2;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
