// Research probe only; no production actor, release or contact receiving.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {compileRiderSetup,riderSetupExample,riderDefinitionIdentity} from '../dist/rider-setup.js';
import assert from 'node:assert/strict';
import {passiveRiderParts,RIDER_JOINTS} from '../dist/rider-native.js';
import {passiveStateIssue} from '../dist/rider-passive.js';
import {getRuntime} from '../dist/moving-wheel.js';
if(process.argv.length>3)throw Error('Usage: node scripts/rider-unbound-review.mjs [output.json]');
const outputPath=process.argv[2]??'artifacts/rider-unbound-review.json';
const setup=riderSetupExample(),passive=compileRiderSetup(setup).scenario.articulated.passive;
const mj=await getRuntime(),duration=.02,g=9.80665;
const specifications=[
 {name:'translation-gravity',q:[0,0,0,0,0,0,0],v:[.7,.2,0,0,0,0,0],gravity:g},
 {name:'spin-and-joints',q:[.3,1,.15,.05,-.04,.03,-.02],v:[.7,.2,.3,.2,-.15,.1,-.08],gravity:g},
 {name:'spin-and-joints-no-gravity',q:[.3,1,.15,.05,-.04,.03,-.02],v:[.7,.2,.3,.2,-.15,.1,-.08],gravity:0}
];
function analytical(parts,q,v,gravity){
 const p=parts.posture.spec,j=parts.posture.joints,s=p.segments;
 const point=(start,velocity,a,w,L)=>({p:[start[0]+L*Math.sin(a),start[1]+L*Math.cos(a)],v:[velocity[0]+w*L*Math.cos(a),velocity[1]-w*L*Math.sin(a)]});
 const hip={p:[p.hip[0]+q[0],p.hip[1]+q[1]],v:[v[0],v[1]]},trunk=p.trunkPitch+q[2],wt=v[2];
 const shoulder=point(hip.p,hip.v,trunk,wt,s.trunk.length);
 const thigh=trunk+j.hip+q[3],wth=wt+v[3],knee=point(hip.p,hip.v,thigh,wth,s.thighs.length);
 const arm=trunk+j.shoulder+q[5],wa=wt+v[5],elbow=point(shoulder.p,shoulder.v,arm,wa,s.upperArms.length);
 const configs=[['trunk',hip,trunk,wt],['thighs',hip,thigh,wth],['shanksFeet',knee,thigh+j.knee+q[4],wth+v[4]],['upperArms',shoulder,arm,wa],['forearmsHands',elbow,arm+j.elbow+q[6],wa+v[6]]];
 const bodies=configs.map(([name,prox,a,w])=>{const body=s[name],com=point(prox.p,prox.v,a,w,body.length*body.comFraction),end=point(prox.p,prox.v,a,w,body.length);return {name,mass:p.riderMass*body.massFraction,com:com.p,velocity:com.v,omega:w,proximal:prox.p,distal:end.p,I:p.riderMass*body.massFraction*body.inertiaPerMass[1]};});
 const total=summarize(bodies,gravity);
 total.energy+=parts.passive.laws.reduce((sum,law,i)=>sum+.5*law.stiffness*(q[i+3]-law.springref)**2,0);
 return {...total,bodies};
}
function summarize(bodies,gravity){
 const mass=bodies.reduce((s,b)=>s+b.mass,0),com=[0,1].map(k=>bodies.reduce((s,b)=>s+b.mass*b.com[k],0)/mass),P=[0,1].map(k=>bodies.reduce((s,b)=>s+b.mass*b.velocity[k],0));
 const H=bodies.reduce((s,b)=>s+b.I*b.omega+b.mass*((b.com[1]-com[1])*(b.velocity[0]-P[0]/mass)-(b.com[0]-com[0])*(b.velocity[1]-P[1]/mass)),0);
 const energy=bodies.reduce((s,b)=>s+.5*b.mass*(b.velocity[0]**2+b.velocity[1]**2)+.5*b.I*b.omega**2+b.mass*gravity*b.com[1],0);
 return {mass,com,P,H,energy};
}
const cases=[];
for(const launch of specifications)for(const dt of [.00003125,.000015625,.0000078125]){
 const parts=passiveRiderParts(passive);
 const xml=`<mujoco model="Unbound rider research"><compiler angle="radian"/><option timestep="${dt}" gravity="0 0 -${launch.gravity}" integrator="implicitfast"><flag autoreset="disable"/></option><worldbody>${parts.body}</worldbody></mujoco>`;
 let model,data,buffer;
 try{
  model=mj.MjModel.from_xml_string(xml);data=new mj.MjData(model);buffer=new mj.DoubleBuffer(6);
  assert.equal(model.nq,7);assert.equal(model.nv,7);assert.equal(model.nbody,6);assert.equal(model.neq,0);
  const bodyType=mj.mjtObj.mjOBJ_BODY.value,siteType=mj.mjtObj.mjOBJ_SITE.value;
  const id=(kind,name)=>{const x=mj.mj_name2id(model,kind,name);assert.ok(x>=0,name);return x;};
  const joints=RIDER_JOINTS.map(name=>{const j=id(mj.mjtObj.mjOBJ_JOINT.value,name);return {q:model.jnt_qposadr[j],v:model.jnt_dofadr[j]};});
  const bodies=Object.keys(parts.posture.spec.segments).map(name=>({name,id:id(bodyType,'rider_'+name),end:id(siteType,'rider_'+name+'_end')}));
  assert.equal(model.body_parentid[bodies[0].id],0);
  for(let i=0;i<7;i++){data.qpos[joints[i].q]=launch.q[i];data.qvel[joints[i].v]=launch.v[i];}
  function observe(){
   mj.mj_forward(model,data);mj.mj_energyPos(model,data);mj.mj_energyVel(model,data);
   assert.equal(data.ncon,0);assert.equal(data.nefc,0);assert.ok(data.qfrc_applied.every(x=>x===0));assert.ok(data.xfrc_applied.every(x=>x===0));
   const q=joints.slice(3).map(j=>data.qpos[j.q]),v=joints.slice(3).map(j=>data.qvel[j.v]);assert.equal(passiveStateIssue(parts.passive,q,v),null);
   for(const a of [data.qpos,data.qvel,data.qacc])assert.ok(a.every(Number.isFinite));
   const observed=bodies.map(b=>{
    mj.mj_objectVelocity(model,data,bodyType,b.id,buffer,0);const vel=buffer.GetView();
    const R=data.ximat,I=model.body_inertia;let Iyy=0;for(let k=0;k<3;k++)Iyy+=R[9*b.id+3+k]**2*I[3*b.id+k];
    for(const k of [0,2,4])assert.ok(Math.abs(vel[k])<1e-10);
    return {name:b.name,mass:model.body_mass[b.id],com:[data.xipos[3*b.id],data.xipos[3*b.id+2]],velocity:[vel[3],vel[5]],omega:vel[1],I:Iyy,
      proximal:[data.xpos[3*b.id],data.xpos[3*b.id+2]],distal:[data.site_xpos[3*b.end],data.site_xpos[3*b.end+2]]};
   });
   const state=summarize(observed,launch.gravity);state.energy=data.energy[0]+data.energy[1];
   state.lossPower=parts.passive.laws.reduce((sum,law,i)=>sum+law.damping*v[i]**2,0);return {...state,time:data.time,bodies:observed};
  }
  const initial=observe(),expected=analytical(parts,launch.q,launch.v,launch.gravity);
  const initialErrors={massKg:Math.abs(initial.mass-expected.mass),linearMomentumNs:0,angularMomentumNms:Math.abs(initial.H-expected.H),energyJ:Math.abs(initial.energy-expected.energy),positionM:0,velocityMps:0,angularVelocityRadps:0,inertiaKgM2:0};
  for(let k=0;k<2;k++){initialErrors.positionM=Math.max(initialErrors.positionM,Math.abs(initial.com[k]-expected.com[k]));initialErrors.linearMomentumNs=Math.max(initialErrors.linearMomentumNs,Math.abs(initial.P[k]-expected.P[k]));}
  for(let i=0;i<bodies.length;i++){
   const a=initial.bodies[i],b=expected.bodies[i];
   for(const [key,quantity] of [['mass','massKg'],['I','inertiaKgM2'],['omega','angularVelocityRadps']])initialErrors[quantity]=Math.max(initialErrors[quantity],Math.abs(a[key]-b[key]));
   for(const key of ['proximal','distal','com','velocity'])for(let k=0;k<2;k++){const quantity=key==='velocity'?'velocityMps':'positionM';initialErrors[quantity]=Math.max(initialErrors[quantity],Math.abs(a[key][k]-b[key][k]));}
  }
  for(const [key,error] of Object.entries(initialErrors))assert.ok(error<1e-10,key+' initial analytical mismatch');
  let maxDiscreteBallisticPositionError=0,maxDiscreteBallisticEnergyError=0;
  let previous=initial,loss=0,maxEnergyResidual=0,maxMomentumResidual=0,maxCOMResidual=0,maxAngularMomentumResidual=0;
  for(let k=1;k<=Math.round(duration/dt);k++){
   const old=data.time;mj.mj_step(model,data);assert.ok(Math.abs(data.time-old-dt)<1e-12);const current=observe();loss+=.5*dt*(previous.lossPower+current.lossPower);
   maxEnergyResidual=Math.max(maxEnergyResidual,Math.abs(current.energy-initial.energy+loss));
   maxMomentumResidual=Math.max(maxMomentumResidual,Math.abs(current.P[0]-initial.P[0]),Math.abs(current.P[1]-initial.P[1]+initial.mass*launch.gravity*data.time));
   maxAngularMomentumResidual=Math.max(maxAngularMomentumResidual,Math.abs(current.H-initial.H));
   for(let axis=0;axis<2;axis++){const ref=initial.com[axis]+initial.P[axis]/initial.mass*data.time-(axis?.5*launch.gravity*data.time**2:0);maxCOMResidual=Math.max(maxCOMResidual,Math.abs(current.com[axis]-ref));}
   if(launch.name==='translation-gravity'){
    // implicitfast advances position with endpoint velocity. With constant
    // gravity this is the exact discrete path, distinct from continuous flight.
    const z=initial.com[1]+initial.P[1]/initial.mass*data.time-.5*launch.gravity*(data.time**2+dt*data.time);
    maxDiscreteBallisticPositionError=Math.max(maxDiscreteBallisticPositionError,Math.abs(current.com[1]-z));
    const energyBias=-.5*initial.mass*launch.gravity**2*dt*data.time;
    maxDiscreteBallisticEnergyError=Math.max(maxDiscreteBallisticEnergyError,Math.abs(current.energy-initial.energy-energyBias));
   }
   previous=current;
  }
  if(launch.name==='translation-gravity'){
   assert.ok(maxDiscreteBallisticPositionError<1e-10,'discrete constant-gravity position');
   assert.ok(maxDiscreteBallisticEnergyError<1e-9,'discrete constant-gravity energy');
  }
  cases.push({name:launch.name,dt,duration,gravity:launch.gravity,launch,modelSHA256:createHash('sha256').update(xml).digest('hex'),initialErrors,maxEnergyResidual,maxMomentumResidual,maxAngularMomentumResidual,maxCOMResidual,dampingLoss:loss,discreteBallistic:launch.name==='translation-gravity'?{maxPositionError:maxDiscreteBallisticPositionError,maxEnergyError:maxDiscreteBallisticEnergyError}:null,initial,final:previous});
 }finally{buffer?.delete();data?.delete();model?.delete();}
}
const sourcePaths=['scripts/rider-unbound-review.mjs','dist/rider-native.js','dist/rider-passive.js','dist/rider-posture.js','dist/rider-setup.js'];
const sourceSHA256={};for(const path of sourcePaths)sourceSHA256[path]=createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex');
const output={baselineMain:'a6e5cd8c2873af49f5000ed252f6a7ddc410cbba',sourceSHA256,runtime:{node:process.version,platform:process.platform,arch:process.arch},passiveSpec:passive,
 scope:'Exploratory world-root rider native probe, not received runtime actors/release/contact. Allocating per-step research observations; not a production runner or benchmark. Reference fit is an authored world pose, not a live bike-relative state conversion.',
 units:'SI. Planar x/z, positive rotation about +y; positions are world x/z; root translation velocity is hip velocity. P is world linear momentum; H is angular momentum about aggregate COM. Native energies include springs/gravity once. Damping loss uses trapezoidal quadrature at every step.',
 nativeBuild:JSON.parse(await readFile(new URL('../dist/vendor/mujoco-3.16.0/provenance.json',import.meta.url),'utf8')),
 riderIdentity:await riderDefinitionIdentity(setup.rider),cases};
await mkdir(dirname(outputPath),{recursive:true});await writeFile(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(cases.map(({name,dt,initialErrors,maxCOMResidual,maxMomentumResidual,maxAngularMomentumResidual,maxEnergyResidual,discreteBallistic})=>({name,dt,initialErrors,maxCOMResidual,maxMomentumResidual,maxAngularMomentumResidual,maxEnergyResidual,discreteBallistic})),null,2));
