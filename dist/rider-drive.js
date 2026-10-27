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
 object(input,['format','joints'],'rider drive');
 if(Object.hasOwn(input,'format')&&input.format!==DRIVE_FORMAT)throw Error('Unsupported rider drive format.');
 const compiled=compilePassiveRider(passive),supplied=Object.hasOwn(input,'joints')?input.joints:{};object(supplied,JOINTS,'drive joints');
 const joints={};
 for(let i=0;i<4;i++){
  const name=JOINTS[i],law=compiled.laws[i],patch=Object.hasOwn(supplied,name)?supplied[name]:{};object(patch,keys,name+' drive');
  const v={targetAngle:law.angle0,kp:[2400,2400,800,600][i],kd:[100,100,30,25][i],maxTorque:i<2?250:100,maxSpeed:12,maxPositivePower:i<2?600:200,maxNegativePower:i<2?600:200,...patch};
  const bounds={targetAngle:[law.minAngle,law.maxAngle],kp:[0,5000],kd:[0,500],maxTorque:[0,500],maxSpeed:[.1,30],maxPositivePower:[0,5000],maxNegativePower:[0,5000]};
  for(const k of keys)if(!Number.isFinite(v[k])||v[k]<bounds[k][0]||v[k]>bounds[k][1])throw Error(name+' '+k+' outside supported range.');
  joints[name]=Object.freeze(v);
 }
 return Object.freeze({format:DRIVE_FORMAT,joints:Object.freeze(joints)});
}
export function createDriveFrame(){return {targetAngles:new Float64Array(4),angles:new Float64Array(4),velocities:new Float64Array(4),error:new Float64Array(4),requestedTorque:new Float64Array(4),torque:new Float64Array(4),power:new Float64Array(4),saturation:new Uint8Array(4),totalPower:0,work:0};}
export function materializeDriveFrame(f){return Object.fromEntries(Object.entries(f).map(([k,v])=>[k,ArrayBuffer.isView(v)?Array.from(v):v]));}

// Pure evaluator into caller-owned storage. Saturation bits: 1 torque, 2 power.
export function evaluateDrive(laws,q,v,out){
 out.totalPower=0;
 for(let i=0;i<4;i++){
  const law=laws[i],c=law.drive,rate=v[i],error=law.targetQ-q[i],requested=c.kp*error-c.kd*rate;
  let torque=Math.max(-c.maxTorque,Math.min(c.maxTorque,requested)),bits=torque===requested?0:1;
  const power=torque*rate,limit=power>=0?c.maxPositivePower:c.maxNegativePower;
  if(Math.abs(power)>limit){torque*=limit/Math.abs(power);bits|=2;}
  out.targetAngles[i]=c.targetAngle;out.angles[i]=law.angle0+q[i];out.velocities[i]=rate;out.error[i]=error;out.requestedTorque[i]=requested;out.torque[i]=torque;out.power[i]=torque*rate;out.saturation[i]=bits;out.totalPower+=out.power[i];
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
  const drive=spec.joints[law.name],delta=drive.targetAngle-law.angle0,targetQ=Math.abs(delta)<1e-12?0:Number(delta.toPrecision(12));
  return Object.freeze({name:law.name,angle0:law.angle0,targetQ,drive,q:model.jnt_qposadr[id],v:model.jnt_dofadr[id]});
 });
 const q=new Float64Array(4),v=new Float64Array(4),frame=createDriveFrame();
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
  apply(data){const positions=data.qpos,velocities=data.qvel,force=data.qfrc_applied;for(let i=0;i<4;i++){q[i]=positions[laws[i].q];v[i]=velocities[laws[i].v];}evaluateDrive(laws,q,v,frame);for(let i=0;i<4;i++)force[laws[i].v]+=frame.torque[i];},
  record(out,work){for(const key of Object.keys(frame))if(ArrayBuffer.isView(frame[key]))out[key].set(frame[key]);out.totalPower=frame.totalPower;out.work=work;}
 };
}
