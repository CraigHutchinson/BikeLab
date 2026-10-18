import {RIDER_BUFFER_KEYS} from '../dist/bike-rig.js';
import {GEOMETRY_KEYS,REFERENCE_GEOMETRY} from '../dist/linkage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {travelBuffer} from '../dist/travel-buffer.js';
import {runRig,getRuntime,validate,DEFAULTS,MODEL,PREVIOUS_MODEL,LEGACY_MODEL,setupFromRecord} from '../dist/bike-rig.js';
const experiment={bike:'hardtail',forkBuffer:'progressive',forkStiffness:4000,forkDamping:200,amplitude:.08,bumpDuration:.2};

test('buffer law: potential gradient, passive work, symmetry and clear travel',()=>{
  const a=new Float64Array(5),b=new Float64Array(5),c=new Float64Array(5),L=.16,w=.02,k=300000,damping=1500;
  for(const q of [0,.005,.019,.02,.08,.14,.141,.155,.16])for(const v of [-2,0,2]){
    travelBuffer(q,v,L,w,k,damping,a);travelBuffer(q+1e-8,0,L,w,k,damping,b);travelBuffer(q-1e-8,0,L,w,k,damping,c);
    const gradient=(b[1]-c[1])/2e-8;
    assert.ok(Math.abs(a[0]*v+gradient*v+a[2])<1e-4);assert.ok(a[1]>=0&&a[2]>=0);
    travelBuffer(L-q,-v,L,w,k,damping,b);assert.ok(Math.abs(a[0]+b[0])<1e-9);assert.ok(Math.abs(a[1]-b[1])<1e-9);
    if(q>=w&&q<=L-w)assert.deepEqual(Array.from(a),[0,0,0,0,0]);
  }
  travelBuffer(w-1e-10,-1,L,w,k,damping,a);assert.ok(a[0]<1e-4,'continuous engagement');
});

test('isolated buffer impact matches independent momentum and conservative turning depth at two masses',async()=>{
  const mj=await getRuntime(),dt=.00001,width=.02,k=300000;
  for(const mass of [3,15])for(const damping of [0,1500]){
    const model=mj.MjModel.from_xml_string(`<mujoco><option gravity="0 0 0" timestep="${dt}" integrator="implicitfast"/><worldbody><body><joint type="slide" axis="0 0 1"/><inertial pos="0 0 0" mass="${mass}" diaginertia="1 1 1"/></body></worldbody></mujoco>`),data=new mj.MjData(model),out=new Float64Array(5);
    try {
      data.qpos[0]=width;data.qvel[0]=-1;let impulse=0,loss=0,min=width,maxError=0,finished=false;
      for(let i=0;i<100000;i++){
        travelBuffer(data.qpos[0],data.qvel[0],.16,width,k,damping,out);const oldLoss=out[2];data.qfrc_applied[0]=out[0];impulse+=out[0]*dt;
        mj.mj_step(model,data);travelBuffer(data.qpos[0],data.qvel[0],.16,width,k,damping,out);loss+=(oldLoss+out[2])*dt/2;
        min=Math.min(min,data.qpos[0]);maxError=Math.max(maxError,Math.abs(.5*mass*data.qvel[0]**2+out[1]+loss-.5*mass));
        if(data.qpos[0]>=width&&data.qvel[0]>0){finished=true;break;}
      }
      assert.ok(finished);assert.ok(min>0);assert.ok(Math.abs(mass*(data.qvel[0]+1)-impulse)<1e-9);
      assert.ok(maxError/(mass*.5)<.003);if(!damping){const depth=Math.cbrt(1.5*mass*width/k);assert.ok(Math.abs((width-min)-depth)<1e-5);assert.ok(Math.abs(data.qvel[0]-1)<.001);}else{assert.ok(loss>0);assert.ok(data.qvel[0]<1);}
    }finally{data.delete();model.delete();}
  }
});
for(const bike of ['hardtail','full'])for(const rider of ['fixed','compliant'])test(`${bike}/${rider}: buffers receive top-out with bounded work and refined response`,async()=>{
  const p={bike,rider,forkBuffer:'progressive',amplitude:.08,bumpDuration:.2,forkDamping:200};
  const runs=[];for(const dt of [.000125,.0000625,.00003125])runs.push(await runRig({...p,dt}));
  for(const r of runs){assert.equal(r.status,'complete');assert.ok(r.summary.peakTopForce>100);assert.ok(r.summary.bufferLoss>0&&r.summary.bufferLoss<=r.summary.loss);assert.ok(r.signals.fork.every(q=>q>=0&&q<=.16));assert.ok(r.signals.frontForce.every(f=>f>=0));assert.ok(r.summary.maxResidual/Math.max(1,Math.abs(r.summary.work),r.summary.loss)<.01);}
  const [a,b]=runs.slice(1);assert.ok(Math.abs(a.summary.peakTopForce-b.summary.peakTopForce)/b.summary.peakTopForce<.02);
  for(let i=0;i<a.signals.time.length;i++)assert.ok(Math.abs(a.signals.fork[i]-b.signals.fork[i])<.0002);
  assert.ok(b.summary.maxResidual<a.summary.maxResidual);
});
test('bottom buffer and top buffer both carry load; old control still terminates',async()=>{
  const a=await runRig(experiment),b=await runRig({...experiment,forkStiffness:9000,forkBuffer:'none'});
  assert.equal(a.status,'complete');assert.ok(a.summary.peakBottomForce>100&&a.summary.peakTopForce>100);assert.ok(a.signals.forkBufferForce.some(f=>f<0));assert.ok(a.signals.forkBufferForce.some(f=>f>0));
  assert.equal(b.status,'terminated');assert.match(b.termination.reason,/Fork travel/);
});
test('weak buffers retain ultimate guard and recording cadence cannot alter loads or work',async()=>{
  const weak=await runRig({...experiment,forkStiffness:9000,forkBufferWidth:.005,forkBufferStiffness:50000,forkBufferDamping:0});
  assert.equal(weak.status,'terminated');assert.match(weak.termination.reason,/Fork travel/);assert.ok(weak.signals.fork.every(q=>q>=-1e-9&&q<=.16));assert.equal(weak.signals.time.at(-1),weak.termination.lastValidTime);
  const a=await runRig(experiment),b=await runRig({...experiment,sampleDt:.01});assert.deepEqual(a.summary,b.summary);for(const key of Object.keys(a.signals))for(let i=0;i<b.signals[key].length;i++)assert.equal(a.signals[key][2*i],b.signals[key][i]);
});
test('buffer settings and versioned reconstruction reject unsupported or ambiguous inputs',()=>{
  for(const p of [{forkBuffer:'rigid'},{forkBufferWidth:0},{forkBufferWidth:.1},{forkBufferStiffness:NaN},{forkBufferDamping:-1}])assert.throws(()=>validate(p));
  const previous=Object.fromEntries(Object.entries(DEFAULTS).filter(([k])=>!RIDER_BUFFER_KEYS.includes(k)&&!GEOMETRY_KEYS.includes(k)&&!k.startsWith('forkBuffer')&&!k.startsWith('shockBuffer')));
  for(const rider of ['fixed','compliant'])assert.equal(setupFromRecord({model:PREVIOUS_MODEL,params:{...previous,rider}}).rider,rider);
  assert.equal(setupFromRecord({model:PREVIOUS_MODEL,params:previous}).forkBuffer,'none');
  assert.throws(()=>setupFromRecord({model:PREVIOUS_MODEL,params:DEFAULTS}),/Unknown legacy/);
  assert.throws(()=>setupFromRecord({model:MODEL,params:previous}),/Incomplete/);
  const oldest=Object.fromEntries(Object.entries(previous).filter(([k])=>!RIDER_BUFFER_KEYS.includes(k)&&!GEOMETRY_KEYS.includes(k)&&!k.startsWith('rider')));assert.equal(setupFromRecord({model:LEGACY_MODEL,params:oldest}).forkBuffer,'none');
});
