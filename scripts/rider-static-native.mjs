// Independent native audit: no equality constraints and no time integration.
import {getRuntime} from '../dist/moving-wheel.js';
import {passiveRiderParts} from '../dist/rider-native.js';
import {staticRiderReference} from '../dist/rider-static-reference.js';
export async function auditNativeStatic(input={},forceScale=1){
 const reference=staticRiderReference(input);if(reference.status!=='available')return {status:'unavailable',reference};
 const {passive,goal,gravity,framePitch}=reference.input,parts=passiveRiderParts({...passive,posture:{...passive.posture,...goal}}),mj=await getRuntime();let model,data,generalized;
 try{
  const xml=`<mujoco model="rider-static-audit"><compiler angle="radian"/><option gravity="0 0 ${-gravity}"/><worldbody><body name="frame" quat="${Math.cos(framePitch/2)} 0 ${Math.sin(framePitch/2)} 0">${parts.sites}${parts.body}</body></worldbody></mujoco>`;
  model=mj.MjModel.from_xml_string(xml);data=new mj.MjData(model);mj.mj_forward(model,data);
  const buffer=n=>new Float64Array(n);
  const force=buffer(3),torque=buffer(3),point=buffer(3),c=Math.cos(framePitch),s=Math.sin(framePitch);
  generalized=new mj.DoubleBuffer(model.nv);generalized.GetView().fill(0);
  for(const name of ['hand','foot']){
   const site=mj.mj_name2id(model,mj.mjtObj.mjOBJ_SITE.value,'rider_'+name),f=reference[name];
   force.set([forceScale*(c*f[0]+s*f[1]),0,forceScale*(-s*f[0]+c*f[1])]);point.set(data.site_xpos.subarray(3*site,3*site+3));
   mj.mj_applyFT(model,data,force,torque,point,model.site_bodyid[site],generalized);
  }
  data.qfrc_applied.set(generalized.GetView());
  for(const j of reference.joints){const name='rider'+j.name[0].toUpperCase()+j.name.slice(1),id=mj.mj_name2id(model,mj.mjtObj.mjOBJ_JOINT.value,name);data.qfrc_applied[model.jnt_dofadr[id]]+=j.active;}
  mj.mj_forward(model,data);
  const residual=Array.from(data.qfrc_applied,(v,i)=>v+data.qfrc_passive[i]-data.qfrc_bias[i]),acceleration=Array.from(data.qacc);
  return {status:'audited',reference,nv:model.nv,equalities:model.neq,velocity:Array.from(data.qvel),residual,acceleration,maxResidual:Math.max(...residual.map(Math.abs)),maxAcceleration:Math.max(...acceleration.map(Math.abs))};
 }finally{generalized?.delete();data?.delete();model?.delete();}
}
