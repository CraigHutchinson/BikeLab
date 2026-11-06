// Offline axisymmetric polygon membrane; no production path.
export const MODEL='bikelab-meridian-energy-0.1';
const cross=(a,b,c,d)=>a*d-b*c;
function geometry(points,L){
 if(!Array.isArray(points)||points.length<4||points.length>257)throw TypeError('Require 4..257 meridian nodes');
 for(const p of points)if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||L+p[1]<=0)throw RangeError('Invalid axial/radial point');
 let turn=0,volume=0;const gradient=points.map(()=>[0,0]);
 for(let i=0;i<points.length;i++){
  const j=(i+1)%points.length,k=(i+2)%points.length,[x,z]=points[i],[u,v]=points[j];
  const dx=u-x,dz=v-z,ex=points[k][0]-u,ez=points[k][1]-v,det=cross(dx,dz,ex,ez);
  if(!(Math.hypot(dx,dz)>1e-10&&det>0))throw RangeError('Require strictly convex CCW meridian and nonzero edges');
  turn+=Math.atan2(det,dx*ex+dz*ez);
  const C=cross(x,z,u,v),w=L/2+(z+v)/6;
  volume+=2*Math.PI*C*w;
  gradient[i][0]+=2*Math.PI*v*w;gradient[j][0]-=2*Math.PI*z*w;
  gradient[i][1]+=2*Math.PI*(-u*w+C/6);gradient[j][1]+=2*Math.PI*(x*w+C/6);
 }
 if(Math.abs(turn-2*Math.PI)>1e-9||!Number.isFinite(volume)||volume<=0)throw RangeError('Invalid polygon winding or volume');
 return {volume,gradient};
}
export function createMeridianDiagnostic(input){
 const keys=['rimRadius','restPoints','meridionalRigidity','hoopRigidity','couplingRigidity','gaugePressure','provenance'];
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).length!==keys.length||Reflect.ownKeys(input).some(k=>!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(input,k),'value')))throw TypeError('Invalid configuration fields');
 const {rimRadius:L,meridionalRigidity:Cm,hoopRigidity:Ch,couplingRigidity:Cc,gaugePressure:p}=input;
 if(![L,Cm,Ch,Cc,p].every(Number.isFinite)||L<.15||L>.45||Cm<=0||Ch<=0||Math.max(Cm,Ch)>1e8||Cc*Cc>=Cm*Ch||p<0||p>1e6)throw RangeError('Invalid geometry/pressure or non-positive-definite material');
 if(typeof input.provenance!=='string'||!input.provenance.trim()||input.provenance.length>2000)throw TypeError('Explicit provenance required');
 const restGeometry=geometry(input.restPoints,L),rest=input.restPoints.map(p=>[...p]);
 if(rest[0][1]!==0||rest.at(-1)[1]!==0||rest[0][0]<=rest.at(-1)[0])throw RangeError('Rest beads must close on rim plane');
 const segments=rest.slice(1).map((b,i)=>{const a=rest[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),radius=L+(a[1]+b[1])/2;return {length,radius,area:2*Math.PI*radius*length};});
 return Object.freeze({evaluate(points){
  if(points.length!==rest.length)throw RangeError('Node count changed');
  const g=geometry(points,L),materialForces=points.map(()=>[0,0]),strains=[];let materialEnergy=0;
  for(let i=0;i<segments.length;i++){
   const j=i+1,a=points[i],b=points[j],s=segments[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   const em=length/s.length-1,eh=(L+(a[1]+b[1])/2)/s.radius-1;
   if(Math.max(Math.abs(em),Math.abs(eh))>.2)throw RangeError('Outside declared small-strain diagnostic envelope');
   const Nm=Cm*em+Cc*eh,Nh=Cc*em+Ch*eh;
   materialEnergy+=s.area*(Cm*em*em+2*Cc*em*eh+Ch*eh*eh)/2;
   const axial=s.area*Nm*dx/(length*s.length),radial=s.area*Nm*dz/(length*s.length),hoop=s.area*Nh/(2*s.radius);
   materialForces[i][0]+=axial;materialForces[j][0]-=axial;
   materialForces[i][1]+=radial-hoop;materialForces[j][1]-=radial+hoop;
   strains.push({meridional:em,hoop:eh,meridionalStressResultant:Nm,hoopStressResultant:Nh});
  }
  const pressureForces=g.gradient.map(v=>v.map(x=>p*x)),forces=materialForces.map((v,i)=>v.map((x,j)=>x+pressureForces[i][j]));
  const potential=materialEnergy-p*(g.volume-restGeometry.volume);
  if(!Number.isFinite(potential)||forces.some(f=>!f.every(Number.isFinite)))throw RangeError('Nonfinite energy/force');
  const beadLoads=[forces[0],forces.at(-1)].map(f=>[...f]);
  return {model:MODEL,volume:g.volume,volumeGradient:g.gradient,materialEnergy,potential,materialForces,pressureForces,forces,strains,
   compressiveSegments:strains.filter(s=>s.meridionalStressResultant<0||s.hoopStressResultant<0).length,
   beadLoads,supportForces:beadLoads.map(f=>f.map(x=>-x)),maxFreeResidual:Math.max(...forces.slice(1,-1).map(f=>Math.hypot(...f)))};
 },tangentBands(points){
  // Reuse the force evaluator's geometry/strain admission. Fixed beads are omitted.
  this.evaluate(points);
  const n=2*(points.length-2),bands=new Float64Array(4*n);
  for(let i=0;i<segments.length;i++){
   const [x,z]=points[i],[u,v]=points[i+1],s=segments[i],dx=u-x,dz=v-z,l=Math.hypot(dx,dz),t=[dx/l,dz/l];
   const em=l/s.length-1,eh=(L+(z+v)/2)/s.radius-1,Nm=Cm*em+Cc*eh;
   const gm=[-t[0]/s.length,-t[1]/s.length,t[0]/s.length,t[1]/s.length],gh=[0,1/(2*s.radius),0,1/(2*s.radius)];
   const dc=[v,-u,-z,x],dw=[0,1/6,0,1/6],w=L/2+(z+v)/6;
   for(let a=0;a<4;a++)for(let b=0;b<=a;b++){
    const row=2*(i-1)+a,col=2*(i-1)+b;if(row<0||row>=n||col<0||col>=n)continue;
    const aa=a%2,bb=b%2,sign=(a<2?-1:1)*(b<2?-1:1);
    const hm=sign*((aa===bb?1:0)-t[aa]*t[bb])/(l*s.length);
    const hc=(a===3&&b===0)?1:(a===2&&b===1)?-1:0;
    const material=s.area*(Cm*gm[a]*gm[b]+Cc*(gm[a]*gh[b]+gh[a]*gm[b])+Ch*gh[a]*gh[b]+Nm*hm);
    const pressure=-2*Math.PI*p*(w*hc+dc[a]*dw[b]+dw[a]*dc[b]);
    bands[4*row+row-col]+=material+pressure;
   }
  }
  // Rim closure joins the two constrained beads and contributes no free entries.
  if(!bands.every(Number.isFinite))throw RangeError('Nonfinite tangent');
  return bands;
 }});
}
