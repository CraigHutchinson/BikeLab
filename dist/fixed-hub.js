// A diagnostic boundary: the hub has no DOFs; only the casing evolves.
import {validate as validateTrail,modelXML as trailXML,inputFromRecord as trailInput} from './trail-bike.js';
import {getRuntime,wheelParts,terrainParts,geometryLimits,validate as validateWheel} from './moving-wheel.js';
import {applyState,scalarLayout,stateIdentity,canonicalModelXML,NATIVE_BUILD} from './trail-initial-state.js';
import {createTyreMotion,createTyreMotionFrame,materializeTyreMotion} from './tyre-motion.js';
import {assessAssembly} from './wheel-limits.js';
export const MODEL='bikelab-fixed-hub-0.1';
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
function fields(o,keys,label){if(!o||typeof o!=='object'||Array.isArray(o)||![Object.prototype,null].includes(Object.getPrototypeOf(o))||Object.keys(o).some(k=>!keys.includes(k)))throw Error('Invalid '+label+' fields.');}
export function validate(input){
 fields(input,['format','source','wheel','velocityMode','motion'],'fixed-hub input');
 if(input.format!==MODEL||!['front','rear'].includes(input.wheel)||!['imported','zero'].includes(input.velocityMode))throw Error('Unsupported fixed-hub identity, wheel or velocity control.');
 const source=structuredClone(input.source),a=validateTrail(source);
 if(a.initialization?.mode!=='state')throw Error('Fixed hub requires a complete compatible source state.');
 if(a.profile.points.some(p=>p[1]!==a.profile.points[0][1]))throw Error('Fixed-hub diagnostic currently requires flat ground.');
 if(assessAssembly(a.assembly,a.wheelParams.rimRadius).status==='incompatible')throw Error('Incompatible source assembly.');
 fields(input.motion,['duration','dt','sampleDt'],'motion');const m={...input.motion};
 if(!Number.isFinite(m.duration)||m.duration<.02||m.duration>.1||!Number.isFinite(m.dt)||m.dt<.0000078125||m.dt>.00003125||!Number.isFinite(m.sampleDt)||m.sampleDt<.000125||m.sampleDt>.005||m.duration/m.sampleDt>300)throw Error('Unsupported fixed-hub observation bounds.');
 for(const ratio of [m.duration/m.sampleDt,m.sampleDt/m.dt])if(Math.abs(ratio-Math.round(ratio))>1e-7)throw Error('Fixed-hub observations must align to integration ticks.');
 validateWheel({...a.wheel,dt:m.dt});
 return {format:MODEL,source,wheel:input.wheel,velocityMode:input.velocityMode,motion:m};
}
export function fromTrailRecord(record,wheel='front',velocityMode='imported'){
 const source=trailInput(record);if(!record.finalState||!record.frames?.length)throw Error('No accepted source state.');
 source.initialization={mode:'state',state:structuredClone(record.finalState)};
 source.motion={gravity:source.motion.gravity,duration:.02,dt:source.motion.dt,sampleDt:.000125};
 source.commands=[{...record.frames.at(-1).command,tick:0}];delete source.observationWindow;
 return validate({format:MODEL,source,wheel,velocityMode,motion:{duration:.02,dt:source.motion.dt,sampleDt:.000125}});
}
// Check complete source identity/topology before extraction. No integration.
export async function prepare(input){
 const config=validate(input),a=validateTrail(config.source),mj=await getRuntime(),xml=trailXML(config.source);
 const sourceIdentity=await stateIdentity(xml,a);let model,data;
 try{
  model=mj.MjModel.from_xml_string(xml);data=new mj.MjData(model);
  applyState(a.initialization.state,sourceIdentity,scalarLayout(mj,model),data);mj.mj_forward(model,data);
  const prefix=config.wheel+'wheel',body=mj.mj_name2id(model,mj.mjtObj.mjOBJ_BODY.value,prefix);
  const position=Array.from(data.xpos.subarray(3*body,3*body+3)),quaternion=Array.from(data.xquat.subarray(4*body,4*body+4));
  const p={...a.wheelParams,dt:config.motion.dt,gravity:a.motion.gravity};
  const parts=wheelParts(p,prefix,a.surface.friction),ground=terrainParts(p,a.profile,a.surface.friction);
  // Match canonical source coefficients, retaining its native binary64 transform.
  const shell=canonicalModelXML('<mujoco model="BikeLab fixed hub"><compiler angle="radian" fusestatic="false"/><option timestep="'+p.dt+'" gravity="0 0 -'+p.gravity+'" integrator="implicitfast" '+(a.surface.friction?'cone="elliptic" ':'')+'solver="Newton" iterations="100" tolerance="1e-10" ccd_tolerance="'+p.collisionTolerance+'" ccd_iterations="'+p.collisionIterations+'"><flag autoreset="disable"/></option><asset>'+ground.assets+'</asset><worldbody>'+ground.geoms+'<body name="hub" pos="HUB_POSITION" quat="HUB_QUATERNION">'+parts.nodes+'</body></worldbody><deformable>'+parts.flex+'</deformable></mujoco>');
  const fixtureXML=shell.replace('HUB_POSITION',position.join(' ')).replace('HUB_QUATERNION',quaternion.join(' '));
  const joints=a.initialization.state.joints.filter(j=>j.name.startsWith(prefix+'_')).map(j=>({...j,velocity:config.velocityMode==='zero'?0:j.velocity}));
  if(joints.length!==2*p.nodes)throw Error('Incomplete source wheel topology.');
  const sourceNodes=Array.from({length:p.nodes},(_,i)=>{const b=mj.mj_name2id(model,mj.mjtObj.mjOBJ_BODY.value,prefix+'_n'+i);return [data.xpos[3*b],data.xpos[3*b+2]];});
  return {config,p,profile:a.profile,prefix,position,quaternion,joints,sourceNodes,xml:fixtureXML,identity:await hash(MODEL+NATIVE_BUILD+fixtureXML),sourceIdentity};
 }finally{data?.delete();model?.delete();}
}
export async function run(input,onProgress){
 if(onProgress!==undefined&&typeof onProgress!=='function')throw Error('Invalid progress observer.');
 onProgress?.('preparing',0,0);const setup=await prepare(input),{config,p,profile,prefix}=setup,m=config.motion;
 const mj=await getRuntime(),steps=Math.round(m.duration/m.dt),stride=Math.round(m.sampleDt/m.dt);let model,data,forceBuffer;
 try{
  model=mj.MjModel.from_xml_string(setup.xml);data=new mj.MjData(model);forceBuffer=new mj.DoubleBuffer(6);
  const layout=scalarLayout(mj,model),byName=new Map(setup.joints.map(j=>[j.name,j]));
  if(layout.length!==setup.joints.length)throw Error('Unexpected fixed-hub topology.');
  for(const j of layout){const s=byName.get(j.name);if(!s||s.type!==j.type)throw Error('Invalid fixed-hub joint map.');data.qpos[j.q]=s.position;data.qvel[j.v]=s.velocity;}
  const id=(kind,name)=>mj.mj_name2id(model,kind.value,name),joint=name=>layout.find(j=>j.name===name);
  const wheel={flex:0,edge:0,bodies:[id(mj.mjtObj.mjOBJ_BODY,'hub'),...Array.from({length:p.nodes},(_,i)=>id(mj.mjtObj.mjOBJ_BODY,prefix+'_n'+i))],nodeJoints:Array.from({length:p.nodes},(_,i)=>[joint(prefix+'_u'+i),joint(prefix+'_v'+i)])};
  const observer=createTyreMotion(model,wheel),hub=[setup.position[0],setup.position[2]],hubBody=wheel.bodies[0];
  const slots=Array.from({length:Math.round(m.duration/m.sampleDt)+2},()=>({nodes:new Float64Array(2*p.nodes),motion:createTyreMotionFrame(),ground:new Float64Array(3),fixture:new Float64Array(3),balance:new Float64Array(3),contacts:new Float64Array(256*6),contactWrench:new Float64Array(3),limits:{}}));
  const oldQ=new Float64Array(model.nq),oldV=new Float64Array(model.nv),oldWarm=new Float64Array(model.nv),oldXYZ=new Float64Array(3*p.nodes),limitScratch={};
  const ground=new Float64Array(3),reaction=new Float64Array(3),balance=new Float64Array(3);
  let energy=0,lossPower=0,contactPower=0,loss=0,contactWork=0,initialEnergy=0,count=0,termination=null,maxResidual=0,maxBalance=0;
  function observe(){
   mj.mj_forward(model,data);mj.mj_energyPos(model,data);mj.mj_energyVel(model,data);energy=data.energy[0]+data.energy[1];lossPower=0;contactPower=0;ground.fill(0);reaction.fill(0);balance.fill(0);
   const q=data.qpos,v=data.qvel,acc=data.qacc,force=data.qfrc_constraint,damper=data.qfrc_damper,R=data.xmat.subarray(9*hubBody,9*hubBody+9),pos=data.xpos;
   for(let i=0;i<model.nv;i++){lossPower-=damper[i]*v[i];contactPower+=force[i]*v[i];}
   for(let i=0;i<p.nodes;i++){
    const u=wheel.nodeJoints[i][0],z=wheel.nodeJoints[i][1],b=wheel.bodies[i+1],mass=model.body_mass[b],x=pos[3*b]-hub[0],h=pos[3*b+2]-hub[1];
    const fu=-model.jnt_stiffness[model.dof_jntid[u.v]]*(q[u.q]-model.qpos_spring[u.q]),fz=-model.jnt_stiffness[model.dof_jntid[z.v]]*(q[z.q]-model.qpos_spring[z.q]);
    const gx=R[0]*force[u.v]+R[2]*force[z.v],gz=R[6]*force[u.v]+R[8]*force[z.v],rx=R[0]*fu+R[2]*fz,rz=R[6]*fu+R[8]*fz;
    ground[0]+=gx;ground[1]+=gz;ground[2]+=h*gx-x*gz;
    reaction[0]+=rx;reaction[1]+=rz;reaction[2]+=h*rx-x*rz;
    const ax=mass*(R[0]*acc[u.v]+R[2]*acc[z.v]),az=mass*(R[6]*acc[u.v]+R[8]*acc[z.v])+mass*p.gravity;
    balance[0]+=ax-gx-rx;balance[1]+=az-gz-rz;balance[2]+=h*(ax-gx-rx)-x*(az-gz-rz);
   }
  }
  function guard(previous){
   if(!Number.isFinite(energy)||!Number.isFinite(lossPower)||!Number.isFinite(contactPower)||!ground.every(Number.isFinite)||!reaction.every(Number.isFinite)||!balance.every(Number.isFinite))return 'nonfinite-state';
   for(let i=0;i<model.nv;i++)if(!Number.isFinite(data.qpos[i])||!Number.isFinite(data.qvel[i])||!Number.isFinite(data.qacc[i])||Math.abs(data.qvel[i])>10)return 'state-rate-limit';
   if(data.solver_niter[0]>=100)return 'native-solver-iteration-limit';if(data.ncon>256)return 'contact-capacity-limit';
   geometryLimits(p,profile,hub,data.flexvert_xpos,previous,limitScratch);if(limitScratch.reason)return limitScratch.reason;
   let strain=0,deformation=0;for(let i=0;i<p.nodes;i++){const u=wheel.nodeJoints[i][0],z=wheel.nodeJoints[i][1];strain=Math.max(strain,Math.abs(data.flexedge_length[i]/model.flexedge_length0[i]-1));deformation=Math.max(deformation,Math.hypot(data.qpos[u.q],data.qpos[z.q]));}
   limitScratch.strain=strain;limitScratch.deformation=deformation;
   return strain>p.maxStrain?'casing-strain-limit':deformation>p.maxDisplacement?'casing-displacement-limit':null;
  }
  function record(){
   const f=slots[count++];f.time=data.time;f.energy=energy;f.dampingLoss=loss;f.contactWork=contactWork;f.fixtureWork=0;f.residual=energy-initialEnergy+loss-contactWork;f.ground.set(ground);f.fixture.set(reaction);f.balance.set(balance);Object.assign(f.limits,limitScratch);observer.record(data,f.motion);
   for(let i=0;i<p.nodes;i++){f.nodes[2*i]=data.flexvert_xpos[3*i];f.nodes[2*i+1]=data.flexvert_xpos[3*i+2];}
   let n=0;const list=data.contact;f.contactWrench.fill(0);
   try{for(let i=0;i<list.size();i++){const c=list.get(i);try{
    const side=c.flex[0]===0?0:1;if(c.flex[side]!==0||c.flex[1-side]>=0)throw Error('Unsupported fixture contact.');
    mj.mj_contactForce(model,data,i,forceBuffer);const local=forceBuffer.GetView();if(!local.every(Number.isFinite))throw Error('Nonfinite contact force.');if(local[0]<=1e-8)continue;
    const k=6*n++,sign=side?1:-1;f.contacts[k]=c.pos[0];f.contacts[k+1]=c.pos[2];let fx=0,fz=0;
    for(let j=0;j<3;j++){fx+=sign*c.frame[3*j]*local[j];fz+=sign*c.frame[3*j+2]*local[j];}
    f.contactWrench[0]+=fx;f.contactWrench[1]+=fz;f.contactWrench[2]+=(c.pos[2]-hub[1])*fx-(c.pos[0]-hub[0])*fz;f.motion.contactCount++;f.motion.normalPower+=local[0]*data.efc_vel[c.efc_address];if(c.dim===3)f.motion.tangentPower+=local[1]*data.efc_vel[c.efc_address+1]+local[2]*data.efc_vel[c.efc_address+2];f.contacts[k+2]=fx;f.contacts[k+3]=fz;f.contacts[k+4]=c.elem[side];f.contacts[k+5]=c.vert[side];
   }finally{c.delete();}}}finally{list.delete();}f.contactCount=n;f.contactMomentDifference=f.ground[2]-f.contactWrench[2];
  }
  observe();initialEnergy=energy;const issue=guard();
  if(issue)throw Error('Fixed-hub initial state rejected: '+issue);
  let geometryError=0;for(let i=0;i<p.nodes;i++)geometryError=Math.max(geometryError,Math.hypot(data.flexvert_xpos[3*i]-setup.sourceNodes[i][0],data.flexvert_xpos[3*i+2]-setup.sourceNodes[i][1]));
  if(geometryError>1e-10)throw Error('Source wheel geometry did not transfer.');record();
  const progressStride=Math.max(1,Math.ceil(steps/100));
  for(let step=1;step<=steps;step++){
   oldQ.set(data.qpos);oldV.set(data.qvel);oldWarm.set(data.qacc_warmstart);oldXYZ.set(data.flexvert_xpos);const time=data.time,oldLoss=lossPower,oldContact=contactPower;
   mj.mj_step(model,data);observe();const reason=guard(oldXYZ)||(Math.abs(data.time-time-m.dt)>1e-9?'native-clock-reset':null);
   if(reason){termination={reason,time,attemptedTime:time+m.dt};data.qpos.set(oldQ);data.qvel.set(oldV);data.qacc_warmstart.set(oldWarm);data.time=time;observe();guard();break;}
   loss+=.5*m.dt*(oldLoss+lossPower);contactWork+=.5*m.dt*(oldContact+contactPower);maxResidual=Math.max(maxResidual,Math.abs(energy-initialEnergy+loss-contactWork));for(let k=0;k<3;k++)maxBalance=Math.max(maxBalance,Math.abs(balance[k]));
   if(step%stride===0)record();if(step%progressStride===0)onProgress?.('integrating',step,steps);
  }
  if(slots[count-1].time!==data.time)record();onProgress?.('finalizing',Math.round(data.time/m.dt),steps);
  return {model:MODEL,engine:'MuJoCo 3.16.0',input:config,identity:setup.identity,sourceIdentity:setup.sourceIdentity,hub,quaternion:setup.quaternion,
   scope:'Stationary hub; casing only. Imported rates are hub-local, not preserved world velocities. Fixture force acts on casing; +y moment about hub. Ground moment uses native nodal forces; contactWrench uses displayed contact points, and their difference is reported separately. Fixed fixture work is zero. Fresh warm start; no equilibrium, calibration or damping change.',
   status:termination?'terminated':'completed',termination,summary:{steps:Math.round(data.time/m.dt),initialEnergy,maxResidual,maxBalance,geometryError},
   finalState:layout.map(j=>({name:j.name,position:data.qpos[j.q],velocity:data.qvel[j.v]})),
   frames:slots.slice(0,count).map(f=>({...f,nodes:Array.from({length:p.nodes},(_,i)=>[f.nodes[2*i],f.nodes[2*i+1]]),motion:materializeTyreMotion(f.motion),contactWrench:Array.from(f.contactWrench),ground:Array.from(f.ground),fixture:Array.from(f.fixture),balance:Array.from(f.balance),contacts:Array.from({length:f.contactCount},(_,i)=>({point:Array.from(f.contacts.subarray(6*i,6*i+2)),force:Array.from(f.contacts.subarray(6*i+2,6*i+4)),edge:f.contacts[6*i+4],vertex:f.contacts[6*i+5]}))}))};
 }finally{forceBuffer?.delete();data?.delete();model?.delete();}
}
export function inputFromRecord(r){if(r?.model!==MODEL)throw Error('Unsupported fixed-hub record.');return validate(r.input);}
export const replay=r=>run(inputFromRecord(r));

