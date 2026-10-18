const G=9.80665;
// Independent world momentum from body velocities, not native reaction arrays.
export function momentum(r,k){
  if(r.params.rider!=='compliant')throw Error('Momentum reference requires a separate rider body.');
  const s=r.signals,g=r.geometry,p=r.params,phi=s.pitch[k],omega=s.pitchVelocity[k],heave=s.heaveVelocity[k],f=s.fork[k],fd=s.forkVelocity[k],theta=s.rearAngle[k],td=s.rearAngularVelocity[k];
  const rotate=(a,x,z)=>[Math.cos(a)*x+Math.sin(a)*z,-Math.sin(a)*x+Math.cos(a)*z];
  const cross=(x,z,fx,fz)=>z*fx-x*fz;
  const frontLocal=[g.frontX-Math.cos(g.headAngle)*f,g.axleZ+Math.sin(g.headAngle)*f],fv=rotate(phi,-Math.cos(g.headAngle)*fd,Math.sin(g.headAngle)*fd),fr=rotate(phi,...frontLocal);
  const rearArm=rotate(phi+theta,g.armX,g.armZ),pivot=rotate(phi,g.pivotX,g.pivotZ),fixedRear=rotate(phi,g.rearX,g.axleZ);
  const q=-s.riderCompression[k],u=-s.riderVelocity[k],rr=rotate(phi,0,q),rv=rotate(phi,0,u);
  const bodies=[{m:p.mass-p.riderMass,x:0,z:s.heave[k],vx:0,vz:heave,I:g.frameInertia*(p.mass-p.riderMass)/p.mass,w:omega},
    {m:p.riderMass,x:s.riderX[k],z:s.riderZ[k],vx:omega*rr[1]+rv[0],vz:heave-omega*rr[0]+rv[1],I:g.frameInertia*p.riderMass/p.mass,w:omega},
    {m:3,x:s.frontX[k],z:s.frontZ[k],vx:omega*fr[1]+fv[0],vz:heave-omega*fr[0]+fv[1],I:.1,w:omega},
    {m:4,x:s.rearX[k],z:s.rearZ[k],vx:p.bike==='full'?omega*pivot[1]+(omega+td)*rearArm[1]:omega*fixedRear[1],vz:p.bike==='full'?heave-omega*pivot[0]-(omega+td)*rearArm[0]:heave-omega*fixedRear[0],I:.13,w:omega+td}];
  let px=0,pz=0,h=0,gravityMoment=0;for(const b of bodies){px+=b.m*b.vx;pz+=b.m*b.vz;h+=b.I*b.w+cross(b.x,b.z,b.m*b.vx,b.m*b.vz);gravityMoment+=b.x*b.m*G;}
  return [px,pz,h,s.fixtureFx[k],s.fixtureFz[k]+s.frontForce[k]+s.rearForce[k]-(p.mass+7)*G,s.fixtureMy[k]+s.heave[k]*s.fixtureFx[k]-s.frontX[k]*s.frontForce[k]-s.rearX[k]*s.rearForce[k]+gravityMoment];
}
export function momentumClosure(r){
  const s=r.signals,first=momentum(r,0),last=momentum(r,s.time.length-1),integral=[0,0,0];let previous=first;
  for(let i=1;i<s.time.length;i++){const next=momentum(r,i),h=s.time[i]-s.time[i-1];for(let j=0;j<3;j++)integral[j]+=(previous[j+3]+next[j+3])*h/2;previous=next;}
  return integral.map((x,j)=>Math.abs(last[j]-first[j]-x));
}
