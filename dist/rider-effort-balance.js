// Shared planar rider balance kernel. Fixed topology, caller-owned reusable storage.
// Forces are on the rider, x/z; positive moment about y. See RIDER_STATIC_REFERENCE.md.
export const EFFORT_DESCENDANTS=[[1,2],[2],[3,4],[4]];
export function createEffortGeometry(){return {mass:new Float64Array(5),com:new Float64Array(10),joints:new Float64Array(8),anchors:new Float64Array(4),gravity:new Float64Array(2),passive:new Float64Array(4),limits:new Float64Array(4)};}
export function createEffortSolution(){return {status:'unobserved',hand:new Float64Array(2),foot:new Float64Array(2),active:new Float64Array(4),total:new Float64Array(4),atZero:new Float64Array(4),slope:new Float64Array(4),forceResidual:new Float64Array(2),momentResidual:0,lambda:0,unconstrained:0,lower:0,upper:0,objective:0};}
const solutionArrays=['hand','foot','active','total','atZero','slope','forceResidual'];
export function solveEffortBalance(g,out){
 for(const key of solutionArrays)out[key].fill(0);
 out.momentResidual=out.lambda=out.unconstrained=out.lower=out.upper=out.objective=0;out.status='unavailable';
 let mass=0,cx=0,cz=0;for(let i=0;i<5;i++){mass+=g.mass[i];cx+=g.mass[i]*g.com[2*i];cz+=g.mass[i]*g.com[2*i+1];}cx/=mass;cz/=mass;
 const hx=g.anchors[0],hz=g.anchors[1],fx=g.anchors[2],fz=g.anchors[3],dx=hx-fx,dz=hz-fz,length=Math.hypot(dx,dz),gx=mass*g.gravity[0],gz=mass*g.gravity[1];
 if(!Number.isFinite(cx+cz+gx+gz+length)||mass<=0){out.status='nonfinite';return false;}
 if(length<1e-6){out.status='anchor-separation';return false;}
 const ux=dx/length,uz=dz/length,moment=-((cz-fz)*gx-(cx-fx)*gz),h0x=dz*moment/(length*length),h0z=-dx*moment/(length*length);
 let denominator=0,numerator=0,lower=-Infinity,upper=Infinity;
 for(let i=0;i<4;i++){
  const hand=i>=2,x=g.joints[2*i],z=g.joints[2*i+1],rx=(hand?hx:fx)-x,rz=(hand?hz:fz)-z;
  let a=-(rz*(hand?h0x:-gx-h0x)-rx*(hand?h0z:-gz-h0z))-g.passive[i];
  for(const j of EFFORT_DESCENDANTS[i])a-=g.mass[j]*((g.com[2*j+1]-z)*g.gravity[0]-(g.com[2*j]-x)*g.gravity[1]);
  const b=-(rz*ux-rx*uz)*(hand?1:-1),limit=g.limits[i];
  if(!Number.isFinite(a+b+limit)||limit<0){out.status='nonfinite';return false;}
  out.atZero[i]=a;out.slope[i]=b;denominator+=b*b;numerator+=a*b;
  if(Math.abs(b)<1e-12){if(Math.abs(a)>limit+1e-9){out.status='torque-limits';return false;}}
  else{const first=(-limit-a)/b,second=(limit-a)/b;lower=Math.max(lower,Math.min(first,second));upper=Math.min(upper,Math.max(first,second));}
 }
 if(denominator<1e-20){out.status='degenerate-torque-policy';return false;}
 if(lower>upper){out.status='torque-limits';return false;}
 out.unconstrained=-numerator/denominator;out.lambda=Math.max(lower,Math.min(upper,out.unconstrained));out.lower=lower;out.upper=upper;out.objective=0;
 out.hand[0]=h0x+out.lambda*ux;out.hand[1]=h0z+out.lambda*uz;out.foot[0]=-gx-out.hand[0];out.foot[1]=-gz-out.hand[1];
 for(let i=0;i<4;i++){out.active[i]=out.atZero[i]+out.slope[i]*out.lambda;out.total[i]=out.active[i]+g.passive[i];out.objective+=out.active[i]*out.active[i];}
 out.forceResidual[0]=out.hand[0]+out.foot[0]+gx;out.forceResidual[1]=out.hand[1]+out.foot[1]+gz;
 out.momentResidual=dz*out.hand[0]-dx*out.hand[1]+(cz-fz)*gx-(cx-fx)*gz;
 out.status='available';return true;
}
