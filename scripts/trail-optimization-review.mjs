// Serial review tool. Never run timing alongside tests or another measurement.
// Stage the unchanged dist/ and package.json under a separate baseline root.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {cpus,availableParallelism} from 'node:os';
import {run,preset,articulatedPreset} from '../dist/trail-bike.js';
import {CANONICAL_NUMERICS} from '../dist/trail-canonical.js';

const [baselinePath,mode='parity',output='artifacts/optimization/'+mode+'.json',...extra]=process.argv.slice(2);
if(!baselinePath||!['parity','timing','getters'].includes(mode)||extra.length)throw Error('Usage: node scripts/trail-optimization-review.mjs baseline/dist/trail-bike.js [parity|timing|getters] [output.json]');
const baselineURL=pathToFileURL(resolve(baselinePath)),baseline=await import(baselineURL.href);
const engines={baseline:baseline.run,candidate:run};
const digest=x=>createHash('sha256').update(x).digest('hex');
const receipt={mode,baselineSourceSHA256:digest(await readFile(baselineURL)),candidateSourceSHA256:digest(await readFile(new URL('../dist/trail-bike.js',import.meta.url))),
 scriptSHA256:digest(await readFile(new URL(import.meta.url))),node:process.version,cpu:cpus()[0]?.model,availableParallelism:availableParallelism(),
 scope:'Complete record parity and serial shared-worker observations; no physical calibration, target-device or real-time qualification.',cases:[]};
const cases=[];
for(const bike of ['full','hardtail']){
 const flat=preset('flat',bike);flat.motion={...flat.motion,duration:.1};
 const fixed=structuredClone(flat);fixed.bike.rider='fixed';fixed.commands=[{tick:0,rearDrive:0,frontBrake:0,rearBrake:0},{tick:800,rearDrive:5,frontBrake:2,rearBrake:1},{tick:1600,rearDrive:0,frontBrake:0,rearBrake:0}];
 const articulated=articulatedPreset(bike),state={...structuredClone(articulated),initialization:{mode:'launch'}};
 const domain=structuredClone(articulated);domain.motion.duration=.3;
 const rejected=structuredClone(flat);rejected.motion.riderOffset=.2;
 for(const [name,input] of [['legacy-guided',flat],['legacy-fixed-commands',fixed],['canonical-trail',preset('trail',bike)],
  ['canonical-fixed-commands',{...fixed,numerics:CANONICAL_NUMERICS}],['articulated',articulated],['state-launch',state],
  ['guided-limit',preset('limit',bike)],['articulated-limit',domain],['initial-rejection',rejected]])cases.push({name:bike+'-'+name,input});
}
const concise=r=>({status:r.status,steps:r.summary?.steps??0,acceptedTime:r.summary?.acceptedTime??0,termination:r.termination,frames:r.frames.length});
if(mode==='parity'){
 for(const c of cases){
  const expected=await baseline.run(c.input),actual=await run(c.input);assert.deepEqual(actual,expected,c.name);
  receipt.cases.push({name:c.name,...concise(actual),scenario:actual.scenario,recordSHA256:digest(JSON.stringify(actual))});console.error(c.name,actual.status);
  if(c.name.endsWith('state-launch')){
   const input={...expected.scenario,initialization:{mode:'state',state:expected.finalState},motion:Object.fromEntries(['gravity','duration','dt','sampleDt'].map(k=>[k,k==='duration'?.02:expected.scenario.motion[k]]))};
   const a=await baseline.run(input),b=await run(input);assert.deepEqual(b,a,c.name+' restart');
   receipt.cases.push({name:c.name+'-restart',...concise(b),scenario:b.scenario,recordSHA256:digest(JSON.stringify(b))});
  }
 }
}else if(mode==='timing'){
 receipt.method={warmupsPerEngine:1,measuredRepeatsPerEngine:3,order:'Alternating baseline/candidate then candidate/baseline; same process, warmed separate native runtimes.',timing:'Whole run including build, guards, integration and record materialization; no JSON hashing within timer. Progress observer disabled.',limits:'Shared worker, uncontrolled host load; three repeats are not tail latency or a per-tick deadline.'};
 for(const c of cases.filter(c=>/(legacy-guided|articulated)$/.test(c.name))){
  let expected;const samples={baseline:[],candidate:[]};
  for(let i=0;i<4;i++)for(const name of i%2?['candidate','baseline']:['baseline','candidate']){
   const start=performance.now(),r=await engines[name](c.input),ms=performance.now()-start;
   assert.equal(r.status,'completed',c.name);const hash=digest(JSON.stringify(r));if(expected)assert.equal(hash,expected);else expected=hash;
   if(i)samples[name].push(ms);
  }
  const median=a=>[...a].sort((a,b)=>a-b)[1],baselineMs=median(samples.baseline),candidateMs=median(samples.candidate);
  receipt.cases.push({name:c.name,input:c.input,samplesMs:samples,baselineMedianMs:baselineMs,candidateMedianMs:candidateMs,medianReductionPercent:100*(1-candidateMs/baselineMs),recordSHA256:expected});
  console.error(c.name,receipt.cases.at(-1).medianReductionPercent.toFixed(2)+'% median reduction');
 }
}else{
 const runtimes={baseline:await (await import(new URL('./moving-wheel.js',baselineURL))).getRuntime(),candidate:await (await import('../dist/moving-wheel.js')).getRuntime()};
 for(const name of ['baseline','candidate']){
  const mj=runtimes[name],proto=mj.MjData.prototype,keys=['qvel','qfrc_damper','qfrc_constraint'],descriptors={},counts={};
  for(const key of keys){descriptors[key]=Object.getOwnPropertyDescriptor(proto,key);assert.ok(descriptors[key]?.get&&descriptors[key].configurable);counts[key]=0;Object.defineProperty(proto,key,{...descriptors[key],get(){counts[key]++;return descriptors[key].get.call(this);}});}
  let r;try{r=await engines[name](cases[0].input);}finally{for(const key of keys)Object.defineProperty(proto,key,descriptors[key]);}
  receipt.cases.push({engine:name,counts,...concise(r),recordSHA256:digest(JSON.stringify(r))});
 }
 assert.equal(receipt.cases[0].recordSHA256,receipt.cases[1].recordSHA256);
 receipt.scope='Instrumented public getter counts over one identical complete full-suspension guided run; no timing or native-allocation byte claim.';
}
await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(output,JSON.stringify(receipt,null,2)+'\n');console.error('Saved',output);
