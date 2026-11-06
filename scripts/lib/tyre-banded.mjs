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
// (B + c*g*g^T)x=rhs via two band solves; B must already factor as SPD.
export function solveBandRankOne(L,rhs,{coefficient:c,vector:g},bands,shift=0){
 const x=solveBand(L,rhs),y=solveBand(L,g);let gx=0,gy=0;
 for(let i=0;i<x.length;i++){gx+=g[i]*x[i];gy+=g[i]*y[i];}
 const denominator=1+c*gy;
 if(!Number.isFinite(denominator)||denominator<1||!Number.isFinite(c)||c<0)return null;
 const weight=c*gx/denominator;for(let i=0;i<x.length;i++)x[i]-=weight*y[i];
 // Check the FULL shifted system, not just the Sherman-Morrison denominator.
 let gd=0,maxX=0,maxRhs=0,sumG=0,maxG=0;for(let i=0;i<x.length;i++){gd+=g[i]*x[i];maxX=Math.max(maxX,Math.abs(x[i]));maxRhs=Math.max(maxRhs,Math.abs(rhs[i]));sumG+=Math.abs(g[i]);maxG=Math.max(maxG,Math.abs(g[i]));}
 let residual=0;for(let i=0;i<x.length;i++){let value=shift*x[i]+c*g[i]*gd;for(let j=Math.max(0,i-3);j<Math.min(x.length,i+4);j++)value+=bands[4*Math.max(i,j)+Math.abs(i-j)]*x[j];residual=Math.max(residual,Math.abs(value-rhs[i]));}
 const bound=1e-12+1e-10*((bandNorm(bands)+shift+c*sumG*maxG)*maxX+maxRhs);
 return Number.isFinite(residual)&&Number.isFinite(bound)&&residual<=bound?x:null;
}
