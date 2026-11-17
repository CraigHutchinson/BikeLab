// Offline constrained equilibrium of the same swept membrane. No inertia,
// penalty springs or native contact; zero-thickness surface above a flat plane.
import {createSweptCasing,MODEL as CASING_MODEL,ENDPOINT_MODEL,RELAXED_MODEL} from '../../dist/sealed-casing.js';
import {factor,linearSolve,normInf} from './tyre-dense.mjs';
export const MODEL='bikelab-sealed-plane-equilibrium-0.1';
export const BUDGETS=Object.freeze({force:1e-5,gap:1e-12,differenceStep:1e-7,maxIterations:100,maxBacktracks:32,armijo:1e-4});
function snapshot(model,q){const s=model.evaluate(q);return {...s,forces:Array.from(s.forces),materialForces:Array.from(s.materialForces),gasForces:Array.from(s.gasForces)};}
function residual(q,f,height){let value=0;for(let i=0;i<q.length;i++)value=Math.max(value,Math.abs(i%2&&q[i]+height<=BUDGETS.gap?Math.max(0,f[i]):f[i]));return value;}
function freeCoordinates(q,f,height){return Array.from(q.keys()).filter(i=>!(i%2&&q[i]+height<=BUDGETS.gap&&f[i]<-BUDGETS.force));}
function tangent(model,q,free,h){
 const raw=free.map(()=>new Float64Array(free.length)),p=Float64Array.from(q);
 for(let j=0;j<free.length;j++){const k=free[j];p[k]=q[k]+h;const a=Float64Array.from(model.evaluate(p).forces);p[k]=q[k]-h;const b=model.evaluate(p).forces;for(let i=0;i<free.length;i++)raw[i][j]=-(a[free[i]]-b[free[i]])/(2*h);p[k]=q[k];}
 return {matrix:raw.map((row,i)=>row.map((v,j)=>(v+raw[j][i])/2)),skew:normInf(raw.map((row,i)=>row.map((v,j)=>v-raw[j][i])))};
}
function stability(model,q,f,height){
 // Strict reactions fix a vertical coordinate. Weak reactions remain FREE,
 // a conservative superset of the critical cone, including release directions.
 const free=freeCoordinates(q,f,height),h=BUDGETS.differenceStep;
 let a,b;try{a=tangent(model,q,free,h);b=tangent(model,q,free,h/2);}catch(e){if(!(e instanceof RangeError))throw e;return {classification:'indeterminate',reason:'difference-domain'};}
 const fa=factor(a.matrix),fb=factor(b.matrix),difference=normInf(a.matrix.map((row,i)=>row.map((v,j)=>v-b.matrix[i][j]))),error=difference+Math.max(a.skew,b.skew),scale=normInf(b.matrix);
 const out={classification:'indeterminate',freeCoordinates:free.length,steps:[h,h/2],differenceInf:difference,skewInf:[a.skew,b.skew],matrixInf:scale,unshiftedPositive:[!!fa,!!fb]};
 if(!fa||!fb)return {...out,reason:'nonpositive-or-marginal'};
 const rows=new Float64Array(free.length);
 for(let j=0;j<free.length;j++){const rhs=new Float64Array(free.length);rhs[j]=1;const x=linearSolve(fb,rhs);for(let i=0;i<rows.length;i++)rows[i]+=Math.abs(x[i]);}
 const lower=1/Math.max(...rows);return {...out,eigenvalueLowerBound:lower,errorEstimate:error,classification:lower>10*error+1e-10*scale?'positive-with-refinement-margin':'indeterminate'};
}
export function solveSealedPlane(configuration,height,initial,options={}){
 if(!options||Object.getPrototypeOf(options)!==Object.prototype||Reflect.ownKeys(options).some(k=>!['maxIterations','maxBacktracks','casingModel','planeAngle'].includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(options,k),'value')))throw TypeError('Invalid static solver options');
 const {maxIterations=BUDGETS.maxIterations,maxBacktracks=BUDGETS.maxBacktracks,casingModel=CASING_MODEL,planeAngle=0}=options;
 if(!Number.isInteger(maxIterations)||maxIterations<0||maxIterations>200||!Number.isInteger(maxBacktracks)||maxBacktracks<0||maxBacktracks>40)throw RangeError('Invalid iteration limits');
 if(!Number.isFinite(planeAngle)||Math.abs(planeAngle)>Math.PI/configuration.nodes)throw RangeError('Plane phase outside half a station');
 const base=createSweptCasing(configuration,casingModel),cos=Math.cos(planeAngle),sin=Math.sin(planeAngle);
 // Solve in the plane frame: x'=cos*x-sin*z, z'=sin*x+cos*z.
 // Material coordinates and force gradients rotate together; beads remain above
 // the plane because height > rimRadius. At zero phase preserve exact old math.
 function rotate(points,inverse=false){const out=new Float64Array(points.length),s=inverse?-sin:sin;for(let i=0;i<points.length;i+=2){out[i]=cos*points[i]-s*points[i+1];out[i+1]=s*points[i]+cos*points[i+1];}return out;}
 const model=planeAngle===0?base:{...base,initial:rotate(base.initial),evaluate(points){const state=base.evaluate(rotate(points,true));return {...state,forces:rotate(state.forces),materialForces:rotate(state.materialForces),gasForces:rotate(state.gasForces)};}};
 if(!Number.isFinite(height)||height<=configuration.rimRadius||height>model.reference.radius+.01)throw RangeError('Hub height must clear the beads and stay in the diagnostic range');
 let q=Float64Array.from(initial??model.initial);model.evaluate(q);
 for(let i=1;i<q.length;i+=2)q[i]=Math.max(q[i],-height);
 let state=snapshot(model,q);const history=[];
 function finish(converged,reason){
  state=snapshot(model,q);const contacts=[];let reaction=0,minGap=Infinity,complementarity=0;
  for(let i=0;i<model.nodes;i++){const gap=q[2*i+1]+height;minGap=Math.min(minGap,gap);const force=gap<=BUDGETS.gap?Math.max(0,-state.forces[2*i+1]):0;reaction+=force;complementarity=Math.max(complementarity,Math.abs(force*gap));if(force>BUDGETS.force)contacts.push({node:i,x:q[2*i],reaction:force});}
  const stable=converged?stability(model,q,state.forces,height):{classification:'not-evaluated'};
  return {model:casingModel===RELAXED_MODEL?'bikelab-sealed-plane-equilibrium-relaxed-0.1':casingModel===ENDPOINT_MODEL?'bikelab-sealed-plane-equilibrium-endpoint-0.1':MODEL,converged,locallyAdmissible:converged&&state.compressiveCells===0&&stable.classification==='positive-with-refinement-margin',reason,planeAngle,coordinateFrame:'plane',admission:!converged?'solver-failed':state.compressiveCells?'compressive-resultant':stable.classification!=='positive-with-refinement-margin'?'stability-indeterminate':'admitted',height,deflection:model.reference.radius-height,coordinates:Array.from(q),reference:model.reference,state,reaction,materialReaction:-state.materialForces.filter((_,i)=>i%2).reduce((a,b)=>a+b,0),gasReaction:-state.gasForces.filter((_,i)=>i%2).reduce((a,b)=>a+b,0),contacts,activeVertexSpan:contacts.length?Math.max(...contacts.map(c=>c.x))-Math.min(...contacts.map(c=>c.x)):0,rimClearance:height-configuration.rimRadius,metrics:{maxKktForce:residual(q,state.forces,height),minGap,complementarity},stability:stable,iterations:history.length,history};
 }
 for(let iteration=0;iteration<=maxIterations;iteration++){
  state=snapshot(model,q);const metric=residual(q,state.forces,height);
  if(metric<=BUDGETS.force)return finish(true,'kkt-converged');
  if(iteration===maxIterations)return finish(false,'iteration-limit');
  const free=freeCoordinates(q,state.forces,height);let t;
  try{t=tangent(model,q,free,BUDGETS.differenceStep);}catch(e){if(!(e instanceof RangeError))throw e;return finish(false,'difference-domain');}
  const scale=Math.max(1,normInf(t.matrix));let accepted=false;
  for(let route=0;route<2&&!accepted;route++){
   let d=new Float64Array(q.length),shift=0;
   if(route===0){let found=false;for(let k=0;k<12;k++){const f=factor(t.matrix,shift);if(f){const x=linearSolve(f,free.map(i=>state.forces[i]));if(x.every(Number.isFinite)){for(let j=0;j<free.length;j++)d[free[j]]=x[j];found=true;break;}}shift=shift===0?scale*1e-6:shift*10;}if(!found)continue;}
   else for(let i=0;i<d.length;i++)d[i]=state.forces[i]/scale;
   for(let trial=0,alpha=1;trial<maxBacktracks;trial++,alpha*=.5){
    const candidate=Float64Array.from(q,(v,i)=>i%2?Math.max(-height,v+alpha*d[i]):v+alpha*d[i]);let descent=0;for(let i=0;i<q.length;i++)descent+=state.forces[i]*(candidate[i]-q[i]);if(!(descent>0))continue;
    let next;try{next=snapshot(model,candidate);}catch(e){if(!(e instanceof RangeError))throw e;continue;}
    const allowance=8*(2*model.nodes*configuration.section.length)*Number.EPSILON*(1+Math.abs(state.materialEnergy)+Math.abs(state.gasEnergy)+Math.abs((state.gaugePressure+configuration.ambientPressure)*model.reference.referenceVolume)),nextMetric=residual(candidate,next.forces,height);
    const armijo=next.potential<state.potential&&next.potential<=state.potential-BUDGETS.armijo*descent;
    const roundoff=descent<=allowance&&next.potential<=state.potential+allowance&&nextMetric<metric/2;
    if(armijo||roundoff){history.push({maxKktForce:metric,potential:next.potential,alpha,shift,route:route?'projected-gradient':'reduced-newton',acceptance:armijo?'armijo':'roundoff-residual'});q=candidate;accepted=true;break;}
   }
  }
  if(!accepted)return finish(false,'line-search-exhausted');
 }
}
