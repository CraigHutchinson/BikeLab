// Offline dense Newton diagnostic; deliberately not an integration-loop solver.
import {createMeridianDiagnostic} from './tyre-meridian.mjs';
import {bandNorm,factorBand,solveBand,solveBandRankOne} from './tyre-banded.mjs';
export const BUDGETS=Object.freeze({force:1e-5,forcePerArea:.01,step:1e-7,armijo:1e-4,maxIterations:80});
const clone=q=>q.map(p=>[...p]);
const free=s=>s.forces.slice(1,-1).flat();
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const normInf=A=>Math.max(...A.map(row=>row.reduce((s,x)=>s+Math.abs(x),0)));
function factor(A,shift=0){
 const n=A.length,L=Array.from({length:n},()=>new Float64Array(n)),scale=Math.max(1,normInf(A)+shift);let minPivot=Infinity;
 for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
  let value=A[i][j]+(i===j?shift:0);for(let k=0;k<j;k++)value-=L[i][k]*L[j][k];
  if(i===j){if(!Number.isFinite(value)||value<=1e-12*scale)return null;minPivot=Math.min(minPivot,value);L[i][j]=Math.sqrt(value);}else L[i][j]=value/L[j][j];
 }
 return {L,minPivot,scale};
}
function linearSolve({L},rhs){
 const n=rhs.length,y=new Float64Array(n),x=new Float64Array(n);
 for(let i=0;i<n;i++){let v=rhs[i];for(let j=0;j<i;j++)v-=L[i][j]*y[j];y[i]=v/L[i][i];}
 for(let i=n-1;i>=0;i--){let v=y[i];for(let j=i+1;j<n;j++)v-=L[j][i]*x[j];x[i]=v/L[i][i];}
 return x;
}
function tangent(model,q,h){
 const n=2*(q.length-2),raw=Array.from({length:n},()=>new Float64Array(n));
 for(let j=0;j<n;j++){
  const a=clone(q),b=clone(q),node=1+Math.floor(j/2),axis=j%2;a[node][axis]+=h;b[node][axis]-=h;
  const fa=free(model.evaluate(a)),fb=free(model.evaluate(b));for(let i=0;i<n;i++)raw[i][j]=-(fa[i]-fb[i])/(2*h);
 }
 const skew=raw.map((row,i)=>row.map((x,j)=>x-raw[j][i])),matrix=raw.map((row,i)=>row.map((x,j)=>(x+raw[j][i])/2));
 return {matrix,asymmetryInf:normInf(skew),matrixInf:normInf(matrix)};
}
function areas(c){
 const q=c.restPoints,a=q.slice(1).map((p,i)=>2*Math.PI*(c.rimRadius+(p[1]+q[i][1])/2)*Math.hypot(p[0]-q[i][0],p[1]-q[i][1]));
 return a.slice(1).map((x,i)=>(x+a[i])/2);
}
export function inspectEquilibriumTangent(configuration,points){
 const model=createMeridianDiagnostic(configuration);model.evaluate(points);
 let a,b;try{a=tangent(model,points,BUDGETS.step);b=tangent(model,points,BUDGETS.step/2);}catch(e){if(!(e instanceof RangeError))throw e;return {classification:'indeterminate',reason:'finite-difference-domain'};}
 const fa=factor(a.matrix),fb=factor(b.matrix),differenceInf=normInf(a.matrix.map((row,i)=>row.map((x,j)=>x-b.matrix[i][j])));
 const report={classification:'indeterminate',scope:'Fixed-bead finite-dimensional axisymmetric tangent only',steps:[BUDGETS.step,BUDGETS.step/2],differenceInf,asymmetryInf:[a.asymmetryInf,b.asymmetryInf],matrixInf:b.matrixInf,unshiftedPositiveDefinite:[!!fa,!!fb]};
 if(!fa||!fb)return {...report,reason:'non-positive-or-marginal-unshifted-tangent'};
 const n=b.matrix.length,rowSums=new Float64Array(n);
 for(let j=0;j<n;j++){const rhs=new Float64Array(n);rhs[j]=1;const x=linearSolve(fb,rhs);for(let i=0;i<n;i++)rowSums[i]+=Math.abs(x[i]);}
 const inverseInf=Math.max(...rowSums),eigenvalueLowerBound=1/inverseInf,errorEstimate=differenceInf+Math.max(a.asymmetryInf,b.asymmetryInf);
 return {...report,eigenvalueLowerBound,conditionBound:b.matrixInf*inverseInf,errorEstimate,classification:eigenvalueLowerBound>10*errorEstimate+1e-10*b.matrixInf?'positive-with-refinement-margin':'indeterminate'};
}
export function solveMeridianEquilibrium(configuration,initial=configuration.restPoints,options={}){
 if(!options||Object.getPrototypeOf(options)!==Object.prototype||Reflect.ownKeys(options).some(k=>!['maxIterations','maxBacktracks','tangent'].includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(options,k),'value')))throw TypeError('Invalid solver options');
 const {maxIterations=BUDGETS.maxIterations,maxBacktracks=32,tangent:method='finite-difference'}=options;
 if(!['finite-difference','analytic-banded'].includes(method))throw RangeError('Invalid tangent method');
 if(!Number.isInteger(maxIterations)||maxIterations<0||maxIterations>200||!Number.isInteger(maxBacktracks)||maxBacktracks<0||maxBacktracks>40)throw RangeError('Invalid iteration limits');
 const model=createMeridianDiagnostic(configuration);let q=clone(initial),state=model.evaluate(q);
 if(q.length>65)throw RangeError('Dense diagnostic supports at most 64 segments');
 for(const i of [0,q.length-1])for(let k=0;k<2;k++)if(q[i][k]!==configuration.restPoints[i][k])throw RangeError('Initial beads must equal fixed reference beads');
 const weights=areas(configuration),history=[];
 const metrics=(s=state)=>({maxForce:s.maxFreeResidual,maxForcePerArea:Math.max(...s.forces.slice(1,-1).map((f,i)=>Math.hypot(...f)/weights[i]))});
 const finish=(converged,reason)=>({converged,reason,points:clone(q),state,metrics:metrics(),iterations:history.length,history});
 for(let iteration=0;iteration<=maxIterations;iteration++){
  const metric=metrics();if(metric.maxForce<=BUDGETS.force&&metric.maxForcePerArea<=BUDGETS.forcePerArea)return finish(true,'residual-converged');
  if(iteration===maxIterations)return finish(false,'iteration-limit');
  let t;try{if(method==='analytic-banded'){t=model.tangentParts(q);t.matrixInf=bandNorm(t.bands);if(t.rankOne){const v=t.rankOne.vector.map(Math.abs);t.matrixInf+=t.rankOne.coefficient*Math.max(...v)*v.reduce((s,x)=>s+x,0);}}else t=tangent(model,q,BUDGETS.step);}catch(e){if(!(e instanceof RangeError))throw e;return finish(false,method==='finite-difference'?'finite-difference-domain':'analytic-tangent-domain');}
  let shift=0,F=free(state),direction=null;
  for(let trial=0;trial<12;trial++){
   const f=t.bands?factorBand(t.bands,shift):factor(t.matrix,shift);if(f){const d=t.bands?(t.rankOne?solveBandRankOne(f,F,t.rankOne,t.bands,shift):solveBand(f,F)):linearSolve(f,F);if(d?.every(Number.isFinite)&&dot(F,d)>0){direction=d;break;}}
   shift=shift===0?Math.max(1,t.matrixInf)*1e-6:shift*10;
  }
  if(!direction)return finish(false,'no-descent-direction');
  const descent=dot(F,direction),before=state.potential;let accepted=false,alpha=1,invalidTrials=0;
  for(let trial=0;trial<maxBacktracks;trial++,alpha*=.5){
   const candidate=clone(q);for(let j=0;j<direction.length;j++)candidate[1+Math.floor(j/2)][j%2]+=alpha*direction[j];
   let next;try{next=model.evaluate(candidate);}catch(e){if(!(e instanceof RangeError))throw e;invalidTrials++;continue;}
   const armijoBound=before-BUDGETS.armijo*alpha*descent;
   const energyRoundoff=64*Number.EPSILON*(1+Math.abs(state.materialEnergy)+Math.abs(state.potential-state.materialEnergy));
   const nextMetric=metrics(next),armijo=next.potential<=armijoBound&&next.potential<before;
   // Near the root, O(force²/stiffness) energy changes can be unresolvable.
   // Require strong reduction of BOTH residuals, without relaxing either gate.
   const roundoff=alpha*descent<=energyRoundoff&&next.potential<=before+energyRoundoff&&nextMetric.maxForce<metric.maxForce/2&&nextMetric.maxForcePerArea<metric.maxForcePerArea/2;
   if(armijo||roundoff){
    history.push({potentialBefore:before,potential:next.potential,alpha,shift,invalidTrials,armijoBound,acceptance:armijo?'armijo':'roundoff-residual',energyAllowance:armijo?0:energyRoundoff,...metric});q=candidate;state=next;accepted=true;break;
   }
  }
  if(!accepted)return finish(false,'line-search-exhausted');
 }
}
