import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticCase } from '../scripts/timestep-diagnostics.mjs';
import { runScalarTimestepIsolation } from '../scripts/timestep-scalar.mjs';
import { runTrial } from '../dist/solver-trial.js';

test('diagnostic original matches production and equal inner steps match across outer-step groupings',async()=>{
  const production=await runTrial(),original=await diagnosticCase(),regrouped=await diagnosticCase({dt:.000125,substeps:1});
  for(const key of ['time','compression','velocity','constitutiveForce']) {
    assert.deepEqual(original.signals[key],production.signals[key],key);
    assert.deepEqual(regrouped.signals[key],original.signals[key],'regrouped '+key);
  }
  assert.equal(original.errors.compression.maxAbsolute,production.errors.compression.maxAbsolute);
  assert.equal(original.substepDt,regrouped.substepDt);
  for(const p of [null,[],{substeps:0},{substeps:3},{pgs:100},{dt:.01},{centered:'yes'},{unknown:1}])
    await assert.rejects(diagnosticCase(p));
});

test('crossed precision controls distinguish early split-force error from late position error',async()=>{
  const dt=.00003125;
  const original=await diagnosticCase({dt}),centered=await diagnosticCase({dt,centered:true});
  const net=await diagnosticCase({dt,balanced:true}),both=await diagnosticCase({dt,balanced:true,centered:true});
  const extraPgs=await diagnosticCase({dt,pgs:4});
  assert.ok(original.errors.compression.peakTime<.3);
  assert.ok(centered.errors.earlyCompression.maxAbsolute>original.errors.earlyCompression.maxAbsolute*.9);
  assert.ok(net.errors.earlyCompression.maxAbsolute<original.errors.earlyCompression.maxAbsolute*.4);
  assert.ok(net.errors.compression.peakTime>1.5);
  assert.ok(centered.errors.lateCompression.maxAbsolute<original.errors.lateCompression.maxAbsolute*.3);
  assert.ok(both.errors.compression.maxAbsolute<original.errors.compression.maxAbsolute*.2);
  assert.deepEqual(extraPgs.signals.compression,original.signals.compression);
  // These are diagnostic effect-size tests for this pinned fixture, not relaxed
  // production accuracy gates or a promise about other bodies/contact states.
});

test('scalar negative controls isolate rounded split updates, not coefficient or final-output rounding',()=>{
  const normal=runScalarTimestepIsolation(),balanced=runScalarTimestepIsolation({balanced:true});
  const pair=(report,mode)=>report.rows.filter(r=>r.mode===mode).slice(-2);
  for(const mode of ['double','coefficients','final-velocity']) {
    const [coarse,fine]=pair(normal,mode);assert.ok(fine.maxCompressionError<coarse.maxCompressionError*.6);
  }
  const [coarse,fine]=pair(normal,'split-velocity');assert.ok(fine.maxCompressionError>coarse.maxCompressionError*1.5);
  assert.ok(fine.peakTime<.3);
  const [,pose]=pair(normal,'position-only');assert.ok(pose.peakTime>1.5);
  const [bc,bf]=pair(balanced,'split-velocity');assert.ok(bf.maxCompressionError<bc.maxCompressionError*.6);
});
