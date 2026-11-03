import test from 'node:test';
import assert from 'node:assert/strict';
import {runTranslation,compareTranslation,translationXML,createTranslationGuard,STEPS,CONTACT_MODEL,BUDGETS} from '../scripts/casing-translate.mjs';
import {entryInput,CONTROLS,analyseContactTrace,encodeTrace,entryReceiving} from '../scripts/casing-entry.mjs';
import {createContactStepper,CONTACT_STEP,CONTACT_TRACE,TRACE_COLUMNS} from '../scripts/casing-contact-step.mjs';
import {receiveArchivedEntry} from '../scripts/casing-entry-receive.mjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {controlInput} from '../scripts/casing-derivative.mjs';
import {getRuntime} from '../dist/moving-wheel.js';

test('contact-free substeps preserve fixed-step states and trace/replay is observational',async()=>{
 const a=await controlInput({nodes:32}),options={duration:.000125,contactSubsteps:true},fixed=await runTranslation(a,{duration:.000125}),r=await runTranslation(a,options),traced=await runTranslation(a,{...options,traceContacts:true});
 assert.equal(r.model,CONTACT_MODEL);assert.equal(r.compiled.solverTolerance,CONTACT_STEP.solverTolerance);assert.deepEqual(r.frames,fixed.frames);assert.deepEqual(r.finalState,fixed.finalState);assert.equal(r.summary.stepping.acceptedSubsteps,r.summary.steps);assert.equal(r.summary.stepping.discardedContactTrials,0);
 const {contactTrace,...withoutTrace}=traced;assert.deepEqual(withoutTrace,r);assert.deepEqual(await runTranslation(a,{...options,traceContacts:true}),traced);assert.equal(contactTrace.rows,1+5*r.summary.steps);
 const bytes=encodeTrace(contactTrace);assert.equal(bytes.length,8*contactTrace.data.length);for(let i=0;i<contactTrace.data.length;i++)assert.equal(bytes.readDoubleLE(8*i),contactTrace.data[i]);
 for(const flags of [{contactSubsteps:1},{traceContacts:'yes'}])await assert.rejects(runTranslation(a,flags),/flag/);
});

test('first contact brackets analytic entry and meets the unchanged refinement budgets',async()=>{
 const a=await entryInput('drop'),records=[];
 for(const dt of STEPS){
  const r=await runTranslation(a,{duration:.000125,dt,hubVelocity:[0,-.1],contactSubsteps:true,traceContacts:true,comparison:true});records.push(r);assert.equal(r.status,'completed');
  const trace=analyseContactTrace(r.contactTrace,CONTROLS.drop);assert.equal(trace.bracketContainsAnalytic,true);assert.equal(trace.freeFlight.withinBudgets,true);assert.equal(trace.completedCycles,0);assert.equal(trace.events.length,1);assert.equal(trace.events[0].kind,'entry');assert.ok(trace.firstEntry[1]-trace.firstEntry[0]<=dt/2**CONTACT_STEP.maxBisections+1e-15);assert.ok(r.summary.stepping.acceptedSubsteps>r.summary.steps);
 }
 assert.equal(compareTranslation(records[0],records[1]).withinBudgets,true);assert.equal(compareTranslation(records[1],records[2],.1).withinBudgets,true);
 const altered=structuredClone(records[1]);altered.contactStep.maxBisections--;assert.throws(()=>compareTranslation(records[0],altered));altered.contactStep=records[1].contactStep;altered.compiled.solverTolerance=1e-10;assert.throws(()=>compareTranslation(records[0],altered));
});

test('a rejected interior substep rolls back the complete macro interval and trace',async()=>{
 const a=await entryInput('drop'),options={duration:.000125,hubVelocity:[0,-.1],contactSubsteps:true,traceContacts:true},clean=await runTranslation(a,options),mj=await getRuntime(),step=mj.mj_step;let small=0,backup;
 mj.mj_step=(m,d)=>{
  if(!backup&&m.opt.timestep<STEPS[0])backup={q:Array.from(d.qpos),v:Array.from(d.qvel),warmstart:Array.from(d.qacc_warmstart)};
  step(m,d);if(m.opt.timestep<STEPS[0]&&++small===2){const warnings=d.warning,w=warnings.get(0);try{w.number=1;w.lastinfo=77;warnings.set(0,w);}finally{w.delete();}}
 };
 let r;try{r=await runTranslation(a,options);}finally{mj.mj_step=step;}
 assert.equal(r.status,'terminated');assert.equal(r.summary.steps,50);assert.match(r.termination.reason,/warning/i);assert.deepEqual(r.finalState,backup);assert.equal(r.summary.stepping.acceptedIntervals,50);assert.equal(r.summary.stepping.acceptedSubsteps,50);assert.equal(r.contactTrace.rows,251);assert.deepEqual(r.contactTrace.data,clean.contactTrace.data.slice(0,251*TRACE_COLUMNS.length));assert.equal(r.nativeWarnings.length,1);assert.ok(r.summary.maxResidual<=clean.summary.maxResidual);
});

test('Newton accuracy receives low-force unloading without weakening physical balance guards',async()=>{
 const a=await entryInput('recontact'),old=await runTranslation(a,{duration:.000125,hubVelocity:[0,.05]}),r=await runTranslation(a,{duration:.000125,hubVelocity:[0,.05],contactSubsteps:true,traceContacts:true});
 assert.equal(old.status,'terminated');assert.match(old.termination.reason,/balance mismatch/);assert.equal(r.status,'completed');assert.ok(r.summary.maxIndependent.balance<=r.budgets.independent.balance);assert.ok(r.summary.maxIndependent.normalForce<=r.budgets.independent.normalForce);assert.equal(r.summary.stepping.discardedContactTrials,0);
 const summary=analyseContactTrace(r.contactTrace,CONTROLS.recontact);assert.equal(summary.completedCycles,0);assert.equal(summary.bracketContainsAnalytic,null);
});

test('contact work-cap exhaustion preserves the last accepted interval and restores its clock',async()=>{
 const a=await controlInput({nodes:32});a.seed.q.fill(0);a.seed.v.fill(0);const mj=await getRuntime(),m=mj.MjModel.from_xml_string(translationXML(a,STEPS[0],true)),d=new mj.MjData(m);let stepper;
 try{
  mj.mj_forward(m,d);const guard=createTranslationGuard(mj,m,d,a),stageGuard=createTranslationGuard(mj,m,d,a);guard.observe(d);let calls=0;
  // Simulate a detector that reports a transition on every candidate. Physics
  // stays in free flight; this specifically exercises bounded scheduling.
  const unstable={observe(...args){const o=stageGuard.observe(...args);if(++calls%4===2)o.contactMask[0]=1;return o;}};
  stepper=createContactStepper(mj,m,d,guard,unstable,{adaptive:true,trace:true,steps:20});
  for(let i=0;i<16;i++)stepper.advance();const before={time:d.time,q:Array.from(d.qpos),v:Array.from(d.qvel),warm:Array.from(d.qacc_warmstart)},trace=stepper.trace().data.slice();
  assert.throws(()=>stepper.advance(),/substep work capacity/);assert.deepEqual({time:d.time,q:Array.from(d.qpos),v:Array.from(d.qvel),warm:Array.from(d.qacc_warmstart)},before);assert.equal(m.opt.timestep,STEPS[0]);assert.equal(stepper.stats.acceptedIntervals,16);assert.equal(stepper.stats.acceptedSubsteps,4096);assert.deepEqual(stepper.trace().data,trace);
 }finally{stepper?.dispose();d.delete();m.delete();}
});

test('recontact after an exact zero-gap endpoint is counted from accepted flight, not RK predictors',()=>{
 const width=TRACE_COLUMNS.length,data=new Float64Array(16*width);
 const set=(row,time,active,gap)=>{data[row*width]=time;data[row*width+1]=active;data[row*width+2]=active;data[row*width+3]=active;data[row*width+4]=active;data[row*width+5]=gap;};set(0,0,1,-1e-5);
 for(let interval=0;interval<3;interval++){for(let stage=0;stage<4;stage++)set(1+5*interval+stage,.1*interval+.05*(stage===3?2:stage>0?1:0),stage%2,-1e-5);set(5+5*interval,.1*(interval+1),interval===2?1:0,[0,1e-5,-1e-5][interval]);}
 const a=analyseContactTrace({format:CONTACT_TRACE,columns:TRACE_COLUMNS,rows:16,data},CONTROLS.recontact);assert.equal(a.completedCycles,1);assert.deepEqual(a.events.map(e=>e.kind),['separation','entry']);assert.equal(a.events[0].after.gap,0);assert.equal(a.predictorDisagreements,3);
});

test('receiving requires momentum and unique coverage, and does not claim unselected controls',()=>{
 const cases=STEPS.map(dt=>({name:'drop',diagnostic:{dt},status:'completed',summary:{maxMomentumError:0},analysis:{bracketContainsAnalytic:true,freeFlight:{withinBudgets:true}}})),refinement=STEPS.slice(0,2).map((dt,i)=>({name:'drop',coarseDt:dt,fineDt:STEPS[i+1],budgetFraction:i?.1:1,withinBudgets:true}));
 const clean=entryReceiving(cases,refinement,'drop',true);assert.ok(Object.values(clean).every(Boolean));assert.equal(Object.hasOwn(clean,'recontact'),false);cases[0].summary.maxMomentumError=2*BUDGETS.momentum;assert.equal(entryReceiving(cases,refinement,'drop',true).momentum,false);cases[0].summary.maxMomentumError=0;assert.equal(entryReceiving([cases[0],cases[0],cases[2]],refinement,'drop',true).coverage,false);assert.equal(entryReceiving(cases,[refinement[0],refinement[0]],'drop',true).coverage,false);assert.equal(entryReceiving([],[],'all',true).complete,false);assert.equal(entryReceiving(cases,refinement,'drop',false).sourcesUnchanged,false);
});

test('archived trace receiving verifies hashes and keeps numerical comparisons attributed to their run',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'bikelab-entry-')),hash=x=>createHash('sha256').update(x).digest('hex'),cases=[],records=[],input=await entryInput('drop');
 try{
  for(const [i,dt] of STEPS.entries()){
   const r=await runTranslation(input,{duration:.000125,dt,hubVelocity:[0,-.1],contactSubsteps:true,traceContacts:true,comparison:true});records.push(r);const {contactTrace,comparison,...record}=r,traceFile=`drop-${i}.f64`,binary=encodeTrace(contactTrace);await writeFile(join(directory,traceFile),binary);record.contactTrace={format:contactTrace.format,columns:contactTrace.columns,rows:contactTrace.rows,file:traceFile,sha256:hash(binary)};
   const file=`drop-${i}.json`,bytes=JSON.stringify(record);await writeFile(join(directory,file),bytes);const {frames,finalState,compiled,...summary}=record;cases.push({name:'drop',file,sha256:hash(bytes),...summary});
  }
  const refinement=[{name:'drop',...compareTranslation(records[0],records[1])},{name:'drop',...compareTranslation(records[1],records[2],.1)}],bytes=JSON.stringify({policy:'substeps',cases,refinement,receiving:{sourcesUnchanged:true},sourcesSha256:{}});await writeFile(join(directory,'report.json'),bytes);
  const receipt=await receiveArchivedEntry(directory,'drop');assert.ok(Object.values(receipt.receiving).every(Boolean));assert.equal(receipt.measuredReportSha256,hash(bytes));assert.equal(receipt.cases.length,3);
  await writeFile(join(directory,'drop-0.f64'),Buffer.alloc(8));await assert.rejects(receiveArchivedEntry(directory,'drop'));
 }finally{await rm(directory,{recursive:true,force:true});}
});
