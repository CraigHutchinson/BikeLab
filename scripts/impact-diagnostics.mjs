// Independent polyline checks on recorded native contacts; not solver inputs.
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const distance=(p,a,b)=>{const d=[b[0]-a[0],b[1]-a[1]],t=Math.max(0,Math.min(1,dot([p[0]-a[0],p[1]-a[1]],d)/dot(d,d)));return Math.hypot(p[0]-a[0]-t*d[0],p[1]-a[1]-t*d[1]);};
export function impactMetrics(r){
 const points=r.scenario.profile.points,faces=points.slice(1).map((b,i)=>{const a=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);return {a,b,normal:[-dz/length,dx/length],angle:Math.atan2(dx,-dz)};});
 // The contact midpoint can lie half the admitted overlap below the surface.
 const witnessBudget=r.scenario.wheel.maxPenetration/2+1e-5;
 const out={contacts:[0,0],peakSampledContactHorizontal:[0,0],maxWitnessDistance:0,maxNormalAngleError:0,maxWrenchError:0,maxMomentumResidual:[0,0,0],witnessBudget};
 for(const f of r.frames){
  const sums=[[0,0,0],[0,0,0]];
  for(const c of f.contacts){
   out.contacts[c.wheel]++;out.peakSampledContactHorizontal[c.wheel]=Math.max(out.peakSampledContactHorizontal[c.wheel],Math.abs(c.force[0]));
   const angle=Math.atan2(c.normal[1],c.normal[0]);let nearest=Infinity,error=Infinity;
   for(let i=0;i<faces.length;i++){
    const face=faces[i],d=distance(c.point,face.a,face.b);nearest=Math.min(nearest,d);
    if(d<=witnessBudget)error=Math.min(error,Math.acos(Math.max(-1,Math.min(1,dot(c.normal,face.normal)))));
    const next=faces[i+1];
    // Clockwise turns expose a convex corner. Its outward normal is a cone,
    // including vertical faces; a concave turn has no such corner support.
    if(next&&next.angle<face.angle&&Math.hypot(c.point[0]-face.b[0],c.point[1]-face.b[1])<=witnessBudget)error=Math.min(error,Math.max(0,next.angle-angle,angle-face.angle));
   }
   out.maxWitnessDistance=Math.max(out.maxWitnessDistance,nearest);out.maxNormalAngleError=Math.max(out.maxNormalAngleError,error);
   const hub=f.wheels[c.wheel].hub,sum=sums[c.wheel];sum[0]+=c.force[0];sum[1]+=c.force[1];sum[2]+=(c.point[1]-hub[1])*c.force[0]-(c.point[0]-hub[0])*c.force[1];
  }
  for(let k=0;k<2;k++)for(let j=0;j<3;j++)out.maxWrenchError=Math.max(out.maxWrenchError,Math.abs(sums[k][j]-f.wheels[k].ground[j]));
  for(let j=0;j<3;j++)out.maxMomentumResidual[j]=Math.max(out.maxMomentumResidual[j],Math.abs(f.momentumResidual[j]));
 }
 return out;
}
