import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewDecay,compareDecay,compareSampledBins} from '../scripts/tyre-fixture-decay-analysis.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} vs ${b}`);
function fixture(){
 return {status:'completed',termination:null,summary:{steps:8},scenario:{motion:{dt:.005,duration:.04,sampleDt:.01}},frames:[0,1,2,3,4].map(i=>({time:i*.01,energy:7+i*.01,kineticEnergy:1+2*i,dampingLoss:2*i*.01,contactWork:3*i*.01,ground:[0,10+10*i,0],nodes:[[i*.01,0]],contacts:[{edge:[0,0,1,1,0][i],vertex:-1}],tyreMotion:{rmsSpeed:2*i,maxNodeSpeed:2*i,maxNodeAcceleration:10*i,node0Velocity:[0,2*i]}}))};
}
test('decay intervals use time weights, shared ledger endpoints and signed work without duplicating boundary duration',()=>{
 const r=fixture(),a=reviewDecay(r);assert.equal(a.status,'complete');assert.equal(a.bins.length,2);
 for(const [i,b] of a.bins.entries()){
  assert.equal(b.intervals,2);assert.equal(b.complete,true);close(b.timeMeanKineticEnergy,3+4*i);close(b.timeMeanVerticalForce,20+20*i);close(b.timeStdVerticalForce,Math.sqrt(50));close(b.deltaEnergy,.02);close(b.dampingLoss,.04);close(b.signedContactWork,.06);close(b.residualIncrement,0);assert.equal(b.sampledContactSetChanges,1);close(b.sampledMaxNodeDisplacementFromBinStart,.02);
 }
 close(a.bins[0].timeRmsNodeSpeed,Math.sqrt(6));close(a.bins[1].timeRmsNodeSpeed,Math.sqrt(38));
 assert.equal(a.dampingMonotonicity.passed,true);
 const other=fixture();for(const f of other.frames){f.ground[1]+=3;f.tyreMotion.node0Velocity[0]=4;}
 for(const b of compareDecay(r,other).bins){close(b.fields.verticalForce.timeRms,3);close(b.fields.node0Velocity.timeRms,4);close(b.fields.kineticEnergy.timeRms,0);}
 for(const b of compareSampledBins(a.bins,reviewDecay(other).bins))close(b.difference.timeMeanVerticalForce,-3);
 const signed=fixture();for(const f of signed.frames)f.contactWork*=-1;close(reviewDecay(signed).bins[0].signedContactWork,-.06);close(reviewDecay(signed).bins[0].residualIncrement,.12);
});
test('decay reporting preserves incomplete runs and rejects missing or nonfinite observations',()=>{
 const rejected=fixture();rejected.frames=[];rejected.status='initial-state-rejected';rejected.summary.steps=0;rejected.termination={reason:'rim-contact'};assert.equal(reviewDecay(rejected).reason,'rim-contact');assert.equal(compareDecay(rejected,fixture()).status,'unavailable');
 const stopped=fixture();stopped.frames.pop();stopped.status='terminated';stopped.summary.steps=6;stopped.termination={reason:'casing-strain-limit'};const a=reviewDecay(stopped);assert.equal(a.status,'partial');assert.equal(a.bins[0].complete,true);assert.equal(a.bins[1].complete,false);assert.equal(a.bins[1].endTime,.03);assert.equal(compareDecay(fixture(),stopped).status,'unavailable');
 const decreasing=fixture();decreasing.frames[2].dampingLoss=-1;assert.equal(reviewDecay(decreasing).dampingMonotonicity.passed,false);
 for(const change of [r=>r.frames.splice(1,1),r=>r.frames[2].time=.019,r=>r.frames[1].kineticEnergy=NaN,r=>r.frames[1].ground[1]=Infinity,r=>r.frames[0].time=.01]){const r=fixture();change(r);assert.throws(()=>reviewDecay(r));}
});
