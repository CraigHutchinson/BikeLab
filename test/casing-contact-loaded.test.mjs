import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {runOrLoadCase,receiveLoadedContacts,GROUPS} from '../scripts/casing-contact-loaded.mjs';
import {STEPS,BUDGETS} from '../scripts/casing-translate.mjs';
import {LOADED_BUDGETS} from '../scripts/casing-loaded.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const input=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))).cases[0].input;
let received;

test('loaded checkpoints preserve the complete comparison grid and reject stale, altered or incomplete data',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'bikelab-loaded-')),source='scripts/casing-contact-loaded.mjs',sources={[source]:hash(await readFile(new URL('../'+source,import.meta.url)))};
 try{
  const first=await runOrLoadCase(directory,'full-front-imported-0',input,STEPS[0],.001,sources);assert.equal(first.reused,false);assert.equal(first.result.status,'completed');received=first.result;
  const resumed=await runOrLoadCase(directory,'full-front-imported-0',input,STEPS[0],.001,sources,()=>assert.fail('A cached case must not integrate'));assert.equal(resumed.reused,true);assert.deepEqual(resumed.result.comparison,first.result.comparison);const {comparison:firstGrid,...firstRecord}=first.result,{comparison:resumedGrid,...resumedRecord}=resumed.result;assert.deepEqual(resumedRecord,JSON.parse(JSON.stringify(firstRecord)));
  await assert.rejects(runOrLoadCase(directory,'full-front-imported-0',input,STEPS[0],.005,sources));const changed=structuredClone(input);changed.rates='zero';await assert.rejects(runOrLoadCase(directory,'full-front-imported-0',changed,STEPS[0],.001,sources));
  const stale={[source]:'0'.repeat(64)};await assert.rejects(runOrLoadCase(directory,'full-front-imported-0',input,STEPS[0],.001,stale),/source changed/i);
  const data=join(directory,'full-front-imported-0.f64'),original=await readFile(data),altered=Buffer.from(original);altered[0]^=1;await writeFile(data,altered);await assert.rejects(runOrLoadCase(directory,'full-front-imported-0',input,STEPS[0],.001,sources),/comparison hash mismatch/);await writeFile(data,original);
  const record=join(directory,'full-front-imported-0.json'),bytes=await readFile(record);await writeFile(record,'{}');await assert.rejects(runOrLoadCase(directory,'full-front-imported-0',input,STEPS[0],.001,sources),/record hash mismatch/);await writeFile(record,bytes);
  const checkpoint=join(directory,'full-front-imported-0.checkpoint.json'),metadata=JSON.parse(await readFile(checkpoint));metadata.comparison.encoding='float64 big-endian';await writeFile(checkpoint,JSON.stringify(metadata));await assert.rejects(runOrLoadCase(directory,'full-front-imported-0',input,STEPS[0],.001,sources));
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('loaded matrix receiving requires complete unique coverage and every original physical budget',()=>{
 assert.ok(received,'Native checkpoint control must complete first');const cases=GROUPS.flatMap(name=>STEPS.map(dt=>({...structuredClone(received),name,diagnostic:{...received.diagnostic,dt}}))),refinement=GROUPS.flatMap(name=>STEPS.slice(0,2).map((dt,i)=>({name,coarseDt:dt,fineDt:STEPS[i+1],budgetFraction:i?.1:1,maxima:Object.fromEntries(Object.keys(LOADED_BUDGETS).map(k=>[k,0])),withinBudgets:true})));
 // This synthetic matrix tests gate logic only; it is not a dynamics receipt.
 assert.ok(Object.values(receiveLoadedContacts(cases,refinement,true)).every(Boolean));assert.equal(receiveLoadedContacts(cases.slice(1),refinement,true).coverage,false);assert.equal(receiveLoadedContacts([cases[0],cases[0],...cases.slice(2)],refinement,true).coverage,false);
 const bad=structuredClone(cases);bad[0].summary.maxMomentumError=2*BUDGETS.momentum;assert.equal(receiveLoadedContacts(bad,refinement,true).momentum,false);bad[0]=structuredClone(cases[0]);delete bad[0].summary.maxIndependent.normalForce;assert.equal(receiveLoadedContacts(bad,refinement,true).independent,false);bad[0]=structuredClone(cases[0]);bad[0].compiled.solverTolerance=1e-10;assert.equal(receiveLoadedContacts(bad,refinement,true).identity,false);bad[0]=structuredClone(cases[0]);bad[0].summary.stepping.acceptedSubsteps+=100000;assert.equal(receiveLoadedContacts(bad,refinement,true).boundedWork,false);
 const wrong=structuredClone(refinement);wrong[1].maxima.velocity=LOADED_BUDGETS.velocity;assert.equal(receiveLoadedContacts(cases,wrong,true).refinement,false);assert.equal(receiveLoadedContacts(cases,refinement,false).sourcesUnchanged,false);
});
