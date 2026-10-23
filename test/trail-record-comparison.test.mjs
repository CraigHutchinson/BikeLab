import test from 'node:test';
import assert from 'node:assert/strict';
import {assertExactTrailRecord,compareCanonicalTrailRecord} from '../scripts/trail-section-browser-check.mjs';

test('complete trail comparison keeps exact values and structure with bounded failure diagnostics',()=>{
 const expected={model:'fixture',frames:Array.from({length:301},(_,i)=>({time:i*.005,contacts:[{force:[0,100]}]}))};
 assertExactTrailRecord(structuredClone(expected),expected);
 const changed=structuredClone(expected);changed.frames[298].contacts[0].force[0]=1e-15;
 assert.throws(()=>assertExactTrailRecord(changed,expected),error=>{
  assert.equal(error.code,'ERR_ASSERTION');
  assert.match(error.message,/record\.frames\.298\.contacts\.0\.force\.0/);
  assert.ok(error.message.length<500);return true;
 });
 const missing=structuredClone(expected);delete missing.frames[0].contacts;
 assert.throws(()=>assertExactTrailRecord(missing,expected),/record\.frames\.0 keys/);
 assert.throws(()=>assertExactTrailRecord({0:1},[1]),/record/);
 assert.throws(()=>assertExactTrailRecord(NaN,NaN),/record/);
 assert.throws(()=>assertExactTrailRecord(new Array(2),new Array(3)),/record length/);
 assert.throws(()=>assertExactTrailRecord({x:1,extra:0},{x:1}),/record keys/);
});

test('canonical comparison retains structure and the declared normalized budget',()=>{
 assert.equal(compareCanonicalTrailRecord({x:1e-12},{x:0}).maxNormalized,1e-12);
 assert.throws(()=>compareCanonicalTrailRecord({x:1e-8},{x:0}),/record.x/);
 assert.throws(()=>compareCanonicalTrailRecord({x:NaN},{x:0}),/record.x/);
 assert.throws(()=>compareCanonicalTrailRecord({},{x:0}),/keys/);
 assert.throws(()=>compareCanonicalTrailRecord(new Array(2),new Array(3)),/length/);
});
