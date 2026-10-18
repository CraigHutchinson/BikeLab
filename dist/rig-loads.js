// Instantaneous accepted-endpoint diagnostics on a separate native data object.
// Native cfrc_int is torque/force at root-subtree COM, world-oriented.
export const LOAD_CHANNELS=['guideFx','guideFz','guideMy','guideAxial','guideTransverse','fixtureFx','fixtureFz','fixtureMy','pivotFx','pivotFz','pivotMy'];
export function interfaceWrench(model,data,body,origin,out){
  const i=6*body,c=3*model.body_rootid[body],x=data.subtree_com[c]-origin[0],z=data.subtree_com[c+2]-origin[2];
  out[0]=data.cfrc_int[i+3];out[1]=data.cfrc_int[i+5];out[2]=data.cfrc_int[i+1]+z*out[0]-x*out[1];
}
export function createLoadObserver(mj,model,ids){
  const d=new mj.MjData(model),origin=new Float64Array(3),w=new Float64Array(3),out=new Float64Array(LOAD_CHANNELS.length);
  return {data:d,read(state,bufferForce,full,compliant){
    d.qpos.set(state.qpos);d.qvel.set(state.qvel);d.qfrc_applied.set(state.qfrc_applied);d.xfrc_applied.set(state.xfrc_applied);d.time=state.time;
    mj.mj_forward(model,d);mj.mj_rnePostConstraint(model,d);out.fill(0);
    if(compliant){
      for(let j=0;j<3;j++)origin[j]=d.xipos[3*ids.rider+j];interfaceWrench(model,d,ids.rider,origin,w);
      out[0]=w[0];out[1]=w[1];out[2]=w[2];const s=Math.sin(d.qpos[1]),c=Math.cos(d.qpos[1]);out[3]=w[0]*s+w[1]*c;out[4]=w[0]*c-w[1]*s;
    }
    for(let j=0;j<3;j++)origin[j]=d.xpos[3*ids.frame+j];interfaceWrench(model,d,ids.frame,origin,w);out.set(w,5);
    for(let j=0;j<3;j++)origin[j]=d.xpos[3*ids.rear+j];interfaceWrench(model,d,ids.rear,origin,w);
    if(full){
      const a=3*ids.armSite,b=3*ids.frameSite,dx=d.site_xpos[a]-d.site_xpos[b],dz=d.site_xpos[a+2]-d.site_xpos[b+2],length=Math.hypot(dx,dz);
      // Buffer compression force B has equivalent arm-eye force -B*(arm-frame)/L.
      const fx=-bufferForce*dx/length,fz=-bufferForce*dz/length;
      w[0]-=fx;w[1]-=fz;w[2]-=(d.site_xpos[a+2]-origin[2])*fx-(d.site_xpos[a]-origin[0])*fz;
    }
    out.set(w,8);return out;
  },delete(){d.delete();}};
}
