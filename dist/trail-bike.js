import {STATE_MODEL,RUN_MOTION,validateInitialization,canonicalModelXML,stateIdentity,scalarLayout,applyState,captureState,scalarStateIssue} from './trail-initial-state.js';
import {DEFAULTS as RIG_DEFAULTS,validate as validateRig} from './bike-rig.js';
import {bikeAssembly} from './bike-assembly.js';
import {geometryFor,shockLength,shockCompressionJacobian} from './linkage.js';
import {wheelParts,terrainParts,canonicalProfile,geometryLimits,validate as validateWheel,getRuntime} from './moving-wheel.js';
import {fixture} from './terrain.js';
import {trailSectionProfile} from './trail-section.js';
import {travelBuffer} from './travel-buffer.js';
import {validateAssembly,assessAssembly,ASSEMBLY_DEFAULTS,sweepRim} from './wheel-limits.js';
import {interfaceWrench} from './rig-loads.js';
import {validateCommands} from './drive-controls.js';
import {passiveRiderParts} from './rider-native.js';
import {validateConnectedRider,createConnectedRider,createRiderFrame,materializeRiderFrame} from './rider-connected.js';
export const MODEL='bikelab-trail-bike-0.4';
export const ARTICULATED_MODEL='bikelab-trail-bike-articulated-0.1';
export const SURFACE_DEFAULTS=Object.freeze({friction:0});
const CONTACT_STRIDE=12;
const LEGACY_MODEL='bikelab-trail-bike-0.1';
const omit=new Set(['tyreStiffness','tyreDamping','amplitude','bumpDuration','delay','input','duration','dt','sampleDt']);
export const BIKE_DEFAULTS=Object.freeze({...Object.fromEntries(Object.entries(RIG_DEFAULTS).filter(([k])=>!omit.has(k))),rider:'compliant',forkBuffer:'progressive',shockBuffer:'progressive',riderBuffer:'progressive'});
export const ARTICULATED_BIKE_DEFAULTS=Object.freeze({...Object.fromEntries(Object.entries(BIKE_DEFAULTS).filter(([k])=>k!=='mass'&&!k.startsWith('rider'))),rider:'articulated'});
export const WHEEL_DEFAULTS=Object.freeze({nodes:64,tyreMass:1,hubMass:1.5,hubInertia:.04,skin:.008,rimRadius:.29,foundation:300000,extension:500,edgeViscosity:.5,contactTime:.0005,contactImpedance:.99,collisionTolerance:1e-10,collisionIterations:100,maxPenetration:.0005,maxStrain:.25,maxDisplacement:.06});
export const MOTION_DEFAULTS=Object.freeze({centerX:-.5,clearance:.012,velocityX:2,velocityZ:0,omega:5,pitchOffset:0,pitchVelocity:0,forkCompression:.04,rearAngle:.08,riderOffset:-.05,gravity:9.80665,duration:1,dt:.00003125,sampleDt:.005});
const ranges={centerX:[-2,2],clearance:[0,.5],velocityX:[-3,3],velocityZ:[-3,3],omega:[-10,10],pitchOffset:[-.2,.2],pitchVelocity:[-1,1],forkCompression:[0,.16],rearAngle:[0,.4],riderOffset:[-.25,.25],gravity:[0,15],duration:[.02,1.5],dt:[.0000078125,.0000625],sampleDt:[.000125,.02]};
function fields(value,defaults,label){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error(label+' must be an object.');
 for(const k of Object.keys(value))if(!Object.hasOwn(defaults,k))throw Error('Unknown '+label+' field: '+k);
 return {...defaults,...value};
}
function requireFields(value,canonical){
 for(const key of Object.keys(canonical)){
  if(!value||!Object.hasOwn(value,key))throw Error('Incomplete articulated record configuration.');
  if(canonical[key]&&typeof canonical[key]==='object')requireFields(value[key],canonical[key]);
 }
}
export function smoothProfile(kind='bump',segments=32){
 if(!['flat','bump'].includes(kind)||![16,32,64].includes(segments))throw Error('Unsupported smooth trail fixture.');
 const p=fixture('flat');p.points=[[-3,0]];
 if(kind==='bump')for(let i=0;i<=segments;i++){const t=i/segments;p.points.push([.6+.8*t,.015*16*t*t*(1-t)*(1-t)]);}
 p.points.push([5,0]);p.source.description=kind==='flat'?'Synthetic flat rigid trail.':'Synthetic 15 mm polynomial bump over 0.8 m, '+segments+' straight segments.';return p;
}
export function impactProfile(kind='square'){
 if(!['square','faceted','edge-limit'].includes(kind))throw Error('Unknown impact profile.');
 const profile=fixture('flat');
 profile.points=kind==='faceted'?[[-3,0],[.6,0],[.68,.045],[.85,.06],[1,.015],[1.08,0],[5,0]]:[[-3,0],[.6,0],[.6,kind==='edge-limit'?.2:.04],[.9,kind==='edge-limit'?.2:.04],[.9,0],[5,0]];
 profile.source.description=kind==='faceted'?'Synthetic coarse faceted 60 mm rock; authored corners are not smoothed.':kind==='square'?'Synthetic 40 mm square-edged rock, 300 mm long.':'Synthetic 200 mm square obstacle for support-limit inspection.';return profile;
}
export function profileSupport(profile){
 let verticalFaces=0,maxSlope=0,maxTurn=0,previousSlope=0;
 for(let i=1;i<profile.points.length;i++){const a=profile.points[i-1],b=profile.points[i],dx=b[0]-a[0],dz=b[1]-a[1],s=dz/dx;if(dx===0)verticalFaces++;else maxSlope=Math.max(maxSlope,Math.abs(s));maxTurn=Math.max(maxTurn,Math.abs(Math.atan(s)-Math.atan(previousSlope)));previousSlope=s;}
 return {geometry:'authored-faceted-polyline',regime:verticalFaces||maxSlope>.25||maxTurn>.08?'experimental-sharp-impact':'smooth-reference',segments:profile.points.length-1,verticalFaces,maxFiniteSlope:maxSlope,maxTangentChange:maxTurn,temporalCollision:'Discrete native contact with motion and near-rim sweep guards; not complete swept-casing CCD.',accuracy:'Uncalibrated; sharp-corner loads remain sensitive to casing mesh. No fracture or pressure-loss prediction.'};
}
export function validate(input={}){
 fields(input,{bike:0,wheel:0,motion:0,profile:0,assembly:0,surface:0,commands:0,articulated:0,initialization:0},'scenario');
 const surface=fields(input.surface??{},SURFACE_DEFAULTS,'surface'),mu=surface.friction;
 if(!Number.isFinite(mu)||mu<0||mu>2||(mu>0&&mu<1e-4))throw Error('Friction must be zero or within [0.0001, 2].');
 const hasRider=input.bike?.rider==='articulated',initialization=Object.hasOwn(input,'initialization')?validateInitialization(input.initialization):null;
 if(initialization&&!hasRider)throw Error('Explicit initialization requires articulated rider mode.');
 if(!hasRider&&Object.hasOwn(input,'articulated'))throw Error('Articulated configuration requires articulated rider mode.');
 const bike=fields(input.bike??{},hasRider?ARTICULATED_BIKE_DEFAULTS:BIKE_DEFAULTS,'bike'),wheel=fields(input.wheel??{},WHEEL_DEFAULTS,'wheel'),motion=fields(input.motion??{},initialization?.mode==='state'?RUN_MOTION:hasRider?{...MOTION_DEFAULTS,riderOffset:0}:MOTION_DEFAULTS,'motion');validateRig(hasRider?{...bike,rider:'fixed'}:bike);
 const articulated=hasRider?validateConnectedRider(Object.hasOwn(input,'articulated')?input.articulated:{}):null;
 if(hasRider&&initialization?.mode!=='state'&&motion.riderOffset!==0)throw Error('Articulated launch requires zero legacy riderOffset.');
 for(const k of Object.keys(motion)){const [lo,hi]=ranges[k];if(!Number.isFinite(motion[k])||motion[k]<lo||motion[k]>hi)throw Error(k+' outside supported SI range.');}
 if(motion.duration/motion.sampleDt>300)throw Error('At most 300 recording intervals.');
 for(const x of [motion.duration/motion.sampleDt,motion.sampleDt/motion.dt])if(Math.abs(x-Math.round(x))>1e-7)throw Error('Observation and duration must align to fixed steps.');
 const wp=validateWheel({...wheel,dt:motion.dt}),profile=canonicalProfile(input.profile??smoothProfile()),assembly=validateAssembly(input.assembly??{});
 const commands=validateCommands(input.commands,Math.round(motion.duration/motion.dt));
 return {commands,surface:Object.freeze(surface),bike:Object.freeze(bike),wheel:Object.freeze(wheel),motion:Object.freeze(motion),profile,assembly,wheelParams:wp,...(hasRider?{articulated}:{}),...(initialization?{initialization}:{})};
}
export function articulatedPreset(bike='full',kind='standing'){
 if(!['standing','flight'].includes(kind))throw Error('Unknown articulated experiment.');
 const a=preset(kind==='flight'?'flight':'flat',bike);
 a.bike={...ARTICULATED_BIKE_DEFAULTS,bike,...(kind==='flight'?{forkBuffer:'none',shockBuffer:'none'}:{})};
 a.motion={...a.motion,riderOffset:0,duration:.1,...(kind==='standing'?{velocityX:0,omega:0,clearance:0}:{})};
 a.articulated=validateConnectedRider();return a;
}
export function preset(name='bump',bike='full'){
 if(!['flat','bump','trail','flight','limit','square','faceted','edge-limit','coast','sliding','drive','brake'].includes(name))throw Error('Unknown connected bike preset.');
 const a={bike:{bike},profile:['square','faceted','edge-limit'].includes(name)?impactProfile(name):smoothProfile(name==='bump'?'bump':'flat')};
 if(name==='trail'){a.profile=trailSectionProfile();a.motion={velocityX:2.5,omega:2.5/.36,clearance:0,duration:1.5};}
 if(name==='flight'){a.bike={bike,rider:'compliant',forkBuffer:'none',shockBuffer:'none',riderBuffer:'none'};a.motion={clearance:.3,gravity:0,forkCompression:0,rearAngle:0,riderOffset:0,velocityX:1,velocityZ:.3,omega:0,duration:.2};}
 if(name==='coast'||name==='sliding'){a.surface={friction:.6};a.motion={velocityX:1.5,omega:name==='coast'?1.5/.36:0,duration:.3};}
 if(name==='drive'||name==='brake'){a.surface={friction:.6};a.motion={velocityX:1.5,omega:1.5/.36,duration:.3};a.commands=[{tick:0,rearDrive:0,frontBrake:0,rearBrake:0},{tick:1600,rearDrive:name==='drive'?20:0,frontBrake:name==='brake'?55:0,rearBrake:name==='brake'?35:0},{tick:6400,rearDrive:0,frontBrake:0,rearBrake:0}];}
 if(name==='limit')a.motion={clearance:.1,velocityZ:-3,duration:.3};return a;
}
export function modelXML(input={}){
 const a=validate(input),p=a.bike,g=geometryFor(p),w=a.wheelParams,front=wheelParts(w,'frontwheel',a.surface.friction),rear=wheelParts(w,'rearwheel',a.surface.friction),ground=terrainParts(w,a.profile,a.surface.friction);
 const hub=(name,pos,parts)=>`<body name="${name}" pos="${pos}"><joint name="${name}Spin" type="hinge" axis="0 1 0"/><inertial pos="0 0 0" mass="${w.hubMass}" diaginertia="${w.hubInertia} ${w.hubInertia} ${w.hubInertia}"/>${parts.nodes}</body>`;
 const rider=a.articulated?{chassis:a.articulated.chassis,parts:passiveRiderParts(a.articulated.passive,a.articulated.closureTime)}:null;
 const tree=bikeAssembly(p,{frontMass:.5,rearMass:1.5,frontInertia:.01,rearInertia:.02,front:hub('frontwheel','0 0 0',front),rear:hub('rearwheel',p.bike==='full'?`${g.armX} 0 ${g.armZ}`:'0 0 0',rear)},rider);
 const xml=`<mujoco model="BikeLab connected bike"><compiler angle="radian" fusestatic="false"/><option timestep="${a.motion.dt}" gravity="0 0 -${a.motion.gravity}" integrator="implicitfast" ${a.surface.friction?'cone="elliptic" ':''}solver="Newton" iterations="100" tolerance="1e-10" ccd_tolerance="${w.collisionTolerance}" ccd_iterations="${w.collisionIterations}"><flag autoreset="disable"/></option><asset>${ground.assets}</asset><worldbody>${ground.geoms}${tree.body}</worldbody>${tree.tendon}${rider?`<equality>${rider.parts.equality}</equality>`:''}<deformable>${front.flex}${rear.flex}</deformable></mujoco>`;
 return a.initialization?canonicalModelXML(xml):xml;
}
function joint(mj,model,name){const id=mj.mj_name2id(model,mj.mjtObj.mjOBJ_JOINT.value,name);return id<0?null:{q:model.jnt_qposadr[id],v:model.jnt_dofadr[id]};}
function translateWrench(w,from,to,out){out[0]=w[0];out[1]=w[1];out[2]=w[2]+(from[1]-to[1])*w[0]-(from[0]-to[0])*w[1];return out;}
// Distance to a fixed contour is 1-Lipschitz. A straight hub step shorter than
// its initial rim clearance cannot hit it. This does not bound curved paths.
export function rimSweep(profile,start,delta,initialGap,rimRadius,tyreRadius){
 if(initialGap>Math.hypot(...delta)+1e-8)return null;
 return sweepRim(profile,Array.from(start),Array.from(delta),rimRadius,tyreRadius);
}
// Complete wheel subtrees are the smallest supported load-observation boundary.
// Native RNE omits flex contacts; node-level interface loads are not reported.
export async function run(input={}){
 const a=validate(input),p=a.bike,w=a.wheelParams,m=a.motion,g=geometryFor(p);
 const assessment=assessAssembly(a.assembly,w.rimRadius),scenario={bike:p,wheel:a.wheel,motion:m,profile:a.profile,assembly:a.assembly,surface:a.surface,commands:a.commands,...(a.articulated?{articulated:a.articulated}:{}),...(a.initialization?{initialization:a.initialization}:{})};
 const report={model:a.initialization?STATE_MODEL:a.articulated?ARTICULATED_MODEL:MODEL,engine:'MuJoCo 3.16.0',units:'SI; x forward, y left, z up; moments about +y. Ground and bearing wrenches at their wheel hub; momentum and impulse about world origin.',parameterProvenance:'Mass, inertia, stiffness, damping and launch are illustrative; no physical calibration. Assembly evidence retains its own provenance.',scenario,assessment,contactSupport:profileSupport(a.profile),scope:'Illustrative planar bike and guided rider; deformable rings and homogeneous Coulomb interface friction on rigid faceted ground. Abstract hub drive and dry-friction brakes; no calibrated grip/inflation, drivetrain/thermal model, frame collision, layered soil or anatomical rider.',surfaceProvenance:'Friction is an illustrative homogeneous tyre-ground interface coefficient; no named material calibration. Zero retains exact frictionless contact.'};
 if(a.articulated){report.scope='Illustrative planar bike with five-group passive unseated rider; fixed frame-local retained hand/foot attachments. Initial pose is not an equilibrium. No saddle contact, active control, anatomical calibration, strength, layered terrain or 3D dynamics.';report.riderSupport={mode:'passive-unseated',saddle:'not-modelled',coordinates:'Four joint displacements/velocities in hip, knee, shoulder, elbow order. Passive load stride: torque, spring energy, positive damping power, spring torque, damping torque. Native coordinates/velocities order: riderX, riderZ, riderPitch, hip, knee, shoulder, elbow. Segment points and rider COM use world xyz; segment velocity is angular xyz then linear xyz at its COM in world axes.',closure:'Soft hand/foot pair work and angular impulse are numerical internal contributions, distinct from external terrain loads; no counterforce.'};}
 if(assessment.status==='incompatible')return {...report,status:'assembly-rejected',termination:{reason:'assembly-service-limit',time:0},frames:[]};
 const mj=await getRuntime();let model,data,diagnostic,velocityBuffer,forceBuffer,connectedRider,diagnosticRider;
 try{
  const xml=modelXML(scenario),identity=a.initialization?await stateIdentity(xml,a):null;
  model=mj.MjModel.from_xml_string(xml);const layout=a.initialization?scalarLayout(mj,model):null;data=new mj.MjData(model);diagnostic=new mj.MjData(model);velocityBuffer=new mj.DoubleBuffer(6);forceBuffer=new mj.DoubleBuffer(6);
  if(a.articulated){connectedRider=createConnectedRider(mj,model,data,a.articulated);diagnosticRider=createConnectedRider(mj,model,diagnostic,a.articulated);}
  const bodyType=mj.mjtObj.mjOBJ_BODY.value,id=(type,name)=>mj.mj_name2id(model,type,name),body=name=>id(bodyType,name),j=Object.fromEntries(['travel','heave','pitch','fork','swing','riderSlide'].map(name=>[name,joint(mj,model,name)]));
  const frameBody=body('frame'),frontBody=body('front'),rearBody=body('rear'),riderBody=a.articulated?body('rider_trunk'):p.rider==='compliant'?body('rider'):frameBody,armSite=id(mj.mjtObj.mjOBJ_SITE.value,'shockArm'),frameSite=id(mj.mjtObj.mjOBJ_SITE.value,'shockFrame');
  const wheels=['frontwheel','rearwheel'].map(name=>{
   const flex=id(mj.mjtObj.mjOBJ_FLEX.value,name+'_casing'),hubBody=body(name);
   return {name,flex,body:hubBody,spin:joint(mj,model,name+'Spin'),vertex:3*model.flex_vertadr[flex],edge:model.flex_edgeadr[flex],nodeJoints:Array.from({length:w.nodes},(_,i)=>[joint(mj,model,name+'_u'+i),joint(mj,model,name+'_v'+i)]),bodies:[hubBody,...Array.from({length:w.nodes},(_,i)=>body(name+'_n'+i))],hub:new Float64Array(2),oldHub:[0,0],move:[0,0],oldRimGap:0,xyz:new Float64Array(3*w.nodes),oldXYZ:new Float64Array(3*w.nodes),ground:new Float64Array(3),brakeTorque:0,driveTorque:0,brakeCapacity:0,limits:{}};
  });
  if(a.initialization?.mode==='state')applyState(a.initialization.state,identity,layout,data);else{
  const rearAngle=j.swing?m.rearAngle:0,rearX=j.swing?g.pivotX+Math.cos(rearAngle)*g.armX+Math.sin(rearAngle)*g.armZ:g.rearX,rearZ=j.swing?g.pivotZ-Math.sin(rearAngle)*g.armX+Math.cos(rearAngle)*g.armZ:g.axleZ;
  const frontX=g.frontX-m.forkCompression*Math.cos(g.headAngle),frontZ=g.axleZ+m.forkCompression*Math.sin(g.headAngle),pitch=Math.atan2(frontZ-rearZ,frontX-rearX)+m.pitchOffset;
  data.qpos[j.travel.q]=m.centerX;data.qpos[j.heave.q]=g.radius+m.clearance+Math.sin(pitch)*rearX-Math.cos(pitch)*rearZ-g.frameHeight;data.qpos[j.pitch.q]=pitch;data.qpos[j.fork.q]=m.forkCompression;
  if(j.swing)data.qpos[j.swing.q]=rearAngle;if(j.riderSlide)data.qpos[j.riderSlide.q]=m.riderOffset;
  data.qvel[j.travel.v]=m.velocityX;data.qvel[j.heave.v]=m.velocityZ;data.qvel[j.pitch.v]=m.pitchVelocity;for(const wheel of wheels)data.qvel[wheel.spin.v]=m.omega;
  }
  const vector=()=>new Float64Array(3),steps=Math.round(m.duration/m.dt),stride=Math.round(m.sampleDt/m.dt);
  const slots=Array.from({length:Math.round(m.duration/m.sampleDt)+a.commands.length+2},()=>({frame:vector(),rider:new Float64Array(2),wheels:wheels.map(()=>({hub:vector(),nodes:new Float64Array(2*w.nodes),ground:vector(),bearing:vector(),carrier:vector(),momentum:vector(),centerOfMass:new Float64Array(2),limits:{}})),command:{tick:0,rearDrive:0,frontBrake:0,rearBrake:0},contactData:new Float64Array(512*CONTACT_STRIDE),momentum:vector(),momentumResidual:vector(),impulse:vector(),root:vector(),forkLoad:vector(),pivot:vector(),guide:vector(),...(a.articulated?{articulated:createRiderFrame()}:{})}));
  const oldQ=new Float64Array(model.nq),oldV=new Float64Array(model.nv),oldWarm=new Float64Array(model.nv),buffers=Array.from({length:3},()=>new Float64Array(5)),ground=vector(),impulse=vector(),initialMomentum=vector(),origin=new Float64Array(3),scratch=vector(),at=new Float64Array(2),allBodies=Array.from({length:model.nbody-1},(_,i)=>i+1);
  const oldActive=a.articulated?new Uint8Array(model.neq):null;
  let closureWork=0,closureAngularImpulse=0,closurePower=0,closureMoment=0,maxClosureGap=0;
  const mass=allBodies.reduce((sum,b)=>sum+model.body_mass[b],0),massBudget={total:mass,frameAndRider:a.articulated?a.articulated.chassis.mass+a.articulated.passive.posture.riderMass:p.mass,...(a.articulated?{chassis:a.articulated.chassis.mass,rider:a.articulated.passive.posture.riderMass}:{}),frontCarrier:.5,rearCarrier:1.5,eachHub:w.hubMass,eachTyre:w.tyreMass,eachWheelRigidSpinInertia:wheelParts(w).reference.rigidSpinInertia};
  let commandIndex=0,driveWork=0,drivePower=0,brakeWork=0,brakePower=0;
  function applyCommand(index){commandIndex=index;const c=a.commands[index];wheels[0].driveTorque=0;wheels[1].driveTorque=c.rearDrive;wheels[0].brakeCapacity=c.frontBrake;wheels[1].brakeCapacity=c.rearBrake;for(const wheel of wheels)model.dof_frictionloss[wheel.spin.v]=wheel.brakeCapacity;}
  applyCommand(0);
  let energy=0,lossPower=0,constraintPower=0,normalPower=0,tangentPower=0,gravityMoment=0,loss=0,constraintWork=0,normalWork=0,tangentWork=0,maxPowerResidual=0,powerResidual=0,gravityImpulse=0,initialEnergy=0,count=0,termination=null,peakForce=0,peakPenetration=0,maxResidual=0,maxRoot=0,maxBearingMoment=0,maxDiagnosticDifference=0,maxLateralContactForce=0,maxConeExcess=0;
  function observe(){
   mj.mj_fwdPosition(model,data);mj.mj_fwdVelocity(model,data);data.qfrc_applied.fill(0);for(const b of buffers)b.fill(0);
   if(p.forkBuffer==='progressive')travelBuffer(data.qpos[j.fork.q],data.qvel[j.fork.v],g.forkTravel,p.forkBufferWidth,p.forkBufferStiffness,p.forkBufferDamping,buffers[0]);data.qfrc_applied[j.fork.v]=buffers[0][0];
   if(j.swing){if(p.shockBuffer==='progressive')travelBuffer(shockLength(0,g)-data.ten_length[0],-data.ten_velocity[0],g.shockTravel,p.shockBufferWidth,p.shockBufferStiffness,p.shockBufferDamping,buffers[1]);data.qfrc_applied[j.swing.v]=buffers[1][0]*shockCompressionJacobian(data.qpos[j.swing.q],g);}
   if(j.riderSlide){if(p.riderBuffer==='progressive')travelBuffer(data.qpos[j.riderSlide.q]+p.riderTravel,data.qvel[j.riderSlide.v],2*p.riderTravel,p.riderBufferWidth,p.riderBufferStiffness,p.riderBufferDamping,buffers[2]);data.qfrc_applied[j.riderSlide.v]=buffers[2][0];}
   for(const wheel of wheels)data.qfrc_applied[wheel.spin.v]=wheel.driveTorque;
   mj.mj_forward(model,data);mj.mj_energyPos(model,data);mj.mj_energyVel(model,data);energy=data.energy[0]+data.energy[1];lossPower=0;constraintPower=0;
   for(const b of buffers){energy+=b[1];lossPower+=b[2];}for(let i=0;i<model.nv;i++){lossPower-=data.qfrc_damper[i]*data.qvel[i];constraintPower+=data.qfrc_constraint[i]*data.qvel[i];}
   closurePower=0;closureMoment=0;if(connectedRider&&!connectedRider.observe()){closurePower=connectedRider.interfaces.rowPower;closureMoment=connectedRider.interfaces.pairMoment[1];}
   normalPower=0;tangentPower=0;brakePower=0;drivePower=0;for(const wheel of wheels){wheel.brakeTorque=0;drivePower+=wheel.driveTorque*data.qvel[wheel.spin.v];}
   const types=data.efc_type,forces=data.efc_force,velocities=data.efc_vel,kind=mj.mjtConstraint;
   for(let i=0;i<data.nefc;){if(a.articulated&&types[i]===kind.mjCNSTR_EQUALITY.value){i++;}else if(types[i]===kind.mjCNSTR_CONTACT_FRICTIONLESS.value){normalPower+=forces[i]*velocities[i];i++;}else if(types[i]===kind.mjCNSTR_CONTACT_ELLIPTIC.value){normalPower+=forces[i]*velocities[i];tangentPower+=forces[i+1]*velocities[i+1]+forces[i+2]*velocities[i+2];i+=3;}else if(types[i]===kind.mjCNSTR_FRICTION_DOF.value){const dof=data.efc_id[i],wheel=dof===wheels[0].spin.v?wheels[0]:dof===wheels[1].spin.v?wheels[1]:null;if(!wheel)throw Error('Unsupported brake DOF.');wheel.brakeTorque+=forces[i];brakePower+=forces[i]*velocities[i];i++;}else throw Error('Unsupported connected-bike constraint in work ledger.');}
   powerResidual=Math.abs(constraintPower-normalPower-tangentPower-brakePower-closurePower);
   ground[0]=data.qfrc_constraint[j.travel.v];ground[1]=data.qfrc_constraint[j.heave.v];ground[2]=data.qfrc_constraint[j.pitch.v]+data.xpos[3*frameBody+2]*ground[0]-data.xpos[3*frameBody]*ground[1];gravityMoment=mass*m.gravity*data.subtree_com[3*frameBody];
   for(const wheel of wheels){const b=3*wheel.body,r=9*wheel.body;wheel.hub[0]=data.xpos[b];wheel.hub[1]=data.xpos[b+2];wheel.xyz.set(data.flexvert_xpos.subarray(wheel.vertex,wheel.vertex+3*w.nodes));let u=0,v=0;
    for(const joints of wheel.nodeJoints){u+=data.qfrc_constraint[joints[0].v];v+=data.qfrc_constraint[joints[1].v];}wheel.ground[0]=data.xmat[r]*u+data.xmat[r+2]*v;wheel.ground[1]=data.xmat[r+6]*u+data.xmat[r+8]*v;wheel.ground[2]=data.qfrc_constraint[wheel.spin.v]-wheel.brakeTorque;
   }
   if(a.articulated){ground.fill(0);for(const wheel of wheels){ground[0]+=wheel.ground[0];ground[1]+=wheel.ground[1];ground[2]+=wheel.ground[2]+wheel.hub[1]*wheel.ground[0]-wheel.hub[0]*wheel.ground[1];}}
  }
  function guard(previous=false){
   // A stopped check must not expose another wheel's stale accepted diagnostics.
   for(const wheel of wheels){const d=wheel.limits;d.reason='not-evaluated';d.rimGap=null;d.penetration=null;d.inner=null;d.movement=null;d.strain=null;d.deformation=null;}
   if(connectedRider?.issue)return connectedRider.issue;
   if(!Number.isFinite(energy)||!Number.isFinite(lossPower)||!Number.isFinite(constraintPower)||!Number.isFinite(gravityMoment)||!Number.isFinite(normalPower)||!Number.isFinite(tangentPower)||!Number.isFinite(powerResidual)||!Number.isFinite(brakePower)||!Number.isFinite(drivePower)||!ground.every(Number.isFinite))return 'nonfinite-state';
   for(let i=0;i<model.nv;i++)if(!Number.isFinite(data.qpos[i])||!Number.isFinite(data.qvel[i])||!Number.isFinite(data.qacc[i]))return 'nonfinite-state';
   if(data.solver_niter[0]>=100)return 'native-solver-iteration-limit';if(data.ncon>512)return 'contact-capacity-limit';
   if(Math.abs(data.qpos[j.pitch.q])>.35)return 'frame-pitch-limit';if(data.qpos[j.fork.q]<-1e-9||data.qpos[j.fork.q]>g.forkTravel)return 'fork-travel-limit';
   if(j.swing&&(data.qpos[j.swing.q]<-1e-9||data.qpos[j.swing.q]>g.rearAngleMax||shockLength(0,g)-data.ten_length[0]>g.shockTravel))return 'shock-travel-limit';
   if(j.riderSlide&&Math.abs(data.qpos[j.riderSlide.q])>p.riderTravel)return 'rider-travel-limit';
   if(Math.hypot(wheels[0].hub[0]-wheels[1].hub[0],wheels[0].hub[1]-wheels[1].hub[1])<2*(w.radius+w.maxDisplacement))return 'wheel-separation-limit';
   for(const wheel of wheels){const limits=geometryLimits(w,a.profile,wheel.hub,wheel.xyz,previous?wheel.oldXYZ:undefined,wheel.limits);wheel.limits=limits;if(limits.reason)return wheel.name+'-'+limits.reason;
    let strain=0,deformation=0;for(let i=0;i<w.nodes;i++){strain=Math.max(strain,Math.abs(data.flexedge_length[wheel.edge+i]/model.flexedge_length0[wheel.edge+i]-1));deformation=Math.max(deformation,Math.hypot(data.qpos[wheel.nodeJoints[i][0].q],data.qpos[wheel.nodeJoints[i][1].q]));}limits.strain=strain;limits.deformation=deformation;
    if(strain>w.maxStrain){limits.reason='casing-strain-limit';return wheel.name+'-'+limits.reason;}if(deformation>w.maxDisplacement){limits.reason='casing-displacement-limit';return wheel.name+'-'+limits.reason;}
    if(previous&&Math.abs(data.qpos[wheel.spin.q]-oldQ[wheel.spin.q])>.01)return wheel.name+'-spin-resolution-limit';
    if(previous){wheel.move[0]=wheel.hub[0]-wheel.oldHub[0];wheel.move[1]=wheel.hub[1]-wheel.oldHub[1];const swept=rimSweep(a.profile,wheel.oldHub,wheel.move,wheel.oldRimGap,w.rimRadius,w.radius);if(swept&&swept.status!=='clear')return wheel.name+'-swept-'+swept.status;}
   }
   return layout?scalarStateIssue(layout,data):null;
  }
  function momentum(bodies,out){out.fill(0);for(const b of bodies){mj.mj_objectVelocity(model,data,bodyType,b,velocityBuffer,0);const v=velocityBuffer.GetView(),mass=model.body_mass[b],x=data.xipos[3*b],z=data.xipos[3*b+2];out[0]+=mass*v[3];out[1]+=mass*v[5];out[2]+=model.body_inertia[3*b+1]*v[1]+mass*(z*v[3]-x*v[5]);}}
  function corrected(bodyId,selected,out){origin[0]=diagnostic.xpos[3*bodyId];origin[1]=0;origin[2]=diagnostic.xpos[3*bodyId+2];at[0]=origin[0];at[1]=origin[2];interfaceWrench(model,diagnostic,bodyId,origin,out);
   for(const wheel of selected){translateWrench(wheel.ground,wheel.hub,at,scratch);for(let k=0;k<3;k++)out[k]-=scratch[k];}
  }
  const frontOnly=[wheels[0]],rearOnly=[wheels[1]],none=[];
  function record(){
   const f=slots[count];momentum(allBodies,f.momentum);if(!count)initialMomentum.set(f.momentum);
   if(connectedRider){connectedRider.record(f.articulated);f.articulated.closureWork=closureWork;f.articulated.closureAngularImpulse=closureAngularImpulse;}
   f.time=data.time;f.frame[0]=data.xpos[3*frameBody];f.frame[1]=data.xpos[3*frameBody+2];f.frame[2]=data.qpos[j.pitch.q];f.rider[0]=data.xipos[3*riderBody];f.rider[1]=data.xipos[3*riderBody+2];if(a.articulated){f.rider[0]=f.articulated.centerOfMass[0];f.rider[1]=f.articulated.centerOfMass[2];}f.fork=data.qpos[j.fork.q];f.rearAngle=j.swing?data.qpos[j.swing.q]:0;f.shock=j.swing?shockLength(0,g)-data.ten_length[0]:0;f.riderOffset=j.riderSlide?data.qpos[j.riderSlide.q]:0;
   Object.assign(f.command,a.commands[commandIndex]);f.driveWork=driveWork;f.drivePower=drivePower;f.brakeWork=brakeWork;f.brakePower=brakePower;
   f.forkBuffer=buffers[0][0];f.shockBuffer=buffers[1][0];f.riderBuffer=buffers[2][0];f.energy=energy;f.dampingLoss=loss;f.constraintWork=constraintWork;f.normalWork=normalWork;f.tangentWork=tangentWork;f.normalPower=normalPower;f.tangentPower=tangentPower;f.constraintPower=constraintPower;f.residual=energy-initialEnergy+loss-constraintWork-driveWork;f.impulse.set(impulse);f.momentumResidual[0]=f.momentum[0]-initialMomentum[0]-impulse[0];f.momentumResidual[1]=f.momentum[1]-initialMomentum[1]-impulse[1]+mass*m.gravity*data.time;f.momentumResidual[2]=f.momentum[2]-initialMomentum[2]-impulse[2]-gravityImpulse;
   if(a.articulated){f.articulated.momentumResidualAfterClosure.set(f.momentumResidual);f.articulated.momentumResidualAfterClosure[2]-=closureAngularImpulse;diagnostic.eq_active.set(data.eq_active);}
   diagnostic.qpos.set(data.qpos);diagnostic.qvel.set(data.qvel);diagnostic.qacc_warmstart.set(data.qacc_warmstart);diagnostic.qfrc_applied.set(data.qfrc_applied);diagnostic.time=data.time;mj.mj_forward(model,diagnostic);mj.mj_rnePostConstraint(model,diagnostic);
   if(diagnosticRider){const issue=diagnosticRider.observe();if(issue)throw Error('Diagnostic rider diverged: '+issue);for(let i=0;i<2;i++)for(let k=0;k<3;k++)maxDiagnosticDifference=Math.max(maxDiagnosticDifference,Math.abs(diagnosticRider.interfaces.attachments[i].forceOnRider[k]-connectedRider.interfaces.attachments[i].forceOnRider[k]));}
   for(let i=0;i<model.nv;i++)maxDiagnosticDifference=Math.max(maxDiagnosticDifference,Math.abs(data.qacc[i]-diagnostic.qacc[i]),Math.abs(data.qfrc_constraint[i]-diagnostic.qfrc_constraint[i]));
   corrected(frameBody,wheels,f.root);corrected(frontBody,frontOnly,f.forkLoad);corrected(rearBody,rearOnly,f.pivot);if(!a.articulated)corrected(riderBody,p.rider==='compliant'?none:wheels,f.guide);
   if(j.swing){const arm=3*armSite,eye=3*frameSite,dx=diagnostic.site_xpos[arm]-diagnostic.site_xpos[eye],dz=diagnostic.site_xpos[arm+2]-diagnostic.site_xpos[eye+2],length=Math.hypot(dx,dz),fx=-buffers[1][0]*dx/length,fz=-buffers[1][0]*dz/length;f.pivot[0]-=fx;f.pivot[1]-=fz;f.pivot[2]-=(diagnostic.site_xpos[arm+2]-diagnostic.xpos[3*rearBody+2])*fx-(diagnostic.site_xpos[arm]-diagnostic.xpos[3*rearBody])*fz;}
   for(let k=0;k<2;k++){const wheel=wheels[k],v=f.wheels[k];v.hub[0]=wheel.hub[0];v.hub[1]=wheel.hub[1];v.hub[2]=Math.atan2(data.xmat[9*wheel.body+2],data.xmat[9*wheel.body]);v.ground.set(wheel.ground);corrected(wheel.body,k?rearOnly:frontOnly,v.carrier);v.bearing.set(v.carrier);v.bearing[2]-=wheel.driveTorque+wheel.brakeTorque;v.driveTorque=wheel.driveTorque;v.brakeCapacity=wheel.brakeCapacity;v.brakeTorque=wheel.brakeTorque;v.spinAngle=data.qpos[wheel.spin.q];v.spinVelocity=data.qvel[wheel.spin.v];momentum(wheel.bodies,v.momentum);v.centerOfMass[0]=data.subtree_com[3*wheel.body];v.centerOfMass[1]=data.subtree_com[3*wheel.body+2];Object.assign(v.limits,wheel.limits);for(let i=0;i<w.nodes;i++){v.nodes[2*i]=wheel.xyz[3*i];v.nodes[2*i+1]=wheel.xyz[3*i+2];}maxBearingMoment=Math.max(maxBearingMoment,Math.abs(v.bearing[2]));}
   for(const value of f.root)maxRoot=Math.max(maxRoot,Math.abs(value));
   const list=data.contact;let contacts=0;
   try{for(let i=0;i<list.size();i++){const c=list.get(i);try{const side=c.flex[0]>=0?0:1,k=wheels.findIndex(wheel=>wheel.flex===c.flex[side]);if(k<0||c.flex[1-side]>=0)throw Error('Unsupported contact pair.');mj.mj_contactForce(model,data,i,forceBuffer);const localForce=forceBuffer.GetView(),force=localForce[0];if(force<=1e-8)continue;maxConeExcess=Math.max(maxConeExcess,Math.hypot(localForce[1],localForce[2])-a.surface.friction*force);const sign=side?1:-1,b=CONTACT_STRIDE*contacts++;f.contactData[b]=k;f.contactData[b+1]=c.pos[0];f.contactData[b+2]=c.pos[2];f.contactData[b+3]=sign*c.frame[0];f.contactData[b+4]=sign*c.frame[2];f.contactData[b+5]=force;f.contactData[b+6]=c.elem[side];f.contactData[b+7]=c.vert[side];
    let fx=0,fy=0,fz=0,vx=0,vz=0;for(let axis=0;axis<3;axis++){fx+=sign*c.frame[3*axis]*localForce[axis];fy+=sign*c.frame[3*axis+1]*localForce[axis];fz+=sign*c.frame[3*axis+2]*localForce[axis];if(c.dim===3){vx+=sign*c.frame[3*axis]*data.efc_vel[c.efc_address+axis];vz+=sign*c.frame[3*axis+2]*data.efc_vel[c.efc_address+axis];}}
    maxLateralContactForce=Math.max(maxLateralContactForce,Math.abs(fy));f.contactData[b+8]=fx;f.contactData[b+9]=fz;f.contactData[b+10]=c.dim===3?vx*sign*c.frame[2]-vz*sign*c.frame[0]:NaN;f.contactData[b+11]=c.dim===3?data.efc_vel[c.efc_address]:NaN;}finally{c.delete();}}}finally{list.delete();}f.contactCount=contacts;count++;
  }
  observe();initialEnergy=energy;const initialReason=guard();if(initialReason)return {...report,massBudget,status:'initial-state-rejected',termination:{reason:initialReason,time:0},frames:[]};if(a.initialization){report.initialState=captureState(identity,layout,data);report.initialization={mode:a.initialization.mode,time:0,warmStart:'fresh-zero',claim:'Supplied or authored state; not a solved equilibrium.'};}
  maxPowerResidual=powerResidual;peakForce=Math.hypot(ground[0],ground[1]);for(const wheel of wheels)peakPenetration=Math.max(peakPenetration,wheel.limits.penetration);record();
  for(let step=1;step<=steps;step++){
   if(oldActive)oldActive.set(data.eq_active);
   oldQ.set(data.qpos);oldV.set(data.qvel);oldWarm.set(data.qacc_warmstart);for(const wheel of wheels){wheel.oldXYZ.set(wheel.xyz);wheel.oldHub[0]=wheel.hub[0];wheel.oldHub[1]=wheel.hub[1];wheel.oldRimGap=wheel.limits.rimGap;}
   const time=data.time,oldCommand=commandIndex,oldLoss=lossPower,oldConstraint=constraintPower,oldNormal=normalPower,oldTangent=tangentPower,oldBrake=brakePower,oldX=ground[0],oldZ=ground[1],oldY=ground[2],oldGravity=gravityMoment,oldClosurePower=closurePower,oldClosureMoment=closureMoment;
   mj.mj_step(model,data);observe();let reason=guard(true)||(Math.abs(data.time-time-m.dt)>1e-9?'native-clock-reset':null);
   // Keep the old command at the interval endpoint; never quadrature across a command jump.
   const endLoss=lossPower,endConstraint=constraintPower,endNormal=normalPower,endTangent=tangentPower,endBrake=brakePower,endX=ground[0],endZ=ground[1],endY=ground[2],endGravity=gravityMoment,endPowerResidual=powerResidual,endClosurePower=closurePower,endClosureMoment=closureMoment;
   const changed=a.commands[commandIndex+1]?.tick===step;
   if(!reason&&changed){applyCommand(commandIndex+1);observe();reason=guard(true);}
   if(reason){termination={reason,time,attemptedTime:time+m.dt,attemptedCommandTick:a.commands[commandIndex].tick,attemptedLimits:wheels.map(wheel=>({...wheel.limits}))};data.qpos.set(oldQ);data.qvel.set(oldV);data.qacc_warmstart.set(oldWarm);data.time=time;if(oldActive)data.eq_active.set(oldActive);applyCommand(oldCommand);observe();guard();break;}
   if(a.articulated){closureWork+=.5*m.dt*(oldClosurePower+endClosurePower);closureAngularImpulse+=.5*m.dt*(oldClosureMoment+endClosureMoment);for(const c of connectedRider.interfaces.attachments)maxClosureGap=Math.max(maxClosureGap,Math.hypot(...c.gap));}
   driveWork+=a.commands[oldCommand].rearDrive*(data.qpos[wheels[1].spin.q]-oldQ[wheels[1].spin.q]);
   loss+=.5*m.dt*(oldLoss+endLoss);constraintWork+=.5*m.dt*(oldConstraint+endConstraint);normalWork+=.5*m.dt*(oldNormal+endNormal);tangentWork+=.5*m.dt*(oldTangent+endTangent);brakeWork+=.5*m.dt*(oldBrake+endBrake);
   impulse[0]+=.5*m.dt*(oldX+endX);impulse[1]+=.5*m.dt*(oldZ+endZ);impulse[2]+=.5*m.dt*(oldY+endY);gravityImpulse+=.5*m.dt*(oldGravity+endGravity);
   maxPowerResidual=Math.max(maxPowerResidual,endPowerResidual,powerResidual);peakForce=Math.max(peakForce,Math.hypot(endX,endZ),Math.hypot(ground[0],ground[1]));for(const wheel of wheels)peakPenetration=Math.max(peakPenetration,wheel.limits.penetration);maxResidual=Math.max(maxResidual,Math.abs(energy-initialEnergy+loss-constraintWork-driveWork));if(step%stride===0||changed)record();
  }
  if(Math.abs(slots[count-1].time-data.time)>1e-10)record();
  const array=Array.from;
  return {...report,...(a.initialization?{finalState:captureState(identity,layout,data)}:{}),massBudget,status:termination?'terminated':'completed',termination,summary:{acceptedTime:data.time,steps:Math.round(data.time/m.dt),peakForce,peakPenetration,maxResidual,maxSampledRootWrench:maxRoot,maxSampledBearingMoment:maxBearingMoment,maxDiagnosticDifference,maxPowerResidual,maxSampledLateralContactForce:maxLateralContactForce,maxSampledConeExcess:maxConeExcess,initialEnergy,finalEnergy:energy,initialMomentum:array(initialMomentum),...(a.articulated?{maxClosureGap,closureWork,closureAngularImpulse}:{})},frames:slots.slice(0,count).map(f=>{
   const {contactData,contactCount,...rest}=f;return {...rest,...(a.articulated?{articulated:materializeRiderFrame(f.articulated)}:{}),...Object.fromEntries(['frame','rider','momentum','momentumResidual','impulse','root','forkLoad','pivot','guide'].map(key=>[key,array(f[key])])),...(a.articulated?{guide:null}:{}),wheels:f.wheels.map(v=>({...v,hub:array(v.hub),ground:array(v.ground),bearing:array(v.bearing),carrier:array(v.carrier),momentum:array(v.momentum),centerOfMass:array(v.centerOfMass),nodes:Array.from({length:w.nodes},(_,i)=>[v.nodes[2*i],v.nodes[2*i+1]])})),contacts:Array.from({length:contactCount},(_,i)=>{const k=CONTACT_STRIDE*i,nx=contactData[k+3],nz=contactData[k+4],force=contactData[k+5];return {wheel:contactData[k],point:[contactData[k+1],contactData[k+2]],normal:[nx,nz],force:[contactData[k+8],contactData[k+9]],normalForce:force,tangentForce:contactData[k+8]*nz-contactData[k+9]*nx,slip:Number.isFinite(contactData[k+10])?contactData[k+10]:null,normalVelocity:Number.isFinite(contactData[k+11])?contactData[k+11]:null,edge:contactData[k+6],vertex:contactData[k+7]};})};})};
 }finally{diagnosticRider?.delete();connectedRider?.delete();forceBuffer?.delete();velocityBuffer?.delete();diagnostic?.delete();data?.delete();model?.delete();}
}
export function inputFromRecord(r){
 if(r?.model===STATE_MODEL){if(!r.scenario?.initialization||!r.scenario.articulated)throw Error('Incomplete explicit-state record.');const a=validate(r.scenario);const {wheelParams,...scenario}=a;requireFields(r.scenario,scenario);return scenario;}
 if(r?.scenario?.initialization)throw Error('Legacy record cannot contain explicit initialization.');
 if(![ARTICULATED_MODEL,MODEL,LEGACY_MODEL,'bikelab-trail-bike-0.2','bikelab-trail-bike-0.3'].includes(r?.model)||!r.scenario)throw Error('Unsupported connected-bike record.');
 for(const [key,defaults] of Object.entries({bike:r.model===ARTICULATED_MODEL?ARTICULATED_BIKE_DEFAULTS:BIKE_DEFAULTS,wheel:WHEEL_DEFAULTS,motion:MOTION_DEFAULTS,assembly:ASSEMBLY_DEFAULTS}))if(!r.scenario[key]||Object.keys(defaults).some(k=>!Object.hasOwn(r.scenario[key],k)))throw Error('Incomplete connected-bike record.');
 if(!r.scenario.profile)throw Error('Missing terrain profile.');
 if([ARTICULATED_MODEL,MODEL,'bikelab-trail-bike-0.3'].includes(r.model)&&(!r.scenario.surface||!Object.hasOwn(r.scenario.surface,'friction')))throw Error('Incomplete connected-bike surface.');
 if([LEGACY_MODEL,'bikelab-trail-bike-0.2'].includes(r.model)&&r.scenario.surface?.friction)throw Error('Legacy trail records are frictionless.');
 if([ARTICULATED_MODEL,MODEL].includes(r.model)&&!Array.isArray(r.scenario.commands))throw Error('Incomplete connected-bike commands.');
 if(![ARTICULATED_MODEL,MODEL].includes(r.model)&&Object.hasOwn(r.scenario,'commands'))throw Error('Legacy records do not contain drive/brake commands.');
 if(r.model===ARTICULATED_MODEL){const c=r.scenario.articulated;if(r.scenario.bike.rider!=='articulated'||!c||['format','chassis','passive','closureTime','maxClosureGap'].some(k=>!Object.hasOwn(c,k))||['mass','com','inertia'].some(k=>!Object.hasOwn(c.chassis??{},k)))throw Error('Incomplete articulated record.');}
 else if(r.scenario.bike.rider==='articulated'||Object.hasOwn(r.scenario,'articulated'))throw Error('Legacy record cannot contain an articulated rider.');
 const a=validate(r.scenario);if(r.model===ARTICULATED_MODEL)requireFields(r.scenario.articulated,a.articulated);if(r.model===LEGACY_MODEL&&profileSupport(a.profile).regime!=='smooth-reference')throw Error('Legacy trail records only admitted smooth profiles.');return {bike:a.bike,wheel:a.wheel,motion:a.motion,profile:a.profile,assembly:a.assembly,surface:a.surface,commands:a.commands,...(a.articulated?{articulated:a.articulated}:{}),...(a.initialization?{initialization:a.initialization}:{})};
}
export const replay=r=>run(inputFromRecord(r));
