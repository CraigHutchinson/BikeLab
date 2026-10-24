import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {preset,articulatedPreset,replay} from '../dist/trail-bike.js';
import {compareCanonicalTrailRecord,assertExactTrailRecord} from './trail-section-browser-check.mjs';

export async function checkTrailProgress({page,root,dir,report}){
 const prefix='calculation';dir=join(dir,prefix);await mkdir(dir,{recursive:true});
 // Observe real workers; direct stale/error callbacks below are lifecycle fault controls.
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;window.calculationWorkers=[];
  window.Worker=class extends NativeWorker{
   constructor(...args){super(...args);this.progressEvents=[];window.calculationWorkers.push(this);this.addEventListener('message',e=>{if(e.data.progress)this.progressEvents.push(e.data.progress);});}
  };
 });
 const shot=async name=>{await page.locator('#calculationPanel').screenshot({path:join(dir,name+'.png')});report.screenshots.push(prefix+'/'+name+'.png');};
 const idle=()=>page.waitForFunction(()=>['COMPLETED','TERMINATED','INITIAL STATE REJECTED','ASSEMBLY REJECTED'].includes(document.getElementById('status').textContent),null,{timeout:120000});
 const snapshot=()=>page.evaluate(()=>({status:document.getElementById('status').textContent,stage:document.getElementById('calculationStage').textContent,detail:document.getElementById('calculationDetail').textContent,value:document.getElementById('calculationBar').value,busy:document.getElementById('calculationPanel').getAttribute('aria-busy')}));
 await page.setViewportSize({width:1440,height:1100});await page.goto(root+'trail-bike.html');
 await page.waitForFunction(()=>{const p=document.getElementById('calculationBar');return p.hasAttribute('value')&&p.value>0&&p.value<.5;},null,{timeout:120000});
 assert.equal(await page.locator('#status').textContent(),'CALCULATING');assert.match(await page.locator('#calculationDetail').textContent(),/s simulated.*steps/);
 assert.ok(await page.locator('#save').isDisabled());assert.equal(await page.locator('#calculationPanel').getAttribute('aria-busy'),'true');
 await shot('progress-desktop');
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal((await snapshot()).status,'CALCULATING');assert.equal((await snapshot()).busy,'true');assert.ok((await snapshot()).value<1);await shot('progress-'+width);
 }
 // These transitions share a JS turn, so even a fast worker cannot finish first.
 await page.locator('[name=duration]').fill('.1');assert.ok(await page.locator('#calculationPanel').isHidden());
 const cancelled=await page.evaluate(()=>{
  const $=id=>document.getElementById(id);$('setup').requestSubmit();
  const worker=window.calculationWorkers.at(-1);window.staleCalculationMessage=worker.onmessage;window.staleCalculationError=worker.onerror;
  const pending={status:$('status').textContent,busy:$('calculationPanel').getAttribute('aria-busy'),indeterminate:!$('calculationBar').hasAttribute('value')};
  $('cancel').click();return pending;
 });
 assert.deepEqual(cancelled,{status:'CALCULATING',busy:'true',indeterminate:true});
 assert.equal((await snapshot()).status,'CANCELLED');assert.equal((await snapshot()).busy,'false');
 const afterCancel=await snapshot();
 await page.evaluate(()=>{window.staleCalculationMessage({data:{progress:{phase:'integrating',acceptedSteps:99,totalSteps:100,dt:.001}}});window.staleCalculationMessage({data:{result:{}}});window.staleCalculationError({});});
 assert.deepEqual(await snapshot(),afterCancel);await shot('cancelled');
 const replacement=await page.evaluate(()=>{
  const $=id=>document.getElementById(id);$('setup').requestSubmit();
  const superseded=window.calculationWorkers.at(-1),late=superseded.onmessage,lateError=superseded.onerror;
  $('setup').requestSubmit(); // Replace a still-running worker in this same turn.
  late({data:{progress:{phase:'integrating',acceptedSteps:99,totalSteps:100,dt:.001}}});late({data:{result:{}}});lateError({});
  const pending={status:$('status').textContent,busy:$('calculationPanel').getAttribute('aria-busy'),indeterminate:!$('calculationBar').hasAttribute('value')};
  window.calculationWorkers.at(-1).onerror({});return pending;
 });
 assert.deepEqual(replacement,{status:'CALCULATING',busy:'true',indeterminate:true});
 assert.equal((await snapshot()).status,'CALCULATION FAILED');assert.equal((await snapshot()).busy,'false');assert.ok(await page.locator('#cancel').isDisabled());await shot('worker-failure');
 for(const kind of ['construction','post']){
  await page.evaluate(kind=>{
   const NormalWorker=window.Worker;
   window.Worker=kind==='construction'?class{constructor(){throw Error('Injected worker construction failure');}}:class extends NormalWorker{postMessage(){throw Error('Injected worker post failure');}};
   try{document.getElementById('setup').requestSubmit();}finally{window.Worker=NormalWorker;}
  },kind);
  assert.equal((await snapshot()).status,'CALCULATION FAILED');assert.equal((await snapshot()).busy,'false');assert.match(await page.locator('#error').textContent(),/Injected worker/);
 }
 await shot('worker-startup-failure');
 await page.setViewportSize({width:1440,height:1100});
 const cases=[];
 const calculate=async(input,name)=>{
  await page.locator('#scenarioEditor').evaluate(el=>{el.open=true;});await page.locator('#setupText').fill(JSON.stringify(input));await page.locator('#applyJson').click();await idle();
  const pending=page.waitForEvent('download');await page.locator('#save').click();const file=join(dir,name+'.json');await (await pending).saveAs(file);
  const r=JSON.parse(await readFile(file,'utf8')),expected=await replay(r),agreement=compareCanonicalTrailRecord(r,expected);
  if(r.numericalPolicy)assertExactTrailRecord(r.numericalPolicy,expected.numericalPolicy);
  const events=await page.evaluate(()=>window.calculationWorkers.at(-1).progressEvents);
  assert.ok(events.length<=105);assert.equal(events[0].phase,'preparing');assert.equal(events.at(-1).phase,'finalizing');
  const steps=r.summary?.steps??0,total=Math.round(r.scenario.motion.duration/r.scenario.motion.dt);
  assert.equal(events.at(-1).acceptedSteps,steps);let previous=0;
  for(const e of events){assert.equal(e.totalSteps,total);assert.equal(e.dt,r.scenario.motion.dt);assert.ok(e.acceptedSteps>=previous&&e.acceptedSteps<=steps);previous=e.acceptedSteps;}
  assert.equal((await snapshot()).busy,'false');assert.equal((await snapshot()).value,steps/total);
  assert.equal(await page.locator('#calculationPercent').textContent(),Math.floor(100*steps/total)+'%');
  cases.push({name,status:r.status,steps,total,messages:events.length,agreement});return r;
 };
 for(const bike of ['full','hardtail']){
  const a=preset('trail',bike);a.motion.duration=.02;
  const r=await calculate(a,bike+'-completed');assert.equal(r.status,'completed');assert.equal((await snapshot()).stage,'Calculation complete');await shot(bike+'-completed');
 }
 const rejected=preset('trail');rejected.motion={...rejected.motion,duration:.02,riderOffset:.2};
 const r=await calculate(rejected,'initial-rejection');assert.equal(r.status,'initial-state-rejected');assert.equal((await snapshot()).stage,'Setup rejected');await shot('initial-rejection');
 const stopped=articulatedPreset();stopped.motion.duration=.3;stopped.initialization={mode:'launch'};
 const s=await calculate(stopped,'model-limit');assert.equal(s.status,'terminated');assert.ok((await snapshot()).value<1);assert.equal((await snapshot()).stage,'Stopped at a model limit');await shot('model-limit');
 report.calculationProgress={cases,scope:'Real worker progress and complete-record replay; deterministic injected stale/error callbacks test cleanup only.'};
 report.checks.push('Trail calculation: actual intermediate accepted-step progress, 390/320 px display, deterministic cancel/active-replacement/stale-message/error/startup controls, complete/initial-rejected/guarded-stop terminal counts, complete browser/Node records within the existing canonical budget.');
 await writeFile(join(dir,'report.json'),JSON.stringify(report.calculationProgress,null,2));
}
