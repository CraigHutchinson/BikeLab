// Independent offline fine-mesh fixture. Production validation/defaults stay intact.
// Same isolated hub/node coordinates and flex damping law as moving-wheel.js;
// tests receive native matrices/forces against that consumer at its supported mesh.
import {DEFAULTS,terrainParts,getRuntime} from '../../dist/moving-wheel.js';
import {chordRatio} from '../../dist/wheel-ring.js';
export function nativeLoadedXML(casing,input){
 const p={...DEFAULTS,integrator:'Euler',...input},n=casing.initial.length/2;
 if(!['Euler','implicitfast'].includes(p.integrator)||![32,64,128,256,512].includes(n)||![p.dt,p.height,p.hubMass,p.tyreMass,p.hubInertia,p.skin,p.edgeViscosity,p.contactTime,p.contactImpedance].every(Number.isFinite)||Math.min(p.dt,p.hubMass,p.tyreMass,p.hubInertia,p.skin)<=0||p.edgeViscosity<0||p.contactTime<4*p.dt||p.contactImpedance<=0||p.contactImpedance>=1)throw RangeError('Invalid offline native fixture');
 const R=casing.reference.radius,L=R*(chordRatio[n]??2*Math.sin(Math.PI/n)),m=p.tyreMass/n,I=m*p.skin*p.skin/2;
 const {assets,geoms}=terrainParts(p,{points:[[-2,0],[2,0]]});
 const nodes=Array.from({length:n},(_,i)=>`<body name="wheel_n${i}" pos="${casing.initial[2*i]} 0 ${casing.initial[2*i+1]}"><joint name="wheel_u${i}" type="slide" axis="1 0 0"/><joint name="wheel_v${i}" type="slide" axis="0 0 1"/><inertial pos="0 0 0" mass="${m}" diaginertia="${I} ${I} ${I}"/></body>`).join('');
 return `<mujoco model="BikeLab offline loaded reference"><compiler angle="radian" fusestatic="false"/><option timestep="${p.dt}" gravity="0 0 0" integrator="${p.integrator}" solver="Newton" ccd_tolerance="${p.collisionTolerance}" ccd_iterations="${p.collisionIterations}" iterations="100" tolerance="1e-10"><flag autoreset="disable"/></option><asset>${assets}</asset><worldbody>${geoms}<body name="hub" pos="${p.centerX} 0 ${p.height}"><joint name="x" type="slide" axis="1 0 0"/><joint name="z" type="slide" axis="0 0 1"/><joint name="spin" type="hinge" axis="0 1 0"/><inertial pos="0 0 0" mass="${p.hubMass}" diaginertia="${p.hubInertia} ${p.hubInertia} ${p.hubInertia}"/>${nodes}</body></worldbody><deformable><flex name="wheel_casing" dim="1" radius="${p.skin}" body="${Array.from({length:n},(_,i)=>'wheel_n'+i).join(' ')}" element="${Array.from({length:n},(_,i)=>i+' '+((i+1)%n)).join(' ')}"><edge damping="${p.edgeViscosity/L}"/><contact condim="1" friction="0 0 0" solref="${p.contactTime} 1" solimp="${p.contactImpedance} ${p.contactImpedance} .001" selfcollide="none"/></flex></deformable></mujoco>`;
}
export async function runLoaded(casing,state,options={}){
 const p={...DEFAULTS,integrator:'Euler',dt:.0000078125,duration:.02,sampleDt:.001,centerX:0,...options,gravity:0,height:state.height+(options.skin??DEFAULTS.skin)},mj=await getRuntime();
 if(![p.duration,p.dt,p.sampleDt].every(Number.isFinite)||Math.min(p.duration,p.dt,p.sampleDt)<=0||p.duration>1||p.duration/p.dt>1000000)throw RangeError('Invalid offline time interval');
 const steps=Math.round(p.duration/p.dt),stride=Math.round(p.sampleDt/p.dt);
 if(stride<1||Math.abs(steps*p.dt-p.duration)>1e-12||Math.abs(stride*p.dt-p.sampleDt)>1e-12||steps%stride)throw RangeError('Unaligned offline observation times');
 if(!state.converged||!state.locallyAdmissible||state.planeAngle!==0||state.coordinates.length!==casing.initial.length||!Number.isFinite(state.reaction)||state.reaction<0)throw RangeError('Expected admitted phase-zero equilibrium');
 const load=options.appliedLoad??state.reaction;if(!Number.isFinite(load)||load<0)throw RangeError('Invalid applied hub load');
 const model=mj.MjModel.from_xml_string(nativeLoadedXML(casing,p));let data,velocityBuffer;
 try{
 data=new mj.MjData(model);velocityBuffer=new mj.DoubleBuffer(6);const q=new Float64Array(casing.initial.length),oldQ=new Float64Array(model.nq),frames=Array.from({length:steps/stride+2},()=>({momentumZ:0,maxBodySpeed:0,groundImpulse:0,momentumResidualZ:0,time:0,hubZ:0,hubVz:0,spin:0,maxStrain:0,relaxedCells:0,pressure:0,volume:0,energy:0,contactWork:0,dampingLoss:0,externalWork:0,residual:0,penetration:0,contacts:0,groundReaction:0,coordinates:new Float64Array(q.length)}));let frameCount=0;
 for(let i=0;i<q.length;i++)data.qpos[i+3]=state.coordinates[i]-casing.initial[i];
 data.qfrc_applied[1]=-load;
 const force=()=>{for(let i=0;i<q.length;i++)q[i]=casing.initial[i]+data.qpos[i+3];casing.evaluate(q);for(let i=0;i<q.length;i++)data.qfrc_applied[i+3]=casing.state.forces[i];};
 let energy=0,contactPower=0,dampingPower=0,contactWork=0,loss=0,work=0,initialEnergy=0,maxResidual=0,maxPenetration=0,maxIterations=0,groundImpulse=0,termination=null;
 function observe(){force();mj.mj_forward(model,data);mj.mj_energyPos(model,data);mj.mj_energyVel(model,data);energy=data.energy[0]+data.energy[1]+casing.state.potential;contactPower=0;dampingPower=0;for(let i=0;i<model.nv;i++){contactPower+=data.qfrc_constraint[i]*data.qvel[i];dampingPower-=data.qfrc_damper[i]*data.qvel[i];}
 let penetration=0;const contacts=data.contact;try{for(let i=0;i<data.ncon;i++){const c=contacts.get(i);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{contacts.delete();}maxPenetration=Math.max(maxPenetration,penetration);maxIterations=Math.max(maxIterations,data.solver_niter[0]);
 return penetration;
 }
 function snapshot(penetration){
 const f=frames[frameCount++];let momentumZ=0,maxBodySpeed=0;
 for(let b=1;b<model.nbody;b++){mj.mj_objectVelocity(model,data,mj.mjtObj.mjOBJ_BODY.value,b,velocityBuffer,0);const v=velocityBuffer.GetView();momentumZ+=model.body_mass[b]*v[5];maxBodySpeed=Math.max(maxBodySpeed,Math.hypot(v[3],v[4],v[5]));}
 f.momentumZ=momentumZ;f.maxBodySpeed=maxBodySpeed;f.groundImpulse=groundImpulse;f.momentumResidualZ=momentumZ-groundImpulse+load*data.time;
 f.time=data.time;f.hubZ=p.height+data.qpos[1];f.hubVz=data.qvel[1];f.spin=data.qpos[2];f.maxStrain=casing.state.maxStrain;f.relaxedCells=casing.state.relaxedCells;
 f.pressure=casing.state.gaugePressure;f.volume=casing.state.volume;f.energy=energy;f.contactWork=contactWork;f.dampingLoss=loss;f.externalWork=work;
 f.residual=energy-initialEnergy-contactWork+loss-work;f.penetration=penetration;f.contacts=data.ncon;f.groundReaction=data.qfrc_constraint[1];f.coordinates.set(q);
 }
 let penetration=observe();initialEnergy=energy;snapshot(penetration);
 for(let k=1;k<=steps;k++){
 const cp=contactPower,dp=dampingPower,fz=data.qfrc_constraint[1];oldQ.set(data.qpos);
 try{mj.mj_step1(model,data);force();mj.mj_step2(model,data);penetration=observe();}catch(e){if(!(e instanceof RangeError))throw e;termination={step:k,reason:'casing-domain',detail:e.message,attemptedQpos:Array.from(data.qpos),attemptedQvel:Array.from(data.qvel)};break;}
 groundImpulse+=p.dt*(fz+data.qfrc_constraint[1])/2;contactWork+=p.dt*(cp+contactPower)/2;loss+=p.dt*(dp+dampingPower)/2;work-=load*(data.qpos[1]-oldQ[1]);
 const residual=energy-initialEnergy-contactWork+loss-work;maxResidual=Math.max(maxResidual,Math.abs(residual));
 let finite=Number.isFinite(energy)&&Number.isFinite(contactPower)&&Number.isFinite(dampingPower)&&Number.isFinite(residual);for(let i=0;i<model.nv;i++)finite&&=Number.isFinite(data.qpos[i])&&Number.isFinite(data.qvel[i])&&Number.isFinite(data.qacc[i]);
 if(!finite)termination={step:k,reason:'nonfinite-state'};
 else if(data.solver_niter[0]>=100)termination={step:k,reason:'native-solver-iteration-limit'};
 else if(penetration>.001)termination={step:k,reason:'penetration-exceeds-1mm'};
 else if(casing.state.maxStrain>.3)termination={step:k,reason:'strain-exceeds-30-percent'};
 if(k%stride===0||termination)snapshot(penetration);if(termination)break;
 }
 return {params:{...p,nodes:q.length/2},load,initialStaticReaction:state.reaction,status:termination?'terminated':'completed',termination,acceptedTime:termination?(termination.step-1)*p.dt:data.time,attemptedTime:data.time,maxResidual,maxPenetration,maxIterations,frames:frames.slice(0,frameCount).map(f=>({...f,coordinates:Array.from(f.coordinates)}))};
 }finally{velocityBuffer?.delete();data?.delete();model.delete();}
}
