import {geometryFor,shockLength,shockCompressionJacobian} from './linkage.js';
import {travelBuffer} from './travel-buffer.js';
export function createTrailForces(mj,model,a){
 const p=a.bike,g=geometryFor(p),joint=name=>{const i=mj.mj_name2id(model,mj.mjtObj.mjOBJ_JOINT.value,name);return i<0?null:{q:model.jnt_qposadr[i],v:model.jnt_dofadr[i]};};
 const j={fork:joint('fork'),swing:joint('swing'),riderSlide:joint('riderSlide')},front=joint('frontwheelSpin'),rear=joint('rearwheelSpin'),buffers=Array.from({length:3},()=>new Float64Array(5));
 return {buffers,apply(data,command){
  data.qfrc_applied.fill(0);for(const b of buffers)b.fill(0);
  if(p.forkBuffer==='progressive')travelBuffer(data.qpos[j.fork.q],data.qvel[j.fork.v],g.forkTravel,p.forkBufferWidth,p.forkBufferStiffness,p.forkBufferDamping,buffers[0]);data.qfrc_applied[j.fork.v]=buffers[0][0];
  if(j.swing){if(p.shockBuffer==='progressive')travelBuffer(shockLength(0,g)-data.ten_length[0],-data.ten_velocity[0],g.shockTravel,p.shockBufferWidth,p.shockBufferStiffness,p.shockBufferDamping,buffers[1]);data.qfrc_applied[j.swing.v]=buffers[1][0]*shockCompressionJacobian(data.qpos[j.swing.q],g);}
  if(j.riderSlide){if(p.riderBuffer==='progressive')travelBuffer(data.qpos[j.riderSlide.q]+p.riderTravel,data.qvel[j.riderSlide.v],2*p.riderTravel,p.riderBufferWidth,p.riderBufferStiffness,p.riderBufferDamping,buffers[2]);data.qfrc_applied[j.riderSlide.v]=buffers[2][0];}
  data.qfrc_applied[front.v]=0;data.qfrc_applied[rear.v]=command.rearDrive;
 }};
}
