import {momentumClosure} from '../scripts/rig-momentum-reference.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runRig,rigRecord,validate,setupFromRecord,DEFAULTS,MODEL,RIDER_BUFFER_KEYS,getRuntime,modelXML,G} from '../dist/bike-rig.js';
import {travelBuffer} from '../dist/travel-buffer.js';
import {createLoadObserver,interfaceWrench} from '../dist/rig-loads.js';
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const preset={rider:'compliant',riderBuffer:'progressive',riderMass:20,riderTravel:.02,riderBufferWidth:.019,riderStiffness:40000,riderDamping:0,forkBuffer:'progressive',shockBuffer:'progressive',input:'together',amplitude:.08,bumpDuration:.2,duration:2};

test('centered rider buffers have restoring signs and account for paired power exactly',()=>{
  const b=new Float64Array(5),a=new Float64Array(5),c=new Float64Array(5),T=.04,w=.015,K=300000,C=1500,h=1e-7;
  for(const q of [-.039,-.03,0,.03,.039])for(const u of [-.3,0,.3]){
    travelBuffer(q+T,u,2*T,w,K,C,b);travelBuffer(q+T+h,0,2*T,w,K,C,a);travelBuffer(q+T-h,0,2*T,w,K,C,c);
    close(b[0]*u+(a[1]-c[1])/(2*h)*u+b[2],0,1e-5);assert.ok(b[1]>=0&&b[2]>=0);
    assert.ok(q<0?b[0]>=0:b[0]<=0);if(q*u<0)assert.equal(b[2],0);
  }
});

test('native interface sign and moment translation agree with independent hanging mass and offset force',async()=>{
  const mj=await getRuntime(),m=mj.MjModel.from_xml_string(`<mujoco><option gravity="0 0 -${G}"/><worldbody><body pos="1 0 2"><inertial pos="0 0 0" mass="5" diaginertia="1 1 1"/></body></worldbody></mujoco>`),d=new mj.MjData(m),w=new Float64Array(3);
  try{d.xfrc_applied[6]=70;d.xfrc_applied[8]=90;d.xfrc_applied[10]=11;mj.mj_forward(m,d);mj.mj_rnePostConstraint(m,d);interfaceWrench(m,d,1,[1,0,2],w);close(w[0],-70);close(w[1],5*G-90);close(w[2],-11);interfaceWrench(m,d,1,[0,0,0],w);close(w[2],-11+2*(-70)-(5*G-90));}finally{d.delete();m.delete();}
});

test('snapshot loads independently satisfy rider Newton/Euler balance and corrected free-pivot moment',async()=>{
  const mj=await getRuntime(),p=validate(preset),m=mj.MjModel.from_xml_string(modelXML(p)),d=new mj.MjData(m);
  const id=(kind,name)=>mj.mj_name2id(m,kind,name),body=mj.mjtObj.mjOBJ_BODY.value,site=mj.mjtObj.mjOBJ_SITE.value;
  const ids={frame:id(body,'frame'),rear:id(body,'rear'),rider:id(body,'rider'),armSite:id(site,'shockArm'),frameSite:id(site,'shockFrame')},observer=createLoadObserver(mj,m,ids);
  try{for(const B of [-900,0,800])for(const pitch of [-.2,.15]){
    d.qpos.set([.02,pitch,.03,.1,-.012]);d.qvel.set([.4,-.6,.2,.3,-.15]);
    const theta=d.qpos[3],g=(await import('../dist/linkage.js')).geometryFor(p),j=(await import('../dist/linkage.js')).shockCompressionJacobian(theta,g);
    d.qfrc_applied[3]=B*j;d.qfrc_applied[4]=400;d.xfrc_applied[6*id(body,'front')+2]=350;d.xfrc_applied[6*ids.rear+2]=500;
    const original=Array.from(d.qpos),loads=observer.read(d,B,true,true),q=d.qpos[4],u=d.qvel[4],omega=d.qvel[1],acc=observer.data.qacc,s=Math.sin(pitch),c=Math.cos(pitch),alpha=acc[1];
    const ax=s*acc[4]+2*c*omega*u+q*(c*alpha-s*omega*omega),az=acc[0]+c*acc[4]-2*s*omega*u+q*(-s*alpha-c*omega*omega);
    close(loads[0],p.riderMass*ax);close(loads[1],p.riderMass*(az+G));close(loads[2],g.frameInertia*p.riderMass/p.mass*alpha);
    close(loads[3],-p.riderStiffness*q-p.riderDamping*u+400);close(loads[10],0);close(loads[6],0);close(loads[7],0);
    assert.deepEqual(Array.from(d.qpos),original);assert.ok(d.qacc.every(v=>v===0),'diagnostic solve must not change integrator acceleration');
  }}finally{observer.delete();d.delete();m.delete();}
});

for(const bike of ['full','hardtail'])test(`${bike} rider stops refine with global momentum, bounded travel and internal loads`,async()=>{
  const runs=[],momentumErrors=[];for(const dt of [.000125,.0000625,.00003125]){
    const r=await runRig({...preset,bike,dt,sampleDt:8*dt});runs.push(r);assert.equal(r.status,'complete');
    assert.ok(r.summary.peakRiderLowerForce>100&&r.summary.peakRiderUpperForce>20);assert.ok(r.summary.riderBufferLoss>0);assert.ok(r.summary.maxResidual/Math.max(1,Math.abs(r.summary.work),r.summary.loss)<.01);
    const s=r.signals;assert.ok(s.riderCompression.every(x=>Math.abs(x)<=r.params.riderTravel));
    for(let i=0;i<s.time.length;i++){close(s.guideAxial[i],s.riderTotalForce[i]);close(s.fixtureFz[i],0);close(s.fixtureMy[i],0);if(bike==='full')close(s.pivotMy[i],0);}
    momentumErrors.push(momentumClosure(r)); // sampled quadrature and first-order integration are checked under refinement
  }
  console.log(bike,'momentum errors',momentumErrors);
  const coarseObservation=await runRig({...preset,bike,dt:.00003125,sampleDt:.0025}),coarseError=momentumClosure(coarseObservation);
  for(let j=0;j<3;j++){assert.ok(momentumErrors[2][j]<.12);assert.ok(momentumErrors[2][j]<coarseError[j]);}
  assert.ok(Math.max(...momentumErrors[2])<Math.max(...momentumErrors[0]));
  const [a,b]=runs.slice(1);for(const key of ['peakRiderLowerForce','peakRiderUpperForce'])assert.ok(Math.abs(a.summary[key]-b.summary[key])/b.summary[key]<.02,key);
  for(let i=0;i<a.signals.time.length;i++)close(a.signals.riderCompression[i],b.signals.riderCompression[i*2],.0002);
  assert.ok(b.summary.maxResidual<a.summary.maxResidual);
});

test('new stop schema, weak-stop termination, dormant controls and historical channels are preserved',async()=>{
  for(const p of [{riderBuffer:'rigid'},{riderBufferWidth:.03,riderTravel:.02},{riderBufferDamping:-1},{riderBufferStiffness:NaN}])assert.throws(()=>validate(p));
  const missing={...DEFAULTS};delete missing.riderBuffer;assert.throws(()=>setupFromRecord({model:MODEL,params:missing}),/Incomplete/);
  const old=JSON.parse(await readFile(new URL('../docs/evidence/iteration-12-legacy-baseline.json',import.meta.url),'utf8'));
  for(const b of old){const r=rigRecord(await runRig(setupFromRecord(b)));assert.equal(r.params.riderBuffer,'none');const signals=Object.fromEntries(b.signalKeys.map(k=>[k,r.signals[k]]));assert.equal(createHash('sha256').update(JSON.stringify(signals)).digest('hex'),b.signalsHash);for(const [k,v] of Object.entries(b.summary))assert.equal(r.summary[k],v);}
  const a=await runRig({duration:2}),b=await runRig({duration:2,riderBuffer:'progressive'});assert.deepEqual(a.signals,b.signals);assert.deepEqual(a.summary,b.summary);
  const weak=await runRig({...preset,riderBufferWidth:.002,riderBufferStiffness:50000,riderBufferDamping:0});assert.equal(weak.status,'terminated');assert.equal(weak.termination.reason,'Rider travel limit');assert.ok(weak.signals.riderCompression.every(v=>Math.abs(v)<=weak.params.riderTravel));
  const fine=await runRig(preset),sparse=await runRig({...preset,sampleDt:.01});assert.deepEqual(fine.summary,sparse.summary);for(const k of Object.keys(sparse.signals))for(let i=0;i<sparse.signals.time.length;i++)assert.equal(sparse.signals[k][i],fine.signals[k][i*2]);
});
