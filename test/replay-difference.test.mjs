import test from 'node:test';
import assert from 'node:assert/strict';
import {replayDifference} from '../scripts/replay-difference.mjs';
import {compareCanonicalTrailRecord} from '../scripts/trail-section-browser-check.mjs';

test('diagnostic counts all numeric failures but retains first and maximum independently',()=>{
 const r=replayDifference({frames:[1,2,4]},{frames:[1,1,2]},.5);
 assert.equal(r.numericLeaves,3);assert.equal(r.differingNumbers,2);assert.equal(r.outsideBudget,2);
 assert.equal(r.firstOutsideBudget.path,'record.frames.1');
 assert.equal(r.maxAbsolute.path,'record.frames.2');assert.equal(r.maxNormalized.normalized,1);
 assert.equal(r.structuralDifferences,0);
});
test('diagnostic preserves strict record acceptance including structure and nonfinite rejection',()=>{
 for(const [a,b] of [
  [{x:1},{x:1}], [{x:1+1e-10},{x:1}], [{x:1+1e-8},{x:1}],
  [{x:1,y:2},{y:2,x:1}], [[1],[1,2]], [new Array(2),[]],
  [{x:NaN},{x:NaN}], [{x:Infinity},{x:Infinity}], [{x:'1'},{x:1}],
  [{x:null},{x:{}}], [{status:'stopped'},{status:'completed'}]
 ]){
  let accepted=true;try{compareCanonicalTrailRecord(a,b);}catch{accepted=false;}
  const r=replayDifference(a,b);assert.equal(r.outsideBudget===0&&r.structuralDifferences===0,accepted);
 }
});
test('diagnostic bounded report does not retain every failing array value',()=>{
 const r=replayDifference(Array(10000).fill(2),Array(10000).fill(0));
 assert.equal(r.outsideBudget,10000);assert.ok(JSON.stringify(r).length<1500);
 const shape=replayDifference(Array(10000).fill(1),[]);
 assert.equal(shape.structuralDifferences,1);assert.ok(JSON.stringify(shape).length<1500);
 for(const value of [Array(10000).fill(1),'x'.repeat(10000)]){
  const typeMismatch=replayDifference(value,null);
  assert.equal(typeMismatch.structuralDifferences,1);assert.ok(JSON.stringify(typeMismatch).length<1500);
 }
});
test('diagnostic rejects invalid tolerances and treats the boundary inclusively',()=>{
 for(const t of [-1,NaN,Infinity])assert.throws(()=>replayDifference(0,0,t));
 assert.equal(replayDifference(2,1,1).outsideBudget,0);
 assert.equal(replayDifference(0,0).firstExact,null);
});
