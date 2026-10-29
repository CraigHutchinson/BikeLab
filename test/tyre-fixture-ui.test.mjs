import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixtureControls} from '../dist/tyre-fixture-ui.js';
const input=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))).cases[0].input;
test('fixture controls preserve authored timesteps and produce aligned bounded long observations',()=>{
 for(const dt of [.00003125,.000015625,.0000078125,.00004])for(const duration of [.02,.1,.5,1,5]){
  const a=fixtureControls(input,{rates:'zero',dt,duration,measure:true}),ticks=Math.round(duration/dt),w=a.measurement.window;
  assert.equal(a.motion.dt,dt);assert.equal(a.motion.duration,duration);assert.deepEqual(a.seed,input.seed);assert.ok(a.motion.duration/a.motion.sampleDt<=300);assert.equal((w.endTick-w.startTick)%w.strideTicks,0);assert.equal(w.endTick,ticks);assert.ok(w.endTick-w.startTick<=Math.round(.02/dt));assert.ok((w.endTick-w.startTick)/w.strideTicks<=256);
 }
 assert.equal(fixtureControls(input,{rates:'imported',dt:input.motion.dt,duration:.02,measure:false}).measurement,undefined);
 const custom=fixtureControls(input,{rates:'imported',dt:input.motion.dt,duration:.1,measure:true});custom.measurement.binDt=.01;custom.measurement.window=null;
 assert.deepEqual(fixtureControls(custom,{rates:'zero',dt:custom.motion.dt,duration:.1,measure:true}).measurement,custom.measurement);
 assert.throws(()=>fixtureControls(input,{rates:'imported',dt:.00004,duration:.02001,measure:true}),/align/);
});
