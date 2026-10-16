import test from 'node:test';
import assert from 'node:assert/strict';
import {runRig,validate,DEFAULTS,MODEL,FORK_BUFFER_MODEL,PREVIOUS_MODEL,LEGACY_MODEL,setupFromRecord,shockLength,shockCompressionJacobian,getRuntime,modelXML,GEOMETRY as g} from '../dist/bike-rig.js';
import {travelBuffer} from '../dist/travel-buffer.js';
const preset={bike:'full',forkBuffer:'progressive',shockBuffer:'progressive',shockDamping:900,input:'rear',amplitude:.08,bumpDuration:.2};
test('shock mapping agrees with geometry gradient, native compressed Jacobian and passive virtual work',async()=>{
 const mj=await getRuntime(),out=new Float64Array(5),a=new Float64Array(5),b=new Float64Array(5);
 for(const rider of ['fixed','compliant']){
  const model=mj.MjModel.from_xml_string(modelXML(validate({rider}))),data=new mj.MjData(model);
  try{
   const joint=mj.mj_name2id(model,mj.mjtObj.mjOBJ_JOINT.value,'swing'),q=model.jnt_qposadr[joint],v=model.jnt_dofadr[joint],t=mj.mj_name2id(model,mj.mjtObj.mjOBJ_TENDON.value,'shock');
   for(const angle of [0,.01,.12,.30,.34])for(const pitch of [-.3,0,.3])for(const rate of [-2,0,2]){
    data.qpos[q]=angle;data.qpos[0]=pitch+.11;data.qpos[1]=pitch;data.qvel[0]=.7;data.qvel[1]=-.4;data.qvel[v]=rate;mj.mj_fwdPosition(model,data);mj.mj_fwdVelocity(model,data);
    const j=shockCompressionJacobian(angle),eps=1e-6,fd=-(shockLength(angle+eps)-shockLength(angle-eps))/(2*eps);
    assert.ok(Math.abs(j-fd)<1e-9);assert.ok(Math.abs(data.ten_length[t]-shockLength(angle))<1e-12);
    let native=0;for(let k=model.ten_J_rowadr[t];k<model.ten_J_rowadr[t]+model.ten_J_rownnz[t];k++)if(model.ten_J_colind[k]===v)native=data.ten_J[k];else assert.ok(Math.abs(data.ten_J[k])<1e-12,'rigid frame motion cannot change shock length');
    assert.ok(Math.abs(j+native)<1e-12);assert.ok(Math.abs(data.ten_velocity[t]+j*rate)<1e-12);
    travelBuffer(shockLength(0)-shockLength(angle),j*rate,g.shockTravel,.008,1e6,3000,out);
    travelBuffer(shockLength(0)-shockLength(angle+eps),0,g.shockTravel,.008,1e6,3000,a);
    travelBuffer(shockLength(0)-shockLength(angle-eps),0,g.shockTravel,.008,1e6,3000,b);
    assert.ok(Math.abs(out[0]*j*rate+(a[1]-b[1])/(2*eps)*rate+out[2])<1e-4);
   }
  }finally{data.delete();model.delete();}
 }
});
for(const rider of ['fixed','compliant'])for(const shockStiffness of [30000,70000])test('shock buffers refine '+rider+'/'+shockStiffness,async()=>{
 const runs=[];for(const dt of [.000125,.0000625,.00003125])runs.push(await runRig({...preset,rider,shockStiffness,dt}));
 const key=shockStiffness===30000?'peakShockBottomForce':'peakShockTopForce';
 for(const r of runs){assert.equal(r.status,'complete');assert.ok(r.summary[key]>100);assert.ok(r.summary.shockBufferLoss>0);assert.ok(r.summary.maxResidual/Math.max(1,Math.abs(r.summary.work),r.summary.loss)<.01);assert.ok(r.signals.shock.every(v=>v>=0&&v<=g.shockTravel));for(let i=0;i<r.signals.time.length;i++){assert.ok(Math.abs(r.signals.shockBufferMoment[i]-r.signals.shockBufferForce[i]*r.signals.shockLeverage[i])<1e-10);assert.equal(r.signals.shockTotalForce[i],r.signals.shockForce[i]-r.signals.shockBufferForce[i]);}}
 const [a,b]=runs.slice(1);assert.ok(Math.abs(a.summary[key]-b.summary[key])/b.summary[key]<.02);for(let i=0;i<a.signals.time.length;i++)assert.ok(Math.abs(a.signals.shock[i]-b.signals.shock[i])<.0002);
});
test('hardtail buffers are dormant and summary peaks/loss do not depend on recording cadence',async()=>{
 for(const rider of ['fixed','compliant']){
  const a=await runRig({bike:'hardtail',rider}),b=await runRig({bike:'hardtail',rider,shockBuffer:'progressive',shockBufferWidth:.012,shockBufferStiffness:4e6,shockBufferDamping:12000});
  assert.deepEqual(a.signals,b.signals);assert.deepEqual(a.summary,b.summary);assert.equal(b.summary.shockBufferLoss,0);assert.ok(b.signals.shockBufferForce.every(x=>x===0));
 }
 const a=await runRig({...preset,shockStiffness:30000}),b=await runRig({...preset,shockStiffness:30000,sampleDt:.01});assert.deepEqual(a.summary,b.summary);
});
test('shock schema migrations preserve fork and rider choices and reject invalid dormant fields',()=>{
 for(const p of [{shockBuffer:'rigid'},{shockBufferWidth:0},{shockBufferWidth:.04},{shockBufferStiffness:Infinity},{shockBufferDamping:-1}])assert.throws(()=>validate({...p,bike:'hardtail'}));
 for(const model of [LEGACY_MODEL,PREVIOUS_MODEL,FORK_BUFFER_MODEL]){
  const params=Object.fromEntries(Object.entries({...DEFAULTS,rider:'compliant',forkBuffer:'progressive'}).filter(([k])=>!k.startsWith('shockBuffer')&&(model===FORK_BUFFER_MODEL||!k.startsWith('forkBuffer'))&&(model!==LEGACY_MODEL||!k.startsWith('rider'))));
  const p=setupFromRecord({model,params});assert.equal(p.shockBuffer,'none');assert.equal(p.rider,model===LEGACY_MODEL?'fixed':'compliant');assert.equal(p.forkBuffer,model===FORK_BUFFER_MODEL?'progressive':'none');
  assert.throws(()=>setupFromRecord({model,params:{...params,shockBuffer:'none'}}),/Unknown/);assert.throws(()=>setupFromRecord({model:MODEL,params}),/Incomplete/);
 }
});

test('shock top-out control and weak buffer retain ultimate bounds and last accepted state',async()=>{
 for(const shockBuffer of ['none','progressive']){const r=await runRig({...preset,shockStiffness:70000,shockBuffer,shockBufferWidth:.002,shockBufferStiffness:100000,shockBufferDamping:0});assert.equal(r.status,'terminated');assert.equal(r.termination.reason,'Rear suspension travel limit');assert.equal(r.signals.time.at(-1),r.termination.lastValidTime);assert.ok(r.signals.shock.every(x=>x>=-1e-9&&x<=g.shockTravel));}
});
