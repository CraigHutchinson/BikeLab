// Parked exploratory producer; no equilibrium certification. See docs/RIDER_SADDLE_CHECKPOINT.md.
import {run,articulatedPreset,modelXML,validate} from '../../dist/trail-bike.js';
import {scalarLayout,applyState,captureState} from '../../dist/trail-initial-state.js';
import {createTrailForces} from '../../dist/trail-forces.js';
import {getRuntime} from '../../dist/moving-wheel.js';
import {appendFile,writeFile} from 'node:fs/promises';
// In-place Householder solve of the augmented full-rank least squares system.
function qr(A,b,rows,n,out){
 for(let k=0;k<n;k++){
  let norm=0;for(let i=k;i<rows;i++)norm=Math.hypot(norm,A[i*n+k]);if(!norm)return false;
  const alpha=A[k*n+k]>=0?-norm:norm,v0=A[k*n+k]-alpha;A[k*n+k]=v0;
  let vv=0;for(let i=k;i<rows;i++)vv+=A[i*n+k]**2;
  for(let j=k+1;j<n;j++){let dot=0;for(let i=k;i<rows;i++)dot+=A[i*n+k]*A[i*n+j];dot*=2/vv;for(let i=k;i<rows;i++)A[i*n+j]-=dot*A[i*n+k];}
  let dot=0;for(let i=k;i<rows;i++)dot+=A[i*n+k]*b[i];dot*=2/vv;for(let i=k;i<rows;i++)b[i]-=dot*A[i*n+k];
  A[k*n+k]=alpha;for(let i=k+1;i<rows;i++)A[i*n+k]=0;
 }
 for(let i=n-1;i>=0;i--){let x=b[i];for(let j=i+1;j<n;j++)x-=A[i*n+j]*out[j];out[i]=x/A[i*n+i];if(!Number.isFinite(out[i]))return false;}return true;
}
const log=async(...x)=>{const line=x.map(x=>typeof x==='object'?JSON.stringify(x):String(x)).join(' ');console.log(line);await appendFile('artifacts/static-progress-2.txt',line+'\n');};
for(const bike of ['full','hardtail'])for(const seated of [false,true]){
 let a=articulatedPreset(bike);a.initialization={mode:'launch'};if(seated)a.saddle={};a.motion.duration=.1;a.articulated=structuredClone(a.articulated);a.articulated.closureTime=.01;for(const law of Object.values(a.articulated.passive.joints)){law.stiffness*=10;law.damping*=5;}
 const seed=await run(a),mj=await getRuntime(),m=mj.MjModel.from_xml_string(modelXML(a)),d=new mj.MjData(m),layout=scalarLayout(mj,m),forces=createTrailForces(mj,m,validate(a));
 try{
 applyState(seed.finalState,seed.initialState.identity,layout,d);d.qvel.fill(0);d.qacc.fill(0);
 const free=layout.filter(j=>j.name!=='travel'),n=free.length,rows=m.nv+n,Q=new Float64Array(d.qpos),R=new Float64Array(m.nv),P=new Float64Array(m.nv),J=new Float64Array(m.nv*n),A=new Float64Array(rows*n),b=new Float64Array(rows),step=new Float64Array(n),scale=new Float64Array(n);let lambda=.001,evals=0;
 function residual(out){d.qvel.fill(0);d.qacc.fill(0);mj.mj_inverse(m,d);forces.apply(d,{rearDrive:0});let sum=0;for(let i=0;i<m.nv;i++){out[i]=d.qfrc_inverse[i]-d.qfrc_applied[i];sum+=out[i]*out[i];}evals++;return sum;}
 let cost=residual(R);
 for(let iter=0;iter<60;iter++){
  const peak=Math.max(...R.map(Math.abs));await log(bike,seated,iter,cost,peak,lambda);if(peak<1e-6)break;Q.set(d.qpos);
  for(let k=0;k<n;k++){const j=free[k],h=j.type==='slide'?1e-7:1e-6;d.qpos.set(Q);d.qpos[j.q]+=h;residual(P);for(let i=0;i<m.nv;i++)J[i*n+k]=(P[i]-R[i])/h;let norm=0;for(let i=0;i<m.nv;i++)norm=Math.hypot(norm,J[i*n+k]);scale[k]=Math.max(norm,1);}
  let accepted=false;
  for(let trial=0;trial<12;trial++){
   A.fill(0);b.fill(0);for(let i=0;i<m.nv;i++){b[i]=-R[i];for(let k=0;k<n;k++)A[i*n+k]=J[i*n+k]/scale[k];}for(let k=0;k<n;k++)A[(m.nv+k)*n+k]=Math.sqrt(lambda);
   if(!qr(A,b,rows,n,step))throw Error('QR failure');let ratio=1;for(let k=0;k<n;k++){step[k]/=scale[k];ratio=Math.max(ratio,Math.abs(step[k])/(free[k].type==='slide'?.02:.1));}
   d.qpos.set(Q);for(let k=0;k<n;k++)d.qpos[free[k].q]+=step[k]/ratio;
   const next=residual(P);if(Number.isFinite(next)&&next<cost){cost=next;R.set(P);lambda=Math.max(1e-12,lambda*.25);accepted=true;break;}lambda*=10;
  }
  if(!accepted){d.qpos.set(Q);break;}
 }
 d.qvel.fill(0);const state=captureState(seed.initialState.identity,layout,d);const input={...seed.scenario,motion:{gravity:a.motion.gravity??9.80665,duration:.25,dt:a.motion.dt??.00003125,sampleDt:.005},initialization:{mode:'state',state}};
 const hold=await run(input);await writeFile('artifacts/static2-'+bike+'-'+seated+'.json',JSON.stringify(hold));await log('HOLD',bike,seated,cost,evals,hold.status,hold.termination,hold.initialDiagnostics,hold.finalDiagnostics);
 }finally{d.delete();m.delete();}
}
