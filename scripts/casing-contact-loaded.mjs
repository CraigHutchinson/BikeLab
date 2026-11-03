// Resumable loaded receiving of the bounded contact policy. No dynamics changes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runTranslation,compareTranslation,translationXML,CONTACT_MODEL,NORMAL_ORACLE,STEPS,BUDGETS} from './casing-translate.mjs';
import {CONTACT_STEP} from './casing-contact-step.mjs';
import {LOADED_BUDGETS} from './casing-loaded.mjs';
import {STAGE_WORK,STAGE_BUDGETS} from '../dist/casing-rk4-observer.js';
import {NATIVE_BUILD} from '../dist/trail-initial-state.js';
import {validate} from '../dist/tyre-fixture.js';
export const GROUPS=Object.freeze(['full-front','full-rear','hardtail-front','hardtail-rear'].flatMap(name=>['imported','zero'].map(rates=>name+'-'+rates)));
export const CACHE='bikelab-loaded-contact-checkpoint-0.1';
export function studyPartition(value){
 if(value===undefined)return {id:null,groups:[...GROUPS],reportFile:'report.json'};
 assert.match(value,/^[0-7]\/[1-8]$/,'Partition must be INDEX/COUNT, with 0 <= INDEX < COUNT <= 8');const [index,count]=value.split('/').map(Number);assert.ok(index<count,'Partition index must be below count');return {id:value,groups:GROUPS.filter((_,i)=>i%count===index),reportFile:`report-${index}-of-${count}.json`};
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sameSources=async sources=>{for(const [p,h] of Object.entries(sources))assert.equal(hash(await readFile(new URL('../'+p,import.meta.url))),h,'Study source changed: '+p);};
const atomicJSON=async(path,value)=>{await writeFile(path+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(path+'.tmp',path);};

function validateRecord(record,input,dt,duration,descriptor){
 assert.equal(record.model,CONTACT_MODEL);assert.equal(record.normalOracle,NORMAL_ORACLE);assert.equal(record.nativeBuild,NATIVE_BUILD);assert.equal(record.stageWork,STAGE_WORK);assert.deepEqual(record.contactStep,CONTACT_STEP);assert.equal(record.compiled.solverTolerance,CONTACT_STEP.solverTolerance);assert.deepEqual(record.input,input);assert.deepEqual(record.diagnostic,{dt,duration,hubVelocity:[0,0],contact:'plane-vertices; compiled regularization recorded, not fixed-hub compliance parity'});assert.equal(record.xmlSha256,hash(translationXML(input,dt,true)));
 assert.deepEqual(record.budgets,{observer:STAGE_BUDGETS,independent:BUDGETS,refinement:LOADED_BUDGETS});assert.ok(['completed','terminated'].includes(record.status));assert.ok(Number.isSafeInteger(record.summary.steps)&&record.summary.steps>=0&&record.summary.steps<=Math.round(duration/dt));if(record.status==='completed')assert.equal(record.summary.steps,Math.round(duration/dt));
 const nv=2*input.seed.wheel.nodes+2;assert.equal(record.finalState.q.length,nv);assert.equal(record.finalState.v.length,nv);assert.equal(record.frames.at(-1).tick,record.summary.steps);
 assert.equal(descriptor.encoding,'float64 little-endian, row-major');assert.equal(descriptor.dt,STEPS[0]);assert.equal(descriptor.width,2*nv+4);assert.equal(descriptor.count,Math.floor(record.summary.steps/Math.round(STEPS[0]/dt))+1);
}

export async function runOrLoadCase(directory,label,input,dt,duration,sources,onProgress){
 assert.match(label,/^[a-z0-9-]+$/);assert.ok(STEPS.includes(dt)&&[.001,.005,.02].includes(duration));const a=validate(input),file=label+'.json',comparisonFile=label+'.f64',checkpointFile=label+'.checkpoint.json';await mkdir(directory,{recursive:true});await sameSources(sources);
 let cached;try{cached=JSON.parse(await readFile(join(directory,checkpointFile)));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(cached){
  assert.equal(cached.format,CACHE);assert.deepEqual(cached.sourcesSha256,sources,'Checkpoint sources differ; use a new study directory');assert.equal(cached.file,file);assert.equal(cached.comparison.file,comparisonFile);
  const bytes=await readFile(join(directory,file)),binary=await readFile(join(directory,comparisonFile));assert.equal(hash(bytes),cached.sha256,'Cached record hash mismatch');assert.equal(hash(binary),cached.comparison.sha256,'Cached comparison hash mismatch');const record=JSON.parse(bytes);validateRecord(record,a,dt,duration,cached.comparison);
  assert.equal(binary.length,8*cached.comparison.count*cached.comparison.width);const trajectory=new Float64Array(binary.length/8);for(let i=0;i<trajectory.length;i++)trajectory[i]=binary.readDoubleLE(8*i);assert.ok(trajectory.every(Number.isFinite));await sameSources(sources);
  return {result:{...record,comparison:{dt:cached.comparison.dt,width:cached.comparison.width,count:cached.comparison.count,trajectory}},checkpoint:cached,reused:true};
 }
 const result=await runTranslation(a,{dt,duration,contactSubsteps:true,comparison:true,onProgress});await sameSources(sources);const {comparison,...record}=result,values=comparison.count*comparison.width,binary=Buffer.allocUnsafe(8*values);assert.ok(values<=comparison.trajectory.length);for(let i=0;i<values;i++)binary.writeDoubleLE(comparison.trajectory[i],8*i);
 const bytes=JSON.stringify(record,null,2)+'\n',checkpoint={format:CACHE,file,sha256:hash(bytes),sourcesSha256:sources,comparison:{file:comparisonFile,sha256:hash(binary),encoding:'float64 little-endian, row-major',dt:comparison.dt,count:comparison.count,width:comparison.width}};validateRecord(record,a,dt,duration,checkpoint.comparison);
 await writeFile(join(directory,comparisonFile),binary);await writeFile(join(directory,file),bytes);await atomicJSON(join(directory,checkpointFile),checkpoint);return {result,checkpoint,reused:false};
}

export function receiveLoadedContacts(cases,refinement,sourcesUnchanged){
 const coverage=cases.length===24&&refinement.length===16&&GROUPS.every(name=>STEPS.every(dt=>cases.filter(c=>c.name===name&&c.diagnostic.dt===dt).length===1)&&STEPS.slice(0,2).every((dt,i)=>refinement.filter(r=>r.name===name&&r.coarseDt===dt&&r.fineDt===STEPS[i+1]&&r.budgetFraction===(i?.1:1)).length===1));
 const independentKeys=Object.keys(BUDGETS).filter(k=>!['mass','momentum'].includes(k)),finiteWithin=(values,budgets,keys=Object.keys(budgets),fraction=1)=>values&&Object.keys(values).length===keys.length&&keys.every(k=>Number.isFinite(values[k])&&values[k]>=0&&values[k]<=fraction*budgets[k]);
 return {coverage,complete:cases.length>0&&cases.every(c=>c.status==='completed'),identity:cases.length>0&&cases.every(c=>c.model===CONTACT_MODEL&&c.normalOracle===NORMAL_ORACLE&&c.nativeBuild===NATIVE_BUILD&&c.stageWork===STAGE_WORK&&Object.keys(CONTACT_STEP).every(k=>c.contactStep?.[k]===CONTACT_STEP[k])&&c.compiled.solverTolerance===CONTACT_STEP.solverTolerance),momentum:cases.length>0&&cases.every(c=>Number.isFinite(c.summary.maxMomentumError)&&c.summary.maxMomentumError>=0&&c.summary.maxMomentumError<=BUDGETS.momentum),workBalance:cases.length>0&&cases.every(c=>Number.isFinite(c.summary.maxResidual)&&c.summary.maxResidual>=0&&c.summary.maxResidual<=LOADED_BUDGETS.residual),independent:cases.length>0&&cases.every(c=>finiteWithin(c.summary.maxIndependent,BUDGETS,independentKeys)&&Number.isFinite(c.compiled.massError)&&c.compiled.massError>=0&&c.compiled.massError<=BUDGETS.mass),nativeStages:cases.length>0&&cases.every(c=>finiteWithin(c.summary.maxObserver,STAGE_BUDGETS)&&c.nativeWarnings.length===0&&c.observerWarnings.length===0),boundedWork:cases.length>0&&cases.every(c=>{const s=c.summary.stepping;return s&&['acceptedIntervals','acceptedSubsteps','attemptedSubsteps','discardedContactTrials','deepestBisection','transitionLimitedSubsteps'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0)&&s.acceptedIntervals===c.summary.steps&&s.acceptedSubsteps>=s.acceptedIntervals&&s.attemptedSubsteps>=s.acceptedSubsteps&&s.acceptedSubsteps-s.acceptedIntervals<=CONTACT_STEP.maxExtraSubsteps&&s.deepestBisection<=CONTACT_STEP.maxBisections;}),refinement:refinement.length>0&&refinement.every(r=>r.withinBudgets===true&&finiteWithin(r.maxima,LOADED_BUDGETS,Object.keys(LOADED_BUDGETS),r.budgetFraction)),sourcesUnchanged:sourcesUnchanged===true};
}

async function main(){
 assert.ok(process.argv.length<=5,'Usage: node scripts/casing-contact-loaded.mjs [directory] [.001|.005|.02] [INDEX/COUNT]');const directory=resolve(process.argv[2]??'artifacts/casing-contact-loaded'),duration=Number(process.argv[3]??.02),partition=studyPartition(process.argv[4]);assert.ok([.001,.005,.02].includes(duration));await mkdir(directory,{recursive:true});
 const files=['scripts/casing-contact-loaded.mjs','scripts/casing-contact-step.mjs','scripts/casing-translate.mjs','scripts/casing-loaded.mjs',...(await readdir(new URL('../dist/',import.meta.url))).filter(p=>p.endsWith('.js')).sort().map(p=>'dist/'+p),'dist/tyre-fixture-examples.json','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm'],sourcesSha256=Object.fromEntries(await Promise.all(files.map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))]))),examples=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))).cases,cases=[],refinement=[];
 assert.deepEqual(examples.map(c=>c.name).sort(),['full-front','full-rear','hardtail-front','hardtail-rear']);
 const save=async(state,error=null)=>{let sourcesUnchanged=true;try{await sameSources(sourcesSha256);}catch{sourcesUnchanged=false;}const receiving=receiveLoadedContacts(cases,refinement,sourcesUnchanged);await atomicJSON(join(directory,partition.reportFile),{model:CONTACT_MODEL,contactStep:CONTACT_STEP,duration,state,error,partition:partition.id,progress:{completedCases:cases.length,totalCases:3*partition.groups.length,matrixTotalCases:24},scope:'Loaded translating, fixed-orientation wheel release. Native contact-substep/solver policy; original budgets. No spin, connected-bike, physical calibration, browser or performance acceptance.',cases,refinement,sourcesSha256,sourcesUnchanged,receiving});return receiving;};
 try{
  for(const example of examples)for(const rates of ['imported','zero']){
   const input=structuredClone(example.input);input.rates=rates;const name=example.name+'-'+rates;if(!partition.groups.includes(name))continue;let previous;
   for(const [index,dt] of STEPS.entries()){
    const label=name+'-'+index;console.log('starting',cases.length+1,'/'+(3*partition.groups.length),label);const {result,checkpoint,reused}=await runOrLoadCase(directory,label,input,dt,duration,sourcesSha256,(tick,total)=>console.log(label,Math.round(100*tick/total)+'%'));
    const {comparison,frames,finalState,...summary}=result;cases.push({name,file:checkpoint.file,sha256:checkpoint.sha256,comparison:checkpoint.comparison,...summary});if(previous&&previous.status==='completed'&&result.status==='completed')refinement.push({name,...compareTranslation(previous,result,index===2?.1:1)});previous=result;await save('running');console.log(reused?'resumed':'completed',label,result.status,'extra substeps',result.summary.stepping.acceptedSubsteps-result.summary.steps);
   }
  }
  const receiving=await save('completed');console.log(JSON.stringify(receiving));if(!Object.entries(receiving).every(([key,value])=>value||(partition.id!==null&&key==='coverage')))process.exitCode=2;
 }catch(error){await save('interrupted',error.message);throw error;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
