// Diagnostic release of a fixed-orientation hub. See TRANSLATING_HUB_PLAN.md.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {getRuntime,geometryLimits,validate as wheelParameters} from '../dist/moving-wheel.js';
import {validate,modelXML as fixtureXML,PLANE_NUMERICS} from '../dist/tyre-fixture.js';
import {checkFlatVertexContacts} from '../dist/flat-vertex-contact.js';
import {STAGE_WORK,STAGE_BUDGETS,hasNativeWarning,nativeWarnings} from '../dist/casing-rk4-observer.js';
import {NATIVE_BUILD} from '../dist/trail-initial-state.js';
import {LOADED_BUDGETS} from './casing-loaded.mjs';
import {createContactStepper,CONTACT_STEP} from './casing-contact-step.mjs';

export const MODEL='bikelab-translating-hub-rk4-diagnostic-0.1';
export const CONTACT_MODEL='bikelab-translating-hub-contact-rk4-diagnostic-0.1';
export const NORMAL_ORACLE='bikelab-flat-normal-oracle-0.1';
export const STEPS=Object.freeze([.000001953125,.0000009765625,.00000048828125]);
export const BUDGETS=Object.freeze({mass:1e-12,force:1e-8,energy:1e-10,power:1e-8,balance:1e-8,gapRate:1e-9,momentum:1e-8,normalForce:1e-7,referenceAcceleration:1e-7,regularizer:1e-12});
const hash=x=>createHash('sha256').update(x).digest('hex');
const require=(ok,message)=>{if(!ok)throw Error(message);};

function fixedXML(a,dt){
 const b={...a,numerics:{...PLANE_NUMERICS},motion:{dt:STEPS[0],duration:.02,sampleDt:.000125}};delete b.measurement;
 return fixtureXML(b).replace(/timestep="[^"]*"/,'timestep="'+dt+'"');
}
export function translationXML(input,dt=STEPS[0],contactSubsteps=false){
 const a=validate(input);require(STEPS.includes(dt),'Unsupported translation timestep');require(typeof contactSubsteps==='boolean','Invalid contact policy');const w=a.seed.wheel,base=fixedXML(a,dt),xml=contactSubsteps?base.replace(/ tolerance="[^"]*"/,' tolerance="'+CONTACT_STEP.solverTolerance+'"'):base;
 require((xml.match(/<body name="hub"/g)||[]).length===1,'Expected one hub');
 return xml.replace(/(<body name="hub"[^>]*>)/,'$1'+`<inertial pos="0 0 0" mass="${w.hubMass}" diaginertia="${w.hubInertia} ${w.hubInertia} ${w.hubInertia}"/><joint name="hub_u" type="slide" axis="1 0 0" damping="0" stiffness="0"/><joint name="hub_v" type="slide" axis="0 0 1" damping="0" stiffness="0"/>`);
}

function compiledContact(m,d){
 return {bodySimple:Array.from(m.body_simple),bodyInverseWeight:Array.from(m.body_invweight0),rows:Array.from({length:d.nefc},(_,i)=>({type:d.efc_type[i],diagonalApproximation:d.efc_diagA[i],regularizer:d.efc_R[i]}))};
}

// The full matrix is checked once; all subsequent Newton checks use the
// independently derived O(N) coupled operator and absolute node velocities.
export function createTranslationGuard(mj,m,initial,input){
 const n=input.seed.wheel.nodes,nv=2*n+2,id=(kind,name)=>{const x=mj.mj_name2id(m,kind,name);require(x>=0,'Missing '+name);return x;},hub=id(mj.mjtObj.mjOBJ_BODY.value,'hub');
 const wheel=wheelParameters({...input.seed.wheel,dt:.0000078125}),hubMass=m.body_mass[hub],masses=new Float64Array(n),forces=new Float64Array(2*n),velocity=new Float64Array(2*n),normal=new Float64Array(n),contactMask=new Uint8Array(n),seen=new Uint8Array(n),hubPoint=new Float64Array(2),limits={};
 assert.equal(m.nq,nv);assert.equal(m.nv,nv);assert.equal(m.njnt,nv);assert.equal(m.nflex,1);assert.equal(m.nflexedge,n);assert.equal(m.flex_vertadr[0],0);assert.equal(m.flex_edgeadr[0],0);assert.equal(m.body_parentid[hub],0);assert.equal(m.body_jntnum[hub],2);assert.equal(hubMass,input.seed.wheel.hubMass);
 require(m.opt.gravity[0]===0&&m.opt.gravity[1]===0&&m.opt.gravity[2]===-input.seed.gravity,'Unexpected gravity');assert.equal(m.dof_damping.some(x=>x!==0),false);
 assert.equal(m.opt.integrator,mj.mjtIntegrator.mjINT_RK4.value);assert.equal(m.opt.enableflags & mj.mjtEnableBit.mjENBL_DIAGEXACT.value,0);assert.equal(m.nu,0);assert.equal(m.neq,0);assert.equal(m.ntendon,0);
 const impedance=wheel.contactImpedance,tau=wheel.contactTime,referenceDamping=2/(impedance*tau),referenceStiffness=1/(impedance*tau*tau),groundHeight=input.seed.profile.points[0][1];
 require(tau>=2*m.opt.timestep,'Unsupported reference safety adjustment');
 for(let j=0;j<nv;j++){
  assert.equal(m.jnt_type[j],mj.mjtJoint.mjJNT_SLIDE.value);assert.equal(m.jnt_qposadr[j],j);assert.equal(m.jnt_dofadr[j],j);assert.equal(m.jnt_limited[j],0);assert.equal(m.qpos_spring[j],0);assert.deepEqual(Array.from(m.jnt_axis.slice(3*j,3*j+3)),j%2?[0,0,1]:[1,0,0]);
  if(j<2){assert.equal(m.jnt_bodyid[j],hub);assert.equal(m.jnt_stiffness[j],0);}
 }
 let tyreMass=0;
 for(let i=0;i<n;i++){
  const body=id(mj.mjtObj.mjOBJ_BODY.value,'casing_n'+i);assert.equal(m.body_parentid[body],hub);assert.equal(m.flex_vertbodyid[i],body);assert.equal(m.body_jntnum[body],2);assert.equal(m.jnt_bodyid[2+2*i],body);assert.equal(m.jnt_bodyid[3+2*i],body);assert.deepEqual(Array.from(m.body_quat.slice(4*body,4*body+4)),[1,0,0,0]);
  masses[i]=m.body_mass[body];tyreMass+=masses[i];require(m.body_simple[body]!==2,'Expected general translating node');require(Math.abs(m.body_invweight0[2*body]-2/(3*masses[i]))<1e-10,'Unexpected planar inverse weight');
 }
 const totalMass=hubMass+tyreMass,buffer=new mj.DoubleBuffer(nv*nv);let massError=0;
 try{mj.mj_fullM(m,initial,buffer);const full=buffer.GetView();for(let r=0;r<nv;r++)for(let c=0;c<nv;c++){
  const expected=r%2!==c%2?0:r<2&&c<2?totalMass:r<2?masses[(c-2)>>1]:c<2?masses[(r-2)>>1]:r===c?masses[(r-2)>>1]:0;
  massError=Math.max(massError,Math.abs(full[r*nv+c]-expected));
 }}finally{buffer.delete();}require(massError<=BUDGETS.mass,'Coupled mass matrix mismatch');
 const metrics={force:0,energy:0,power:0,balance:0,gapRate:0,normalForce:0,referenceAcceleration:0,regularizer:0},keys=Object.keys(metrics),o={energy:0,kineticEnergy:0,elasticEnergy:0,lossPower:0,contactPower:0,verticalForce:0,contacts:0,loadedRows:0,minimumGap:0,minimumGapVelocity:0,contactMask,hub:hubPoint,momentum:new Float64Array(2),hubReaction:new Float64Array(2),metrics,limits};
 // Attempted warning/solver counters are not integration state and survive rollback.
 function observe(d,previous,restoring=false){
  if(!restoring){require(!hasNativeWarning(d),'Native warning');for(let i=0;i<d.solver_niter.length;i++)require(d.solver_niter[i]<m.opt.iterations,'Native solver iteration limit');}require(d.ncon<=256,'Contact capacity limit');
  const q=d.qpos,v=d.qvel,acc=d.qacc,xyz=d.flexvert_xpos,R=d.xmat,ri=9*hub,xx=R[ri],xz=R[ri+2],zx=R[ri+6],zz=R[ri+8],g=input.seed.gravity,gx=-g*zx,gz=-g*zz;
  for(let j=0;j<nv;j++)require(Number.isFinite(q[j])&&Number.isFinite(v[j])&&Number.isFinite(acc[j]),'Nonfinite translation state');
  hubPoint[0]=d.xpos[3*hub];hubPoint[1]=d.xpos[3*hub+2];geometryLimits(wheel,input.seed.profile,hubPoint,xyz,previous,limits);require(!limits.reason,'Translation geometry: '+limits.reason);checkFlatVertexContacts(mj,m,d,0,n);
  let kinetic=.5*hubMass*(v[0]**2+v[1]**2),gravity=hubMass*g*hubPoint[1],elastic=0,lossPower=0,nativeLoss=0,contactPower=0,nodePower=0,rowPower=0,forceError=0,balance=0,gapRate=0,ground=0,px=totalMass*v[0],pz=totalMass*v[1],sumFx=0,sumFz=0,hubMaX=totalMass*acc[0],hubMaZ=totalMass*acc[1];normal.fill(0);seen.fill(0);contactMask.fill(0);o.minimumGap=Infinity;o.loadedRows=0;
  for(let i=0;i<n;i++){
   const u=2+2*i,z=u+1,mi=masses[i],vx=v[0]+v[u],vz=v[1]+v[z];require(Math.hypot(q[u],q[z])<=wheel.maxDisplacement,'Casing displacement limit');
   kinetic+=.5*mi*(vx*vx+vz*vz);gravity+=mi*g*xyz[3*i+2];velocity[2*i]=xx*vx+xz*vz;velocity[2*i+1]=zx*vx+zz*vz;const gap=xyz[3*i+2]-m.flex_radius[0]-groundHeight;if(gap<o.minimumGap){o.minimumGap=gap;o.minimumGapVelocity=velocity[2*i+1];}px+=mi*v[u];pz+=mi*v[z];hubMaX+=mi*acc[u];hubMaZ+=mi*acc[z];
   for(let axis=0;axis<2;axis++){const j=u+axis;forces[2*i+axis]=-m.jnt_stiffness[j]*q[j];elastic+=.5*m.jnt_stiffness[j]*q[j]**2;balance=Math.max(balance,Math.abs(mi*(acc[axis]+acc[j])-d.qfrc_smooth[j]-d.qfrc_constraint[j]));}
  }
  for(let e=0;e<n;e++){
   const a=m.flex_edge[2*e],b=m.flex_edge[2*e+1],dx=xyz[3*b]-xyz[3*a],dz=xyz[3*b+2]-xyz[3*a+2],length=Math.hypot(dx,dz),rest=m.flexedge_length0[e],extension=length-rest;require(length>1e-12&&Math.abs(extension/rest)<=wheel.maxStrain,'Casing strain limit');
   const ex=dx/length,ez=dz/length,rate=ex*(velocity[2*b]-velocity[2*a])+ez*(velocity[2*b+1]-velocity[2*a+1]),f=m.flex_edgestiffness[0]*extension+m.flex_edgedamping[0]*rate,fu=f*(xx*ex+zx*ez),fv=f*(xz*ex+zz*ez);
   forces[2*a]+=fu;forces[2*a+1]+=fv;forces[2*b]-=fu;forces[2*b+1]-=fv;elastic+=.5*m.flex_edgestiffness[0]*extension**2;lossPower+=m.flex_edgedamping[0]*rate**2;
  }
  // Source-derived, non-metric normal law: see CASING_TRANSLATE.md. Use our
  // geometry, absolute velocities, internal forces and mass, not native aref/R.
  // Absent/excluded vertices remain zero: closing speed alone is not contact.
  let normalForceError=0,referenceError=0,regularizerError=0,activeRows=0;
  const list=d.contact;try{for(let i=0;i<list.size();i++){const c=list.get(i);try{
   const side=c.flex[0]===0?0:1,node=c.vert[side],row=c.efc_address;require(!seen[node],'Duplicate vertex contact');seen[node]=1;
   require(c.adhesion===0&&c.includemargin===0,'Unsupported contact adhesion/margin');
   require(Math.abs(c.solref[0]-tau)<1e-15&&c.solref[1]===1&&Math.abs(c.solimp[0]-impedance)<1e-15&&Math.abs(c.solimp[1]-impedance)<1e-15,'Unsupported normal law parameters');
   if(row<0){require(c.exclude!==0&&c.dist>=c.includemargin,'Unexpected excluded normal contact');continue;}
   require(c.exclude===0&&c.dist<c.includemargin&&row===activeRows++,'Unexpected active normal row');
   const gap=xyz[3*node+2]-m.flex_radius[0]-groundHeight,mi=masses[node],vz=velocity[2*node+1],regularizer=2/(3*mi)*(1-impedance)/impedance,aref=-referenceDamping*vz-referenceStiffness*gap,smooth=(zx*forces[2*node]+zz*forces[2*node+1])/mi-g,predicted=Math.max(0,(aref-smooth)/(1/mi+regularizer));
   require(Math.abs(d.efc_pos[row]-gap)<=1e-10&&d.efc_margin[row]===0,'Normal row gap/margin mismatch');
   normalForceError=Math.max(normalForceError,Math.abs(predicted-d.efc_force[row]));referenceError=Math.max(referenceError,Math.abs(aref-d.efc_aref[row]));regularizerError=Math.max(regularizerError,Math.abs(regularizer-d.efc_R[row]));
   contactMask[node]=1;normal[node]=d.efc_force[row];if(normal[node]>0)o.loadedRows++;ground+=normal[node];nodePower+=normal[node]*vz;gapRate=Math.max(gapRate,Math.abs(d.efc_vel[row]-vz));
  }finally{c.delete();}}}finally{list.delete();}require(activeRows===d.nefc,'Unaccounted normal rows');
  for(let j=0;j<nv;j++){contactPower+=d.qfrc_constraint[j]*v[j];nativeLoss-=d.qfrc_damper[j]*v[j];}
  for(let i=0;i<d.nefc;i++){require(d.efc_type[i]===mj.mjtConstraint.mjCNSTR_CONTACT_FRICTIONLESS.value&&Number.isFinite(d.efc_force[i])&&d.efc_force[i]>=0,'Unsupported normal contact');rowPower+=d.efc_force[i]*d.efc_vel[i];}
  for(let i=0;i<n;i++){
   const u=2+2*i,mi=masses[i];sumFx+=forces[2*i];sumFz+=forces[2*i+1];
   forceError=Math.max(forceError,Math.abs(forces[2*i]-d.qfrc_passive[u]),Math.abs(forces[2*i+1]-d.qfrc_passive[u+1]),Math.abs(d.qfrc_bias[u]+mi*gx),Math.abs(d.qfrc_bias[u+1]+mi*gz),Math.abs(d.qfrc_constraint[u]-zx*normal[i]),Math.abs(d.qfrc_constraint[u+1]-zz*normal[i]));
  }
  forceError=Math.max(forceError,Math.abs(d.qfrc_passive[0]),Math.abs(d.qfrc_passive[1]),Math.abs(d.qfrc_bias[0]+totalMass*gx),Math.abs(d.qfrc_bias[1]+totalMass*gz),Math.abs(d.qfrc_constraint[0]-zx*ground),Math.abs(d.qfrc_constraint[1]-zz*ground));
  balance=Math.max(balance,Math.abs(hubMaX-d.qfrc_smooth[0]-d.qfrc_constraint[0]),Math.abs(hubMaZ-d.qfrc_smooth[1]-d.qfrc_constraint[1]),Math.abs(hubMass*(acc[0]-gx)+sumFx),Math.abs(hubMass*(acc[1]-gz)+sumFz));
  mj.mj_energyPos(m,d);mj.mj_energyVel(m,d);o.energy=kinetic+elastic+gravity;o.kineticEnergy=kinetic;o.elasticEnergy=elastic;o.lossPower=lossPower;o.contactPower=contactPower;o.verticalForce=ground;o.contacts=d.ncon;o.momentum[0]=xx*px+xz*pz;o.momentum[1]=zx*px+zz*pz;o.hubReaction[0]=-xx*sumFx-xz*sumFz;o.hubReaction[1]=-zx*sumFx-zz*sumFz;
  metrics.force=forceError;metrics.energy=Math.abs(o.energy-d.energy[0]-d.energy[1]);metrics.power=Math.max(Math.abs(lossPower-nativeLoss),Math.abs(contactPower-nodePower),Math.abs(contactPower-rowPower));metrics.balance=balance;metrics.gapRate=gapRate;metrics.normalForce=normalForceError;metrics.referenceAcceleration=referenceError;metrics.regularizer=regularizerError;
  for(const key of keys)if(!Number.isFinite(metrics[key])||metrics[key]>BUDGETS[key])throw Error('Independent translation '+key+' mismatch: '+metrics[key]+' (limit '+BUDGETS[key]+')');require(o.momentum.every(Number.isFinite)&&o.hub.every(Number.isFinite),'Nonfinite momentum/hub');return o;
 }
 return {observe,observation:o,hubMass,tyreMass,totalMass,massError};
}

export async function runTranslation(input,options={}){
 require(options&&[Object.prototype,null].includes(Object.getPrototypeOf(options)),'Translation options must be a plain object');
 for(const key of Reflect.ownKeys(options)){const d=Object.getOwnPropertyDescriptor(options,key);require(['dt','duration','hubVelocity','onProgress','comparison','contactSubsteps','traceContacts'].includes(key)&&d.enumerable&&Object.hasOwn(d,'value'),'Unknown or non-data translation option');}
 const {dt=STEPS[0],duration=.001,hubVelocity=[0,0],onProgress,comparison=false,contactSubsteps=false,traceContacts=false}=options;require(STEPS.includes(dt),'Unsupported translation timestep');require([.000125,.001,.005,.02].includes(duration),'Unsupported translation horizon');require(Array.isArray(hubVelocity)&&Object.getPrototypeOf(hubVelocity)===Array.prototype&&hubVelocity.length===2&&Reflect.ownKeys(hubVelocity).length===3&&[0,1].every(i=>{const d=Object.getOwnPropertyDescriptor(hubVelocity,String(i));return d&&Object.hasOwn(d,'value')&&Number.isFinite(d.value)&&Math.abs(d.value)<=1;}),'Invalid hub-local velocity');require(onProgress===undefined||typeof onProgress==='function','Invalid progress callback');require(typeof comparison==='boolean'&&typeof contactSubsteps==='boolean'&&typeof traceContacts==='boolean','Invalid diagnostic flag');
 const a=validate(input),velocity=[...hubVelocity],xml=translationXML(a,dt,contactSubsteps),mj=await getRuntime();let m,d,stepper;
 try{
  m=mj.MjModel.from_xml_string(xml);d=new mj.MjData(m);d.qpos.set(a.seed.q,2);if(a.rates==='imported')d.qvel.set(a.seed.v,2);d.qvel.set(velocity);mj.mj_forward(m,d);
  const guard=createTranslationGuard(mj,m,d,a),stageGuard=createTranslationGuard(mj,m,d,a),o=guard.observe(d),initialEnergy=o.energy,initialMomentum=Array.from(o.momentum),compiled={...(contactSubsteps?{solverTolerance:m.opt.tolerance}:{}),translating:compiledContact(m,d),massError:guard.massError,hubMass:guard.hubMass,tyreMass:guard.tyreMass,totalMass:guard.totalMass,foundationStiffness:Array.from(m.jnt_stiffness.slice(2))};
  let fixed,fixedData;try{fixed=mj.MjModel.from_xml_string(fixedXML(a,dt));fixedData=new mj.MjData(fixed);fixedData.qpos.set(a.seed.q);if(a.rates==='imported')fixedData.qvel.set(a.seed.v);mj.mj_forward(fixed,fixedData);compiled.fixed=compiledContact(fixed,fixedData);}finally{fixedData?.delete();fixed?.delete();}
  const steps=Math.round(duration/dt),stride=Math.round(.000125/dt),progressStride=Math.max(1,Math.ceil(steps/10)),frames=Array.from({length:steps/stride+2},()=>({q:new Float64Array(m.nq),v:new Float64Array(m.nv),hub:new Float64Array(2),momentum:new Float64Array(2),hubReaction:new Float64Array(2)})),maxObserver=Object.fromEntries(Object.keys(STAGE_BUDGETS).map(k=>[k,0])),maxIndependent={...o.metrics};
  const observerKeys=Object.keys(maxObserver),metricKeys=Object.keys(maxIndependent);let count=0,accepted=0,loss=0,work=0,impulse=0,termination=null,maxResidual=0,maxMomentumError=0,minContacts=o.contacts,maxContacts=o.contacts;
  stepper=createContactStepper(mj,m,d,guard,stageGuard,{adaptive:contactSubsteps,trace:traceContacts,steps});
  const width=2*m.nv+4,comparisonStride=Math.round(STEPS[0]/dt),trajectory=comparison?new Float64Array((Math.round(duration/STEPS[0])+1)*width):null;let comparisonCount=0;
  const compareSample=()=>{if(!trajectory)return;const offset=comparisonCount++*width;trajectory.set(d.qpos,offset);trajectory.set(d.qvel,offset+m.nv);trajectory[offset+2*m.nv]=o.verticalForce;trajectory[offset+2*m.nv+1]=impulse;trajectory[offset+2*m.nv+2]=loss;trajectory[offset+2*m.nv+3]=work;};
  const record=()=>{const f=frames[count++];f.q.set(d.qpos);f.v.set(d.qvel);f.hub.set(o.hub);f.momentum.set(o.momentum);f.hubReaction.set(o.hubReaction);Object.assign(f,{tick:accepted,time:d.time,energy:o.energy,kineticEnergy:o.kineticEnergy,dampingLoss:loss,contactWork:work,verticalImpulse:impulse,residual:o.energy-initialEnergy+loss-work,verticalForce:o.verticalForce,contacts:o.contacts});};record();compareSample();onProgress?.(0,steps);
  for(let tick=1;tick<=steps;tick++){
   let prediction;
   try{prediction=stepper.advance(loss,work,impulse);}
   catch(error){termination={attemptedTick:tick,reason:error.message};break;}
   accepted=tick;loss+=prediction.loss;work+=prediction.contactWork;impulse+=prediction.verticalImpulse;for(const k of metricKeys)maxIndependent[k]=Math.max(maxIndependent[k],prediction.maxIndependent[k]);for(const k of observerKeys)maxObserver[k]=Math.max(maxObserver[k],prediction.maxObserver[k]);minContacts=Math.min(minContacts,prediction.minContacts);maxContacts=Math.max(maxContacts,prediction.maxContacts);
   maxResidual=Math.max(maxResidual,prediction.maxResidual);maxMomentumError=Math.max(maxMomentumError,prediction.maxMomentumError);
   if(tick%stride===0)record();if(tick%comparisonStride===0)compareSample();if(tick%progressStride===0)onProgress?.(tick,steps);
  }
  if(frames[count-1].tick!==accepted)record();onProgress?.(accepted,steps);
  return {model:contactSubsteps?CONTACT_MODEL:MODEL,...(contactSubsteps?{contactStep:CONTACT_STEP}:{}),normalOracle:NORMAL_ORACLE,nativeBuild:NATIVE_BUILD,stageWork:STAGE_WORK,scope:'Fixed orientation, two hub translations plus relative casing slides. Authored hub and casing mass only; no spin, bike/rider load, equilibrium, physical calibration or full contact-transition qualification.',input:a,diagnostic:{dt,duration,hubVelocity:velocity,contact:'plane-vertices; compiled regularization recorded, not fixed-hub compliance parity'},xmlSha256:hash(xml),compiled,budgets:{observer:STAGE_BUDGETS,independent:BUDGETS,refinement:LOADED_BUDGETS},status:termination?'terminated':'completed',termination,nativeWarnings:nativeWarnings(d),observerWarnings:nativeWarnings(stepper.observer.data),summary:{steps:accepted,initialEnergy,initialMomentum,maxResidual,maxMomentumError,maxObserver,maxIndependent,minContacts,maxContacts,...(contactSubsteps?{stepping:{...stepper.stats}}:{})},frames:frames.slice(0,count).map(f=>({...f,q:Array.from(f.q),v:Array.from(f.v),hub:Array.from(f.hub),momentum:Array.from(f.momentum),hubReaction:Array.from(f.hubReaction)})),finalState:{q:Array.from(d.qpos),v:Array.from(d.qvel),warmstart:Array.from(d.qacc_warmstart)},...(traceContacts?{contactTrace:stepper.trace()}:{}),...(comparison?{comparison:{dt:STEPS[0],count:comparisonCount,width,trajectory}}:{})};
 }finally{stepper?.dispose();d?.delete();m?.delete();}
}

export function compareTranslation(a,b,fraction=1){
 assert.equal(a.status,'completed');assert.equal(b.status,'completed');assert.equal(a.model,b.model);assert.equal(a.nativeBuild,b.nativeBuild);assert.equal(a.normalOracle,b.normalOracle);assert.deepEqual(a.contactStep,b.contactStep);assert.equal(a.compiled.solverTolerance,b.compiled.solverTolerance);assert.equal(a.diagnostic.dt,2*b.diagnostic.dt,'Refinement requires a timestep halving');assert.deepEqual(a.input,b.input);assert.deepEqual(a.diagnostic.hubVelocity,b.diagnostic.hubVelocity);assert.equal(a.diagnostic.duration,b.diagnostic.duration);assert.ok([1,.1].includes(fraction));assert.equal(a.comparison.count,b.comparison.count);assert.equal(a.comparison.width,b.comparison.width);assert.equal(a.comparison.dt,b.comparison.dt);
 const nv=a.finalState.q.length,width=a.comparison.width,maxima={position:0,velocity:0,force:0,impulse:0,loss:0,work:0,residual:Math.max(a.summary.maxResidual,b.summary.maxResidual)},names=['force','impulse','loss','work'];
 for(let i=0;i<a.comparison.count;i++){const o=i*width;for(let j=0;j<nv;j++){maxima.position=Math.max(maxima.position,Math.abs(a.comparison.trajectory[o+j]-b.comparison.trajectory[o+j]));maxima.velocity=Math.max(maxima.velocity,Math.abs(a.comparison.trajectory[o+nv+j]-b.comparison.trajectory[o+nv+j]));}const av=a.comparison.trajectory,bv=b.comparison.trajectory;
  // R is fixed and orthogonal: world-vector error norm equals the local norm.
  // A physical node moves with h + u, not u alone.
  for(let offset=0;offset<=nv;offset+=nv){const dx=av[o+offset]-bv[o+offset],dz=av[o+offset+1]-bv[o+offset+1],key=offset?'velocity':'position';maxima[key]=Math.max(maxima[key],Math.hypot(dx,dz));for(let j=2;j<nv;j+=2)maxima[key]=Math.max(maxima[key],Math.hypot(dx+av[o+offset+j]-bv[o+offset+j],dz+av[o+offset+j+1]-bv[o+offset+j+1]));}
  for(let j=0;j<4;j++)maxima[names[j]]=Math.max(maxima[names[j]],Math.abs(av[o+2*nv+j]-bv[o+2*nv+j]));} 
 return {stateBasis:'Maximum generalized component and absolute world hub/node vector errors',coarseDt:a.diagnostic.dt,fineDt:b.diagnostic.dt,samples:a.comparison.count,budgetFraction:fraction,maxima,withinBudgets:Object.entries(maxima).every(([k,v])=>v<=fraction*LOADED_BUDGETS[k])};
}

async function main(){
 require(process.argv.length<=4,'Usage: node scripts/casing-translate.mjs [output-directory] [.001|.005|.02]');const dir=resolve(process.argv[2]??'artifacts/casing-translate'),duration=Number(process.argv[3]??.001);require([.001,.005,.02].includes(duration),'Unsupported study duration');await mkdir(dir,{recursive:true});
 const sources=['scripts/casing-contact-step.mjs','scripts/casing-translate.mjs','scripts/casing-loaded.mjs','dist/trail-initial-state.js','dist/casing-rk4-observer.js','dist/flat-vertex-contact.js','dist/tyre-fixture.js','dist/moving-wheel.js','dist/tyre-fixture-examples.json','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm'],sourceHashes=async()=>Object.fromEntries(await Promise.all(sources.map(async path=>[path,hash(await readFile(new URL('../'+path,import.meta.url)))]))),sourcesSha256=await sourceHashes(),examples=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))),cases=[],refinement=[];
 for(const example of examples.cases)for(const rates of ['imported','zero']){let previous;for(const dt of STEPS){const input=structuredClone(example.input);input.rates=rates;const name=example.name+'-'+rates+'-'+STEPS.indexOf(dt);console.log('starting',name);const result=await runTranslation(input,{dt,duration,comparison:true,onProgress:(tick,total)=>console.log(name,Math.round(100*tick/total)+'%')}),{comparison,...record}=result,bytes=JSON.stringify(record,null,2)+'\n',file=name+'.json';await writeFile(join(dir,file),bytes);const {frames,finalState,...summary}=record;cases.push({file,sha256:hash(bytes),...summary});if(previous&&previous.status==='completed'&&result.status==='completed')refinement.push({name,...compareTranslation(previous,result,dt===STEPS[2]?.1:1)});previous=result;console.log('completed',name,result.status,result.summary.maxResidual);}}
 const sourcesUnchanged=JSON.stringify(await sourceHashes())===JSON.stringify(sourcesSha256);await writeFile(join(dir,'report.json'),JSON.stringify({model:MODEL,duration,cases,refinement,sourcesSha256,sourcesUnchanged},null,2)+'\n');if(!sourcesUnchanged||cases.some(c=>c.status!=='completed'||c.summary.maxMomentumError>BUDGETS.momentum)||refinement.length!==16||refinement.some(r=>!r.withinBudgets))process.exitCode=2;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
