import test from 'node:test';
import assert from 'node:assert/strict';
import {runRig,validate,modelXML,getRuntime,DEFAULTS,GEOMETRY as g,G,MODEL,LEGACY_MODEL,setupFromRecord} from '../dist/bike-rig.js';
import {oscillatorState} from '../dist/suspension-reference.js';

for(const bike of ['hardtail','full']) {
  test(`${bike} passive rider: independent weight/moment/sag and refinement budgets`,async()=>{
    const coarse=await runRig({bike,rider:'compliant',dt:.00025});
    const fine=await runRig({bike,rider:'compliant',dt:.0000625});
    for(const r of [coarse,fine]) {
      assert.equal(r.status,'complete');assert.equal(r.dofs,bike==='full'?5:4);
      const p=r.params,s=r.signals,total=(p.mass+g.wheelMass+g.rearMass)*G;
      const front=total*(r.initial.comX-s.rearX[0])/(s.frontX[0]-s.rearX[0]);
      assert.ok(Math.abs(r.initial.frontForce-front)<.01);
      assert.ok(Math.abs(r.initial.frontForce+r.initial.rearForce-total)<.01);
      assert.ok(Math.abs(s.riderCompression[0]*p.riderStiffness-p.riderMass*G*Math.cos(s.pitch[0]))<.01);
      assert.ok(r.summary.maxResidual<.02);
      assert.ok(r.summary.riderLoss>0&&r.summary.riderLoss<=r.summary.loss);
      for(const values of Object.values(s))for(const v of values)assert.ok(Number.isFinite(v));
      for(const q of s.riderCompression)assert.ok(Math.abs(q)<=p.riderTravel);
      for(const f of [...s.frontForce,...s.rearForce])assert.ok(f>=0);
      assert.ok(s.fork.every(q=>q>=-1e-9&&q<=g.forkTravel));
      assert.ok(s.shock.every(q=>q>=0&&q<=g.shockTravel));
    }
    for(const key of ['frontForce','rearForce','riderForce']) {
      const a=Math.max(...coarse.signals[key]),b=Math.max(...fine.signals[key]);
      assert.ok(Math.abs(a-b)/b<.01,key);
    }
    assert.ok(Math.abs(coarse.summary.peakRiderForce-fine.summary.peakRiderForce)/fine.summary.peakRiderForce<.01);
    for(const key of ['fork','shock','riderCompression'])for(let i=0;i<fine.signals.time.length;i++)
      assert.ok(Math.abs(coarse.signals[key][i]-fine.signals[key][i])<.0001,key);
    assert.ok(fine.summary.maxResidual<coarse.summary.maxResidual);
  });
}

test('locked zero-displacement rider recovers original inertia and gravity; native guide work is internal',async()=>{
  const mj=await getRuntime(),bodyType=mj.mjtObj.mjOBJ_BODY.value,jointType=mj.mjtObj.mjOBJ_JOINT.value;
  for(const bike of ['hardtail','full']) {
    const p=validate({bike,rider:'compliant'}),xml=modelXML(p);
    const fixed=mj.MjModel.from_xml_string(modelXML(validate({bike}))),locked=mj.MjModel.from_xml_string(xml.replace(/<joint name="riderSlide"[^>]*\/>/,'')),mobile=mj.MjModel.from_xml_string(xml);
    const a=new mj.MjData(fixed),b=new mj.MjData(locked),d=new mj.MjData(mobile),vf=new mj.DoubleBuffer(6),vr=new mj.DoubleBuffer(6);
    try {
      assert.equal(locked.nv,fixed.nv);assert.equal(mobile.nv,fixed.nv+1);
      assert.ok(Math.abs(Array.from(mobile.body_mass).reduce((x,y)=>x+y,0)-(p.mass+7))<1e-12);
      for(let i=0;i<fixed.nq;i++){a.qpos[i]=b.qpos[i]=d.qpos[i]=.03*(i+1);a.qvel[i]=b.qvel[i]=d.qvel[i]=.02*(i+1);}
      mj.mj_forward(fixed,a);mj.mj_forward(locked,b);
      for(const key of ['M','qfrc_bias']){assert.equal(a[key].length,b[key].length);for(let i=0;i<a[key].length;i++)assert.ok(Math.abs(a[key][i]-b[key][i])<1e-10,key);}
      const joint=mj.mj_name2id(mobile,jointType,'riderSlide'),qi=mobile.jnt_qposadr[joint],vi=mobile.jnt_dofadr[joint];
      d.qpos[qi]=-.04;d.qvel[vi]=.13;mj.mj_forward(mobile,d);
      const force=-p.riderStiffness*d.qpos[qi]-p.riderDamping*d.qvel[vi];
      assert.ok(Math.abs(d.qfrc_passive[vi]-force)<1e-10);
      mj.mj_objectVelocity(mobile,d,bodyType,mj.mj_name2id(mobile,bodyType,'frame'),vf,0);
      mj.mj_objectVelocity(mobile,d,bodyType,mj.mj_name2id(mobile,bodyType,'rider'),vr,0);
      const v0=vf.GetView(),v1=vr.GetView(),pitch=d.qpos[1];
      const pairedPower=force*((v1[3]-v0[3])*Math.sin(pitch)+(v1[5]-v0[5])*Math.cos(pitch));
      assert.ok(Math.abs(pairedPower-(-p.riderStiffness*d.qpos[qi]*d.qvel[vi]-p.riderDamping*d.qvel[vi]**2))<1e-10);
    } finally {vr.delete();vf.delete();d.delete();b.delete();a.delete();mobile.delete();locked.delete();fixed.delete();}
  }
});

test('native production rider on a fixed tilted guide agrees with independent damped oscillator',async()=>{
  const mj=await getRuntime(),p=validate({rider:'compliant',dt:.0000625});
  const rider=modelXML(p).match(/<body name="rider">[\s\S]*?<\/body>/)[0],tilt=.2;
  const m=mj.MjModel.from_xml_string(`<mujoco><compiler angle="radian"/><option timestep="${p.dt}" gravity="0 0 -${G}" integrator="implicitfast"/><worldbody><body euler="0 ${tilt} 0">${rider}</body></worldbody></mujoco>`),d=new mj.MjData(m);
  try {
    const eq=-p.riderMass*G*Math.cos(tilt)/p.riderStiffness,offset=.025,u=.1,reference=new Float64Array(2);
    d.qpos[0]=eq+offset;d.qvel[0]=u;let max=0;
    for(let i=0;i<=Math.round(2/p.dt);i++) {
      oscillatorState(p.riderMass,p.riderStiffness,p.riderDamping,offset,u,i*p.dt,reference);
      max=Math.max(max,Math.abs(d.qpos[0]-eq-reference[0]));
      if(i<Math.round(2/p.dt))mj.mj_step(m,d);
    }
    assert.ok(max<.0001,`max error ${max}`);
  } finally {d.delete();m.delete();}
});

test('rider domain rejects invalid budgets and terminates at last valid rider travel',async()=>{
  for(const p of [{rider:'active'},{rider:'compliant',riderMass:80},{riderMass:NaN},{riderStiffness:0},{riderDamping:-1},{riderTravel:0}])assert.throws(()=>validate(p));
  assert.equal(validate({mass:40,rider:'fixed'}).mass,40,'dormant rider split does not invalidate legacy mass');
  await assert.rejects(runRig({rider:'compliant',riderTravel:.02}),/Rider travel/);
  const r=await runRig({bike:'hardtail',rider:'compliant',riderTravel:.059});
  assert.equal(r.status,'terminated');assert.equal(r.termination.reason,'Rider travel limit');
  assert.equal(r.signals.time.at(-1),r.termination.lastValidTime);
  assert.ok(r.signals.riderCompression.every(q=>Math.abs(q)<=r.params.riderTravel));
  assert.ok(Math.abs(r.termination.trialQpos.at(-1))>r.params.riderTravel);
  assert.equal(r.signals.riderCompression.at(-1),-r.termination.lastValidQpos.at(-1));
});

test('rider controls affect dynamics; repeat, sample cadence and energy loss are reproducible',async()=>{
  const p={rider:'compliant',duration:2},a=await runRig(p),b=await runRig(p),c=await runRig({...p,sampleDt:.01}),changed=await runRig({...p,riderDamping:1500});
  assert.deepEqual(a,b);assert.deepEqual(a.summary,c.summary);assert.notDeepEqual(a.signals.riderCompression,changed.signals.riderCompression);
  for(const key of Object.keys(a.signals))for(let i=0;i<c.signals[key].length;i++)assert.equal(a.signals[key][i*2],c.signals[key][i]);
});

test('v0.1 records migrate explicitly to fixed mode; v0.2 requires every rider setting',()=>{
  const legacy=Object.fromEntries(Object.entries(DEFAULTS).filter(([k])=>!k.startsWith('rider')&&!k.startsWith('forkBuffer')&&!k.startsWith('shockBuffer')));
  assert.deepEqual(setupFromRecord({model:LEGACY_MODEL,params:legacy}),DEFAULTS);
  assert.throws(()=>setupFromRecord({model:MODEL,params:legacy}),/Incomplete/);
  assert.throws(()=>setupFromRecord({model:LEGACY_MODEL,params:{...legacy,rider:'compliant'}}),/Unknown legacy/);
  const p=validate({rider:'compliant'});assert.deepEqual(setupFromRecord({model:MODEL,params:p,signals:'ignored'}),p);
});
