// Matched, bounded diagnostic controls. None of these alternate force/coordinate
// representations changes the production trial. See docs/TIMESTEP_RESEARCH.md.
import RAPIER from '../dist/vendor/rapier-0.21.0/rapier.mjs';
import { DEFAULTS, STEPS, SAMPLE_DT, validate } from '../dist/solver-config.js';
import { oscillatorState } from '../dist/suspension-reference.js';
import { G } from '../dist/physics.js';
import { createHash } from 'node:crypto';

let initialized;
const vector=()=>({x:0,y:0,z:0});
const maxError=()=>({maxAbsolute:0,peakTime:0,signedAtPeak:0});
function record(error,delta,time) {
  if(Math.abs(delta)>error.maxAbsolute)Object.assign(error,{maxAbsolute:Math.abs(delta),peakTime:time,signedAtPeak:delta});
}
export async function diagnosticCase(options={}) {
  const controls={dt:DEFAULTS.dt,substeps:4,pgs:1,centered:false,balanced:false,vertical:false,...options};
  if(!options||typeof options!=='object'||Array.isArray(options))throw new Error('Diagnostic controls must be an object.');
  for(const key of Object.keys(options))if(!Object.hasOwn(controlsDefaults,key))throw new Error('Unknown diagnostic control: '+key);
  if(!STEPS.includes(controls.dt)||![1,2,4,8].includes(controls.substeps)||![1,4].includes(controls.pgs))
    throw new Error('Unsupported diagnostic timestep/iteration setting.');
  for(const key of ['centered','balanced','vertical'])if(typeof controls[key]!=='boolean')throw new Error(key+' must be boolean.');
  const p=validate({...DEFAULTS,dt:controls.dt,...(controls.vertical?{tiltDegrees:0,transverseForce:0}:{})});
  await (initialized??=RAPIER.init());
  const angle=p.tiltDegrees*Math.PI/180,sin=Math.sin(angle),cos=Math.cos(angle);
  const axis={x:sin,y:0,z:-cos},normal={x:cos,y:0,z:sin},origin=vector();
  const eq=(p.mass*G*cos-p.preload)/p.stiffness,shift=controls.centered?eq:0;
  // Net-force control preserves the ideal axial ODE, not the original reaction
  // load paths: absorb gravity/preload into the motor target, retain side load.
  const gravity=controls.balanced?0:-G;
  const target=(controls.balanced?eq:-p.preload/p.stiffness)-shift;
  const side=p.transverseForce-(controls.balanced?p.mass*G*sin:0);
  const ticks=Math.round(p.duration/p.dt),stride=Math.round(SAMPLE_DT/p.dt),count=ticks/stride+1;
  const signals=Object.fromEntries(['time','compression','velocity','constitutiveForce','referenceCompression','referenceVelocity']
    .map(k=>[k,new Float64Array(count)]));
  const errors={compression:maxError(),velocity:maxError(),force:maxError(),earlyCompression:maxError(),lateCompression:maxError()};
  const position=vector(),velocity=vector(),rotation={x:0,y:0,z:0,w:1},reference=new Float64Array(2);
  let world,maxTranslation=0,maxRotation=0,sample=0;
  try {
    world=new RAPIER.World({x:0,y:0,z:gravity});world.timestep=p.dt;
    const ip=world.integrationParameters;
    ip.numSolverIterations=controls.substeps;ip.numInternalPgsIterations=controls.pgs;
    ip.lengthUnit=1;ip.maxCcdSubsteps=1;
    const support=world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(axis.x*(p.initialCompression-shift),0,axis.z*(p.initialCompression-shift))
      .setLinvel(axis.x*p.initialVelocity,0,axis.z*p.initialVelocity)
      .setAdditionalMassProperties(p.mass,origin,{x:1,y:1,z:1},{x:0,y:0,z:0,w:1})
      .setLinearDamping(0).setAngularDamping(0).setCanSleep(false));
    body.recomputeMassPropertiesFromColliders();
    const joint=world.createImpulseJoint(RAPIER.JointData.prismatic(origin,origin,axis),support,body,true);
    joint.configureMotorModel(RAPIER.MotorModel.ForceBased);joint.configureMotorPosition(target,p.stiffness,p.damping);
    body.addForce({x:normal.x*side,y:0,z:normal.z*side},true);
    // Match the production fixture's explicit zero torque operation.
    body.addTorque({x:0,y:0,z:0},true);
    const storedDt=world.timestep,substepDt=Math.fround(storedDt/controls.substeps);
    for(let tick=0;tick<=ticks;tick++) {
      if(tick)world.step();
      body.translation(position);body.linvel(velocity);body.rotation(rotation);
      const rawQ=position.x*sin-position.z*cos,q=rawQ+shift,u=velocity.x*sin-velocity.z*cos;
      if(!Number.isFinite(q)||!Number.isFinite(u)||q<0||q>p.travel)throw new Error('Diagnostic state left its finite interior-stroke domain.');
      maxTranslation=Math.max(maxTranslation,Math.hypot(position.x-rawQ*sin,position.y,position.z+rawQ*cos));
      maxRotation=Math.max(maxRotation,2*Math.atan2(Math.hypot(rotation.x,rotation.y,rotation.z),Math.abs(rotation.w)));
      if(tick%stride)continue;
      const t=tick*storedDt;
      oscillatorState(p.mass,p.stiffness,p.damping,p.initialCompression-eq,p.initialVelocity,t,reference);
      const refQ=eq+reference[0],refU=reference[1],force=p.preload+p.stiffness*q+p.damping*u;
      record(errors.compression,q-refQ,t);record(errors.velocity,u-refU,t);
      record(errors.force,force-(p.preload+p.stiffness*refQ+p.damping*refU),t);
      record(t<=1?errors.earlyCompression:errors.lateCompression,q-refQ,t);
      signals.time[sample]=t;signals.compression[sample]=q;signals.velocity[sample]=u;
      signals.constitutiveForce[sample]=force;signals.referenceCompression[sample]=refQ;signals.referenceVelocity[sample]=refU;sample++;
    }
    return {params:p,controls,representation:{gravityZ:gravity,motorTarget:target,coordinateShift:shift,transverseForce:side},
      storedDt,substepDt,substepsPerTick:controls.substeps,additionalBodySubsteps:0,internalPgsIterations:controls.pgs,
      ticks,integratedSubsteps:ticks*controls.substeps,sampleCount:sample,errors,closure:{maxTranslation,maxRotation},signals};
  } finally {world?.free();}
}
const controlsDefaults={dt:DEFAULTS.dt,substeps:4,pgs:1,centered:false,balanced:false,vertical:false};
export function diagnosticSummary(run) {
  const {signals,...summary}=run;
  const values=Object.fromEntries(Object.entries(signals).map(([k,v])=>[k,Array.from(v)]));
  return {...summary,traceSha256:createHash('sha256').update(JSON.stringify(values)).digest('hex')};
}
