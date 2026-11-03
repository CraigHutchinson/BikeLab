// Recheck archived observations without rerunning dynamics or rewriting the study.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {analyseContactTrace,CONTROLS,entryReceiving} from './casing-entry.mjs';
import {CONTACT_STEP,TRACE_COLUMNS} from './casing-contact-step.mjs';
import {CONTACT_MODEL} from './casing-translate.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
export async function receiveArchivedEntry(directory,selection='all'){
 const raw=await readFile(join(directory,'report.json')),report=JSON.parse(raw),cases=[];assert.equal(report.policy,'substeps');
 for(const original of report.cases){
  assert.match(original.file,/^[a-z0-9-]+\.json$/);const bytes=await readFile(join(directory,original.file));assert.equal(hash(bytes),original.sha256);const record=JSON.parse(bytes);
  assert.equal(record.model,CONTACT_MODEL);assert.deepEqual(record.contactStep,CONTACT_STEP);assert.equal(record.compiled.solverTolerance,CONTACT_STEP.solverTolerance);assert.deepEqual(record.input,original.input);assert.deepEqual(record.diagnostic,original.diagnostic);assert.deepEqual(record.summary,original.summary);
  const trace=record.contactTrace;assert.match(trace.file,/^[a-z0-9-]+\.f64$/);assert.deepEqual(trace.columns,TRACE_COLUMNS);const buffer=await readFile(join(directory,trace.file));assert.equal(hash(buffer),trace.sha256);assert.equal(trace.rows,1+5*record.summary.stepping.acceptedSubsteps);assert.equal(buffer.length,8*trace.rows*trace.columns.length);
  const data=new Float64Array(buffer.length/8);for(let i=0;i<data.length;i++)data[i]=buffer.readDoubleLE(8*i);
  cases.push({...original,analysis:analyseContactTrace({...trace,data},CONTROLS[original.name])});
 }
 // Numeric common-grid comparisons remain the original measured results. Check
 // their declared budgets and identities; do not claim to recompute trajectories.
 for(const r of report.refinement){
  const coarse=cases.find(c=>c.name===r.name&&c.diagnostic.dt===r.coarseDt),fine=cases.find(c=>c.name===r.name&&c.diagnostic.dt===r.fineDt);assert.ok(coarse&&fine);assert.equal(r.coarseDt,2*r.fineDt);
  for(const key of ['model','normalOracle','nativeBuild','contactStep','input'])assert.deepEqual(coarse[key],fine[key]);assert.deepEqual(coarse.diagnostic.hubVelocity,fine.diagnostic.hubVelocity);assert.equal(coarse.diagnostic.duration,fine.diagnostic.duration);
  assert.deepEqual(Object.keys(r.maxima).sort(),Object.keys(coarse.budgets.refinement).sort());assert.equal(r.withinBudgets,Object.entries(r.maxima).every(([key,value])=>Number.isFinite(value)&&value<=r.budgetFraction*coarse.budgets.refinement[key]));
 }
 const sources=['scripts/casing-entry-receive.mjs','scripts/casing-entry.mjs','scripts/casing-translate.mjs','scripts/casing-contact-step.mjs'];
 return {scope:'Hash-verified archived cases/traces, corrected endpoint-cycle analysis, identity and momentum gates. Common-grid numeric comparisons come from the original study and are not recalculated.',measuredReportSha256:hash(raw),measuredSourcesSha256:report.sourcesSha256,analysisSourcesSha256:Object.fromEntries(await Promise.all(sources.map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))]))),cases:cases.map(c=>({name:c.name,file:c.file,sha256:c.sha256,analysis:c.analysis})),receiving:entryReceiving(cases,report.refinement,selection,report.receiving.sourcesUnchanged)};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 assert.ok(process.argv.length<=4,'Usage: node scripts/casing-entry-receive.mjs DIRECTORY [drop|recontact|all]');const directory=resolve(process.argv[2]??'artifacts/casing-entry-substeps'),receipt=await receiveArchivedEntry(directory,process.argv[3]??'all');await writeFile(join(directory,'receiving.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt.receiving));if(!Object.values(receipt.receiving).every(Boolean))process.exitCode=2;
}
