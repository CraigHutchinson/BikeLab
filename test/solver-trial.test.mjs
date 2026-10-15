import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runTrial, validate, DEFAULTS, trialReport } from '../dist/solver-trial.js';
import { G } from '../dist/physics.js';
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} versus ${b}; limit ${tol}`);

test('vendored solver and licence match the pinned package receipt',async()=>{
  const root=new URL('../dist/vendor/rapier-0.21.0/',import.meta.url);
  const metadata=JSON.parse(await readFile(new URL('provenance.json',root),'utf8'));
  assert.equal(metadata.version,'0.21.0');assert.equal(metadata.coreVersion,'0.36.0');assert.equal(metadata.license,'Apache-2.0');
  for(const [name,hash] of Object.entries(metadata.files))
    assert.equal(createHash('sha256').update(await readFile(new URL(name,root))).digest('hex'),hash);
});

test('trial rejects unsupported states and bounds work before constructing the solver',()=>{
  for(const p of [null,[],new Date(),{unknown:0},{mass:0},{mass:NaN},{dt:.01},{dt:0},{duration:3},{duration:.101},
    {tiltDegrees:90},{transverseForce:501},{initialCompression:0},{initialVelocity:1},{preload:1000},
    {travel:.02},{stiffness:Infinity}])assert.throws(()=>validate(p));
  const p=validate();assert.equal(Object.isFrozen(p),true);assert.deepEqual(p,DEFAULTS);
});

test('true prismatic joint supports static equilibrium at multiple scales',async()=>{
  for(const [mass,stiffness,preload,tiltDegrees] of [[45,9000,50,0],[20,5000,0,-30],[100,15000,150,30]]) {
    const q=(mass*G*Math.cos(tiltDegrees*Math.PI/180)-preload)/stiffness;
    const r=await runTrial({mass,stiffness,preload,tiltDegrees,initialCompression:q,transverseForce:300,duration:.5});
    assert.equal(r.checks.complete,true);assert.equal(r.checks.closure,true);assert.equal(r.checks.restart,true);
    near(r.engine.measuredMass,mass,1e-6);assert.equal(r.engine.motor,'ForceBased');
    for(const value of r.signals.compression)near(value,q,1e-6);
    for(const value of r.signals.constitutiveForce)near(value,mass*G*Math.cos(tiltDegrees*Math.PI/180),.02);
    assert.match(r.diagnostics.jointReaction,/unavailable/);
  }
});

test('conservative candidate is compared with independent cosine motion and preserves tilt symmetry',async()=>{
  const p={mass:20,stiffness:5000,preload:0,initialCompression:.05,damping:0,tiltDegrees:0,dt:.000125,duration:.5};
  const r=await runTrial(p),eq=p.mass*G/p.stiffness,w=Math.sqrt(p.stiffness/p.mass);
  let max=0;
  for(let i=0;i<r.sampleCount;i++) {
    const exact=eq+(p.initialCompression-eq)*Math.cos(w*r.signals.time[i]);
    near(r.signals.referenceCompression[i],exact,1e-14);
    max=Math.max(max,Math.abs(r.signals.compression[i]-exact));
  }
  near(max,r.errors.compression.maxAbsolute,1e-14);assert.ok(max<3e-5);
  const a=await runTrial({duration:.5}),b=await runTrial({tiltDegrees:-20,transverseForce:-100,duration:.5});
  for(let i=0;i<a.sampleCount;i++)near(a.signals.compression[i],b.signals.compression[i],1e-7);
  assert.ok(a.closure.maxTranslation<1e-5&&b.closure.maxTranslation<1e-5);
});

test('preregistered refinement reports genuine failures without relaxing tolerances',async()=>{
  let previous=Infinity;
  for(const dt of [.0005,.00025,.000125]) {
    const r=await runTrial({dt});assert.equal(r.status,'fail');assert.equal(r.checks.reference,false);
    assert.equal(r.checks.closure,true);assert.equal(r.checks.restart,true);assert.equal(r.checks.complete,true);
    assert.equal(r.errors.compression.limit,1e-6);assert.equal(r.errors.compressionVelocity.limit,1e-4);assert.equal(r.errors.force.limit,.1);
    assert.ok(r.errors.compression.maxAbsolute<previous*.75);previous=r.errors.compression.maxAbsolute;
    assert.equal(r.sampleCount,401);assert.equal(r.signals.time[400],r.completedTicks*r.engine.storedDt);
    assert.equal(r.engine.storedDt,Math.fround(dt));
  }
});

test('full-world restart and repeated reports are exact for this artifact and runtime',async()=>{
  const p={initialVelocity:.15,duration:.4,dt:.00025,tiltDegrees:35,initialCompression:.05};
  const a=await runTrial(p),b=await runTrial(p);
  assert.deepEqual(trialReport(a),trialReport(b));
  assert.equal(a.restart.exactBodyState,true);assert.equal(a.restart.exactFinalSnapshot,true);
  assert.equal(a.restart.comparedSteps,800);assert.equal(a.restart.tick,800);
  const exported=JSON.parse(JSON.stringify(trialReport(a)));
  assert.deepEqual(exported,trialReport(a));assert.deepEqual(trialReport(await runTrial(exported.params)),exported);
  p.mass=99;assert.notEqual(a.params.mass,p.mass);
});

test('three-axis torque probe stresses rotational closure without introducing ideal axial motion',async()=>{
  const q=(45*G-50)/9000;
  for(const probeTorque of [-50,50]) {
    const r=await runTrial({tiltDegrees:0,initialCompression:q,probeTorque,duration:.5});
    assert.equal(r.checks.closure,true);assert.equal(r.checks.restart,true);assert.equal(r.checks.complete,true);
    assert.ok(r.closure.maxRotation>0,'probe must exercise rotational constraints');
    assert.ok(r.errors.compression.maxAbsolute<1e-6);
  }
});
