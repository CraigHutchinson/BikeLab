import {travelBuffer} from './travel-buffer.js';
import loadMujoco from './vendor/mujoco-3.16.0/mujoco.js';

export const MODEL = 'bikelab-planar-rig-0.4';
export const FORK_BUFFER_MODEL = 'bikelab-planar-rig-0.3';
export const PREVIOUS_MODEL = 'bikelab-planar-rig-0.2';
export const LEGACY_MODEL = 'bikelab-planar-rig-0.1';
export const G = 9.80665;
export const GEOMETRY = Object.freeze({radius:.36, frameHeight:.65, headAngle:65*Math.PI/180,
  frontX:.70, axleZ:-.29, rearX:-.45, pivotZ:-.15, armZ:-.14,
  shockFrameX:-.08, shockFrameZ:.15, shockArmX:-.20, shockArmZ:-.03,
  forkTravel:.16, shockTravel:.065, rearAngleMax:.4, wheelMass:3, rearMass:4, frameInertia:8});
export const DEFAULTS = Object.freeze({bike:'full',mass:82,rider:'fixed',riderMass:70,
  riderStiffness:12000,riderDamping:900,riderTravel:.15,forkBuffer:'none',forkBufferWidth:.02,forkBufferStiffness:300000,forkBufferDamping:1500,forkStiffness:9000,forkDamping:700,
  shockBuffer:'none',shockBufferWidth:.008,shockBufferStiffness:1000000,shockBufferDamping:3000,shockStiffness:70000,shockDamping:2400,tyreStiffness:90000,tyreDamping:300,
  amplitude:.025,bumpDuration:.4,delay:.25,input:'travelling',duration:4,dt:.000125,sampleDt:.005});
const shockBufferKeys=['shockBuffer','shockBufferWidth','shockBufferStiffness','shockBufferDamping'];
const bufferKeys=['forkBuffer','forkBufferWidth','forkBufferStiffness','forkBufferDamping'];
const riderKeys=['rider','riderMass','riderStiffness','riderDamping','riderTravel'];
const bounds={shockBufferWidth:[.002,.012],shockBufferStiffness:[100000,4000000],shockBufferDamping:[0,12000],forkBufferWidth:[.005,.03],forkBufferStiffness:[50000,1000000],forkBufferDamping:[0,4000],mass:[40,120],riderMass:[20,100],riderStiffness:[4000,40000],riderDamping:[0,3000],riderTravel:[.02,.25],forkStiffness:[4000,18000],forkDamping:[0,1800],shockStiffness:[30000,150000],
  shockDamping:[0,5000],tyreStiffness:[40000,160000],tyreDamping:[0,600],amplitude:[0,.08],
  bumpDuration:[.2,1],delay:[0,1],duration:[2,8],dt:[.00003125,.00025],sampleDt:[.0025,.02]};
export function validate(input={}) {
  if(!input || typeof input!=='object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input)))throw new Error('Setup must be an object.');
  for(const key of Object.keys(input))if(!Object.hasOwn(DEFAULTS,key))throw new Error('Unknown setup parameter: '+key);
  const p={...DEFAULTS,...input};
  if(!['none','progressive'].includes(p.shockBuffer))throw new Error('Unknown shock buffer mode.');
  if(!['none','progressive'].includes(p.forkBuffer))throw new Error('Unknown fork buffer mode.');
  if(!['fixed','compliant'].includes(p.rider))throw new Error('Unknown rider mode.');
  if(p.rider==='compliant'&&p.mass-p.riderMass<5)throw new Error('Rider mass must leave at least 5 kg of frame mass.');
  if(!['full','hardtail'].includes(p.bike))throw new Error('Unknown bike.');
  if(!['travelling','together','front','rear'].includes(p.input))throw new Error('Unknown platen input.');
  for(const [key,[lo,hi]] of Object.entries(bounds))if(!Number.isFinite(p[key])||p[key]<lo||p[key]>hi)throw new Error(`${key} must be between ${lo} and ${hi} (SI).`);
  for(const n of [p.sampleDt/p.dt,p.duration/p.sampleDt,4/p.dt])if(Math.abs(n-Math.round(n))>1e-7)throw new Error('Time intervals must align with the fixed step.');
  return Object.freeze(p);
}
export function shockLength(angle) {
  const g=GEOMETRY,c=Math.cos(angle),s=Math.sin(angle);
  return Math.hypot(c*g.shockArmX+s*g.shockArmZ-g.shockFrameX,
    g.pivotZ-s*g.shockArmX+c*g.shockArmZ-g.shockFrameZ);
}
// Compression s=L(0)-L(theta); ds/dtheta maps axial force into swing moment.
export function shockCompressionJacobian(angle) {
  const g=GEOMETRY,c=Math.cos(angle),s=Math.sin(angle);
  const x=c*g.shockArmX+s*g.shockArmZ-g.shockFrameX;
  const z=g.pivotZ-s*g.shockArmX+c*g.shockArmZ-g.shockFrameZ;
  const dx=-s*g.shockArmX+c*g.shockArmZ,dz=-c*g.shockArmX-s*g.shockArmZ;
  return -(x*dx+z*dz)/Math.hypot(x,z);
}
// Caller-owned outputs: front height/velocity, rear height/velocity.
export function platens(p,t,out) {
  out.fill(0);
  for(let wheel=0;wheel<2;wheel++) {
    if((p.input==='front'&&wheel===1)||(p.input==='rear'&&wheel===0))continue;
    const start=1+(wheel===1&&p.input==='travelling'?p.delay:0),u=(t-start)/p.bumpDuration;
    if(u<=0||u>=1)continue;
    const s=Math.sin(Math.PI*u),c=Math.cos(Math.PI*u);
    out[2*wheel]=p.amplitude*s**4;
    out[2*wheel+1]=4*p.amplitude*Math.PI/p.bumpDuration*s**3*c;
  }
}
export function modelXML(p) {
  const g=GEOMETRY,compliant=p.rider==='compliant',frameMass=compliant?p.mass-p.riderMass:p.mass;
  const frameInertia=g.frameInertia*frameMass/p.mass,riderInertia=g.frameInertia*p.riderMass/p.mass;
  // Append this child after the original front/rear tree; their legacy addresses remain unchanged.
  const rider=compliant?`<body name="rider"><joint name="riderSlide" type="slide" axis="0 0 1" springref="0" stiffness="${p.riderStiffness}" damping="${p.riderDamping}"/>
    <inertial pos="0 0 0" mass="${p.riderMass}" diaginertia="${riderInertia} ${riderInertia} ${riderInertia}"/></body>`:'';
  const rear=p.bike==='full'?`<body name="rear" pos="0 0 ${g.pivotZ}"><joint name="swing" type="hinge" axis="0 1 0"/>
    <inertial pos="${g.rearX} 0 ${g.armZ}" mass="${g.rearMass}" diaginertia=".13 .13 .13"/>
    <site name="shockArm" pos="${g.shockArmX} 0 ${g.shockArmZ}"/></body>`:
    `<body name="rear" pos="${g.rearX} 0 ${g.axleZ}"><inertial pos="0 0 0" mass="${g.rearMass}" diaginertia=".13 .13 .13"/></body>`;
  return `<mujoco model="BikeLab illustrative ${p.bike}"><compiler angle="radian" fusestatic="false"/>
    <option timestep="${p.dt}" gravity="0 0 -${G}" integrator="implicitfast"/>
    <worldbody><body name="frame" pos="0 0 ${g.frameHeight}">
    <joint name="heave" type="slide" axis="0 0 1"/><joint name="pitch" type="hinge" axis="0 1 0"/>
    <inertial pos="0 0 0" mass="${frameMass}" diaginertia="${frameInertia} ${frameInertia} ${frameInertia}"/>
    <site name="shockFrame" pos="${g.shockFrameX} 0 ${g.shockFrameZ}"/>
    <body name="front" pos="${g.frontX} 0 ${g.axleZ}">
      <joint name="fork" type="slide" axis="${-Math.cos(g.headAngle)} 0 ${Math.sin(g.headAngle)}" stiffness="${p.forkStiffness}" damping="${p.forkDamping}"/>
      <inertial pos="0 0 0" mass="${g.wheelMass}" diaginertia=".1 .1 .1"/>
    </body>${rear}${rider}</body></worldbody>
    ${p.bike==='full'?`<tendon><spatial name="shock" stiffness="${p.shockStiffness}" damping="${p.shockDamping}" springlength="${shockLength(0)}"><site site="shockFrame"/><site site="shockArm"/></spatial></tendon>`:''}</mujoco>`;
}
let runtime;
export function getRuntime(){return runtime??=loadMujoco();}
const names=['time','heave','pitch','fork','shock','rearAngle','frontX','frontZ','rearX','rearZ','frontBase','rearBase',
  'shockBufferForce','shockTopForce','shockBottomForce','shockBufferEnergy','shockBufferDissipation','shockBufferMoment','shockTotalForce','shockLeverage','forkBufferForce','forkTopForce','forkBottomForce','forkBufferEnergy','forkBufferDissipation','frontForce','rearForce','shockForce','riderCompression','riderVelocity','riderForce','riderX','riderZ','riderDissipation','energy','work','dissipation','residual','speed'];

// Entire integration and observation path is shared by the worker and CLI.
export async function runRig(input={}) {
  const p=validate(input),g=GEOMETRY,mj=await getRuntime();
  let model,data,velocity;
  try {
    model=mj.MjModel.from_xml_string(modelXML(p)); data=new mj.MjData(model);velocity=new mj.DoubleBuffer(6);
    const bodyType=mj.mjtObj.mjOBJ_BODY.value;
    const front=mj.mj_name2id(model,bodyType,'front'),rear=mj.mj_name2id(model,bodyType,'rear');
    const shockId=p.bike==='full'?mj.mj_name2id(model,mj.mjtObj.mjOBJ_TENDON.value,'shock'):-1;
    const frame=mj.mj_name2id(model,bodyType,'frame'),compliant=p.rider==='compliant';
    const rider=compliant?mj.mj_name2id(model,bodyType,'rider'):frame;
    const riderJoint=compliant?mj.mj_name2id(model,mj.mjtObj.mjOBJ_JOINT.value,'riderSlide'):-1;
    const riderQ=compliant?model.jnt_qposadr[riderJoint]:-1,riderV=compliant?model.jnt_dofadr[riderJoint]:-1;
    const q=data.qpos; q[2]=.04;if(p.bike==='full')q[3]=.12;
    const rearZ=p.bike==='full'?g.pivotZ-Math.sin(.12)*g.rearX+Math.cos(.12)*g.armZ:g.axleZ;
    const rearX=p.bike==='full'?Math.cos(.12)*g.rearX+Math.sin(.12)*g.armZ:g.rearX;
    const frontZ=g.axleZ+q[2]*Math.sin(g.headAngle),frontX=g.frontX-q[2]*Math.cos(g.headAngle);
    q[1]=Math.atan2(frontZ-rearZ,frontX-rearX);
    q[0]=g.radius-.006+Math.sin(q[1])*rearX-Math.cos(q[1])*rearZ-g.frameHeight;
    if(compliant)q[riderQ]=-p.riderMass*G*Math.cos(q[1])/p.riderStiffness;
    const base=new Float64Array(4),forces=new Float64Array(2),depths=new Float64Array(2),velocities=new Float64Array(2);
    const ids=[front,rear],maxSamples=Math.round(p.duration/p.sampleDt)+2;
    const signals=Object.fromEntries(names.map(n=>[n,new Float64Array(maxSamples)]));
    const buffer=new Float64Array(5),shockBuffer=new Float64Array(5);
    const swingJoint=p.bike==='full'?mj.mj_name2id(model,mj.mjtObj.mjOBJ_JOINT.value,'swing'):-1;
    const swingQ=swingJoint>=0?model.jnt_qposadr[swingJoint]:-1,swingV=swingJoint>=0?model.jnt_dofadr[swingJoint]:-1;
    let shockMoment=0,shockJacobian=0,shockBufferLoss=0,peakShockTopForce=0,peakShockBottomForce=0;
    const forkJoint=mj.mj_name2id(model,mj.mjtObj.mjOBJ_JOINT.value,'fork'),forkV=model.jnt_dofadr[forkJoint];
    const lastQ=new Float64Array(model.nq),lastV=new Float64Array(model.nv);
    let work=0,loss=0,riderLoss=0,bufferLoss=0,peakTopForce=0,peakBottomForce=0,initialEnergy=0,energy=0,count=0,maxResidual=0,peakForce=0,peakRiderForce=0,maxSpeed=0;
    let supportPower=0,lossPower=0,riderLossPower=0,termination=null;
    const axialRiderForce=()=>compliant?-p.riderStiffness*data.qpos[riderQ]-p.riderDamping*data.qvel[riderV]:0;
    function observe(t,excite) {
      mj.mj_fwdPosition(model,data);mj.mj_fwdVelocity(model,data);
      if(p.forkBuffer==='progressive')travelBuffer(data.qpos[2],data.qvel[forkV],g.forkTravel,p.forkBufferWidth,p.forkBufferStiffness,p.forkBufferDamping,buffer);
      data.qfrc_applied[forkV]=buffer[0];
      if(swingV>=0){
        shockJacobian=shockCompressionJacobian(data.qpos[swingQ]);
        if(p.shockBuffer==='progressive')travelBuffer(shockLength(0)-data.ten_length[shockId],-data.ten_velocity[shockId],g.shockTravel,p.shockBufferWidth,p.shockBufferStiffness,p.shockBufferDamping,shockBuffer);
        shockMoment=shockBuffer[0]*shockJacobian;
        data.qfrc_applied[swingV]=shockMoment;
      }
      if(excite)platens(p,t,base);else base.fill(0);
      riderLossPower=compliant?p.riderDamping*data.qvel[riderV]**2:0;
      supportPower=0;lossPower=riderLossPower+buffer[2]+shockBuffer[2]+p.forkDamping*data.qvel[2]**2;
      if(p.bike==='full')lossPower+=p.shockDamping*data.ten_velocity[shockId]**2;
      for(let i=0;i<2;i++) {
        mj.mj_objectVelocity(model,data,bodyType,ids[i],velocity,0);
        velocities[i]=velocity.GetView()[5];
        depths[i]=Math.max(0,g.radius+base[2*i]-data.xipos[3*ids[i]+2]);
        const rate=base[2*i+1]-velocities[i];
        forces[i]=depths[i]>0?Math.max(0,p.tyreStiffness*depths[i]+p.tyreDamping*rate):0;
        data.xfrc_applied[6*ids[i]+2]=forces[i];
        supportPower+=forces[i]*base[2*i+1];
        if(depths[i]>0)lossPower+=(forces[i]-p.tyreStiffness*depths[i])*rate;
      }
      mj.mj_energyPos(model,data);mj.mj_energyVel(model,data);
      energy=data.energy[0]+data.energy[1]+buffer[1]+shockBuffer[1]+.5*p.tyreStiffness*(depths[0]**2+depths[1]**2);
      maxSpeed=0;for(let i=0;i<data.qvel.length;i++)maxSpeed=Math.max(maxSpeed,Math.abs(data.qvel[i]));
    }
    function domain() {
      for(let i=0;i<data.qpos.length;i++)if(!Number.isFinite(data.qpos[i])||!Number.isFinite(data.qvel[i]))return 'Nonfinite state';
      if(compliant&&Math.abs(data.qpos[riderQ])>p.riderTravel)return 'Rider travel limit';
      if(data.qpos[2]<-1e-9||data.qpos[2]>g.forkTravel)return 'Fork travel limit';
      if(p.bike==='full'&&(data.qpos[3]<-1e-9||data.qpos[3]>g.rearAngleMax||shockLength(0)-data.ten_length[shockId]>g.shockTravel))return 'Rear suspension travel limit';
      if(Math.max(depths[0],depths[1])>.2*g.radius)return 'Tyre surrogate compression limit';
      if(Math.abs(data.qpos[1])>.5)return 'Fixture pitch limit';
      if(!Number.isFinite(energy)||!Number.isFinite(maxSpeed)||maxSpeed>100)return 'Unstable state';
      return null;
    }
    // Four seconds of flat-platen settling is part of every reproducible setup.
    observe(0,false);
    for(let i=0;i<Math.round(4/p.dt);i++) {
      const reason=domain();if(reason)throw new Error('Setup settling stopped: '+reason);
      mj.mj_step(model,data);
      if(Math.abs(data.time-(i+1)*p.dt)>1e-7)throw new Error('Setup settling stopped: engine time reset');
      observe(0,false);
    }
    const reason=domain();if(reason)throw new Error('Setup settling stopped: '+reason);
    if(maxSpeed>.002)throw new Error('Setup did not settle within four seconds. Increase damping.');
    data.time=0; initialEnergy=energy;peakForce=Math.max(forces[0],forces[1]);peakRiderForce=Math.abs(axialRiderForce());peakTopForce=buffer[3];peakBottomForce=buffer[4];peakShockTopForce=shockBuffer[3];peakShockBottomForce=shockBuffer[4];
    const initial={qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),frontForce:forces[0],rearForce:forces[1],
      comX:((compliant?p.mass-p.riderMass:p.mass)*data.xipos[3*frame]+(compliant?p.riderMass*data.xipos[3*rider]:0)+g.wheelMass*data.xipos[3*front]+g.rearMass*data.xipos[3*rear])/(p.mass+g.wheelMass+g.rearMass)};
    function record(t) {
      const k=count++; signals.time[k]=t;signals.heave[k]=data.qpos[0]+g.frameHeight;signals.pitch[k]=data.qpos[1];
      signals.fork[k]=data.qpos[2];signals.rearAngle[k]=p.bike==='full'?data.qpos[3]:0;
      signals.shock[k]=p.bike==='full'?shockLength(0)-data.ten_length[shockId]:0;
      signals.shockForce[k]=p.bike==='full'?p.shockStiffness*signals.shock[k]-p.shockDamping*data.ten_velocity[shockId]:0;
      signals.shockBufferForce[k]=shockBuffer[0];signals.shockTopForce[k]=shockBuffer[3];signals.shockBottomForce[k]=shockBuffer[4];
      signals.shockBufferEnergy[k]=shockBuffer[1];signals.shockBufferDissipation[k]=shockBufferLoss;signals.shockBufferMoment[k]=shockMoment;
      // Existing shockForce is positive extension resistance; buffer force is compression-positive.
      signals.shockTotalForce[k]=signals.shockForce[k]-shockBuffer[0];signals.shockLeverage[k]=shockJacobian;
      signals.forkBufferForce[k]=buffer[0];signals.forkTopForce[k]=buffer[3];signals.forkBottomForce[k]=buffer[4];
      signals.forkBufferEnergy[k]=buffer[1];signals.forkBufferDissipation[k]=bufferLoss;
      signals.frontX[k]=data.xipos[3*front];signals.frontZ[k]=data.xipos[3*front+2];
      signals.rearX[k]=data.xipos[3*rear];signals.rearZ[k]=data.xipos[3*rear+2];
      signals.frontBase[k]=base[0];signals.rearBase[k]=base[2];signals.frontForce[k]=forces[0];signals.rearForce[k]=forces[1];
      signals.riderCompression[k]=compliant?-data.qpos[riderQ]:0;signals.riderVelocity[k]=compliant?-data.qvel[riderV]:0;
      signals.riderForce[k]=axialRiderForce();
      signals.riderX[k]=data.xipos[3*rider];signals.riderZ[k]=data.xipos[3*rider+2];signals.riderDissipation[k]=riderLoss;
      signals.energy[k]=energy;signals.work[k]=work;signals.dissipation[k]=loss;signals.residual[k]=energy+loss-work-initialEnergy;signals.speed[k]=maxSpeed;
    }
    observe(0,true);record(0);
    const steps=Math.round(p.duration/p.dt),stride=Math.round(p.sampleDt/p.dt);
    for(let tick=1;tick<=steps;tick++) {
      lastQ.set(data.qpos);lastV.set(data.qvel);
      const oldPower=supportPower,oldLoss=lossPower,oldRiderLoss=riderLossPower,oldBufferLoss=buffer[2],oldShockBufferLoss=shockBuffer[2];
      mj.mj_step(model,data);observe(tick*p.dt,true);
      const failure=Math.abs(data.time-tick*p.dt)>1e-7?'Engine time reset':domain();
      if(failure) {
        termination={reason:failure,trialTime:tick*p.dt,trialQpos:Array.from(data.qpos),lastValidTime:(tick-1)*p.dt,
          lastValidQpos:Array.from(lastQ)};
        data.qpos.set(lastQ);data.qvel.set(lastV);data.time=(tick-1)*p.dt;observe(data.time,true);
        if(signals.time[count-1]<data.time-1e-10)record(data.time);
        break;
      }
      work+=(oldPower+supportPower)*p.dt/2;loss+=(oldLoss+lossPower)*p.dt/2;
      riderLoss+=(oldRiderLoss+riderLossPower)*p.dt/2;bufferLoss+=(oldBufferLoss+buffer[2])*p.dt/2;shockBufferLoss+=(oldShockBufferLoss+shockBuffer[2])*p.dt/2;
      peakShockTopForce=Math.max(peakShockTopForce,shockBuffer[3]);peakShockBottomForce=Math.max(peakShockBottomForce,shockBuffer[4]);
      peakTopForce=Math.max(peakTopForce,buffer[3]);peakBottomForce=Math.max(peakBottomForce,buffer[4]);
      maxResidual=Math.max(maxResidual,Math.abs(energy+loss-work-initialEnergy));peakForce=Math.max(peakForce,forces[0],forces[1]);
      peakRiderForce=Math.max(peakRiderForce,Math.abs(axialRiderForce()));
      if(tick%stride===0)record(tick*p.dt);
    }
    return {model:MODEL,riderModel:{kind:compliant?'passive-frame-guide':'fixed-lump',
      frameMass:compliant?p.mass-p.riderMass:p.mass,riderMass:compliant?p.riderMass:0,
      frameInertia:g.frameInertia*(compliant?p.mass-p.riderMass:p.mass)/p.mass,
      riderInertia:compliant?g.frameInertia*p.riderMass/p.mass:0,
      axis:[0,0,1],origin:[0,0,0],rest:0,forceScope:compliant?'Axial spring/damper only; transverse guide wrench unavailable':'Rider force unresolved'},engine:'MuJoCo '+mj.mj_versionString(),params:p,geometry:g,dofs:model.nv,initial,
      status:termination?'terminated':'complete',termination,summary:{maxResidual,peakForce,peakRiderForce,peakTopForce,peakBottomForce,work,loss,riderLoss,bufferLoss,shockBufferLoss,peakShockTopForce,peakShockBottomForce},
      signals:Object.fromEntries(names.map(n=>[n,signals[n].slice(0,count)]))};
  } finally {velocity?.delete();data?.delete();model?.delete();}
}
export function rigRecord(run) {
  return {...run,signals:Object.fromEntries(Object.entries(run.signals).map(([k,v])=>[k,Array.from(v)]))};
}

export function setupFromRecord(record) {
  if(record?.model===LEGACY_MODEL||record?.model===PREVIOUS_MODEL||record?.model===FORK_BUFFER_MODEL) {
    const keys=Object.keys(DEFAULTS).filter(key=>!shockBufferKeys.includes(key)&&(record.model===FORK_BUFFER_MODEL||!bufferKeys.includes(key))&&(record.model!==LEGACY_MODEL||!riderKeys.includes(key)));
    if(!record.params||keys.some(key=>!Object.hasOwn(record.params,key)))throw new Error('Incomplete legacy bicycle rig setup.');
    if(Object.keys(record.params).some(key=>!keys.includes(key)))throw new Error('Unknown legacy setup parameter.');
    return validate({...record.params,...(record.model===LEGACY_MODEL?{rider:'fixed'}:{}),...(record.model!==FORK_BUFFER_MODEL?{forkBuffer:'none'}:{}),shockBuffer:'none'});
  }
  if(record?.model!==MODEL)throw new Error("Unsupported bicycle rig record.");
  if(!record.params || Object.keys(DEFAULTS).some(key=>!Object.hasOwn(record.params,key)))throw new Error("Incomplete bicycle rig setup.");
  return validate(record.params);
}
