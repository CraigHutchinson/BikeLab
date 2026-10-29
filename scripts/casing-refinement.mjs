// Isolated contact-free reference. Never changes production timestep admission.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {controlInput} from './casing-derivative.mjs';
import {runEulerTrial,linearAdmission} from './casing-euler.mjs';
import {getRuntime,validate as wheelParameters,geometryLimits} from '../dist/moving-wheel.js';
import {modelXML} from '../dist/tyre-fixture.js';

export const MODEL='bikelab-contact-free-loss-refinement-0.1';
export const GRID=.0000009765625;
export const REFERENCE_BUDGETS=Object.freeze({position:1e-10,velocity:1e-7,loss:1e-10,energy:1e-10,power:1e-6,sampledLoss:1e-10});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

// Independent Cartesian force law; compiled geometry/coefficients are input data.
// State = [q_x0,q_z0,...,v_x0,v_z0,..., accumulated loss]. Scratch is caller-owned.
export function geometricRhs(p,state,out,observation){
 const nv=p.rest.length,q=state,v=nv;let energy=0,power=0;
 for(let i=0;i<nv;i++){
  assert.ok(Number.isFinite(q[i])&&Number.isFinite(state[v+i]),'Nonfinite reference state');
  out[i]=state[v+i];out[v+i]=-p.k*q[i]/p.mass;
  energy+=.5*p.k*q[i]*q[i]+.5*p.mass*state[v+i]*state[v+i];
  observation.xyz[3*Math.floor(i/2)+(i%2?2:0)]=p.rest[i]+q[i];
 }
 for(let e=0;e<p.lengths.length;e++){
  const a=2*p.edges[2*e],b=2*p.edges[2*e+1],dx=(p.rest[b]+q[b])-(p.rest[a]+q[a]),dz=(p.rest[b+1]+q[b+1])-(p.rest[a+1]+q[a+1]),length=Math.hypot(dx,dz);
  assert.ok(length>1e-12&&Number.isFinite(length),'Collapsed reference edge');
  const ex=dx/length,ez=dz/length,extension=length-p.lengths[e],rate=ex*(state[v+b]-state[v+a])+ez*(state[v+b+1]-state[v+a+1]);
  const f=(p.edgeK*extension+p.edgeC*rate)/p.mass;
  out[v+a]+=f*ex;out[v+a+1]+=f*ez;out[v+b]-=f*ex;out[v+b+1]-=f*ez;
  power+=p.edgeC*rate*rate;energy+=.5*p.edgeK*extension*extension;
  assert.ok(Math.abs(extension/p.lengths[e])<=p.maxStrain,'Reference strain limit');
 }
 for(let i=0;i<nv;i+=2)assert.ok(Math.hypot(q[i],q[i+1])<=p.maxDisplacement,'Reference displacement limit');
 out[2*nv]=power;observation.energy=energy;observation.power=power;
 assert.ok(Number.isFinite(energy)&&Number.isFinite(power)&&Number.isFinite(state[2*nv]),'Nonfinite reference observation');
 for(let i=0;i<nv;i++)assert.ok(Number.isFinite(out[nv+i]),'Nonfinite reference acceleration');
}

export function createGeometricRK4(p,initial){
 const nv=p.rest.length,size=2*nv+1;
 assert.ok(nv>=4&&nv%2===0&&initial.length===size);
 assert.ok(Number.isFinite(p.mass)&&p.mass>0&&Number.isFinite(p.k)&&p.k>0&&Number.isFinite(p.edgeK)&&p.edgeK>=0&&Number.isFinite(p.edgeC)&&p.edgeC>=0);
 assert.ok(Number.isFinite(p.maxStrain)&&p.maxStrain>0&&Number.isFinite(p.maxDisplacement)&&p.maxDisplacement>0);
 assert.equal(p.edges.length,2*p.lengths.length);assert.ok(p.rest.every(Number.isFinite));
 assert.ok(p.lengths.every(x=>Number.isFinite(x)&&x>0));assert.ok(p.edges.every(x=>Number.isInteger(x)&&x>=0&&x<nv/2));
 const state=Float64Array.from(initial),candidate=new Float64Array(size),stage=new Float64Array(size),k1=new Float64Array(size),k2=new Float64Array(size),k3=new Float64Array(size),k4=new Float64Array(size),observation={xyz:new Float64Array(3*nv/2)};
 const observe=()=>{geometricRhs(p,state,k1,observation);return observation;};observe();
 return {state,observation,observe,step(h){
  assert.ok(Number.isFinite(h)&&h>0);try{geometricRhs(p,state,k1,observation);
  for(let i=0;i<size;i++)stage[i]=state[i]+h*k1[i]/2;geometricRhs(p,stage,k2,observation);
  for(let i=0;i<size;i++)stage[i]=state[i]+h*k2[i]/2;geometricRhs(p,stage,k3,observation);
  for(let i=0;i<size;i++)stage[i]=state[i]+h*k3[i];geometricRhs(p,stage,k4,observation);
  for(let i=0;i<size;i++)candidate[i]=state[i]+h*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6;
  geometricRhs(p,candidate,k1,observation);state.set(candidate);
  }catch(error){observe();throw error;}
 }};
}

function warningCounters(d){const out=[],w=d.warning;for(let i=0;i<w.size();i++){const v=w.get(i);try{if(v.number)out.push({index:i,number:v.number,lastinfo:v.lastinfo});}finally{v.delete();}}return out;}

function compiledPhysical(mj,m,d,n){
 const nv=2*n;assert.equal(m.nv,nv);assert.equal(m.nq,nv);assert.equal(m.nC,nv);assert.equal(m.nflex,1);assert.equal(m.nflexedge,n);assert.equal(m.flex_vertnum[0],n);assert.equal(m.nu,0);assert.equal(m.ntendon,0);
 for(const values of [m.opt.gravity,m.qpos_spring,m.dof_damping,m.dof_dampingpoly])assert.ok(Array.from(values).every(x=>x===0));
 assert.equal(m.opt.integrator,mj.mjtIntegrator.mjINT_EULER.value);
 const hub=mj.mj_name2id(m,mj.mjtObj.mjOBJ_BODY.value,'hub');assert.ok(hub>=0);assert.equal(m.body_jntnum[hub],0);
 const rest=new Float64Array(nv),mass=d.M[0],k=m.jnt_stiffness[0];
 for(let i=0;i<n;i++){
  const body=mj.mj_name2id(m,mj.mjtObj.mjOBJ_BODY.value,'casing_n'+i);assert.equal(m.flex_vertbodyid[i],body);assert.equal(m.body_parentid[body],hub);
  assert.deepEqual(Array.from(d.xmat.slice(9*body,9*body+9)),[1,0,0,0,1,0,0,0,1]);
  for(let axis=0;axis<2;axis++){
   const j=2*i+axis;assert.equal(m.jnt_type[j],mj.mjtJoint.mjJNT_SLIDE.value);assert.equal(m.jnt_bodyid[j],body);assert.equal(m.jnt_dofadr[j],j);assert.equal(m.jnt_qposadr[j],j);
   assert.deepEqual(Array.from(m.jnt_axis.slice(3*j,3*j+3)),axis?[0,0,1]:[1,0,0]);assert.equal(m.jnt_stiffness[j],k);assert.equal(m.M_rownnz[j],1);assert.equal(m.M_colind[m.M_rowadr[j]],j);assert.equal(d.M[m.M_rowadr[j]],mass);assert.equal(m.body_mass[body],mass);
   rest[j]=d.flexvert_xpos[3*i+(axis?2:0)];assert.equal(rest[j],d.xpos[3*body+(axis?2:0)]);
  }
 }
 const edges=Array.from(m.flex_edge),set=new Set();for(let i=0;i<n;i++)set.add([edges[2*i],edges[2*i+1]].sort((a,b)=>a-b).join(','));for(let i=0;i<n;i++)assert.ok(set.has([i,(i+1)%n].sort((a,b)=>a-b).join(',')));
 return {mass,k,edgeK:m.flex_edgestiffness[0],edgeC:m.flex_edgedamping[0],rest:Array.from(rest),edges,lengths:Array.from(m.flexedge_length0),maxStrain:.25,maxDisplacement:.06};
}

function integrateReference(p,initial,duration,h,guard,onProgress){
 const nv=p.rest.length,count=Math.round(duration/GRID)+1,stride=Math.round(GRID/h),steps=(count-1)*stride,engine=createGeometricRK4(p,initial),state=engine.state;
 const trajectory=new Float64Array(count*2*nv),energy=new Float64Array(count),power=new Float64Array(count),loss=new Float64Array(count),oldXYZ=new Float64Array(3*nv/2);
 const initialEnergy=engine.observation.energy;let maxResidual=0,sample=0;
 const record=()=>{for(let j=0;j<2*nv;j++)trajectory[sample*2*nv+j]=state[j];energy[sample]=engine.observation.energy;power[sample]=engine.observation.power;loss[sample]=state[2*nv];sample++;};
 guard(engine.observation.xyz);record();
 for(let tick=1;tick<=steps;tick++){
  oldXYZ.set(engine.observation.xyz);engine.step(h);guard(engine.observation.xyz,oldXYZ);
  maxResidual=Math.max(maxResidual,Math.abs(engine.observation.energy-initialEnergy+state[2*nv]));
  if(tick%stride===0)record();if(tick%Math.max(1,Math.floor(steps/10))===0)onProgress?.(tick/steps);
 }
 return {dt:h,steps,initialEnergy,maxResidual,trajectory,energy,power,loss};
}

function compareReferences(a,b,nv){
 let position=0,velocity=0,loss=0,energy=0,power=0,sampledLoss=0;
 for(let i=0;i<a.energy.length;i++){
  for(let j=0;j<nv;j++){position=Math.max(position,Math.abs(a.trajectory[i*2*nv+j]-b.trajectory[i*2*nv+j]));velocity=Math.max(velocity,Math.abs(a.trajectory[i*2*nv+nv+j]-b.trajectory[i*2*nv+nv+j]));}
  loss=Math.max(loss,Math.abs(a.loss[i]-b.loss[i]));energy=Math.max(energy,Math.abs(a.energy[i]-b.energy[i]));power=Math.max(power,Math.abs(a.power[i]-b.power[i]));
 }
 for(const stride of [16,8,4,2,1]){let difference=0;for(let i=stride;i<a.power.length;i+=stride){difference+=GRID*stride/2*(a.power[i-stride]-b.power[i-stride]+a.power[i]-b.power[i]);sampledLoss=Math.max(sampledLoss,Math.abs(difference));}}
 const differences={position,velocity,loss,energy,power,sampledLoss};return {coarseDt:a.dt,fineDt:b.dt,maxAbsolute:differences,withinBudgets:Object.entries(differences).every(([key,v])=>v<=REFERENCE_BUDGETS[key])&&b.maxResidual<=REFERENCE_BUDGETS.energy};
}

// Signed terms at one common time; maxima are reported separately, never added.
export function decompose(initialEnergy,eulerEnergy,eulerLoss,referenceEnergy,referenceLoss,sampledReferenceLoss,out={}){
 out.residual=eulerEnergy-initialEnergy+eulerLoss;out.referenceResidual=referenceEnergy-initialEnergy+referenceLoss;out.energyDifference=eulerEnergy-referenceEnergy;out.sampledPowerDifference=eulerLoss-sampledReferenceLoss;out.referenceQuadrature=sampledReferenceLoss-referenceLoss;
 out.closure=out.residual-out.referenceResidual-out.energyDifference-out.sampledPowerDifference-out.referenceQuadrature;return out;
}

export async function runRefinement(options={}){
 assert.ok(options&&typeof options==='object'&&!Array.isArray(options));for(const key of Object.keys(options))assert.ok(['nodes','edgeViscosity','duration','onProgress'].includes(key),'Unknown refinement option: '+key);
 const {nodes=128,edgeViscosity=3,duration=.02,onProgress}=options;
 assert.ok([32,64,128].includes(nodes));assert.ok([.5,3].includes(edgeViscosity));assert.ok([.000125,.001,.02].includes(duration));assert.ok(onProgress===undefined||typeof onProgress==='function');
 const input=await controlInput({nodes,edgeViscosity,dt:.000015625});input.seed.q.fill(0);input.seed.v.fill(0);for(let i=0;i<nodes;i++)input.seed.v[2*i]=i%2?-.01:.01;
 const xml=modelXML(input).replace('integrator="implicitfast"','integrator="Euler"'),mj=await getRuntime();let m,d;
 try{
  m=mj.MjModel.from_xml_string(xml);d=new mj.MjData(m);mj.mj_forward(m,d);
  const p=compiledPhysical(mj,m,d,nodes),nv=m.nv,initial=new Float64Array(2*nv+1),wheel=wheelParameters({...input.seed.wheel,dt:input.motion.dt}),hub=new Float64Array([0,1]),limits={};initial.set(input.seed.q);initial.set(input.seed.v,nv);
  const guard=(xyz,old)=>{geometryLimits(wheel,input.seed.profile,hub,xyz,old,limits);assert.equal(limits.reason,null,'Contact-free geometry domain: '+limits.reason);};
  const levels=[],refinement=[];let reference;
  for(const divisor of [2,4,8]){
   onProgress?.('reference-start',{dt:GRID/divisor});const next=integrateReference(p,initial,duration,GRID/divisor,guard,fraction=>onProgress?.('reference-progress',{dt:GRID/divisor,fraction}));
   if(reference)refinement.push(compareReferences(reference,next,nv));levels.push({dt:next.dt,steps:next.steps,maxResidual:next.maxResidual,finalEnergy:next.energy.at(-1),finalLoss:next.loss.at(-1)});reference=next;
  }
  assert.ok(refinement.at(-1).withinBudgets,'Fine reference has not converged within declared numerical budgets');
  const cases=[],state=new Float64Array(2*nv+1),rhs=new Float64Array(2*nv+1),observation={xyz:new Float64Array(3*nodes)},oldXYZ=new Float64Array(3*nodes);
  for(const multiple of [16,8,4,2,1]){
   const dt=GRID*multiple,steps=Math.round(duration/dt),admission=linearAdmission({mass:p.mass,kBound:p.k+4*p.edgeK,cBound:4*p.edgeC,dt});assert.ok(admission.admitted);
   m.opt.timestep=dt;mj.mj_resetData(m,d);d.qpos.set(input.seed.q);d.qvel.set(input.seed.v);mj.mj_forward(m,d);
   state.set(d.qpos);state.set(d.qvel,nv);state[2*nv]=0;geometricRhs(p,state,rhs,observation);guard(observation.xyz);
   assert.equal(observation.energy,reference.initialEnergy);
   let previousPower=observation.power,previousReferencePower=reference.power[0],loss=0,referenceTrapezoid=0,maxForceError=0,maxNativeEnergyError=0,maxPositionError=0,maxVelocityError=0,maxPositionRms=0,maxVelocityRms=0;
   for(let j=0;j<nv;j++)maxForceError=Math.max(maxForceError,Math.abs(p.mass*rhs[nv+j]-d.qfrc_smooth[j]));mj.mj_energyPos(m,d);mj.mj_energyVel(m,d);maxNativeEnergyError=Math.abs(observation.energy-d.energy[0]-d.energy[1]);
   const maxima={residual:0,referenceResidual:0,energyDifference:0,sampledPowerDifference:0,referenceQuadrature:0,closure:0},termKeys=Object.keys(maxima),terms={},last={},peak={},frames=Array.from({length:Math.ceil(.00025/dt)+Math.ceil(duration/.000125)+2},()=>({}));let count=0;
   Object.assign(frames[count++],{tick:0,time:0,...decompose(reference.initialEnergy,observation.energy,0,reference.energy[0],0,0),positionError:0,velocityError:0});
   for(let tick=1;tick<=steps;tick++){
    oldXYZ.set(observation.xyz);mj.mj_step(m,d);mj.mj_forward(m,d);assert.equal(d.ncon,0);assert.equal(d.nefc,0);assert.ok(Math.abs(d.time-tick*dt)<1e-10,'Native clock reset');
    state.set(d.qpos);state.set(d.qvel,nv);geometricRhs(p,state,rhs,observation);guard(observation.xyz,oldXYZ);
    mj.mj_energyPos(m,d);mj.mj_energyVel(m,d);maxNativeEnergyError=Math.max(maxNativeEnergyError,Math.abs(observation.energy-d.energy[0]-d.energy[1]));
    for(let j=0;j<nv;j++)maxForceError=Math.max(maxForceError,Math.abs(p.mass*rhs[nv+j]-d.qfrc_smooth[j]));
    const index=tick*multiple,offset=index*2*nv;loss+=dt*(previousPower+observation.power)/2;referenceTrapezoid+=dt*(previousReferencePower+reference.power[index])/2;previousPower=observation.power;previousReferencePower=reference.power[index];
    let positionError=0,velocityError=0,positionRms=0,velocityRms=0;
    for(let j=0;j<nv;j++){const dq=state[j]-reference.trajectory[offset+j],dv=state[nv+j]-reference.trajectory[offset+nv+j];positionError=Math.max(positionError,Math.abs(dq));velocityError=Math.max(velocityError,Math.abs(dv));positionRms+=dq*dq;velocityRms+=dv*dv;}
    maxPositionError=Math.max(maxPositionError,positionError);maxVelocityError=Math.max(maxVelocityError,velocityError);maxPositionRms=Math.max(maxPositionRms,Math.sqrt(positionRms/nv));maxVelocityRms=Math.max(maxVelocityRms,Math.sqrt(velocityRms/nv));
    decompose(reference.initialEnergy,observation.energy,loss,reference.energy[index],reference.loss[index],referenceTrapezoid,terms);Object.assign(last,terms);last.tick=tick;last.time=tick*dt;last.positionError=positionError;last.velocityError=velocityError;
    if(tick===1||Math.abs(terms.residual)>Math.abs(peak.residual))Object.assign(peak,last);for(const key of termKeys)maxima[key]=Math.max(maxima[key],Math.abs(terms[key]));
    if(tick*dt<=.00025||tick%Math.round(.000125/dt)===0||tick===steps)Object.assign(frames[count++],last);
   }
   assert.deepEqual(warningCounters(d),[]);assert.ok(maxForceError<1e-8&&maxNativeEnergyError<1e-12,'Independent force/energy mismatch');
   let legacyEndpointExact=null;
   if(duration===.02&&[16,8].includes(multiple)){
    const old=await runEulerTrial({nodes,edgeViscosity,mode:'alternating',dt});assert.equal(old.status,'completed');assert.deepEqual(Array.from(d.qpos),old.finalNodes.q);assert.deepEqual(Array.from(d.qvel),old.finalNodes.v);legacyEndpointExact=true;
   }
   cases.push({dt,steps,admission,legacyEndpointExact,maxForceError,maxNativeEnergyError,maxPositionError,maxVelocityError,maxPositionRms,maxVelocityRms,maxima,atPeakResidual:peak,endpoint:last,frames:frames.slice(0,count)});onProgress?.('euler-completed',{dt,maxPositionError,maxVelocityError,residual:maxima.residual});
  }
  return {model:MODEL,scope:'Matched-grid diagnostic decomposition relative to a refined independent Cartesian RK4 reference; not a unique error attribution, physical calibration, contact or production qualification.',input,diagnosticDuration:duration,observationGrid:GRID,xmlSha256:hash(xml),nativeVersion:mj.mj_versionString(),nativeWarnings:[],physical:p,initialEnergy:reference.initialEnergy,scales:{position:Math.sqrt(2*reference.initialEnergy/(nodes*p.k)),velocity:Math.sqrt(2*reference.initialEnergy/(nodes*p.mass))},referenceBudgets:REFERENCE_BUDGETS,referenceLevels:levels,referenceComparisons:refinement,cases};
 }finally{d?.delete();m?.delete();}
}

async function main(){
 if(process.argv.length>3)throw Error('Usage: node scripts/casing-refinement.mjs [output-directory]');const dir=resolve(process.argv[2]??'artifacts/casing-refinement');await mkdir(dir,{recursive:true});
 const sources=['scripts/casing-refinement.mjs','scripts/casing-euler.mjs','scripts/casing-derivative.mjs','dist/moving-wheel.js','dist/tyre-fixture.js','dist/tyre-fixture-examples.json','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm'];
 const sourcesSha256=Object.fromEntries(await Promise.all(sources.map(async path=>[path,hash(await readFile(new URL('../'+path,import.meta.url)))])));
 const result=await runRefinement({onProgress:(stage,value)=>console.log(stage,JSON.stringify(value))}),cases=[];
 for(let i=0;i<result.cases.length;i++){const c=result.cases[i],file='case-'+(i+1)+'.json',bytes=JSON.stringify(c,null,2)+'\n';await writeFile(join(dir,file),bytes);const {frames,...receipt}=c;cases.push({file,sha256:hash(bytes),...receipt});}
 const report={...result,sourcesSha256,cases};await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
