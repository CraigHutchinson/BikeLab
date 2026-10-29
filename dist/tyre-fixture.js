import {MEASUREMENT,MEASURED_MODEL,validateMeasurement,recordingTicks,createEndpoint,createIntervals} from './tyre-fixture-observation.js';
export {MEASUREMENT,MEASURED_MODEL} from './tyre-fixture-observation.js';
import {wheelParts,terrainParts,canonicalProfile,geometryLimits,validate as validateWheel,getRuntime} from './moving-wheel.js';
import {WHEEL_DEFAULTS,inputFromRecord as trailInput,validate as validateTrail,modelXML as trailXML} from './trail-bike.js';
import {TYRE_WINDOW_MODEL} from './tyre-window.js';
import {NATIVE_BUILD,canonicalModelXML,validateInitialization,stateIdentity,scalarLayout,applyState} from './trail-initial-state.js';
import {createTyreMotion,createTyreMotionFrame,materializeTyreMotion} from './tyre-motion.js';

export const MODEL='bikelab-fixed-hub-casing-0.1';
export const SEED='bikelab-fixed-hub-seed-0.1';
export const SCOPE='World-fixed hub; fresh time, warm start and ledgers. Imported node rates remain hub-local; removing hub motion changes kinetic energy and momentum. This is a diagnostic boundary, not continued whole-bike motion, equilibrium, calibrated tyre damping or failure.';
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');
function object(a,keys,label){
 if(!a||typeof a!=='object'||Array.isArray(a)||![Object.prototype,null].includes(Object.getPrototypeOf(a)))throw Error(label+' must be an object.');
 for(const k of Reflect.ownKeys(a)){const d=Object.getOwnPropertyDescriptor(a,k);if(!keys.includes(k)||!d.enumerable||!Object.hasOwn(d,'value'))throw Error('Unknown or non-data '+label+' field.');}
 if(keys.some(k=>!Object.hasOwn(a,k)))throw Error('Incomplete '+label+'.');
}
function vector(a,n,limit,label){
 if(!Array.isArray(a)||a.length!==n||Reflect.ownKeys(a).length!==n+1)throw Error('Incomplete '+label+'.');
 for(let i=0;i<n;i++){const d=Object.getOwnPropertyDescriptor(a,String(i));if(!d||!Object.hasOwn(d,'value')||!Number.isFinite(d.value)||Math.abs(d.value)>limit)throw Error('Invalid '+label+'.');}
 return [...a];
}
export function validate(input){
 const measured=Object.hasOwn(input??{},'measurement');
 object(input,measured?['seed','motion','rates','measurement']:['seed','motion','rates'],'fixture input');const s=input.seed,m=input.motion;
 object(s,['format','source','wheel','profile','gravity','hub','q','v'],'seed');
 if(s.format!==SEED)throw Error('Unsupported fixed-hub seed.');
 object(s.source,['recordSha256','identity','bike','wheel','tick','time','nativeBuild'],'source');
 if(!/^[a-f0-9]{64}$/.test(s.source.recordSha256)||!/^[a-f0-9]{64}$/.test(s.source.identity)||s.source.nativeBuild!==NATIVE_BUILD||!['full','hardtail'].includes(s.source.bike)||!['front','rear'].includes(s.source.wheel)||!Number.isSafeInteger(s.source.tick)||s.source.tick<0||!Number.isFinite(s.source.time)||s.source.time<0||s.source.time>10.000001)throw Error('Invalid source provenance.');
 object(s.wheel,Object.keys(WHEEL_DEFAULTS),'wheel');object(m,['dt','duration','sampleDt'],'motion');
 if(!Number.isFinite(m.dt)||m.dt<.0000078125||m.dt>.0000625||!Number.isFinite(m.duration)||m.duration<(measured ? .001 : .02)||m.duration>(measured?5:.1)||!Number.isFinite(m.sampleDt)||m.sampleDt<(measured?m.dt:.000125)||m.sampleDt>(measured ? .05 : .005)||m.duration/m.sampleDt>300)throw Error('Unsupported fixture time/recording range.');
 for(const ratio of [m.duration/m.sampleDt,m.sampleDt/m.dt])if(Math.abs(ratio-Math.round(ratio))>1e-7)throw Error('Fixture observations must align to fixed steps.');
 const measurement=measured?validateMeasurement(input.measurement,m):null;
 const w=validateWheel({...s.wheel,dt:m.dt}),profile=canonicalProfile(s.profile);
 if(profile.points.some(p=>p[1]!==profile.points[0][1]))throw Error('Fixed-hub control currently requires flat terrain.');
 if(!Number.isFinite(s.gravity)||s.gravity<0||s.gravity>15)throw Error('Invalid gravity.');
 object(s.hub,['position','quaternion'],'hub');const position=vector(s.hub.position,3,10,'hub position'),quaternion=vector(s.hub.quaternion,4,1,'hub quaternion');
 if(position[1]!==0||quaternion[1]!==0||quaternion[3]!==0||Math.abs(Math.hypot(...quaternion)-1)>1e-12)throw Error('Hub must have a normalized planar orientation.');
 if(!['imported','zero'].includes(input.rates))throw Error('Choose imported or zero node rates.');
 const q=vector(s.q,2*w.nodes,10,'node positions'),v=vector(s.v,2*w.nodes,10,'node velocities');
 return {seed:{format:SEED,source:{...s.source},wheel:{...s.wheel},profile,gravity:s.gravity,hub:{position,quaternion},q,v},motion:{...m},rates:input.rates,...(measured?{measurement}:{})};
}
export function modelXML(input){
 const a=validate(input),s=a.seed,w=validateWheel({...s.wheel,dt:a.motion.dt}),ring=wheelParts(w,'casing'),ground=terrainParts(w,s.profile);
 // Constitutive/rest geometry uses the source bike's canonical construction.
 // Preserve the captured binary64 world transform instead of quantizing it again.
 const physical=canonicalModelXML(`<option timestep="${a.motion.dt}" gravity="0 0 -${s.gravity}" integrator="implicitfast" solver="Newton" iterations="100" tolerance="1e-10" ccd_tolerance="${w.collisionTolerance}" ccd_iterations="${w.collisionIterations}"><flag autoreset="disable"/></option><asset>${ground.assets}</asset><worldbody>${ground.geoms}<body name="hub" pos="HUB_POSITION" quat="HUB_QUATERNION">${ring.nodes}</body></worldbody><deformable>${ring.flex}</deformable>`);
 return '<mujoco model="BikeLab fixed hub casing"><compiler angle="radian" fusestatic="false"/>'+physical.replace('HUB_POSITION',s.hub.position.join(' ')).replace('HUB_QUATERNION',s.hub.quaternion.join(' '))+'</mujoco>';
}
function binding(mj,model,prefix,n){
 const id=(type,name)=>{const v=mj.mj_name2id(model,type,name);if(v<0)throw Error('Missing native fixture member: '+name);return v;};
 const bodyType=mj.mjtObj.mjOBJ_BODY.value,flex=id(mj.mjtObj.mjOBJ_FLEX.value,prefix+'_casing');
 const nodeJoints=Array.from({length:n},(_,i)=>['u','v'].map(axis=>{const j=id(mj.mjtObj.mjOBJ_JOINT.value,prefix+'_'+axis+i);if(model.jnt_type[j]!==mj.mjtJoint.mjJNT_SLIDE.value)throw Error('Non-slide casing node.');return {q:model.jnt_qposadr[j],v:model.jnt_dofadr[j]};}));
 return {flex,edge:model.flex_edgeadr[flex],vertex:3*model.flex_vertadr[flex],nodeJoints,bodies:[id(bodyType,prefix==='casing'?'hub':prefix),...Array.from({length:n},(_,i)=>id(bodyType,prefix+'_n'+i))]};
}
function applyNodes(a,b,data){for(let i=0;i<b.nodeJoints.length;i++)for(let k=0;k<2;k++){const j=b.nodeJoints[i][k];data.qpos[j.q]=a.seed.q[2*i+k];data.qvel[j.v]=a.rates==='zero'?0:a.seed.v[2*i+k];}}

// Source compatibility is checked on the complete bike before extracting local
// coordinates. The fixture never accepts a bike identity as its own state key.
export async function fromWindow(record,wheel='front'){
 if(record?.model!==TYRE_WINDOW_MODEL||!['front','rear'].includes(wheel))throw Error('Select a front/rear wheel from a tyre-window record.');
 const scenario=trailInput(record),a=validateTrail(scenario),start=record.windowObservation?.start,w=a.observationWindow;
 if(!start||start.tick!==w.startTick||!Number.isFinite(start.time)||Math.abs(start.time-start.tick*a.motion.dt)>1e-8||!Number.isSafeInteger(start.frameIndex)||start.frameIndex<0||!Number.isFinite(record.frames?.[start.frameIndex]?.time)||Math.abs(record.frames[start.frameIndex].time-start.time)>1e-8||!Number.isSafeInteger(record.summary?.steps)||record.summary.steps<w.endTick||record.summary.steps>Math.round(a.motion.duration/a.motion.dt))throw Error('A complete accepted observation window is required.');
 if(!record.frames?.[start.frameIndex])throw Error('Missing accepted window frame.');
 if(a.surface.friction!==0||a.profile.points.some(p=>p[1]!==a.profile.points[0][1]))throw Error('This control requires flat frictionless source terrain.');
 if((w.endTick-w.startTick)*a.motion.dt>.1+1e-12||w.strideTicks*a.motion.dt>.005+1e-12)throw Error('Fixed-hub extraction supports windows up to 100 ms with cadence at most 5 ms.');
 const state=validateInitialization({mode:'state',state:start.state}).state,mj=await getRuntime();let model,data,fixtureModel,fixtureData;
 try{
  const xml=trailXML(scenario),identity=await stateIdentity(xml,a);model=mj.MjModel.from_xml_string(xml);data=new mj.MjData(model);applyState(state,identity,scalarLayout(mj,model),data);mj.mj_forward(model,data);
  const b=binding(mj,model,wheel+'wheel',a.wheel.nodes),hub=b.bodies[0],q=[],v=[];
  for(const axes of b.nodeJoints)for(const j of axes){q.push(data.qpos[j.q]);v.push(data.qvel[j.v]);}
  const input=validate({seed:{format:SEED,source:{recordSha256:await hash(JSON.stringify(record)),identity,bike:a.bike.bike,wheel,tick:start.tick,time:start.time,nativeBuild:NATIVE_BUILD},wheel:a.wheel,profile:a.profile,gravity:a.motion.gravity,hub:{position:Array.from(data.xpos.slice(3*hub,3*hub+3)),quaternion:Array.from(data.xquat.slice(4*hub,4*hub+4))},q,v},motion:{dt:a.motion.dt,duration:(w.endTick-w.startTick)*a.motion.dt,sampleDt:w.strideTicks*a.motion.dt},rates:'imported'});
  fixtureModel=mj.MjModel.from_xml_string(modelXML(input));fixtureData=new mj.MjData(fixtureModel);const f=binding(mj,fixtureModel,'casing',a.wheel.nodes);applyNodes(input,f,fixtureData);mj.mj_forward(fixtureModel,fixtureData);
  let geometryError=0,restError=0;
  for(let i=0;i<3*a.wheel.nodes;i++)geometryError=Math.max(geometryError,Math.abs(data.flexvert_xpos[b.vertex+i]-fixtureData.flexvert_xpos[f.vertex+i]));
  for(let i=0;i<a.wheel.nodes;i++){
   restError=Math.max(restError,Math.abs(model.flexedge_length0[b.edge+i]-fixtureModel.flexedge_length0[f.edge+i]));
   if(model.body_mass[b.bodies[i+1]]!==fixtureModel.body_mass[f.bodies[i+1]])throw Error('Fixture node mass mismatch.');
   for(let k=0;k<3;k++)if(model.body_inertia[3*b.bodies[i+1]+k]!==fixtureModel.body_inertia[3*f.bodies[i+1]+k])throw Error('Fixture node inertia mismatch.');
   for(let k=0;k<2;k++){const x=b.nodeJoints[i][k],y=f.nodeJoints[i][k];if(model.jnt_stiffness[model.dof_jntid[x.v]]!==fixtureModel.jnt_stiffness[fixtureModel.dof_jntid[y.v]]||model.qpos_spring[x.q]!==fixtureModel.qpos_spring[y.q]||model.dof_damping[x.v]!==fixtureModel.dof_damping[y.v])throw Error('Fixture spring/damping mismatch.');}
  }
  if(model.flex_edgestiffness[b.flex]!==fixtureModel.flex_edgestiffness[f.flex]||model.flex_edgedamping[b.flex]!==fixtureModel.flex_edgedamping[f.flex])throw Error('Fixture edge law mismatch.');
  if(geometryError>1e-10||restError>1e-10)throw Error('Fixture reconstruction exceeds the 1e-10 m geometry budget.');
  return {input,transfer:{geometryMaxAbsolute:geometryError,restLengthMaxAbsolute:restError,budget:1e-10,compiledMassInertiaSpringDampingMatch:true,scope:SCOPE}};
 }finally{fixtureData?.delete();fixtureModel?.delete();data?.delete();model?.delete();}
}

export async function run(input,onProgress){
 if(onProgress!==undefined&&typeof onProgress!=='function')throw Error('Progress observer must be a function.');
 const a=validate(input),s=a.seed,m=a.motion,w=validateWheel({...s.wheel,dt:m.dt}),steps=Math.round(m.duration/m.dt),stride=Math.round(m.sampleDt/m.dt),progressStride=Math.max(1,Math.ceil(steps/100));
 const progress=(phase,tick=0)=>onProgress?.(phase,tick,steps,m.dt);progress('preparing');
 const xml=modelXML(a),identity=await hash(JSON.stringify({model:MODEL,nativeBuild:NATIVE_BUILD,xml:xml.replace(/timestep="[^"]*"/,'timestep="run-control"'),limits:{maxPenetration:w.maxPenetration,maxStrain:w.maxStrain,maxDisplacement:w.maxDisplacement}})),mj=await getRuntime();let model,data,forceBuffer;
 try{
  progress('initializing');model=mj.MjModel.from_xml_string(xml);data=new mj.MjData(model);forceBuffer=new mj.DoubleBuffer(6);const b=binding(mj,model,'casing',w.nodes);applyNodes(a,b,data);
  if(model.nq!==2*w.nodes||model.nv!==2*w.nodes||model.body_jntnum[b.bodies[0]]!==0)throw Error('Unexpected fixed-hub topology.');
  const diagnostic=createTyreMotion(model,b),hub=new Float64Array([s.hub.position[0],s.hub.position[2]]),xyz=new Float64Array(3*w.nodes),oldXYZ=new Float64Array(xyz.length),oldQ=new Float64Array(model.nq),oldV=new Float64Array(model.nv),oldWarm=new Float64Array(model.nv),ground=new Float64Array(3),clamp=new Float64Array(3),limits={};
  const measured=!!a.measurement,schedule=measured?recordingTicks(m,a.measurement):null,intervals=measured?createIntervals(m.dt,m.duration,a.measurement.binDt):null,endpoint=measured?createEndpoint():null,oldEndpoint=measured?createEndpoint():null;let nextSample=1;
  const slots=Array.from({length:measured?schedule.length+1:Math.round(m.duration/m.sampleDt)+2},()=>({nodes:new Float64Array(2*w.nodes),ground:new Float64Array(3),clamp:new Float64Array(3),tyreMotion:createTyreMotionFrame(),limits:{},contactData:new Float64Array(256*7)}));
  let energy=0,lossPower=0,contactPower=0,forceResidual=0,loss=0,work=0,initialEnergy=0,count=0,accepted=0,termination=null,maxResidual=0,maxForceResidual=0,peakForce=0;
  function observe(){
   mj.mj_forward(model,data);mj.mj_energyPos(model,data);mj.mj_energyVel(model,data);energy=data.energy[0]+data.energy[1];lossPower=0;contactPower=0;forceResidual=0;ground.fill(0);clamp.fill(0);xyz.set(data.flexvert_xpos.subarray(b.vertex,b.vertex+xyz.length));
   if(measured){endpoint.kineticEnergy=data.energy[1];endpoint.meanSquareSpeed=0;endpoint.maxSpeed=0;endpoint.maxSpeedIndex=0;endpoint.maxAcceleration=0;endpoint.maxAccelerationIndex=0;}
   const qv=data.qvel,acc=data.qacc,cf=data.qfrc_constraint,damper=data.qfrc_damper,passive=data.qfrc_passive,R=data.xmat,h=9*b.bodies[0];
   for(let i=0;i<w.nodes;i++){
    const u=b.nodeJoints[i][0].v,v=b.nodeJoints[i][1].v,mass=model.body_mass[b.bodies[i+1]],x=xyz[3*i]-hub[0],z=xyz[3*i+2]-hub[1];
    const fx=R[h]*cf[u]+R[h+2]*cf[v],fz=R[h+6]*cf[u]+R[h+8]*cf[v];ground[0]+=fx;ground[1]+=fz;ground[2]+=z*fx-x*fz;
    const ax=R[h]*acc[u]+R[h+2]*acc[v],az=R[h+6]*acc[u]+R[h+8]*acc[v],cx=mass*ax-fx,cz=mass*(az+s.gravity)-fz;
    clamp[0]+=cx;clamp[1]+=cz;clamp[2]+=z*cx-x*cz;
    forceResidual=Math.max(forceResidual,Math.abs(cx-(R[h]*passive[u]+R[h+2]*passive[v])),Math.abs(cz-(R[h+6]*passive[u]+R[h+8]*passive[v])));
    lossPower-=damper[u]*qv[u]+damper[v]*qv[v];contactPower+=cf[u]*qv[u]+cf[v]*qv[v];
    if(measured){const speed2=qv[u]**2+qv[v]**2,speed=Math.sqrt(speed2),acceleration=Math.hypot(acc[u],acc[v]);endpoint.meanSquareSpeed+=speed2/w.nodes;if(speed>endpoint.maxSpeed){endpoint.maxSpeed=speed;endpoint.maxSpeedIndex=i;}if(acceleration>endpoint.maxAcceleration){endpoint.maxAcceleration=acceleration;endpoint.maxAccelerationIndex=i;}}
   }
   if(measured)endpoint.verticalForce=ground[1];
  }
  function guard(previous=false){
   if(measured&&(!Number.isFinite(endpoint.meanSquareSpeed)||!Number.isFinite(endpoint.maxSpeed)||!Number.isFinite(endpoint.maxAcceleration)))return 'nonfinite-observation';
   if(!Number.isFinite(energy)||!Number.isFinite(lossPower)||!Number.isFinite(contactPower)||!Number.isFinite(forceResidual)||!ground.every(Number.isFinite)||!clamp.every(Number.isFinite))return 'nonfinite-state';
   const q=data.qpos,v=data.qvel,acc=data.qacc;for(let i=0;i<model.nv;i++)if(!Number.isFinite(q[i])||!Number.isFinite(v[i])||!Number.isFinite(acc[i]))return 'nonfinite-state';
   if(data.solver_niter[0]>=100)return 'native-solver-iteration-limit';if(data.ncon>256)return 'contact-capacity-limit';
   geometryLimits(w,s.profile,hub,xyz,previous?oldXYZ:undefined,limits);if(limits.reason)return limits.reason;
   let strain=0,deformation=0;for(let i=0;i<w.nodes;i++){strain=Math.max(strain,Math.abs(data.flexedge_length[b.edge+i]/model.flexedge_length0[b.edge+i]-1));deformation=Math.max(deformation,Math.hypot(q[b.nodeJoints[i][0].q],q[b.nodeJoints[i][1].q]));}limits.strain=strain;limits.deformation=deformation;
   if(strain>w.maxStrain)return 'casing-strain-limit';if(deformation>w.maxDisplacement)return 'casing-displacement-limit';return null;
  }
  function record(){
   const f=slots[count++];f.time=data.time;f.energy=energy;f.kineticEnergy=data.energy[1];f.dampingLoss=loss;f.contactWork=work;f.contactPower=contactPower;f.residual=energy-initialEnergy+loss-work;f.fixtureWork=0;f.forceResidual=forceResidual;f.ground.set(ground);f.clamp.set(clamp);f.nodalGroundMoment=ground[2];Object.assign(f.limits,limits);diagnostic.record(data,f.tyreMotion);f.tyreMotion.normalPower=contactPower;
   for(let i=0;i<w.nodes;i++){f.nodes[2*i]=xyz[3*i];f.nodes[2*i+1]=xyz[3*i+2];}
   const list=data.contact;let contacts=0,contactMoment=0;try{for(let i=0;i<list.size();i++){const c=list.get(i);try{
    const side=c.flex[0]===b.flex?0:c.flex[1]===b.flex?1:-1;if(side<0||c.flex[1-side]>=0||c.dim!==1)throw Error('Unsupported fixture contact.');
    mj.mj_contactForce(model,data,i,forceBuffer);const force=forceBuffer.GetView()[0],sign=side?1:-1;contactMoment+=(c.pos[2]-hub[1])*sign*c.frame[0]*force-(c.pos[0]-hub[0])*sign*c.frame[2]*force;
    if(force<=1e-8)continue;const k=7*contacts++;f.contactData[k]=c.pos[0];f.contactData[k+1]=c.pos[2];f.contactData[k+2]=sign*c.frame[0]*force;f.contactData[k+3]=sign*c.frame[2]*force;f.contactData[k+4]=force;f.contactData[k+5]=c.elem[side];f.contactData[k+6]=c.vert[side];
   }finally{c.delete();}}}finally{list.delete();}f.contactCount=contacts;f.tyreMotion.contactCount=contacts;
   // Flex contact distribution can give a different moment from contact-point
   // forces. Retain that discrepancy; the clamp moment below is inferred from
   // total angular balance, not a directly measured native bearing torque.
   f.contactMomentDifference=f.nodalGroundMoment-contactMoment;f.ground[2]=contactMoment;f.clamp[2]+=f.contactMomentDifference;
  }
  const report={model:measured?MEASURED_MODEL:MODEL,identity,nativeBuild:NATIVE_BUILD,scenario:a,scope:SCOPE,units:'SI; world x forward, y left, z up. ground/clamp [Fx,Fz,My] act on casing about fixed hub. Clamp is inferred from balance; its moment includes the separately reported nodal/contact-point moment discrepancy, not a measured bearing torque. Node rates are hub-local.',dynamicMass:Array.from({length:w.nodes},(_,i)=>model.body_mass[b.bodies[i+1]]).reduce((x,y)=>x+y,0)};
  observe();initialEnergy=energy;const initialIssue=guard();if(initialIssue){progress('finalizing');return {...report,status:'initial-state-rejected',termination:{reason:initialIssue,time:0},summary:{steps:0,acceptedTime:0},frames:[],...(measured?{observation:{format:MEASUREMENT,intervals:[],windowFrameIndices:[]}}:{})};}
  peakForce=Math.hypot(ground[0],ground[1]);maxForceResidual=forceResidual;record();progress('integrating');
  for(let tick=1;tick<=steps;tick++){
   oldQ.set(data.qpos);oldV.set(data.qvel);oldWarm.set(data.qacc_warmstart);oldXYZ.set(xyz);const time=data.time,oldLoss=lossPower,oldPower=contactPower,oldEnergy=energy,previousLoss=loss,previousWork=work;if(measured)Object.assign(oldEndpoint,endpoint);
   mj.mj_step(model,data);observe();const reason=guard(true)||(Math.abs(data.time-time-m.dt)>1e-9?'native-clock-reset':null);
   if(reason){termination={reason,time,attemptedTime:time+m.dt};data.qpos.set(oldQ);data.qvel.set(oldV);data.qacc_warmstart.set(oldWarm);data.time=time;observe();guard();break;}
   loss+=.5*m.dt*(oldLoss+lossPower);work+=.5*m.dt*(oldPower+contactPower);accepted=tick;maxResidual=Math.max(maxResidual,Math.abs(energy-initialEnergy+loss-work));maxForceResidual=Math.max(maxForceResidual,forceResidual);peakForce=Math.max(peakForce,Math.hypot(ground[0],ground[1]));
   if(measured)intervals.accept(tick,oldEndpoint,endpoint,oldEnergy,previousLoss,previousWork,energy,loss,work);
   if(measured?tick===schedule[nextSample]:tick%stride===0){record();if(measured)nextSample++;}if(tick%progressStride===0)progress('integrating',tick);
  }
  if(slots[count-1].time!==data.time)record();progress('finalizing',accepted);
  const finalNodes={q:[],v:[]};for(const axes of b.nodeJoints)for(const j of axes){finalNodes.q.push(data.qpos[j.q]);finalNodes.v.push(data.qvel[j.v]);}
  return {...report,status:termination?'terminated':'completed',termination,finalNodes,summary:{steps:accepted,acceptedTime:data.time,initialEnergy,finalEnergy:energy,maxResidual,maxForceResidual,peakForce},...(measured?{observation:{format:MEASUREMENT,scope:'Trapezoidal statistics at every accepted physics endpoint; maxima are discrete endpoint observations, not continuous peaks or settling certification.',intervals:intervals.result(),windowFrameIndices:slots.slice(0,count).flatMap((f,i)=>{const tick=Math.round(f.time/m.dt),window=a.measurement.window;return window&&tick>=window.startTick&&tick<=window.endTick&&(tick-window.startTick)%window.strideTicks===0?[i]:[];})}}:{}),frames:slots.slice(0,count).map(f=>{const {contactData,contactCount,nodes,ground,clamp,tyreMotion,...rest}=f;return {...rest,ground:Array.from(ground),clamp:Array.from(clamp),nodes:Array.from({length:w.nodes},(_,i)=>[nodes[2*i],nodes[2*i+1]]),tyreMotion:materializeTyreMotion(tyreMotion),contacts:Array.from({length:contactCount},(_,i)=>{const k=7*i;return {point:[contactData[k],contactData[k+1]],force:[contactData[k+2],contactData[k+3]],normalForce:contactData[k+4],edge:contactData[k+5],vertex:contactData[k+6]};})};})};
 }finally{forceBuffer?.delete();data?.delete();model?.delete();}
}
export function inputFromRecord(record){if(![MODEL,MEASURED_MODEL].includes(record?.model))throw Error('Unsupported fixed-hub record.');const input=validate(record.scenario);if((record.model===MEASURED_MODEL)!==!!input.measurement)throw Error('Fixture measurement discriminator mismatch.');return input;}
export const replay=record=>run(inputFromRecord(record));
