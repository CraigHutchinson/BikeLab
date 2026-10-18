import test from 'node:test';
import assert from 'node:assert/strict';
import {solveRing,solveFootprint,footprintFixture,validate,replayFootprint,DEFAULTS,contourIntrusion} from '../dist/footprint.js';
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b} (±${t})`);
const solved=(p,profile)=>{const r=solveFootprint(p,profile);assert.equal(r.status,'solved',r.reason);return r;};
// Dense elimination and exhaustive active sets, independent of coordinate sweeps.
function dense(A,b){
 const m=A.map((row,i)=>[...row,b[i]]),n=b.length;
 for(let i=0;i<n;i++){
  let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[pivot][i]))pivot=j;
  [m[i],m[pivot]]=[m[pivot],m[i]];const d=m[i][i];assert.ok(Math.abs(d)>1e-12);
  for(let k=i;k<=n;k++)m[i][k]/=d;
  for(let j=0;j<n;j++)if(j!==i){const f=m[j][i];for(let k=i;k<=n;k++)m[j][k]-=f*m[i][k];}
 }return m.map(row=>row[n]);
}
function reference(lower,r,k,T){
 const n=lower.length,ds=2*Math.PI*r/n,H=Array.from({length:n},()=>Array(n).fill(0));
 for(let i=0;i<n;i++){H[i][i]+=k*ds;const j=(i+1)%n;H[i][i]+=T/ds;H[j][j]+=T/ds;H[i][j]-=T/ds;H[j][i]-=T/ds;}
 for(let mask=0;mask<2**n;mask++){
  const free=[],fixed=[];for(let i=0;i<n;i++)((mask>>i)&1?fixed:free).push(i);
  const u=Array.from(lower),x=dense(free.map(i=>free.map(j=>H[i][j])),free.map(i=>-fixed.reduce((s,j)=>s+H[i][j]*u[j],0)));
  free.forEach((i,j)=>u[i]=x[j]);const g=H.map(row=>row.reduce((s,h,j)=>s+h*u[j],0));
  if(u.every((v,i)=>v>=lower[i]-1e-10)&&fixed.every(i=>g[i]>=-1e-8))return {u,g,energy:u.reduce((s,v,i)=>s+.5*v*g[i],0)};
 }throw Error('No feasible independent optimum');
}
test('radial QP matches independent active-set solves, KKT and exact uncoupled solution',()=>{
 for(const lower of [[0,.01,0,0],[.02,0,.01,0,0,0],[0,.03,0,0,.02,0,.005]])for(const T of [0,30,200]){
  const a=solveRing(lower,.36,300000,T),b=reference(lower,.36,300000,T);assert.ok(a.converged);
  a.u.forEach((v,i)=>{near(v,b.u[i],1e-10);assert.ok(v>=lower[i]);assert.ok(a.gradient[i]>=-1e-7);near((v-lower[i])*a.gradient[i],0,1e-8);});near(a.energy,b.energy,1e-8);
  if(T===0)assert.deepEqual([...a.u],lower);
 }
});
test('normal force and +My equal derivatives of minimized energy under translation and rotation',()=>{
 for(const p of [{fixture:'flat',height:.345,rotation:.003},{fixture:'rounded',centerX:-.1,height:.4,rotation:.002},{fixture:'bridge',centerX:.002,height:.383}]){
  const a=solved(p);
  for(const [key,channel] of [['centerX','forceX'],['height','forceZ'],['rotation','momentY']])for(const eps of [2e-7,1e-7]){
   const mid=p[key]??DEFAULTS[key],hi=solved({...p,[key]:mid+eps}),lo=solved({...p,[key]:mid-eps});near(-(hi.summary.energy-lo.summary.energy)/(2*eps),a.summary[channel],2e-4);
  }
  const sum=a.contacts.reduce((s,c)=>[s[0]+c.forceX,s[1]+c.forceZ,s[2]+(c.z-a.params.height)*c.forceX-(c.x-a.params.centerX)*c.forceZ],[0,0,0]);
  near(sum[0],a.summary.forceX);near(sum[1],a.summary.forceZ);near(sum[2],a.summary.momentY);
  for(const c of a.contacts){assert.ok(c.normalForce>0);near(Math.hypot(c.nx,c.nz),1,1e-12);const [v,w]=[a.profile.points[c.feature],a.profile.points[c.feature+1]];near((c.x-v[0])*(w[1]-v[1])-(c.z-v[1])*(w[0]-v[0]),0,1e-10);}
 }
});
test('quasistatic holding work converges to stored energy change',()=>{
 const first=solved({height:.355}),last=solved({height:.34}),delta=last.summary.energy-first.summary.energy,errors=[];
 for(const steps of [32,64,128]){let work=0,previous=first;for(let i=1;i<=steps;i++){const next=solved({height:.355-.015*i/steps});work-=.5*(previous.summary.forceZ+next.summary.forceZ)*(next.params.height-previous.params.height);previous=next;}errors.push(Math.abs(work-delta));}
 assert.ok(errors[2]<.002);assert.ok(errors[2]<errors[0]);
});
test('flat separation, mirrored two-support sharing and segment subdivision preserve load',()=>{
 const free=solved({height:.4});assert.equal(free.contacts.length,0);assert.equal(free.summary.energy,0);assert.equal(free.summary.forceZ,0);
 const flat=solved();near(flat.summary.forceX,0);near(flat.summary.momentY,0);
 const bridge=solved({fixture:'bridge',height:.383});assert.ok(bridge.contacts.some(c=>c.x<-.04));assert.ok(bridge.contacts.some(c=>c.x>.04));assert.ok(bridge.contacts.every(c=>Math.abs(c.x)>.04));near(bridge.summary.forceX,0);near(bridge.summary.momentY,0);
 const left=solved({fixture:'bridge',height:.383,centerX:-.002}),right=solved({fixture:'bridge',height:.383,centerX:.002});near(left.summary.forceX,-right.summary.forceX);near(left.summary.forceZ,right.summary.forceZ);near(left.summary.momentY,-right.summary.momentY);
 const p=footprintFixture('flat');p.points=[[-1,0],[-.2,0],[0,0],[.2,0],[1,0]];
 const split=solved({},p);for(const key of ['forceX','forceZ','momentY','energy'])near(split.summary[key],flat.summary[key],1e-9);
});
test('tyre and terrain refinement are independent and do not multiply stiffness',()=>{
 for(const p of [{fixture:'flat'},{fixture:'step',centerX:.1,height:.445},{fixture:'rounded',centerX:.1,height:.44},{fixture:'bridge',height:.383}]){
  const rows=[256,512,1024].map(nodes=>solved({...p,nodes}));
  const [a,b]=rows.slice(1);assert.ok(Math.abs(a.summary.forceZ/b.summary.forceZ-1)<.01);assert.ok(Math.abs(a.summary.energy/b.summary.energy-1)<.01);assert.ok(b.summary.contourIntrusion<=a.summary.contourIntrusion+1e-10);
 }
 for(const p of [{fixture:'rounded',centerX:.1,height:.44},{fixture:'bridge',height:.383}]){
  const rows=[64,128,256].map(terrainSegments=>solved({...p,nodes:1024,terrainSegments}));
  assert.ok(Math.abs(rows[1].summary.forceZ/rows[2].summary.forceZ-1)<.01);
  assert.ok(Math.abs(rows[1].summary.energy/rows[2].summary.energy-1)<.01);
 }
});
test('unsupported rim, domain, buried and exposed-edge geometry never publishes loads',()=>{
 for(const [p,profile] of [[{height:.29}], [{height:.1},footprintFixture('step')], [{}, {...footprintFixture('flat'),points:[[-.2,0],[.2,0]]}], [{fixture:'step',centerX:-.2,height:.36}]]){
  const a=solveFootprint(p,profile);assert.equal(a.status,'unsupported');assert.ok(a.reason);assert.equal(a.contacts,undefined);assert.equal(a.summary,undefined);assert.equal(a.outline,undefined);
 }
 const step=footprintFixture('step');assert.ok(contourIntrusion(step.points,[[-.01,.09],[.01,.09],[0,.2]])>.009);
 // Exact ray through the sharp top-left vertex: two distinct normals are active.
 const angle=Math.atan2(.2,.26),rotation=-Math.PI+(.5)*2*Math.PI/512-angle;
 const wrapped=Math.atan2(Math.sin(rotation),Math.cos(rotation));const corner=solveFootprint({fixture:'step',centerX:-.2,height:.36,rotation:wrapped});assert.equal(corner.status,'unsupported');assert.match(corner.reason,/corner/);
});
test('configuration, profile ownership and complete record replay are strict',()=>{
 for(const p of [{extra:1},{nodes:2048},{terrainSegments:12},{foundation:0},{coupling:-1},{rotation:Infinity},{rimRadius:.35},{fixture:'typo'},{height:NaN},null,[]])assert.throws(()=>validate(p));
 for(const lower of [[0,0,0],[0,NaN,0,0],[0,-1,0,0]])assert.throws(()=>solveRing(lower,.36,300000,30));
 const p=footprintFixture('flat'),a=solved({},p),record=JSON.parse(JSON.stringify(a));p.points[0][0]=-9;assert.equal(a.profile.points[0][0],-1);
 record.summary.forceZ=-123;assert.deepEqual(replayFootprint(record),a);delete record.params.nodes;assert.throws(()=>replayFootprint(record));
 assert.throws(()=>replayFootprint({...a,model:'future'}));assert.throws(()=>replayFootprint({...a,profile:undefined}));
});
