// Offline frozen-state internal dynamics. Reuse the already native-verified
// coupled inverse instead of treating the internal principal mass block as M^-1.
import {inverseMass} from '../spinning-gap.mjs';
export function internalFrequencyBound(K,q,{hubMass,tyreMass,hubInertia,skin}){
 if(!q||q.length<2||q.length%2||!Array.from(q).every(Number.isFinite)||![hubMass,tyreMass,hubInertia,skin].every(Number.isFinite)||Math.min(hubMass,tyreMass,hubInertia)<=0||skin<0)throw RangeError('Invalid coupled mass/geometry');
 const n=q.length,N=n/2,m=tyreMass/N,J0=hubInertia+tyreMass*skin*skin/2;
 if(!Array.isArray(K)||K.length!==n||K.some(row=>row.length!==n||!Array.from(row).every(Number.isFinite)))throw RangeError('Invalid internal tangent');
 const b=Array.from({length:N},(_,i)=>[q[2*i],q[2*i+1]]),rows=new Float64Array(n),rhs=new Array(n+3).fill(0);let fixedHub=0;
 for(let i=0;i<n;i++){let sum=0;for(let j=0;j<n;j++)sum+=Math.abs(K[i][j]);fixedHub=Math.max(fixedHub,sum/m);}
 for(let j=0;j<n;j++){for(let i=0;i<n;i++)rhs[i+3]=K[i][j];const a=inverseMass(rhs,b,m,hubMass,J0,0);for(let i=0;i<n;i++)rows[i]+=Math.abs(a[i+3]);}
 const lambdaBound=Math.max(...rows);if(!Number.isFinite(lambdaBound))throw RangeError('Nonfinite mass-frequency bound');
 return {lambdaBound,fixedHubLambdaBound:fixedHub,nodeMass:m,hubSpinInertiaWithNodes:J0,oscillatorScaleSeconds:lambdaBound>0?2/Math.sqrt(lambdaBound):null};
}
export function casingTangent(model,q,h=1e-7){
 if(!Number.isFinite(h)||h<=0||h>1e-4)throw RangeError('Invalid tangent difference step');
 const n=q.length,A=Array.from({length:n},()=>new Float64Array(n)),p=Float64Array.from(q);
 for(let j=0;j<n;j++){p[j]=q[j]+h;const plus=Float64Array.from(model.evaluate(p).forces);p[j]=q[j]-h;const minus=model.evaluate(p).forces;for(let i=0;i<n;i++)A[i][j]=-(plus[i]-minus[i])/(2*h);p[j]=q[j];}
 let skewInf=0;for(let i=0;i<n;i++){let sum=0;for(let j=0;j<n;j++)sum+=Math.abs(A[i][j]-A[j][i]);skewInf=Math.max(skewInf,sum);}
 for(let i=0;i<n;i++)for(let j=0;j<i;j++)A[i][j]=A[j][i]=(A[i][j]+A[j][i])/2;
 return {matrix:A,skewInf};
}
