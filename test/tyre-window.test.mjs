import test from 'node:test';
import assert from 'node:assert/strict';
import {TYRE_MOTION,tyreMotionProbe} from '../dist/tyre-motion.js';
import {TYRE_WINDOW,TYRE_WINDOW_MODEL,windowSchedule,tailWindow,restartWindow} from '../dist/tyre-window.js';
import {activePreset,validate,run,replay,inputFromRecord,modelXML} from '../dist/trail-bike.js';
import {getRuntime} from '../dist/moving-wheel.js';
const setup=bike=>({...activePreset(bike),motion:{duration:.04,dt:.00003125,sampleDt:.005,velocityX:0,omega:0,clearance:0},diagnostics:TYRE_MOTION,observationWindow:{format:TYRE_WINDOW,startTick:640,endTick:1280,strideTicks:4}});
const physicalSummary=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!k.startsWith('maxSampled')&&k!=='maxDiagnosticDifference'));

test('window schedule is a bounded integer union with strict configuration',()=>{
 const a=setup();a.commands=[{tick:0,rearDrive:0,frontBrake:0,rearBrake:0},{tick:111,rearDrive:1,frontBrake:0,rearBrake:0},{tick:700,rearDrive:0,frontBrake:0,rearBrake:0}];
 const v=validate(a),ticks=Array.from(windowSchedule(v.motion,v.commands,v.observationWindow));
 const expected=new Set([111,700]);for(let i=0;i<=1280;i+=160)expected.add(i);for(let i=640;i<=1280;i+=4)expected.add(i);
 assert.deepEqual(ticks,[...expected].sort((a,b)=>a-b));assert.ok(Object.isFrozen(v.observationWindow));
 for(const bad of [null,{},[],{...a.observationWindow,format:'bad'},{...a.observationWindow,startTick:-1},{...a.observationWindow,startTick:.5},{...a.observationWindow,endTick:1281},{...a.observationWindow,strideTicks:0},{...a.observationWindow,strideTicks:3},{...a.observationWindow,startTick:1000},{...a.observationWindow,extra:1},Object.defineProperty({...a.observationWindow},'startTick',{get(){throw Error('Getter evaluated');}})])assert.throws(()=>validate({...a,observationWindow:bad}));
 const noDiagnostics={...a};delete noDiagnostics.diagnostics;assert.throws(()=>validate(noDiagnostics),/require tyre/);
 for(const [dt,duration,sampleDt] of [[.00004,.5,.005],[.00005,.02,.005]]){const {wheelParams,...scenario}=validate({...a,motion:{...a.motion,dt,duration,sampleDt},commands:[{tick:0,rearDrive:0,frontBrake:0,rearBrake:0}],observationWindow:{format:TYRE_WINDOW,startTick:0,endTick:Math.round(.02/dt),strideTicks:Math.round(.005/dt)}});const tail=tailWindow({scenario,status:'completed'});assert.doesNotThrow(()=>validate(tail));assert.ok(tail.observationWindow.strideTicks*dt>=.000125-1e-12);assert.equal(tail.observationWindow.endTick,Math.round(duration/dt));}
 assert.throws(()=>validate({...a,motion:{...a.motion,duration:.0375,dt:.0000078125,sampleDt:.000125},commands:[{tick:0,rearDrive:0,frontBrake:0,rearBrake:0}],observationWindow:{format:TYRE_WINDOW,startTick:1,endTick:4785,strideTicks:16}}),/512/);
});

test('uninterrupted window preserves native state, physical summary and shared frames on both bikes',async()=>{
 for(const bike of ['full','hardtail']){
  const a=setup(bike),b={...a};delete b.observationWindow;
  const ordinary=await run(b),window=await run(a);assert.equal(window.model,TYRE_WINDOW_MODEL);assert.equal(window.status,'completed');
  assert.equal(modelXML(a),modelXML(b));assert.deepEqual(window.finalState,ordinary.finalState);assert.deepEqual(window.initialState,ordinary.initialState);assert.deepEqual(physicalSummary(window.summary),physicalSummary(ordinary.summary));
  for(const f of ordinary.frames)assert.deepEqual(window.frames.find(g=>Math.abs(g.time-f.time)<1e-12),f);
  const start=window.windowObservation.start;assert.equal(start.tick,640);assert.equal(window.frames[start.frameIndex].time,start.time);assert.notDeepEqual(start.state,window.finalState);
  assert.deepEqual(await replay(window),window);assert.throws(()=>inputFromRecord({...window,model:ordinary.model}),/Legacy record/);
  const missing=structuredClone(window);delete missing.scenario.observationWindow.strideTicks;assert.throws(()=>inputFromRecord(missing),/Incomplete/);
  assert.equal(tyreMotionProbe(window).observationWindow,undefined);
  assert.equal(tailWindow(ordinary).observationWindow.startTick,640);
 }
});

test('fresh window comparison owns the start state and remaps boundary/interior commands exactly',async()=>{
 const a=setup();a.observationWindow={format:TYRE_WINDOW,startTick:320,endTick:960,strideTicks:4};
 a.commands=[0,111,320,641,960,1100].map((tick,i)=>({tick,rearDrive:i,frontBrake:0,rearBrake:0}));
 const r=await run(a),before=JSON.stringify(r),input=restartWindow(r),fresh=await run(input);
 assert.equal(r.status,'completed');assert.equal(fresh.status,'completed');assert.deepEqual(input.commands,[{tick:0,rearDrive:2,frontBrake:0,rearBrake:0},{tick:321,rearDrive:3,frontBrake:0,rearBrake:0},{tick:640,rearDrive:4,frontBrake:0,rearBrake:0}]);
 assert.deepEqual(fresh.initialState,r.windowObservation.start.state);assert.equal(fresh.frames[0].time,0);assert.equal(fresh.frames[0].active.work,0);assert.equal(fresh.frames[0].driveWork,0);
 assert.equal(JSON.stringify(r),before);input.initialization.state.joints[0].position+=1;assert.equal(JSON.stringify(r),before);
 const atZero=setup();atZero.observationWindow={format:TYRE_WINDOW,startTick:0,endTick:640,strideTicks:4};const z=await run(atZero);
 assert.deepEqual(z.windowObservation.start.state,z.initialState);assert.equal(z.windowObservation.start.frameIndex,0);assert.equal(new Set(z.frames.map(f=>Math.round(f.time/atZero.motion.dt))).size,z.frames.length);
 assert.throws(()=>restartWindow({scenario:a,windowObservation:{start:null}}),/complete accepted/);
});

test('rejected candidates never publish a start snapshot or consume observation capacity',async()=>{
 const mj=await getRuntime(),forward=mj.mj_forward;
 for(const tick of [2,640,645]){
  const a=setup();a.commands=[{tick:0,rearDrive:0,frontBrake:0,rearBrake:0},{tick:640,rearDrive:2,frontBrake:0,rearBrake:0}];let injected=false;
  mj.mj_forward=(m,d)=>{forward(m,d);const at=Math.round(d.time/a.motion.dt);if(!injected&&at===tick){const id=mj.mj_name2id(m,mj.mjtObj.mjOBJ_JOINT.value,'rearwheelSpin');if(tick!==640||d.qfrc_applied[m.jnt_dofadr[id]]===2){injected=true;d.qacc[0]=NaN;}}};
  let r;try{r=await run(a);}finally{mj.mj_forward=forward;}
  assert.ok(injected);assert.equal(r.status,'terminated');assert.equal(r.summary.steps,tick-1);assert.equal(Math.round(r.frames.at(-1).time/a.motion.dt),tick-1);
  assert.ok(r.frames.every(f=>Math.round(f.time/a.motion.dt)<tick));assert.equal(new Set(r.frames.map(f=>f.time)).size,r.frames.length);
  if(tick<=640)assert.equal(r.windowObservation.start,null);else assert.equal(r.windowObservation.start.tick,640);
  assert.throws(()=>restartWindow(r),/complete accepted/);
 }
});
