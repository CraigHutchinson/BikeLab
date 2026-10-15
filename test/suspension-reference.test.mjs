import test from 'node:test';
import assert from 'node:assert/strict';
import { oscillatorState, compareSuspension, comparisonReport } from '../dist/suspension-reference.js';
import { simulate, DEFAULTS } from '../dist/suspension.js';
import { G } from '../dist/physics.js';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}, tolerance ${tol}`);
const state=(m,k,c,e,u,t)=>{const out=new Float64Array(2);oscillatorState(m,k,c,e,u,t,out);return out;};
test('analytical oracle satisfies initial data and independent special-case trajectories',()=>{
  for(const c of [0,1,4,5,8000]) assert.deepEqual(Array.from(state(1,4,c,.03,-.02,0)),[.03,-.02]);
  for(const t of [0,.01,.5,2,30]){
    const [e,u]=state(1,4,0,.03,.02,t);
    near(e,.03*Math.cos(2*t)+.01*Math.sin(2*t),1e-15);
    near(u,-.06*Math.sin(2*t)+.02*Math.cos(2*t),1e-15);
    // Critical: (A+B*t)*exp(-2t); overdamped roots -1 and -4.
    const critical=state(1,4,4,.03,.02,t);
    near(critical[0],(.03+.08*t)*Math.exp(-2*t),1e-15);
    near(critical[1],(.02-.16*t)*Math.exp(-2*t),1e-15);
    const over=state(1,4,5,.03,-.06,t);
    near(over[0],.02*Math.exp(-t)+.01*Math.exp(-4*t),1e-15);
    near(over[1],-.02*Math.exp(-t)-.04*Math.exp(-4*t),1e-15);
  }
});
test('analytical oracle is continuous across critical damping and satisfies the ODE',()=>{
  for(const [m,k]of [[12,5000],[95,22000]]){
    const c=2*Math.sqrt(m*k), h=1e-6;
    for(const factor of [0,.2,1-1e-10,1,1+1e-10,2]){
      for(const t of [.001,.02,.2]){
        const a=state(m,k,c*factor,.01,-.02,t);
        const lo=state(m,k,c*factor,.01,-.02,t-h),hi=state(m,k,c*factor,.01,-.02,t+h);
        near((hi[0]-lo[0])/(2*h),a[1],1e-8);
        near((hi[1]-lo[1])/(2*h),-(c*factor*a[1]+k*a[0])/m,1e-7);
        if(Math.abs(factor-1)<1e-8){
          const critical=state(m,k,c,.01,-.02,t);
          near(a[0],critical[0],1e-11);near(a[1],critical[1],1e-9);
        }
      }
    }
  }
  // A heavily overdamped case at long times must not overflow hyperbolic functions.
  const [e,u]=state(1,1000,8000,.01,0,30);
  assert.ok(e>0&&e<.01&&u<0);assert.ok(Number.isFinite(e)&&Number.isFinite(u));
});
test('paired reference agrees across regimes/scales and refines at the same recording times',()=>{
  for(const [mass,stiffness]of [[12,5000],[95,22000]]) for(const ratio of [0,.25,1,2]){
    const c=2*ratio*Math.sqrt(mass*stiffness),sag=mass*G/stiffness;
    const r=simulate({mass,stiffness,preload:0,initialCompression:sag*1.2,
      compressionDamping:c,reboundDamping:c,duration:2});
    const before=r.signals.force.slice(),a=compareSuspension(r);
    assert.equal(a.status,'pass');assert.deepEqual(r.signals.force,before);
    assert.equal(a.sampleCount,r.signals.time.length);
    assert.equal(comparisonReport(a).signals,undefined);
  }
  const p={mass:5,stiffness:50000,preload:0,initialCompression:.0012,
    compressionDamping:20,reboundDamping:20,duration:1};
  const coarse=compareSuspension(simulate(p)),fine=compareSuspension(simulate({...p,dt:.00025}));
  assert.ok(fine.errors.force.maxAbsolute<coarse.errors.force.maxAbsolute/8);
});
test('unsupported physics and conservative travel envelope cannot yield a reference pass',()=>{
  for(const p of [{},{profile:'sine',reboundDamping:350},
    {initialCompression:0,initialVelocity:-1,reboundDamping:350},
    {initialCompression:.075,initialVelocity:1,reboundDamping:350}]){
    const a=compareSuspension(simulate(p));
    assert.equal(a.status,'unavailable');assert.ok(a.reason);assert.equal(a.signals,undefined);
  }
});
test('comparison detects altered channels and rejects malformed or misaligned recordings',()=>{
  const original=simulate({reboundDamping:350});
  for(const key of ['compression','compressionVelocity','force']){
    const changed=structuredClone(original);changed.signals[key][3]+=1;
    const a=compareSuspension(changed);assert.equal(a.status,'fail');
    near(a.errors[key].maxAbsolute,1,1e-7);
  }
  for(const mutate of [
    r=>r.signals.time[2]+=.001,r=>r.signals.force[2]=NaN,r=>r.signals.force=[],
    r=>delete r.params.travel,r=>r.model='other',r=>r.status='unknown',r=>r.signals.force[2]=1e200
  ]){
    const changed=structuredClone(original);mutate(changed);assert.throws(()=>compareSuspension(changed));
  }
});
test('reference CLI reports complete configuration and distinct unsupported/invalid exits',async()=>{
  const cli=fileURLToPath(new URL('../scripts/compare-suspension.mjs',import.meta.url));
  const invoke=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
  const good=invoke();assert.equal(good.status,0);
  const report=JSON.parse(good.stdout);assert.equal(report.status,'pass');
  assert.deepEqual(Object.keys(report.params).sort(),Object.keys(DEFAULTS).sort());
  const dir=await mkdtemp(join(tmpdir(),'bikelab-reference-')),path=join(dir,'setup.json');
  try{
    await writeFile(path,'{}');assert.equal(invoke(path).status,2);
    await writeFile(path,'{"unknown":1}');assert.equal(invoke(path).status,1);
    assert.equal(invoke(path,'extra').status,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
