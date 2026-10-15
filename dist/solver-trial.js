import RAPIER from './vendor/rapier-0.21.0/rapier.mjs';
import { G } from './physics.js';
import { oscillatorState, LIMITS } from './suspension-reference.js';

import { MODEL, DEFAULTS, STEPS, SAMPLE_DT, CLOSURE_LIMITS, validate } from './solver-config.js';
export { MODEL, DEFAULTS, STEPS, SAMPLE_DT, CLOSURE_LIMITS, validate };
let initialized;
const init = () => initialized ??= RAPIER.init();
const vector = () => ({x:0,y:0,z:0});
const scratch = () => ({position:vector(),velocity:vector(),rotation:{x:0,y:0,z:0,w:1},angular:vector()});
function observe(body,s) {
  body.translation(s.position); body.linvel(s.velocity); body.rotation(s.rotation); body.angvel(s.angular);
}
const CHANNELS=['position','velocity','rotation','angular'], XYZ=['x','y','z'], XYZW=['x','y','z','w'];
function sameState(a,b) {
  for (const channel of CHANNELS)
    for (const key of channel==='rotation'?XYZW:XYZ) if(a[channel][key]!==b[channel][key])return false;
  return true;
}
function finite(s) {
  for(const channel of CHANNELS)for(const key of channel==='rotation'?XYZW:XYZ)
    if(!Number.isFinite(s[channel][key]))return false;
  return true;
}
function errorSample(error,delta) { error.maxAbsolute=Math.max(error.maxAbsolute,Math.abs(delta));error.rms+=delta*delta; }
const sameBytes=(a,b)=>a.length===b.length && a.every((v,i)=>v===b[i]);

// Offline feasibility arm. No collisions, stops or body coordinate locks. A real
// prismatic impulse joint removes five DOFs; its force-based motor supplies the spring.
export async function runTrial(input = {}) {
  const p=validate(input); await init();
  const angle=p.tiltDegrees*Math.PI/180, sin=Math.sin(angle), cos=Math.cos(angle);
  const axis={x:sin,y:0,z:-cos}, transverse={x:cos,y:0,z:sin};
  const eq=(p.mass*G*cos-p.preload)/p.stiffness;
  const steps=Math.round(p.duration/p.dt), stride=Math.round(SAMPLE_DT/p.dt), count=Math.round(p.duration/SAMPLE_DT)+1;
  const signals=Object.fromEntries(['time','compression','velocity','constitutiveForce','referenceCompression','referenceVelocity',
    'referenceForce','translationError','rotationError','x','z'].map(k=>[k,new Float64Array(count)]));
  const errors=Object.fromEntries(Object.entries(LIMITS).map(([key,limit])=>[key,{maxAbsolute:0,rms:0,limit}]));
  const state=scratch(), restoredState=scratch(), reference=new Float64Array(2);
  let world,restored,restoredBody,restoreTick=Math.floor(steps/2), restartEqual=true, comparedSteps=0;
  let maxTranslation=0,maxRotation=0,minCompression=Infinity,maxCompression=-Infinity;
  let sample=0,completedTicks=0,termination=null;
  try {
    world=new RAPIER.World({x:0,y:0,z:-G}); world.timestep=p.dt;
    world.integrationParameters.numSolverIterations=4;
    world.integrationParameters.numInternalPgsIterations=1;
    world.integrationParameters.lengthUnit=1;
    world.integrationParameters.maxCcdSubsteps=1;
    const origin=vector(), support=world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(axis.x*p.initialCompression,0,axis.z*p.initialCompression)
      .setLinvel(axis.x*p.initialVelocity,0,axis.z*p.initialVelocity)
      .setAdditionalMassProperties(p.mass,origin,{x:1,y:1,z:1},{x:0,y:0,z:0,w:1})
      .setLinearDamping(0).setAngularDamping(0).setCanSleep(false));
    body.recomputeMassPropertiesFromColliders();
    const joint=world.createImpulseJoint(RAPIER.JointData.prismatic(origin,origin,axis),support,body,true);
    joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
    joint.configureMotorPosition(-p.preload/p.stiffness,p.stiffness,p.damping);
    body.addForce({x:transverse.x*p.transverseForce,y:0,z:transverse.z*p.transverseForce},true);
    // A separate 3D torque probe stresses rotational closure without changing the ideal axial equation.
    const torqueScale=p.probeTorque/Math.sqrt(14);
    body.addTorque({x:torqueScale,y:2*torqueScale,z:3*torqueScale},true);
    const engine={package:'@dimforge/rapier3d-compat',packageVersion:'0.21.0',bindingVersion:RAPIER.version(),coreVersion:'0.36.0',
      sourceCommit:'b716d375efc0201003f0cd9ef7168eee0b62c177',
      precision:'float32',joint:'prismatic impulse joint',motor:'ForceBased',solverIterations:4,internalPgsIterations:1,
      requestedDt:p.dt,storedDt:world.timestep,substepsPerTick:4,substepDt:Math.fround(world.timestep/4),
      additionalBodySubsteps:0,lengthUnit:1,maxCcdSubsteps:1,sleeping:false,bodyLinearDamping:0,bodyAngularDamping:0,
      measuredMass:body.mass(),principalInertia:[1,1,1],torqueAxis:[1/Math.sqrt(14),2/Math.sqrt(14),3/Math.sqrt(14)],colliders:0};
    for (let tick=0;tick<=steps;tick++) {
      if (tick>0) { world.step(); if(restored)restored.step(); }
      observe(body,state);
      if(!finite(state)) { termination='Nonfinite engine state; trial rejected.'; break; }
      if(restored) { observe(restoredBody,restoredState);restartEqual &&= sameState(state,restoredState);comparedSteps++; }
      const q=state.position.x*sin-state.position.z*cos, u=state.velocity.x*sin-state.velocity.z*cos;
      const linear=Math.hypot(state.position.x-q*sin,state.position.y,state.position.z+q*cos);
      const angular=2*Math.atan2(Math.hypot(state.rotation.x,state.rotation.y,state.rotation.z),Math.abs(state.rotation.w));
      maxTranslation=Math.max(maxTranslation,linear);maxRotation=Math.max(maxRotation,angular);
      minCompression=Math.min(minCompression,q);maxCompression=Math.max(maxCompression,q);
      if(q<0 || q>p.travel) { termination='Candidate left stroke; trial rejected. No stop or safe continuation is provided.'; break; }
      completedTicks=tick;
      if(tick%stride===0) {
        const t=tick*engine.storedDt; oscillatorState(p.mass,p.stiffness,p.damping,p.initialCompression-eq,p.initialVelocity,t,reference);
        const refQ=eq+reference[0],refU=reference[1],force=p.preload+p.stiffness*q+p.damping*u;
        const refForce=p.preload+p.stiffness*refQ+p.damping*refU;
        signals.time[sample]=t;signals.compression[sample]=q;signals.velocity[sample]=u;
        signals.constitutiveForce[sample]=force;signals.referenceCompression[sample]=refQ;
        signals.referenceVelocity[sample]=refU;signals.referenceForce[sample]=refForce;
        signals.translationError[sample]=linear;signals.rotationError[sample]=angular;
        signals.x[sample]=state.position.x;signals.z[sample]=state.position.z;
        errorSample(errors.compression,q-refQ);errorSample(errors.compressionVelocity,u-refU);errorSample(errors.force,force-refForce);
        sample++;
      }
      if(tick===restoreTick) {
        restored=RAPIER.World.restoreSnapshot(world.takeSnapshot());
        restoredBody=restored.getRigidBody(body.handle);
        observe(restoredBody,restoredState); restartEqual &&= sameState(state,restoredState);
      }
    }
    for(const e of Object.values(errors))e.rms=Math.sqrt(e.rms/sample);
    const finalSnapshotEqual=!!restored && sameBytes(world.takeSnapshot(),restored.takeSnapshot());
    const restart={tick:restoreTick,time:restoreTick*engine.storedDt,comparedSteps,exactBodyState:restartEqual&&comparedSteps===steps-restoreTick,
      exactFinalSnapshot:finalSnapshotEqual,scope:'Same artifact and runtime; complete engine snapshot plus immutable setup and integer tick. No contact/soil state in this fixture.'};
    const checks={reference:Object.values(errors).every(e=>e.maxAbsolute<=e.limit),
      closure:maxTranslation<=CLOSURE_LIMITS.translation&&maxRotation<=CLOSURE_LIMITS.rotation,
      restart:restart.exactBodyState&&restart.exactFinalSnapshot,complete:termination===null};
    return {model:MODEL,params:p,engine,sampleDt:SAMPLE_DT,effectiveSampleDt:stride*engine.storedDt,status:Object.values(checks).every(Boolean)?'pass':'fail',checks,
      termination,completedTicks,sampleCount:sample,errors,
      closure:{maxTranslation,maxRotation,limits:CLOSURE_LIMITS},travel:{minCompression,maxCompression},restart,
      diagnostics:{jointReaction:'unavailable: this JS binding exposes no joint impulse/wrench getter',
        timestep:'Four solver iterations are four internal substeps. Float32 split force/velocity updates and position accumulation can reverse refinement; a smaller outer timestep is not an accuracy guarantee.',
        force:'Constitutive force evaluated from recorded q/u; not the engine motor impulse or a measured support reaction.',
        scope:'Offline, interior-stroke solver feasibility. No contact, stops, whole bicycle, calibration or real-time qualification.'},
      signals:Object.fromEntries(Object.entries(signals).map(([k,v])=>[k,v.subarray(0,sample)]))};
  } finally { restored?.free();world?.free(); }
}
export function trialReport(run) {
  const {signals,...report}=run;
  return {...report,signals:Object.fromEntries(Object.entries(signals).map(([k,v])=>[k,Array.from(v)]))};
}
