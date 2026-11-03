// Synthetic translating contact controls, kept separate from imported bike states.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runTranslation,compareTranslation,STEPS,BUDGETS} from './casing-translate.mjs';
import {DEFAULTS as WHEEL_DEFAULTS} from '../dist/moving-wheel.js';
import {CONTACT_TRACE,TRACE_COLUMNS} from './casing-contact-step.mjs';
export const CONTROLS=Object.freeze({drop:Object.freeze({gap:1e-5,velocityZ:-.1,gravity:9.80665}),recontact:Object.freeze({gap:-5e-5,velocityZ:.05,gravity:9.80665})});
export const ENTRY_BUDGETS=Object.freeze({freePosition:1e-12,freeVelocity:1e-10,eventBracketTime:1e-12});
const hash=x=>createHash('sha256').update(x).digest('hex');
export async function entryInput(name){
 assert.ok(Object.hasOwn(CONTROLS,name),'Unknown entry control');const c=CONTROLS[name],a=structuredClone(JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))).cases[0].input);
 a.seed.q.fill(0);a.seed.v.fill(0);a.seed.gravity=c.gravity;a.seed.hub={position:[0,0,WHEEL_DEFAULTS.radius+c.gap],quaternion:[1,0,0,0]};a.rates='zero';return a;
}
export function analyseContactTrace(trace,control){
 assert.equal(trace.format,CONTACT_TRACE);assert.deepEqual(trace.columns,TRACE_COLUMNS);assert.ok(Number.isSafeInteger(trace.rows)&&trace.rows>=1&&(trace.rows-1)%5===0);const width=TRACE_COLUMNS.length,x=trace.data;assert.equal(x.length,trace.rows*width);assert.ok(x.every(Number.isFinite));
 const snapshot=row=>{const i=row*width;return {time:x[i],contacts:x[i+1],rows:x[i+2],loadedRows:x[i+3],force:x[i+4],gap:x[i+5],gapRate:x[i+6]};};
 const events=[],forceEvents=[];let previous=snapshot(0),everContact=previous.rows>0,separated=false,cycles=0,firstEntry=null,predictorDisagreements=0,freeSteps=0,freePosition=0,freeVelocity=0,freeForce=0,flightEligible=control.gap>0,minimumSeparatedGap=null;
 for(let row=5;row<trace.rows;row+=5){
  const end=snapshot(row);assert.ok(end.time>previous.time,'Accepted substep time must increase');let allFree=previous.rows===0&&end.rows===0,disagreement=false;
  for(let s=0;s<4;s++){const i=(row-4+s)*width;allFree=allFree&&x[i+2]===0;disagreement=disagreement||x[i+2]!==previous.rows;}
  if(disagreement||end.rows!==previous.rows)predictorDisagreements++;
  if(flightEligible&&allFree){
   const i=row*width,t=end.time;freePosition=Math.max(freePosition,Math.hypot(x[i+7],x[i+8]-control.velocityZ*t+.5*control.gravity*t*t)+x[i+11]);freeVelocity=Math.max(freeVelocity,Math.hypot(x[i+9],x[i+10]-control.velocityZ+control.gravity*t)+x[i+12]);freeSteps++;
   for(let s=0;s<5;s++)freeForce=Math.max(freeForce,Math.abs(x[(row-4+s)*width+4]));
  }else flightEligible=false;
  if(!end.rows&&end.gap>0){minimumSeparatedGap=Math.min(minimumSeparatedGap??Infinity,end.gap);if(everContact)separated=true;}
  if((previous.rows>0)!==(end.rows>0)){
   const event={kind:end.rows?'entry':'separation',bracket:[previous.time,end.time],before:previous,after:end,predictors:Array.from({length:4},(_,s)=>({stage:s,...snapshot(row-4+s)}))};events.push(event);
   if(end.rows){firstEntry??=event.bracket;if(everContact&&separated)cycles++;everContact=true;separated=false;}else if(end.gap>0)separated=true;
  }
  if((previous.loadedRows>0)!==(end.loadedRows>0))forceEvents.push({kind:end.loadedRows?'loading':'unloading',bracket:[previous.time,end.time],before:previous,after:end});
  previous=end;
 }
 const analyticEntry=control.gap>0?2*control.gap/(Math.sqrt(control.velocityZ**2+2*control.gravity*control.gap)-control.velocityZ):null;
 const bracketContainsAnalytic=analyticEntry===null?null:!!firstEntry&&firstEntry[0]-ENTRY_BUDGETS.eventBracketTime<=analyticEntry&&analyticEntry<=firstEntry[1]+ENTRY_BUDGETS.eventBracketTime;
 return {acceptedSubsteps:(trace.rows-1)/5,events,forceEvents,completedCycles:cycles,minimumSeparatedGap,predictorDisagreements,analyticEntry,firstEntry,bracketContainsAnalytic,freeFlight:{acceptedSteps:freeSteps,positionErrorBound:freePosition,velocityErrorBound:freeVelocity,maxForce:freeForce,withinBudgets:control.gap<=0?null:freeSteps>0&&freePosition<=ENTRY_BUDGETS.freePosition&&freeVelocity<=ENTRY_BUDGETS.freeVelocity&&freeForce===0}};
}
export function encodeTrace(trace){const buffer=Buffer.allocUnsafe(trace.data.length*8);for(let i=0;i<trace.data.length;i++)buffer.writeDoubleLE(trace.data[i],i*8);return buffer;}

export function entryReceiving(cases,refinement,selection,sourcesUnchanged){
 assert.ok(['drop','recontact','all'].includes(selection));const names=selection==='all'?Object.keys(CONTROLS):[selection];
 const coverage=cases.length===3*names.length&&refinement.length===2*names.length&&names.every(name=>STEPS.every(dt=>cases.filter(c=>c.name===name&&c.diagnostic.dt===dt).length===1)&&STEPS.slice(0,2).every((dt,i)=>refinement.filter(r=>r.name===name&&r.coarseDt===dt&&r.fineDt===STEPS[i+1]&&r.budgetFraction===(i?.1:1)).length===1));
 return {coverage,complete:cases.length>0&&cases.every(c=>c.status==='completed'),momentum:cases.length>0&&cases.every(c=>Number.isFinite(c.summary.maxMomentumError)&&c.summary.maxMomentumError<=BUDGETS.momentum),...(names.includes('drop')?{entry:cases.filter(c=>c.name==='drop').every(c=>c.analysis.bracketContainsAnalytic&&c.analysis.freeFlight.withinBudgets)}:{}),...(names.includes('recontact')?{recontact:cases.filter(c=>c.name==='recontact').every(c=>c.analysis.completedCycles>=1)}:{}),refinement:refinement.length>0&&refinement.every(r=>r.withinBudgets),sourcesUnchanged:sourcesUnchanged===true};
}

async function main(){
 assert.ok(process.argv.length<=5,'Usage: node scripts/casing-entry.mjs [directory] [fixed|substeps] [drop|recontact|all]');const directory=resolve(process.argv[2]??'artifacts/casing-entry'),policy=process.argv[3]??'substeps',selection=process.argv[4]??'all';assert.ok(['fixed','substeps'].includes(policy));assert.ok(['drop','recontact','all'].includes(selection));await mkdir(directory,{recursive:true});
 const files=['scripts/casing-entry.mjs','scripts/casing-contact-step.mjs','scripts/casing-translate.mjs','scripts/casing-loaded.mjs','dist/tyre-fixture-examples.json',...(await readdir(new URL('../dist/',import.meta.url))).filter(p=>p.endsWith('.js')).sort().map(p=>'dist/'+p),'dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm'];
 const sourceHashes=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))]))),sourcesSha256=await sourceHashes(),cases=[],refinement=[];
 for(const name of selection==='all'?Object.keys(CONTROLS):[selection]){
  const input=await entryInput(name),control=CONTROLS[name];let previous;
  for(const [index,dt] of STEPS.entries()){
   const label=name+'-'+index;console.log('starting',label);const result=await runTranslation(input,{dt,duration:.02,hubVelocity:[0,control.velocityZ],contactSubsteps:policy==='substeps',traceContacts:true,comparison:true,onProgress:(tick,total)=>console.log(label,Math.round(tick/total*100)+'%')});
   const {contactTrace,comparison,...record}=result,analysis=analyseContactTrace(contactTrace,control),traceFile=label+'.f64',traceBytes=encodeTrace(contactTrace);await writeFile(join(directory,traceFile),traceBytes);
   record.contactTrace={format:contactTrace.format,columns:contactTrace.columns,rows:contactTrace.rows,encoding:'float64 little-endian, row-major',file:traceFile,sha256:hash(traceBytes)};
   const file=label+'.json',bytes=JSON.stringify(record,null,2)+'\n';await writeFile(join(directory,file),bytes);const {frames,finalState,compiled,...summary}=record;cases.push({name,file,sha256:hash(bytes),...summary,analysis});
   if(previous&&previous.status==='completed'&&result.status==='completed')refinement.push({name,...compareTranslation(previous,result,index===2?.1:1)});previous=result;
   console.log('completed',label,result.status,'substeps',analysis.acceptedSubsteps,'cycles',analysis.completedCycles);
  }
 }
 const sourcesUnchanged=JSON.stringify(await sourceHashes())===JSON.stringify(sourcesSha256),receiving=entryReceiving(cases,refinement,selection,sourcesUnchanged);
 await writeFile(join(directory,'report.json'),JSON.stringify({scope:'Synthetic translating, nonspinning controls; donor state provenance is parameter lineage only. Ordered RK predictors are not physical trajectory samples. No calibrated tyre, full-bike, browser or performance claim.',policy,controls:CONTROLS,duration:.02,budgets:ENTRY_BUDGETS,cases,refinement,sourcesSha256,receiving},null,2)+'\n');console.log(JSON.stringify(receiving));if(!Object.values(receiving).every(Boolean))process.exitCode=2;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
