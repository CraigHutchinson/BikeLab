// Dynamic spring-supported capsule ring. Model and limitations: MOVING_WHEEL.md.
import loadMujoco from './vendor/mujoco-3.16.0/mujoco.js';
import {fixture,validateProfile} from './terrain.js';
import {validateAssembly,assessAssembly,sweepRim,ASSEMBLY_DEFAULTS} from './wheel-limits.js';
export const MODEL='bikelab-moving-wheel-0.1';
export const DEFAULTS=Object.freeze({fixture:'flat',nodes:64,terrainSegments:32,radius:.36,rimRadius:.29,skin:.008,hubMass:3,tyreMass:1,hubInertia:.08,foundation:300000,extension:500,edgeViscosity:.5,centerX:-.4,height:.39,rotation:0,velocityX:1,velocityZ:0,omega:0,gravity:9.80665,forceX:0,forceZ:0,torque:0,duration:.35,dt:.00003125,sampleDt:.005,contactTime:.001,contactImpedance:.99,collisionTolerance:1e-10,collisionIterations:100,maxPenetration:.0005,maxStrain:.25,maxDisplacement:.06});
const bounds={radius:[.25,.45],rimRadius:[.15,.4],skin:[.003,.015],hubMass:[1,30],tyreMass:[.5,3],hubInertia:[.02,.5],foundation:[50000,600000],extension:[0,2000],edgeViscosity:[0,3],centerX:[-5,5],height:[.15,2],rotation:[-Math.PI,Math.PI],velocityX:[-5,5],velocityZ:[-5,5],omega:[-30,30],gravity:[0,15],forceX:[-100,100],forceZ:[-100,100],torque:[-10,10],duration:[.02,1],dt:[.0000078125,.00025],sampleDt:[.001,.02],contactTime:[.0005,.005],contactImpedance:[.95,.999],collisionTolerance:[1e-12,1e-6],collisionIterations:[35,200],maxPenetration:[.00005,.001],maxStrain:[.05,.3],maxDisplacement:[.005,.07]};
const plain=a=>a&&typeof a==='object'&&!Array.isArray(a)&&[Object.prototype,null].includes(Object.getPrototypeOf(a));
// Canonical binary64 geometry for the three supported meshes. JS transcendental
// functions may differ by an ulp between runtimes; contact can amplify that.
// sin(i*pi/64), i=0..32; reflect the quarter circle for exact mesh symmetry.
const quarterSin=Object.freeze([0,0.049067674327418015,0.0980171403295606,0.14673047445536175,0.19509032201612825,0.24298017990326387,0.29028467725446233,0.33688985339222005,0.3826834323650898,0.4275550934302821,0.47139673682599764,0.5141027441932217,0.5555702330196022,0.5956993044924334,0.6343932841636455,0.6715589548470183,0.7071067811865475,0.7409511253549591,0.7730104533627369,0.8032075314806448,0.8314696123025452,0.8577286100002721,0.8819212643483549,0.9039892931234433,0.9238795325112867,0.9415440651830208,0.9569403357322089,0.970031253194544,0.9807852804032304,0.989176509964781,0.9951847266721968,0.9987954562051724,1]);
const chordRatio=Object.freeze({32:0.1960342806591212,64:0.09813534865483603,128:0.049082457045824576});
const ringSin=i=>{i%=128;return i<=32?quarterSin[i]:i<=64?quarterSin[64-i]:i<=96?-quarterSin[i-64]:-quarterSin[128-i];};
export function validate(input={}){
 if(!plain(input))throw Error('Parameters must be an object.');for(const k of Object.keys(input))if(!Object.hasOwn(DEFAULTS,k))throw Error('Unknown parameter: '+k);
 const p={...DEFAULTS,...input};for(const [k,[lo,hi]] of Object.entries(bounds))if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi)throw Error(k+' outside supported SI range.');
 if(!['flat','square','rounded','flight','overload'].includes(p.fixture)||![32,64,128].includes(p.nodes)||![16,32,64].includes(p.terrainSegments))throw Error('Unsupported fixture or resolution.');
 if(!Number.isInteger(p.collisionIterations))throw Error('Collision iteration limit must be an integer.');
 if(p.radius-p.rimRadius<2*p.skin+.02)throw Error('Insufficient casing/rim clearance.');
 const R=p.radius-p.skin,ds=2*Math.PI*R/p.nodes,L=R*chordRatio[p.nodes];
 if(p.dt*Math.sqrt((p.foundation*ds+4*p.extension/L)/(p.tyreMass/p.nodes))>.55)throw Error('Timestep exceeds the ring stiffness/mass admission bound; reduce dt.');
 if(p.contactTime<4*p.dt)throw Error('Contact time must be at least four integration steps.');
 if(p.duration/p.sampleDt>400)throw Error('Recording exceeds 400 intervals; increase sampleDt.');
 for(const x of [p.sampleDt/p.dt,p.duration/p.sampleDt])if(Math.abs(x-Math.round(x))>1e-7)throw Error('Observation/duration must align with the fixed timestep.');
 return Object.freeze(p);
}
export function wheelFixture(p){const f=fixture(['square','rounded'].includes(p.fixture)?p.fixture:'flat',p.terrainSegments);f.points[0][0]=-2;f.points.at(-1)[0]=2;return f;}
export function preset(name){const patch=name==='square'||name==='rounded'?{fixture:name,height:.37,velocityX:1.5,omega:4,duration:.5}:name==='flight'?{fixture:name,height:1,velocityX:.5,velocityZ:.4,omega:3,gravity:0,duration:.2}:name==='overload'?{fixture:name,height:.42,velocityZ:-4,hubMass:20,duration:.2}:{fixture:'flat'};return {params:validate(patch),assembly:validateAssembly()};}
// Merge collinear segments before collision decomposition: author subdivision is not extra support.
export function canonicalProfile(input){const profile=structuredClone(validateProfile(input)),points=[];for(const c of profile.points){while(points.length>1){const a=points.at(-2),b=points.at(-1),ux=b[0]-a[0],uz=b[1]-a[1],vx=c[0]-b[0],vz=c[1]-b[1];if(Math.abs(ux*vz-uz*vx)>1e-12*Math.hypot(ux,uz)*Math.hypot(vx,vz)||ux*vx+uz*vz<=0)break;points.pop();}points.push(c);}if(points.length>132||points.some(q=>Math.abs(q[0])>10||Math.abs(q[1])>2))throw Error('Dynamic profile supports at most 132 canonical points within ±10 m x and ±2 m z.');profile.points=points;return profile;}
const contact=(p,friction=0)=>{if(!Number.isFinite(friction)||friction<0||friction>2||(friction>0&&friction<1e-4))throw Error('Friction must be zero or within [0.0001, 2].');return `condim="${friction?3:1}" friction="${friction} 0 0" solref="${p.contactTime} 1" solimp="${p.contactImpedance} ${p.contactImpedance} .001"`;};
export function wheelParts(input={},prefix='wheel',friction=0){
 const p=validate(input);if(!/^[a-z][a-z0-9_]*$/.test(prefix))throw Error('Invalid assembly prefix.');
 const n=p.nodes,R=p.radius-p.skin,ds=2*Math.PI*R/n,L=R*chordRatio[n],mass=p.tyreMass/n,inertia=mass*p.skin**2/2;
 const body=Array.from({length:n},(_,i)=>{const a=i*128/n;return `<body name="${prefix}_n${i}" pos="${R*ringSin(a)} 0 ${-R*ringSin(a+32)}"><joint name="${prefix}_u${i}" type="slide" axis="1 0 0" stiffness="${p.foundation*ds}"/><joint name="${prefix}_v${i}" type="slide" axis="0 0 1" stiffness="${p.foundation*ds}"/><inertial pos="0 0 0" mass="${mass}" diaginertia="${inertia} ${inertia} ${inertia}"/></body>`;}).join('');
 return {nodes:body,flex:`<flex name="${prefix}_casing" dim="1" radius="${p.skin}" body="${Array.from({length:n},(_,i)=>prefix+'_n'+i).join(' ')}" element="${Array.from({length:n},(_,i)=>i+' '+((i+1)%n)).join(' ')}"><edge stiffness="${p.extension/L}" damping="${p.edgeViscosity/L}"/><contact ${contact(p,friction)} selfcollide="none"/></flex>`,reference:{centerlineRadius:R,arcWeight:ds,chordLength:L,nodeMass:mass,nodeInertia:inertia,totalMass:p.hubMass+p.tyreMass,rigidSpinInertia:p.hubInertia+p.tyreMass*(R*R+p.skin*p.skin/2)}};
}
export function terrainParts(p,profile,friction=0){const floor=Math.min(...profile.points.map(q=>q[1]))-1;let assets='',geoms='';
 for(let i=1;i<profile.points.length;i++){const a=profile.points[i-1],b=profile.points[i];if(b[0]===a[0])continue;const vertices=[];for(const y of [-.1,.1])for(const [x,z] of [[a[0],floor],[b[0],floor],b,a])vertices.push(x,y,z);assets+=`<mesh name="ground${i}" vertex="${vertices.join(' ')}"/>`;geoms+=`<geom name="ground${i}" type="mesh" mesh="ground${i}" ${contact(p,friction)}/>`;}
 return {assets,geoms};
}
export function modelXML(input={},authored){const p=validate(input),profile=canonicalProfile(authored??wheelFixture(p)),parts=wheelParts(p),{assets,geoms}=terrainParts(p,profile);
 return `<mujoco model="BikeLab moving wheel"><compiler angle="radian" fusestatic="false"/><option timestep="${p.dt}" gravity="0 0 -${p.gravity}" integrator="implicitfast" solver="Newton" ccd_tolerance="${p.collisionTolerance}" ccd_iterations="${p.collisionIterations}" iterations="100" tolerance="1e-10"><flag autoreset="disable"/></option><asset>${assets}</asset><worldbody>${geoms}<body name="hub" pos="${p.centerX} 0 ${p.height}"><joint name="x" type="slide" axis="1 0 0"/><joint name="z" type="slide" axis="0 0 1"/><joint name="spin" type="hinge" axis="0 1 0"/><inertial pos="0 0 0" mass="${p.hubMass}" diaginertia="${p.hubInertia} ${p.hubInertia} ${p.hubInertia}"/>${parts.nodes}</body></worldbody><deformable>${parts.flex}</deformable></mujoco>`;
}
let runtime;export const getRuntime=()=>runtime??=loadMujoco();
function pointSegment(x,z,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-ax-t*dx,z-az-t*dz);}
function cross(ax,az,bx,bz){return ax*bz-az*bx;}
function intersects(ax,az,bx,bz,cx,cz,dx,dz){const u=cross(bx-ax,bz-az,cx-ax,cz-az),v=cross(bx-ax,bz-az,dx-ax,dz-az),w=cross(dx-cx,dz-cz,ax-cx,az-cz),q=cross(dx-cx,dz-cz,bx-cx,bz-cz);return u*v<0&&w*q<0;}
function segmentDistance(ax,az,bx,bz,cx,cz,dx,dz){return intersects(ax,az,bx,bz,cx,cz,dx,dz)?0:Math.min(pointSegment(ax,az,cx,cz,dx,dz),pointSegment(bx,bz,cx,cz,dx,dz),pointSegment(cx,cz,ax,az,bx,bz),pointSegment(dx,dz,ax,az,bx,bz));}
function groundHeight(points,x){let height=-Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(a[0]<=x&&x<=b[0])height=Math.max(height,a[0]===b[0]?Math.max(a[1],b[1]):a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}return height;}
function centerGap(points,x,z,r){let d=Infinity;for(let i=1;i<points.length;i++)d=Math.min(d,pointSegment(x,z,...points[i-1],...points[i]));return z<=groundHeight(points,x)?-r:d-r;}
// Geometric guards are independent of the native contact manifold.
// null inner clearance means the guard stopped before measuring any casing edge.
// Never leak the internal minimum sentinel into replay records.
function geometryResult(out,reason,rimGap,penetration,inner,movement){out.reason=reason;out.rimGap=rimGap;out.penetration=penetration;out.inner=inner;out.movement=movement;return out;}
export function geometryLimits(p,profile,hub,xyz,previous,out={}){const points=profile.points,n=p.nodes,x=hub[0],z=hub[1];let penetration=0,inner=null,movement=0;
 if(x-p.radius<points[0][0]||x+p.radius>points.at(-1)[0])return geometryResult(out,'authored-domain',null,penetration,inner,movement);
 const rimGap=centerGap(points,x,z,p.rimRadius);if(rimGap<=1e-8)return geometryResult(out,'rim-contact',rimGap,penetration,inner,movement);
 for(let i=0;i<n;i++){const j=(i+1)%n,ax=xyz[3*i],az=xyz[3*i+2],bx=xyz[3*j],bz=xyz[3*j+2];
  if(ax-p.skin<points[0][0]||ax+p.skin>points.at(-1)[0])return geometryResult(out,'casing-domain',rimGap,penetration,inner,movement);
  if(az<=groundHeight(points,ax))return geometryResult(out,'casing-centreline-crossing',rimGap,penetration,inner,movement);
  inner=Math.min(inner??Infinity,pointSegment(x,z,ax,az,bx,bz)-p.skin-p.rimRadius);
  if(previous)movement=Math.max(movement,Math.hypot(ax-previous[3*i],az-previous[3*i+2]));
  for(let k=1;k<points.length;k++){const a=points[k-1],b=points[k];if(Math.max(ax,bx)+p.skin<a[0]||Math.min(ax,bx)-p.skin>b[0]||Math.min(az,bz)-p.skin>Math.max(a[1],b[1]))continue;penetration=Math.max(penetration,p.skin-segmentDistance(ax,az,bx,bz,...a,...b));}
  for(let k=i+2;k<n;k++){if(i===0&&k===n-1)continue;const l=(k+1)%n,cx=xyz[3*k],cz=xyz[3*k+2],dx=xyz[3*l],dz=xyz[3*l+2];if(Math.max(ax,bx)+1e-10<Math.min(cx,dx)||Math.min(ax,bx)-1e-10>Math.max(cx,dx)||Math.max(az,bz)+1e-10<Math.min(cz,dz)||Math.min(az,bz)-1e-10>Math.max(cz,dz))continue;if(segmentDistance(ax,az,bx,bz,cx,cz,dx,dz)<=1e-10)return geometryResult(out,'casing-self-crossing',rimGap,penetration,inner,movement);}
 }
 const reason=inner<=0?'casing-rim-contact':penetration>p.maxPenetration?'contact-penetration-limit':movement>p.skin/4?'motion-resolution-limit':null;
 return geometryResult(out,reason,rimGap,penetration,inner,movement);
}
export function inputFromRecord(r){if(r?.model!==MODEL||!r.params||!r.profile||!r.assembly||Object.keys(DEFAULTS).some(k=>!Object.hasOwn(r.params,k))||Object.keys(ASSEMBLY_DEFAULTS).some(k=>!Object.hasOwn(r.assembly,k)))throw Error('Incomplete or unsupported moving-wheel record.');return {params:validate(r.params),profile:structuredClone(validateProfile(r.profile)),assembly:validateAssembly(r.assembly)};}
export async function run(input={}){
 if(!plain(input)||Object.keys(input).some(k=>!['params','profile','assembly'].includes(k)))throw Error('Expected params, profile and assembly.');
 const p=validate(input.params??{}),profile=structuredClone(validateProfile(input.profile??wheelFixture(p))),collisionProfile=canonicalProfile(profile),assembly=validateAssembly(input.assembly??{}),assessment=assessAssembly(assembly,p.rimRadius),reference=wheelParts(p).reference;
 const report={model:MODEL,engine:'MuJoCo 3.16.0',params:p,profile,assembly,assessment,reference,coordinates:'SI; x forward, y left, z up; positive spin about +y; ground moment about hub, angular impulse about world origin',parameterProvenance:'Ring properties, mass and launch presets are illustrative; assembly declarations retain their own evidence. No physical calibration.',scope:'Uncalibrated planar spring-supported capsule ring; frictionless, no inflation, damage or 3D riding.'};
 if(assessment.status==='incompatible')return {...report,status:'assembly-rejected',termination:{reason:'assembly-service-limit',time:0},frames:[]};
 const mj=await getRuntime();let model,data,velocityBuffer,forceBuffer;try{
  model=mj.MjModel.from_xml_string(modelXML(p,collisionProfile));data=new mj.MjData(model);velocityBuffer=new mj.DoubleBuffer(6);forceBuffer=new mj.DoubleBuffer(6);
  data.qpos[2]=p.rotation;data.qvel[0]=p.velocityX;data.qvel[1]=p.velocityZ;data.qvel[2]=p.omega;data.qfrc_applied[0]=p.forceX;data.qfrc_applied[1]=p.forceZ;data.qfrc_applied[2]=p.torque;
  const steps=Math.round(p.duration/p.dt),stride=Math.round(p.sampleDt/p.dt),maxFrames=Math.floor(steps/stride)+2,frames=Array.from({length:maxFrames},()=>({hub:new Float64Array(3),velocity:new Float64Array(3),nodes:new Float64Array(2*p.nodes),contactData:new Float64Array(256*9),groundWrench:new Float64Array(3),impulse:new Float64Array(3),momentum:new Float64Array(3),momentumResidual:new Float64Array(3),limits:{}})),oldQ=new Float64Array(model.nq),oldV=new Float64Array(model.nv),oldWarm=new Float64Array(model.nv),oldXYZ=new Float64Array(3*p.nodes),hub=new Float64Array(2),oldHub=new Float64Array(2),bodyType=mj.mjtObj.mjOBJ_BODY.value;
  let count=0,work=0,constraintWork=0,loss=0,jx=0,jz=0,jy=0,initialEnergy=0,energy=0,cp=0,dp=0,wp=0,fx=0,fz=0,my=0,originMoment=0,appliedMoment=0,appliedAngularImpulse=0,initialPx=0,initialPz=0,initialHy=0,termination=null,limits,peakPenetration=0,maxResidual=0,peakForce=0,maxStrain=0,maxDeformation=0,contactSteps=0;
  function observe(){mj.mj_forward(model,data);mj.mj_energyPos(model,data);mj.mj_energyVel(model,data);energy=data.energy[0]+data.energy[1];cp=0;dp=0;for(let i=0;i<model.nv;i++){cp+=data.qfrc_constraint[i]*data.qvel[i];dp-=data.qfrc_damper[i]*data.qvel[i];}
   hub[0]=p.centerX+data.qpos[0];hub[1]=p.height+data.qpos[1];fx=data.qfrc_constraint[0];fz=data.qfrc_constraint[1];my=data.qfrc_constraint[2];originMoment=my+hub[1]*fx-hub[0]*fz;wp=p.forceX*data.qvel[0]+p.forceZ*data.qvel[1]+p.torque*data.qvel[2];appliedMoment=reference.totalMass*p.gravity*data.subtree_com[3]+p.torque+hub[1]*p.forceX-hub[0]*p.forceZ;
  }
  function guard(previous){if(!Number.isFinite(energy)||!Number.isFinite(cp)||!Number.isFinite(dp)||!Number.isFinite(wp)||!Number.isFinite(fx)||!Number.isFinite(fz)||!Number.isFinite(my)||!Number.isFinite(appliedMoment))return {reason:'nonfinite-state'};for(let i=0;i<model.nv;i++)if(!Number.isFinite(data.qpos[i])||!Number.isFinite(data.qvel[i])||!Number.isFinite(data.qacc[i])||!Number.isFinite(data.qfrc_constraint[i])||!Number.isFinite(data.qfrc_damper[i]))return {reason:'nonfinite-state'};if(data.solver_niter[0]>=100)return {reason:'native-solver-iteration-limit'};if(data.ncon>256)return {reason:'contact-capacity-limit'};
   const g=geometryLimits(p,collisionProfile,hub,data.flexvert_xpos,previous);if(g.reason)return g;
   let strain=0,deformation=0;for(let i=0;i<p.nodes;i++){strain=Math.max(strain,Math.abs(data.flexedge_length[i]/model.flexedge_length0[i]-1));deformation=Math.max(deformation,Math.hypot(data.qpos[3+2*i],data.qpos[4+2*i]));}
   g.strain=strain;g.deformation=deformation;if(strain>p.maxStrain)g.reason='casing-strain-limit';else if(deformation>p.maxDisplacement)g.reason='casing-displacement-limit';else if(previous&&Math.abs(data.qpos[2]-oldQ[2])>.01)g.reason='spin-resolution-limit';return g;
  }
  function record(){let px=0,pz=0,hy=0,gravityMoment=0;for(let b=1;b<model.nbody;b++){mj.mj_objectVelocity(model,data,bodyType,b,velocityBuffer,0);const v=velocityBuffer.GetView(),mass=model.body_mass[b],x=data.xipos[3*b],z=data.xipos[3*b+2];px+=mass*v[3];pz+=mass*v[5];hy+=model.body_inertia[3*b+1]*v[1]+mass*(z*v[3]-x*v[5]);gravityMoment+=x*mass*p.gravity;}
   if(!count){initialPx=px;initialPz=pz;initialHy=hy;}
   const frame=frames[count],list=data.contact;let contactCount=0;
   try{for(let i=0;i<list.size();i++){const c=list.get(i);try{if(c.flex[0]!==0&&c.flex[1]!==0)continue;mj.mj_contactForce(model,data,i,forceBuffer);const normalForce=forceBuffer.GetView()[0];if(normalForce<=1e-8)continue;const sign=c.flex[1]===0?1:-1,k=9*contactCount++;frame.contactData[k]=c.pos[0];frame.contactData[k+1]=c.pos[2];frame.contactData[k+2]=sign*c.frame[0];frame.contactData[k+3]=sign*c.frame[2];frame.contactData[k+4]=normalForce;frame.contactData[k+5]=c.dist;frame.contactData[k+6]=c.elem[sign===1?1:0];frame.contactData[k+7]=c.vert[sign===1?1:0];frame.contactData[k+8]=sign;}finally{c.delete();}}}finally{list.delete();}
   const residual=energy-initialEnergy+loss-constraintWork-work;maxResidual=Math.max(maxResidual,Math.abs(residual));
   frame.time=data.time;frame.hub[0]=hub[0];frame.hub[1]=hub[1];frame.hub[2]=data.qpos[2];frame.velocity.set(data.qvel.subarray(0,3));
   for(let i=0;i<p.nodes;i++){frame.nodes[2*i]=data.flexvert_xpos[3*i];frame.nodes[2*i+1]=data.flexvert_xpos[3*i+2];}
   frame.contactCount=contactCount;frame.groundWrench[0]=fx;frame.groundWrench[1]=fz;frame.groundWrench[2]=my;frame.energy=energy;frame.externalWork=work;frame.constraintWork=constraintWork;frame.dampingLoss=loss;frame.residual=residual;frame.impulse[0]=jx;frame.impulse[1]=jz;frame.impulse[2]=jy;frame.momentum[0]=px;frame.momentum[1]=pz;frame.momentum[2]=hy;frame.momentumResidual[0]=px-initialPx-jx-p.forceX*data.time;frame.momentumResidual[1]=pz-initialPz-jz-(p.forceZ-reference.totalMass*p.gravity)*data.time;frame.momentumResidual[2]=hy-initialHy-jy-appliedAngularImpulse;frame.gravityMoment=gravityMoment;Object.assign(frame.limits,limits);count++;
  }
  observe();initialEnergy=energy;limits=guard();if(limits.reason)return {...report,status:'initial-state-rejected',termination:{reason:limits.reason,time:0},frames:[],diagnostics:limits};peakPenetration=limits.penetration;peakForce=Math.hypot(fx,fz);maxStrain=limits.strain;maxDeformation=limits.deformation;record();
  for(let step=1;step<=steps;step++){
   oldQ.set(data.qpos);oldV.set(data.qvel);oldWarm.set(data.qacc_warmstart);oldXYZ.set(data.flexvert_xpos);oldHub.set(hub);const time=data.time,oldCp=cp,oldDp=dp,oldWp=wp,oldFx=fx,oldFz=fz,oldMy=originMoment,oldAppliedMoment=appliedMoment;
   mj.mj_step(model,data);observe();const next=guard(oldXYZ);
   if(!next.reason&&(limits.rimGap<.01||next.rimGap<.01)){const sweep=sweepRim(collisionProfile,Array.from(oldHub),[hub[0]-oldHub[0],hub[1]-oldHub[1]],p.rimRadius,p.radius);if(sweep.status!=='clear')next.reason='swept-'+sweep.status;}
   if(!next.reason&&Math.abs(data.time-(time+p.dt))>1e-9)next.reason='native-clock-reset';
   if(next.reason){termination={reason:next.reason,time,attemptedTime:time+p.dt,attemptedDiagnostics:next};data.qpos.set(oldQ);data.qvel.set(oldV);data.qacc_warmstart.set(oldWarm);data.time=time;observe();break;}
   limits=next;work+=.5*p.dt*(oldWp+wp);constraintWork+=.5*p.dt*(oldCp+cp);loss+=.5*p.dt*(oldDp+dp);jx+=.5*p.dt*(oldFx+fx);jz+=.5*p.dt*(oldFz+fz);jy+=.5*p.dt*(oldMy+originMoment);appliedAngularImpulse+=.5*p.dt*(oldAppliedMoment+appliedMoment);
   peakPenetration=Math.max(peakPenetration,limits.penetration);peakForce=Math.max(peakForce,Math.hypot(fx,fz));maxStrain=Math.max(maxStrain,limits.strain);maxDeformation=Math.max(maxDeformation,limits.deformation);if(Math.hypot(fx,fz)>1e-8)contactSteps++;maxResidual=Math.max(maxResidual,Math.abs(energy-initialEnergy+loss-constraintWork-work));if(step%stride===0)record();
  }
  if(Math.abs(frames[count-1].time-data.time)>1e-10)record();
  return {...report,status:termination?'terminated':'completed',termination,frames:frames.slice(0,count).map(f=>{const {contactData,contactCount,...rest}=f;return {...rest,hub:Array.from(f.hub),velocity:Array.from(f.velocity),nodes:Array.from({length:p.nodes},(_,i)=>[f.nodes[2*i],f.nodes[2*i+1]]),contacts:Array.from({length:contactCount},(_,i)=>{const k=9*i,nx=contactData[k+2],nz=contactData[k+3],normalForce=contactData[k+4];return {point:[contactData[k],contactData[k+1]],normal:[nx,nz],force:[nx*normalForce,nz*normalForce],normalForce,distance:contactData[k+5],edge:contactData[k+6],vertex:contactData[k+7]};}),groundWrench:Array.from(f.groundWrench),impulse:Array.from(f.impulse),momentum:Array.from(f.momentum),momentumResidual:Array.from(f.momentumResidual)};}),summary:{acceptedTime:data.time,peakPenetration,peakForce,maxStrain,maxDeformation,maxResidual,contactSteps,steps:Math.round(data.time/p.dt),initialEnergy,finalEnergy:energy,initialMomentum:[initialPx,initialPz,initialHy]}};
 }finally{forceBuffer?.delete();velocityBuffer?.delete();data?.delete();model?.delete();}
}
export const replay=r=>run(inputFromRecord(r));
