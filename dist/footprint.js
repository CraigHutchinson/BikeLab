// Radially guided, uncalibrated static surrogate; see docs/STATIC_FOOTPRINT.md.
import {fixture,validateProfile,probe,PROFILE} from './terrain.js';
export const MODEL='bikelab-static-radial-ring-0.1';
export const DEFAULTS=Object.freeze({fixture:'flat',centerX:0,height:.345,radius:.36,rimRadius:.29,foundation:300000,coupling:30,nodes:512,terrainSegments:128,rotation:0});
export function validate(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))throw Error('Setup must be an object.');
 for(const k of Object.keys(input))if(!Object.hasOwn(DEFAULTS,k))throw Error('Unknown setting: '+k);
 const p={...DEFAULTS,...input};
 for(const [k,a,b] of [['centerX',-.45,.45],['height',.1,.7],['radius',.25,.45],['rimRadius',.15,.4],['foundation',50000,1000000],['coupling',0,200],['rotation',-Math.PI,Math.PI]])if(!Number.isFinite(p[k])||p[k]<a||p[k]>b)throw Error(k+' outside supported range.');
 if(p.rimRadius>=p.radius-.02)throw Error('Rim must leave at least 20 mm radial clearance.');
 if(![64,128,256,512,1024].includes(p.nodes))throw Error('Choose 64, 128, 256, 512 or 1024 nodes.');
 if(![32,64,128,256,512].includes(p.terrainSegments))throw Error('Choose 32, 64, 128, 256 or 512 terrain segments.');
 if(!['flat','rounded','step','bridge'].includes(p.fixture))throw Error('Unknown fixture.');
 return Object.freeze(p);
}
export function footprintFixture(name,segments=128){
 if(![32,64,128,256,512].includes(segments))throw Error('Unsupported terrain resolution.');
 if(name==='flat'||name==='rounded')return fixture(name,segments);
 if(name==='step')return fixture('square');
 if(name==='bridge'){
  const points=[[-1,-.06]];
  for(const center of [-.1,.1]){points.push([center-.06,-.06],[center-.06,-.02]);for(let j=1;j<=segments;j++){const angle=Math.PI*(1-j/segments);points.push([center+.06*Math.cos(angle),-.02+.06*Math.sin(angle)]);}points.push([center+.06,-.06]);}
  points.push([1,-.06]);
  return {format:PROFILE,units:'m',axes:'x-forward,z-up',solid:'below',interpolation:'linear',source:{kind:'illustrative',description:'Two sampled 60 mm radius rounded supports over a recessed centre.'},points};
 }
 throw Error('Unknown fixture.');
}
// E=.5*k*ds*sum(u²)+.5*T/ds*sum((u_next-u)²). Bounds are inward displacement.
// Cyclic exact coordinate minimization of a strictly convex bound-constrained QP.
export function solveRing(lower,radius,foundation,coupling){
 const n=lower.length;
 if(n<4||n>1024||!Number.isFinite(radius)||radius<=0||!Number.isFinite(foundation)||foundation<=0||!Number.isFinite(coupling)||coupling<0||!Array.from(lower).every(v=>Number.isFinite(v)&&v>=0))throw Error('Invalid radial ring problem.');
 const ds=2*Math.PI*radius/n,a=foundation*ds,c=coupling/ds,diagonal=a+2*c,u=Float64Array.from(lower),gradient=new Float64Array(n);
 let residual=Infinity,iterations=0;
 for(;iterations<30000;iterations++){
  for(let i=0;i<n;i++)u[i]=Math.max(lower[i],c*(u[(i+n-1)%n]+u[(i+1)%n])/diagonal);
  residual=0;
  for(let i=0;i<n;i++){gradient[i]=diagonal*u[i]-c*(u[(i+n-1)%n]+u[(i+1)%n]);residual=Math.max(residual,Math.abs(u[i]-Math.max(lower[i],u[i]-gradient[i]/diagonal))*diagonal);}
  if(residual<1e-7)break;
 }
 let energy=0;for(let i=0;i<n;i++)energy+=.5*a*u[i]**2+.5*c*(u[(i+1)%n]-u[i])**2;
 return {u,gradient,energy,residual,iterations:Math.min(iterations+1,30000),converged:residual<1e-7,ds};
}
function cross(x,z,a,b){return x*b-z*a;}
function heightAt(points,x){let z=-Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(x>=a[0]&&x<=b[0])z=Math.max(z,a[0]===b[0]?Math.max(a[1],b[1]):a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}return z;}
function boundary(points,x,z){for(let i=1;i<points.length;i++){const [a,b]=[points[i-1],points[i]],dx=b[0]-a[0],dz=b[1]-a[1],t=((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz);if(t>=-1e-10&&t<=1+1e-10&&Math.abs(cross(x-a[0],z-a[1],dx,dz))/Math.hypot(dx,dz)<1e-10)return true;}return false;}
// Partition every displayed chord at terrain x breakpoints. One-sided limits catch
// vertical faces. Heights are affine on each open interval, so endpoints bound overlap.
export function contourIntrusion(points,outline){
 let maximum=0;
 for(let i=0;i<outline.length;i++){
  const a=outline[i],b=outline[(i+1)%outline.length],dx=b[0]-a[0],dz=b[1]-a[1],cuts=[0,1];
  if(Math.abs(dx)>1e-14)for(const p of points){const t=(p[0]-a[0])/dx;if(t>0&&t<1)cuts.push(t);}
  cuts.sort((a,b)=>a-b);
  for(let j=1;j<cuts.length;j++)for(const f of [1e-8,.5,1-1e-8]){
   const t=cuts[j-1]+(cuts[j]-cuts[j-1])*f,x=a[0]+t*dx,z=a[1]+t*dz;
   if(!boundary(points,x,z))maximum=Math.max(maximum,heightAt(points,x)-z);
  }
 }
 return Math.max(0,maximum);
}
export function solveFootprint(input={},authoredProfile){
 const p=validate(input),profile=structuredClone(validateProfile(authoredProfile??footprintFixture(p.fixture,p.terrainSegments))),points=profile.points,n=p.nodes;
 const base={model:MODEL,params:p,profile};const unavailable=(reason,diagnostics={})=>({...base,status:'unsupported',reason,...diagnostics});
 if(p.centerX-p.radius<points[0][0]||p.centerX+p.radius>points.at(-1)[0])return unavailable('Tyre leaves authored terrain.');
 if(p.height<=heightAt(points,p.centerX)+1e-10)return unavailable('Hub is on or inside terrain.');
 const rim=probe(profile,{center:[p.centerX,p.height],radius:p.rimRadius});
 if(rim.status!=='available'||rim.gap<=0)return unavailable('Rim reaches terrain; rim strike and damage are unsupported.');
 const lower=new Float64Array(n),ex=new Float64Array(n),ez=new Float64Array(n),nx=new Float64Array(n),nz=new Float64Array(n),distance=new Float64Array(n),feature=new Int32Array(n),ambiguous=new Uint8Array(n);
 distance.fill(Infinity);feature.fill(-1);
 for(let i=0;i<n;i++){
  const angle=-Math.PI+(i+.5)*2*Math.PI/n-p.rotation;ex[i]=Math.sin(angle);ez[i]=-Math.cos(angle);
  for(let j=1;j<points.length;j++){
   const [a,b]=[points[j-1],points[j]],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),normalX=-dz/length,normalZ=dx/length,incidence=normalX*ex[i]+normalZ*ez[i];
   if(incidence>=-1e-12)continue;
   const den=cross(ex[i],ez[i],dx,dz),ax=a[0]-p.centerX,az=a[1]-p.height,r=cross(ax,az,dx,dz)/den,t=cross(ax,az,ex[i],ez[i])/den;
   if(r<=0||t< -1e-10||t>1+1e-10||r>distance[i]+1e-10)continue;
   if(Math.abs(r-distance[i])<1e-10){if(Math.hypot(nx[i]-normalX,nz[i]-normalZ)>1e-6)ambiguous[i]=1;continue;}
   distance[i]=r;feature[i]=j-1;nx[i]=normalX;nz[i]=normalZ;ambiguous[i]=0;
  }
  lower[i]=Math.max(0,p.radius-distance[i]);
  if(lower[i]>=p.radius-p.rimRadius)return unavailable('Required tyre displacement reaches the rim; rim strike is unsupported.');
 }
 const solution=solveRing(lower,p.radius,p.foundation,p.coupling);
 if(!solution.converged)return unavailable('Static contact solve did not converge.',{residual:solution.residual});
 const outline=[],contacts=[];let fx=0,fz=0,moment=0,maxDeformation=0;
 for(let i=0;i<n;i++){
  const r=p.radius-solution.u[i],x=p.centerX+r*ex[i],z=p.height+r*ez[i];outline.push([x,z]);maxDeformation=Math.max(maxDeformation,solution.u[i]);
  if(lower[i]<=0||solution.u[i]-lower[i]>1e-9||solution.gradient[i]<=1e-6)continue;
  const incidence=-(nx[i]*ex[i]+nz[i]*ez[i]);
  if(ambiguous[i]||incidence<.05)return unavailable('Active corner/tangent ray requires a richer contact model.');
  const radialReaction=solution.gradient[i],normalForce=radialReaction/incidence,forceX=normalForce*nx[i],forceZ=normalForce*nz[i];fx+=forceX;fz+=forceZ;moment+=(z-p.height)*forceX-(x-p.centerX)*forceZ;
  contacts.push({node:i,feature:feature[i],x,z,nx:nx[i],nz:nz[i],normalForce,forceX,forceZ,radialReaction});
 }
 const intrusion=contourIntrusion(points,outline),tolerance=2e-4;
 if(intrusion>tolerance)return unavailable('Displayed contour cuts through terrain; increase tyre resolution or change the pose.',{contourIntrusion:intrusion,contourTolerance:tolerance});
 return {...base,status:'solved',outline,contacts,deformation:Array.from(solution.u),summary:{forceX:fx,forceZ:fz,momentY:moment,energy:solution.energy,maxDeformation,activeNodes:contacts.length,residual:solution.residual,iterations:solution.iterations,contourIntrusion:intrusion,contourTolerance:tolerance}};
}
export function setupFromRecord(record){
 if(record?.model!==MODEL||!record.params||Object.keys(DEFAULTS).some(k=>!Object.hasOwn(record.params,k)))throw Error('Unsupported or incomplete footprint record.');
 return validate(record.params);
}

// Import setup/provenance only: recompute every displayed force; never trust saved outputs.
export function replayFootprint(record){
 const params=setupFromRecord(record);
 if(!record.profile)throw Error('Footprint record requires its authored profile.');
 return solveFootprint(params,record.profile);
}
