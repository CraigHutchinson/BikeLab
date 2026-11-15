// Shared offline dense factorization; never used in the integration loop.
export const normInf=A=>Math.max(...A.map(row=>row.reduce((s,x)=>s+Math.abs(x),0)));
export function factor(A,shift=0){
 const n=A.length,L=Array.from({length:n},()=>new Float64Array(n)),scale=Math.max(1,normInf(A)+shift);let minPivot=Infinity;
 for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
  let value=A[i][j]+(i===j?shift:0);for(let k=0;k<j;k++)value-=L[i][k]*L[j][k];
  if(i===j){if(!Number.isFinite(value)||value<=1e-12*scale)return null;minPivot=Math.min(minPivot,value);L[i][j]=Math.sqrt(value);}else L[i][j]=value/L[j][j];
 }
 return {L,minPivot,scale};
}
export function linearSolve({L},rhs){
 const n=rhs.length,y=new Float64Array(n),x=new Float64Array(n);
 for(let i=0;i<n;i++){let v=rhs[i];for(let j=0;j<i;j++)v-=L[i][j]*y[j];y[i]=v/L[i][i];}
 for(let i=n-1;i>=0;i--){let v=y[i];for(let j=i+1;j<n;j++)v-=L[j][i]*x[j];x[i]=v/L[i][i];}
 return x;
}
