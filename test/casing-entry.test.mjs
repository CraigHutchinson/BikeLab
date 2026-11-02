import test from 'node:test';
import assert from 'node:assert/strict';
import {runTranslation,compareTranslation,STEPS,CONTACT_MODEL} from '../scripts/casing-translate.mjs';
import {entryInput,CONTROLS,analyseContactTrace,encodeTrace} from '../scripts/casing-entry.mjs';
import {CONTACT_STEP,TRACE_COLUMNS} from '../scripts/casing-contact-step.mjs';
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
