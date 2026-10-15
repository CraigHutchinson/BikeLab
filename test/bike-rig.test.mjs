import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runRig,DEFAULTS,GEOMETRY as g,G,validate,shockLength,platens,getRuntime,modelXML,setupFromRecord,MODEL} from '../dist/bike-rig.js';

for(const bike of ['hardtail','full']) {
  test(`${bike}: static loads, fork sag, finite nonnegative contacts and bounded travel`,async()=>{
    const run=await runRig({bike});assert.equal(run.status,'complete');assert.equal(run.dofs,bike==='full'?4:3);
    const s=run.signals,total=(DEFAULTS.mass+g.wheelMass+g.rearMass)*G;
    const front=total*(run.initial.comX-s.rearX[0])/(s.frontX[0]-s.rearX[0]);
    assert.ok(Math.abs(run.initial.frontForce-front)<.001);assert.ok(Math.abs(run.initial.rearForce-(total-front))<.001);
    const axisZ=Math.sin(g.headAngle+s.pitch[0]);
    assert.ok(Math.abs(s.fork[0]*DEFAULTS.forkStiffness-(front-g.wheelMass*G)*axisZ)<.001);
    for(const values of Object.values(s))for(const value of values)assert.ok(Number.isFinite(value));
    for(const key of ['frontForce','rearForce','dissipation'])for(const v of s[key])assert.ok(v>=0);
    for(const v of s.fork)assert.ok(v>=0&&v<=g.forkTravel);
    for(const v of s.shock)assert.ok(v>=0&&v<=g.shockTravel);
    if(bike==='hardtail')assert.ok(s.shock.every(v=>v===0)&&s.rearAngle.every(v=>v===0));
    assert.ok(run.summary.maxResidual<.02,'energy/work residual < 0.02 J for nominal smooth bump');
  });
  test(`${bike}: step refinement changes load peaks < 1% and travel < 0.1 mm`,async()=>{
    const coarse=await runRig({bike,dt:.00025}),fine=await runRig({bike,dt:.0000625});
    assert.equal(coarse.status,'complete');assert.equal(fine.status,'complete');
    const peak=s=>Math.max(...s);
    for(const key of ['frontForce','rearForce'])assert.ok(Math.abs(peak(coarse.signals[key])-peak(fine.signals[key]))/peak(fine.signals[key])<.01);
    for(const key of ['fork','shock'])for(let i=0;i<coarse.signals.time.length;i++)assert.ok(Math.abs(coarse.signals[key][i]-fine.signals[key][i])<.0001);
    assert.ok(fine.summary.maxResidual<coarse.summary.maxResidual);
  });
}
test('native linkage matches independent rotated geometry and shock generalized force',async()=>{
  const mj=await getRuntime(),p=validate(),m=mj.MjModel.from_xml_string(modelXML(p));let d;
  try {d=new mj.MjData(m);assert.equal(m.nq,4);assert.equal(m.nbody,4);
    assert.ok(Math.abs(Array.from(m.body_mass).reduce((a,b)=>a+b,0)-89)<1e-12);
    for(const angle of [0,.05,.15,.3]){
      d.qpos[0]=.03;d.qpos[1]=.1;d.qpos[2]=.04;d.qpos[3]=angle;mj.mj_forward(m,d);
      assert.ok(Math.abs(d.ten_length[0]-shockLength(angle))<1e-12);
      const localX=Math.cos(angle)*g.rearX+Math.sin(angle)*g.armZ,localZ=g.pivotZ-Math.sin(angle)*g.rearX+Math.cos(angle)*g.armZ;
      assert.ok(Math.abs(d.xipos[9]-(Math.cos(.1)*localX+Math.sin(.1)*localZ))<1e-12);
      assert.ok(Math.abs(d.xipos[11]-(.68-Math.sin(.1)*localX+Math.cos(.1)*localZ))<1e-12);
      const h=1e-6,gradient=(shockLength(angle+h)-shockLength(angle-h))/(2*h);
      const expected=-p.shockStiffness*(shockLength(angle)-shockLength(0))*gradient;
      assert.ok(Math.abs(d.qfrc_passive[3]-expected)<1e-5,'no duplicate leverage or hinge spring');
    }
  } finally {d?.delete();m.delete();}
});
test('platen height derivative and independent/delayed inputs',()=>{
  const a=new Float64Array(4),b=new Float64Array(4),c=new Float64Array(4),h=1e-6;
  for(const input of ['travelling','front','rear','together'])for(const t of [0,1,1.1,1.3,1.4,1.5,2]){
    const p=validate({input});platens(p,t,a);platens(p,t-h,b);platens(p,t+h,c);
    for(let i=0;i<4;i+=2)assert.ok(Math.abs((c[i]-b[i])/(2*h)-a[i+1])<1e-7);
    if(input==='front')assert.equal(a[2],0);if(input==='rear')assert.equal(a[0],0);if(input==='together')assert.equal(a[0],a[2]);
  }
});
test('alternate mass/spring scale retains static load balance',async()=>{
  for(const bike of ['hardtail','full']){const r=await runRig({bike,mass:55,forkStiffness:6500,shockStiffness:50000,amplitude:0});
    assert.equal(r.status,'complete');assert.ok(Math.abs(r.initial.frontForce+r.initial.rearForce-62*G)<.01);assert.ok(r.summary.maxResidual<.001);}
});
test('repeat runs preserve samples and parameter changes alter actual dynamics',async()=>{
  const a=await runRig({duration:2}),b=await runRig({duration:2}),c=await runRig({duration:2,forkDamping:1100});
  assert.deepEqual(a,b);assert.notDeepEqual(a.signals.fork,c.signals.fork);
});
test('invalid schemas, nonfinite settings and nonaligned intervals reject before execution',()=>{
  for(const input of [null,[],{bike:'road'},{mass:NaN},{mass:200},{dt:Infinity},{dt:.00012},{surprise:1},{input:'unknown'}])assert.throws(()=>validate(input));
});
test('unsupported load terminates at a valid state without recording the violating trial',async()=>{
  const r=await runRig({bike:'hardtail',amplitude:.08,bumpDuration:.2,forkDamping:200});
  assert.equal(r.status,'terminated');assert.ok(r.termination.trialTime>r.termination.lastValidTime);
  assert.equal(r.signals.time.at(-1),r.termination.lastValidTime);
  assert.equal(r.signals.fork.at(-1),r.termination.lastValidQpos[2]);
  assert.ok(r.signals.fork.every(v=>v>=-1e-9&&v<=g.forkTravel));
});
test('vendored MuJoCo files match provenance and loaded engine is pinned',async()=>{
  const base=new URL('../dist/vendor/mujoco-3.16.0/',import.meta.url),receipt=JSON.parse(await readFile(new URL('provenance.json',base),'utf8'));
  for(const [name,hash] of Object.entries(receipt.files))assert.equal(createHash('sha256').update(await readFile(new URL(name,base))).digest('hex'),hash,name);
  assert.equal((await getRuntime()).mj_versionString(),'3.16.0');
});

test("saved setup requires complete parameters and exact model identity",()=>{
  assert.throws(()=>setupFromRecord({model:MODEL,params:{}}),/Incomplete/);
  assert.throws(()=>setupFromRecord({model:"old",params:DEFAULTS}),/Unsupported/);
  assert.deepEqual(setupFromRecord({model:MODEL,params:DEFAULTS,signals:"ignored"}),DEFAULTS);
});

test("record cadence cannot change physics or integration-endpoint diagnostics",async()=>{
  const a=await runRig({duration:2}),b=await runRig({duration:2,sampleDt:.01});
  assert.deepEqual(a.summary,b.summary);
  for(const key of Object.keys(a.signals))for(let i=0;i<b.signals[key].length;i++)assert.equal(a.signals[key][2*i],b.signals[key][i]);
});
