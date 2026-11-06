// Internal offline solver algebra: lower row storage A[i,j] = bands[4*i+i-j].
// Two coordinates per node and nearest-neighbour blocks give half bandwidth 3.
export function bandNorm(bands){
 const n=bands.length/4,sums=new Float64Array(n);
 for(let i=0;i<n;i++)for(let d=0;d<=Math.min(3,i);d++){
  const v=Math.abs(bands[4*i+d]);sums[i]+=v;if(d)sums[i-d]+=v;
 }
 return Math.max(...sums);
}
export function factorBand(bands,shift=0){
 const n=bands.length/4,L=new Float64Array(bands.length),scale=Math.max(1,bandNorm(bands)+shift);
 for(let i=0;i<n;i++)for(let j=Math.max(0,i-3);j<=i;j++){
  let v=bands[4*i+i-j]+(i===j?shift:0);
  for(let k=Math.max(0,i-3,j-3);k<j;k++)v-=L[4*i+i-k]*L[4*j+j-k];
  if(i===j){if(!Number.isFinite(v)||v<=1e-12*scale)return null;L[4*i]=Math.sqrt(v);}
  else L[4*i+i-j]=v/L[4*j];
 }
 return L;
}
export function solveBand(L,rhs){
 const n=rhs.length,x=new Float64Array(n);
 for(let i=0;i<n;i++){let v=rhs[i];for(let j=Math.max(0,i-3);j<i;j++)v-=L[4*i+i-j]*x[j];x[i]=v/L[4*i];}
 for(let i=n-1;i>=0;i--){let v=x[i];for(let j=i+1;j<Math.min(n,i+4);j++)v-=L[4*j+j-i]*x[j];x[i]=v/L[4*i];}
 return x;
}
