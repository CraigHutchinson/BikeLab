import {CONTROL_FORMAT,createControlFrame,createRiderController} from './rider-controller.js';
// Application-owned, explicit sampled/held joint effort. No root actuation,
// integral state, torque slew model, posture projection or passive-law changes.
import {compilePassiveRider,JOINTS} from './rider-passive.js';
export const ACTIVE_MODEL='bikelab-trail-bike-active-0.1';
export const DRIVE_FORMAT='bikelab-rider-drive-0.1';
const keys=['targetAngle','kp','kd','maxTorque','maxSpeed','maxPositivePower','maxNegativePower'];
function object(v,fields,label){
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw Error(label+' must be an object.');
 for(const k of Reflect.ownKeys(v)){
  if(!fields.includes(k))throw Error('Unknown '+label+' field: '+String(k));
  const d=Object.getOwnPropertyDescriptor(v,k);if(!d.enumerable||!Object.hasOwn(d,'value'))throw Error(label+' fields must be enumerable data properties.');
 }
}
export function validateDrive(input,passive){
 object(input,['format','joints','response'],'rider drive');
 const controlled=input.format===CONTROL_FORMAT;
 object(input,controlled?['format','joints','response']:['format','joints'],'rider drive');
 if(Object.hasOwn(input,'format')&&!controlled&&input.format!==DRIVE_FORMAT)throw Error('Unsupported rider drive format.');
 const compiled=compilePassiveRider(passive),supplied=Object.hasOwn(input,'joints')?input.joints:{};object(supplied,JOINTS,'drive joints');
 let response;
 if(controlled){const r=Object.hasOwn(input,'response')?input.response:{};object(r,['frequencyHz','dampingRatio','compensation'],'rider response');response={frequencyHz:4,dampingRatio:1,compensation:'two-wheel-static',...r};
  if(!Number.isFinite(response.frequencyHz)||response.frequencyHz<.1||response.frequencyHz>10||!Number.isFinite(response.dampingRatio)||response.dampingRatio<0||response.dampingRatio>3||!['off','two-wheel-static'].includes(response.compensation))throw Error('Unsupported rider response policy.');Object.freeze(response);
 }
 const jointKeys=controlled?keys.filter(k=>k!=='kp'&&k!=='kd'):keys,joints={};
 for(let i=0;i<4;i++){
  const name=JOINTS[i],law=compiled.laws[i],patch=Object.hasOwn(supplied,name)?supplied[name]:{};object(patch,jointKeys,name+' drive');
  const v={targetAngle:law.angle0,kp:[2400,2400,800,600][i],kd:[100,100,30,25][i],maxTorque:i<2?250:100,maxSpeed:12,maxPositivePower:i<2?600:200,maxNegativePower:i<2?600:200,...patch};
  const bounds={targetAngle:[law.minAngle,law.maxAngle],kp:[0,5000],kd:[0,500],maxTorque:[0,500],maxSpeed:[.1,30],maxPositivePower:[0,5000],maxNegativePower:[0,5000]};
  if(controlled){delete v.kp;delete v.kd;}
  for(const k of jointKeys)if(!Number.isFinite(v[k])||v[k]<bounds[k][0]||v[k]>bounds[k][1])throw Error(name+' '+k+' outside supported range.');
  joints[name]=Object.freeze(v);
 }
 return Object.freeze({format:controlled?CONTROL_FORMAT:DRIVE_FORMAT,joints:Object.freeze(joints),...(controlled?{response}:{})});
}
export function createDriveFrame(controlled=false){return {...(controlled?createControlFrame():{}),targetAngles:new Float64Array(4),angles:new Float64Array(4),velocities:new Float64Array(4),error:new Float64Array(4),requestedTorque:new Float64Array(4),torque:new Float64Array(4),power:new Float64Array(4),saturation:new Uint8Array(4),totalPower:0,work:0};}
export function materializeDriveFrame(f){return Object.fromEntries(Object.entries(f).map(([k,v])=>[k,ArrayBuffer.isView(v)?Array.from(v):v]));}

// Shared native target policy for static and scheduled goals.
export function canonicalTargetDelta(angle,initial){const delta=angle-initial;return Math.abs(delta)<1e-12?0:Number(delta.toPrecision(12));}
// Pure evaluator into caller-owned storage. Saturation bits: 1 torque, 2 power.
// Optional targets come from the validated, setup-time target compiler.
export function evaluateDrive(laws,q,v,out,targets=null,control=null){
 out.totalPower=0;
 for(let i=0;i<4;i++){
  const law=laws[i],c=law.drive,rate=v[i],error=(targets?targets.q[i]:law.targetQ)-q[i],proportional=(control?control.kp[i]:c.kp)*error,damping=-(control?control.kd[i]:c.kd)*rate,requested=proportional+damping+(control?control.estimate[i]:0);
  if(control){control.proportional[i]=proportional;control.damping[i]=damping;}
  let torque=Math.max(-c.maxTorque,Math.min(c.maxTorque,requested)),bits=torque===requested?0:1;
  const power=torque*rate,limit=power>=0?c.maxPositivePower:c.maxNegativePower;
  if(Math.abs(power)>limit){torque*=limit/Math.abs(power);bits|=2;}
  out.targetAngles[i]=targets?targets.angles[i]:c.targetAngle;out.angles[i]=law.angle0+q[i];out.velocities[i]=rate;out.error[i]=error;out.requestedTorque[i]=requested;out.torque[i]=torque;out.power[i]=torque*rate;out.saturation[i]=bits;out.totalPower+=out.power[i];
 }
 return out;
}
export function createRiderDrive(mj,model,configuration,passive){
 const compiled=compilePassiveRider(passive),spec=validateDrive(configuration,passive);
 const laws=compiled.laws.map(law=>{
  const id=mj.mj_name2id(model,mj.mjtObj.mjOBJ_JOINT.value,law.nativeName),body=mj.mj_name2id(model,mj.mjtObj.mjOBJ_BODY.value,({riderHip:'rider_thighs',riderKnee:'rider_shanksFeet',riderShoulder:'rider_upperArms',riderElbow:'rider_forearmsHands'})[law.nativeName]);
  if(id<0||body<0||model.jnt_type[id]!==mj.mjtJoint.mjJNT_HINGE.value||model.jnt_bodyid[id]!==body)throw Error('Invalid rider drive joint binding.');
  // Match the canonical model's precision policy. Host trig may differ by an
  // ulp; a nominal zero target must not become a tiny host-dependent drive.
  const drive=spec.joints[law.name],targetQ=canonicalTargetDelta(drive.targetAngle,law.angle0);
  return Object.freeze({name:law.name,angle0:law.angle0,targetQ,drive,q:model.jnt_qposadr[id],v:model.jnt_dofadr[id]});
 });
 const q=new Float64Array(4),v=new Float64Array(4),frame=createDriveFrame(spec.format===CONTROL_FORMAT),controller=spec.format===CONTROL_FORMAT?createRiderController(mj,model,laws,compiled,spec.response):null;
 const controlKeys=controller?Object.keys(controller.frame):[],frameArrays=Object.keys(frame).filter(k=>ArrayBuffer.isView(frame[k]));
 function issue(velocities,effort){
  for(let i=0;i<4;i++){
   const law=laws[i],rate=velocities[law.v],power=effort[i]*rate,c=law.drive;
   if(!Number.isFinite(rate)||!Number.isFinite(power))return 'nonfinite-rider-drive';
   if(Math.abs(rate)>c.maxSpeed)return 'rider-drive-'+law.name+'-speed-limit';
   if(power>c.maxPositivePower+1e-10||power < -c.maxNegativePower-1e-10)return 'rider-drive-'+law.name+'-held-power-limit';
  }
  return null;
 }
 return {laws,frame,issue,
  apply(data,targets=null,contactMask=0){const positions=data.qpos,velocities=data.qvel,force=data.qfrc_applied;for(let i=0;i<4;i++){q[i]=positions[laws[i].q];v[i]=velocities[laws[i].v];}if(controller){controller.frame.contactMask=contactMask;controller.evaluate(data,q);}
   evaluateDrive(laws,q,v,frame,targets,controller?.frame);
   if(controller){for(const key of controlKeys){const value=controller.frame[key];if(ArrayBuffer.isView(value))frame[key].set(value);else frame[key]=value;}}for(let i=0;i<4;i++)force[laws[i].v]+=frame.torque[i];},
  record(out,work){for(const key of frameArrays)out[key].set(frame[key]);if(controller){out.contactMask=frame.contactMask;out.estimateStatus=frame.estimateStatus;}out.totalPower=frame.totalPower;out.work=work;}
 };
}
