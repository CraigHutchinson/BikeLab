// Reduced swept membrane in hub coordinates. Uncalibrated; no shear/bending law.
import {ringSin} from './wheel-ring.js';
import {createSealedGas} from './tyre-gas.js';
export const MODEL='bikelab-swept-sealed-casing-0.1';
export const ENDPOINT_MODEL='bikelab-swept-sealed-casing-endpoint-0.1';
export function createSweptCasing(input,model=MODEL){
 if(![MODEL,ENDPOINT_MODEL].includes(model))throw RangeError('Unsupported swept casing discretization');
 const endpoint=model===ENDPOINT_MODEL;
 const keys=['nodes','rimRadius','section','meridionalRigidity','hoopRigidity','couplingRigidity','gaugePressure','ambientPressure','exponent','provenance'];
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).length!==keys.length||Reflect.ownKeys(input).some(k=>!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(input,k),'value')))throw TypeError('Invalid swept casing configuration');
 const {nodes:N,rimRadius:L,meridionalRigidity:Cm,hoopRigidity:Ch,couplingRigidity:Cc,gaugePressure:pg}=input;
 if(![16,32,64,128].includes(N)||![L,Cm,Ch,Cc,pg].every(Number.isFinite)||L<.15||L>.45||Cm<=0||Ch<=0||Math.max(Cm,Ch)>1e7||Cc*Cc>=Cm*Ch||pg<0||pg>1e6)throw RangeError('Invalid swept casing geometry/material');
 if(typeof input.provenance!=='string'||!input.provenance.trim())throw TypeError('Explicit casing provenance required');
 const section=input.section;
 if(!Array.isArray(section)||section.length<5||section.length>33||!section.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[1]>=0))throw RangeError('Invalid reference section');
 const M=section.length,H=Math.max(...section.map(p=>p[1]));
 if(H<=0||H>.1||section[0][1]!==0||section[M-1][1]!==0||section[0][0]<=section[M-1][0])throw RangeError('Invalid bead closure');
 for(let j=0;j<M;j++){const a=section[j],b=section[(j+1)%M],c=section[(j+2)%M];if((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])<=0)throw RangeError('Reference section must be strictly convex CCW');}
 const alpha=Float64Array.from(section,p=>p[1]/H),axial=Float64Array.from(section,p=>p[0]),radial=Float64Array.from(section,p=>p[1]);
 const directions=new Float64Array(2*N),q=new Float64Array(2*N),vertices=new Float64Array(3*N*M),force3=new Float64Array(3*N*M),volumeGradient=new Float64Array(3*N*M),forces=new Float64Array(2*N),materialForces=new Float64Array(2*N),gasForces=new Float64Array(2*N);
 for(let i=0;i<N;i++){const a=128*i/N;directions[2*i]=ringSin(a);directions[2*i+1]=-ringSin(a+32);}
 const triangles=[],cells=[];
 for(let i=0;i<N;i++)for(let j=0;j<M;j++){
  const k=(i+1)%N,h=(j+1)%M,a=i*M+j,b=k*M+j,c=k*M+h,d=i*M+h;
  // Fixed diagonal; outward winding for CCW (axial,radial) section and +theta sweep.
  triangles.push(a,b,c,a,c,d);
  if(j<M-1){const lm=Math.hypot(axial[j+1]-axial[j],radial[j+1]-radial[j]),R=L+(radial[j]+radial[j+1])/2;cells.push({a,b,c,d,lm,lh:2*R*Math.sin(Math.PI/N),area:2*Math.PI/N*R*lm});}
 }
 const normals=new Float64Array(triangles.length),state={model,volume:0,materialEnergy:0,gasEnergy:0,potential:0,gaugePressure:pg,maxStrain:0,compressiveCells:0,forces,materialForces,gasForces};
 const gasState={};let chamber=null,initialized=false;
 function map(points){
  if(points.length!==2*N)throw RangeError('Casing coordinate count changed');
  for(let i=0;i<N;i++){
   const x=points[2*i],z=points[2*i+1],ex=directions[2*i],ez=directions[2*i+1];
   if(!Number.isFinite(x)||!Number.isFinite(z))throw RangeError('Nonfinite casing coordinates');
   // Stay in the owned angular sector: prevents circumferential ordering reversal.
   const r=x*ex+z*ez,t=x*ez-z*ex;
   if(r<=L||Math.abs(t)>r*Math.tan(Math.PI/N)*.45)throw RangeError('Casing sector/clearance domain');
   for(let j=0;j<M;j++){const v=3*(i*M+j),a=alpha[j];vertices[v]=L*ex+a*(x-L*ex);vertices[v+1]=axial[j];vertices[v+2]=L*ez+a*(z-L*ez);}
  }
 }
 function geometry(){
  volumeGradient.fill(0);let volume=0;
  for(let t=0;t<triangles.length;t+=3){
   const a=3*triangles[t],b=3*triangles[t+1],c=3*triangles[t+2];
   const ax=vertices[a],ay=vertices[a+1],az=vertices[a+2],bx=vertices[b],by=vertices[b+1],bz=vertices[b+2],cx=vertices[c],cy=vertices[c+1],cz=vertices[c+2];
   const nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay),ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az),nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
   if(!initialized){normals[t]=nx;normals[t+1]=ny;normals[t+2]=nz;}
   else if(nx*normals[t]+ny*normals[t+1]+nz*normals[t+2]<=1e-16)throw RangeError('Collapsed or inverted casing triangle');
   const ux=by*cz-bz*cy,uy=bz*cx-bx*cz,uz=bx*cy-by*cx;
   volume+=(ax*ux+ay*uy+az*uz)/6;
   volumeGradient[a]+=ux/6;volumeGradient[a+1]+=uy/6;volumeGradient[a+2]+=uz/6;
   volumeGradient[b]+=(cy*az-cz*ay)/6;volumeGradient[b+1]+=(cz*ax-cx*az)/6;volumeGradient[b+2]+=(cx*ay-cy*ax)/6;
   volumeGradient[c]+=(ay*bz-az*by)/6;volumeGradient[c+1]+=(az*bx-ax*bz)/6;volumeGradient[c+2]+=(ax*by-ay*bx)/6;
  }
  if(!Number.isFinite(volume)||volume<=0)throw RangeError('Invalid signed casing volume');return volume;
 }
 function edgeForce(a,b,scale){
  a*=3;b*=3;for(let k=0;k<3;k++){const f=scale*(vertices[b+k]-vertices[a+k]);force3[a+k]+=f;force3[b+k]-=f;}
 }
 function evaluate(points){
  map(points);state.volume=geometry();force3.fill(0);forces.fill(0);materialForces.fill(0);gasForces.fill(0);state.materialEnergy=0;state.maxStrain=0;state.compressiveCells=0;
  for(const s of cells){
   const a=3*s.a,b=3*s.b,c=3*s.c,d=3*s.d;
   const la=Math.hypot(vertices[d]-vertices[a],vertices[d+1]-vertices[a+1],vertices[d+2]-vertices[a+2]),lb=Math.hypot(vertices[c]-vertices[b],vertices[c+1]-vertices[b+1],vertices[c+2]-vertices[b+2]);
   const hx=(vertices[b]+vertices[c]-vertices[a]-vertices[d])/2,hy=(vertices[b+1]+vertices[c+1]-vertices[a+1]-vertices[d+1])/2,hz=(vertices[b+2]+vertices[c+2]-vertices[a+2]-vertices[d+2])/2,lh=Math.hypot(hx,hy,hz);
   if(Math.min(la,lb,lh)<=1e-10)throw RangeError('Collapsed material cell');
   const em=(la+lb)/(2*s.lm)-1,eh=lh/s.lh-1,Nm=Cm*em+Cc*eh,Nh=Cc*em+Ch*eh;
   if(endpoint){
    // Integrate endpoint energies, not the square of their averaged strain.
    // Added energy is exactly area*Cm*(ema-emb)^2/8; no new material coefficient.
    const ema=la/s.lm-1,emb=lb/s.lm-1,Nma=Cm*ema+Cc*eh,Nmb=Cm*emb+Cc*eh;
    state.maxStrain=Math.max(state.maxStrain,Math.abs(ema),Math.abs(emb),Math.abs(eh));
    if(Nma<0||Nmb<0||Nh<0)state.compressiveCells++;
    state.materialEnergy+=s.area*(Cm*(ema*ema+emb*emb)/2+2*Cc*em*eh+Ch*eh*eh)/2;
    edgeForce(s.a,s.d,s.area*Nma/(2*s.lm*la));edgeForce(s.b,s.c,s.area*Nmb/(2*s.lm*lb));
   }else{
    state.maxStrain=Math.max(state.maxStrain,Math.abs(em),Math.abs(eh));
    if(Nm<0||Nh<0)state.compressiveCells++;
    state.materialEnergy+=s.area*(Cm*em*em+2*Cc*em*eh+Ch*eh*eh)/2;
    edgeForce(s.a,s.d,s.area*Nm/(2*s.lm*la));edgeForce(s.b,s.c,s.area*Nm/(2*s.lm*lb));
   }
   if(state.maxStrain>.2)throw RangeError('Casing small-strain envelope');
   const f=s.area*Nh/(2*s.lh*lh);
   force3[a]+=f*hx;force3[a+1]+=f*hy;force3[a+2]+=f*hz;force3[d]+=f*hx;force3[d+1]+=f*hy;force3[d+2]+=f*hz;
   force3[b]-=f*hx;force3[b+1]-=f*hy;force3[b+2]-=f*hz;force3[c]-=f*hx;force3[c+1]-=f*hy;force3[c+2]-=f*hz;
  }
  const gas=chamber?.evaluateInto(state.volume,gasState);state.gaugePressure=gas?.gaugePressure??pg;state.gasEnergy=gas?.energy??(-pg*state.volume);state.potential=state.materialEnergy+state.gasEnergy;
  for(let i=0;i<N;i++)for(let j=0;j<M;j++){const v=3*(i*M+j),a=alpha[j];materialForces[2*i]+=a*force3[v];materialForces[2*i+1]+=a*force3[v+2];gasForces[2*i]+=a*state.gaugePressure*volumeGradient[v];gasForces[2*i+1]+=a*state.gaugePressure*volumeGradient[v+2];}
  for(let i=0;i<forces.length;i++){forces[i]=materialForces[i]+gasForces[i];if(!Number.isFinite(forces[i]))throw RangeError('Nonfinite casing force');}
  return state;
 }
 // Uniform reduced equilibrium at the requested inflation pressure. This is NOT
 // the meridian solution; the polyhedron and reduced kinematics define this root.
 function uniformForce(height){for(let i=0;i<N;i++){q[2*i]=(L+height)*directions[2*i];q[2*i+1]=(L+height)*directions[2*i+1];}evaluate(q);let f=0;for(let i=0;i<2*N;i++)f+=forces[i]*directions[i];return f;}
 uniformForce(H);initialized=true;const restVolume=state.volume;let lo=H,hi=H*1.15;
 if(pg>0){if(uniformForce(hi)>=0)throw RangeError('No inflated equilibrium within declared material envelope');for(let k=0;k<48;k++){const mid=(lo+hi)/2;if(uniformForce(mid)>0)lo=mid;else hi=mid;}uniformForce((lo+hi)/2);}else uniformForce(H);
 const initial=Float64Array.from(q),referenceVolume=state.volume;
 chamber=createSealedGas({referenceVolume,initialGaugePressure:pg,ambientPressure:input.ambientPressure,exponent:input.exponent,minVolumeFraction:.5,maxVolumeFraction:1.5,provenance:input.provenance});
 evaluate(initial);let residual=0;for(let i=0;i<N;i++)residual=Math.max(residual,Math.hypot(forces[2*i],forces[2*i+1]));
 if(residual>1e-5)throw RangeError('Reduced unloaded force residual');
 return Object.freeze({model,nodes:N,initial,directions:Float64Array.from(directions),state,reference:Object.freeze({restVolume,referenceVolume,radius:Math.hypot(initial[0],initial[1]),restHeight:H,unloadedResidual:residual,scope:'Uncalibrated affine swept membrane; small strain, no shear, bending, insert or failure'}),evaluate});
}
