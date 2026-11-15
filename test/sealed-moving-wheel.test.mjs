import test from 'node:test';
import assert from 'node:assert/strict';
import {run,replay,validate,SEALED_MODEL} from '../dist/moving-wheel.js';
import {createSweptCasing} from '../dist/sealed-casing.js';
import {meridianFixture} from '../scripts/lib/tyre-meridian-fixture.mjs';
import {validateAssembly} from '../dist/wheel-limits.js';
function setup(pressure=160000,patch={}) {
 const c=meridianFixture(8),casing={nodes:32,rimRadius:c.rimRadius,section:c.restPoints,meridionalRigidity:c.meridionalRigidity,hoopRigidity:c.hoopRigidity,couplingRigidity:c.couplingRigidity,gaugePressure:pressure,ambientPressure:101325,exponent:1.2,provenance:'Illustrative native receiving fixture; uncalibrated'};
 const radius=createSweptCasing(casing).reference.radius+.008;
 return {casing,assembly:validateAssembly({pressure}),params:validate({nodes:32,rimRadius:c.rimRadius,radius,height:radius+.001,velocityX:0,omega:0,duration:.05,sampleDt:.00125,dt:.0000078125,...patch})};
}
const near=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} versus ${b}, budget ${t}`);
test('sealed native flat drop receives evolving pressure, exact replay and recording independence',async()=>{
 for(const pressure of [120000,160000,200000]) {
  const a=setup(pressure),r=await run(a);assert.equal(r.status,'completed');assert.equal(r.model,SEALED_MODEL);
  near(r.frames[0].pressure,pressure,1e-9);assert.ok(r.frames.some(f=>f.pressure>pressure+1));
  for(const f of r.frames){near((f.pressure+101325)*Math.pow(f.volume/r.casingReference.referenceVolume,1.2),pressure+101325,1e-8);assert.equal(f.compressiveCells,0);}
  assert.deepEqual(await replay(JSON.parse(JSON.stringify(r))),r);
  const sampled=await run({...a,params:{...a.params,sampleDt:.0025}});assert.deepEqual(sampled.frames.at(-1),r.frames.at(-1));
 }
});
test('sealed free flight keeps internal forces out of whole-wheel translation and spin',async()=>{
 const r=await run(setup(160000,{height:1,gravity:0,velocityX:.5,velocityZ:.2,omega:3,duration:.02}));
 assert.equal(r.status,'completed');assert.equal(r.summary.contactSteps,0);
 const f=r.frames.at(-1);near(f.momentumResidual[0],0,1e-9);near(f.momentumResidual[1],0,1e-9);near(f.momentumResidual[2],0,2e-6);
 assert.ok(r.summary.maxResidual<.001);
});
test('sealed flat-drop timestep refinement reduces native work error',async()=>{
 const coarse=await run(setup(160000,{dt:.000015625})),fine=await run(setup());
 assert.equal(coarse.status,'completed');assert.equal(fine.status,'completed');
 assert.ok(fine.summary.maxResidual<coarse.summary.maxResidual*.75);
 near(coarse.frames.at(-1).hub[1],fine.frames.at(-1).hub[1],2e-5);
 near(coarse.frames.at(-1).impulse[1],fine.frames.at(-1).impulse[1],.002);
});
