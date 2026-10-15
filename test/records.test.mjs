import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate,serialize } from '../dist/physics.js';
import { verifyRecord } from '../scripts/record-validation.mjs';
test('record verification accepts numerical agreement and rejects tampered evidence',()=>{
  const original=JSON.parse(serialize(simulate({duration:.1})));
  assert.equal(verifyRecord(JSON.stringify(original)).result,'numerical agreement');
  const mutations=[
    r=>r.signals.height[1]+=1e-4,
    r=>r.signals.time.pop(),
    r=>r.signals.force[0]=null,
    r=>delete r.metrics.impulse,
    r=>r.metrics.peakForce+=1,
    r=>r.events.push({time:.1,type:'load-lost',uncertainty:.0005}),
    r=>r.model='bikelab-wheel-0.1'
  ];
  for(const mutate of mutations){const r=structuredClone(original);mutate(r);assert.throws(()=>verifyRecord(JSON.stringify(r)));}
});
