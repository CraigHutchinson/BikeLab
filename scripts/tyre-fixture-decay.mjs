import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {run} from '../dist/tyre-fixture.js';
import {reviewDecay,compareDecay,compareSampledBins} from './tyre-fixture-decay-analysis.mjs';
const [directory='artifacts/tyre-fixture-decay',...extra]=process.argv.slice(2);
if(extra.length)throw Error('Usage: node scripts/tyre-fixture-decay.mjs [directory]');
await mkdir(directory,{recursive:true});const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sourcesSha256={};
for(const path of ['dist/tyre-fixture.js','dist/tyre-fixture-examples.json','dist/moving-wheel.js','dist/tyre-motion.js','dist/trail-initial-state.js','scripts/tyre-fixture-decay.mjs','scripts/tyre-fixture-decay-analysis.mjs','docs/evidence/tyre-fixture.json'])sourcesSha256[path]=hash(await readFile(new URL('../'+path,import.meta.url)));
const bundle=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))),records=new Map(),cases=[],samplingControls=[],prefixControls=[],comparisons=[];
const baseline=JSON.parse(await readFile(new URL('../docs/evidence/tyre-fixture.json',import.meta.url))).comparison.cases;
const report={format:'bikelab-fixed-hub-decay-0.1',scope:'100 ms same-start fixed-hub controls; five 20 ms bins with trapezoidal time weights and endpoint ledger differences. Sampled extrema/contact changes only. No equilibrium, asymptotic stability, damping calibration or performance claim. Signed contact work is not all dissipation.',sourcesSha256,cases,prefixControls,samplingControls,comparisons};
const saveReport=()=>writeFile(join(directory,'review.json'),JSON.stringify(report,null,2)+'\n');
async function calculate(name,input){
 let lastPercent=-1;
 const record=await run(input,(phase,accepted,total)=>{const percent=Math.floor(10*accepted/total)*10;if(phase==='integrating'&&percent>lastPercent){lastPercent=percent;console.error(`${name}: ${percent}% (${accepted}/${total} accepted)`);}});
 const raw=JSON.stringify(record)+'\n';await writeFile(join(directory,name+'.json'),raw);
 return {record,receipt:{name,input,recordSha256:hash(raw),status:record.status,termination:record.termination,summary:record.summary,decay:reviewDecay(record)}};
}
function exactSharedFrames(a,b){
 const dt=a.scenario.motion.dt;assert.equal(dt,b.scenario.motion.dt);
 assert.equal(a.identity,b.identity);assert.deepEqual(a.scenario.seed,b.scenario.seed);assert.equal(a.scenario.rates,b.scenario.rates);
 const byTick=new Map(b.frames.map(f=>[Math.round(f.time/dt),f]));let shared=0;
 for(const f of a.frames){const other=byTick.get(Math.round(f.time/dt));if(other){assert.deepEqual(f,other);shared++;}}
 return shared;
}
for(const seed of bundle.cases)for(const rates of ['imported','zero'])for(const [step,dt] of [['coarse',.00003125],['fine',.000015625],['finest',.0000078125]]){
 const name=seed.name+'-'+rates+'-'+step,input=structuredClone(seed.input);input.rates=rates;input.motion={dt,duration:.1,sampleDt:.0005};
 const long=await calculate(name,input);cases.push(long.receipt);records.set(name,long.record);await saveReport();
 const shortInput=structuredClone(input);shortInput.motion.duration=.02;shortInput.motion.sampleDt=.000125;
 const short=await calculate(name+'-dense-prefix',shortInput),prefix={...short.receipt,comparison:{status:'unavailable',reason:'Complete short and long controls are required.'}};
 if(long.record.status==='completed'&&short.record.status==='completed'){
  const shared=exactSharedFrames(long.record,short.record);assert.equal(shared,41);
  assert.equal(short.receipt.recordSha256,baseline.find(c=>c.name===name)?.recordSha256,'Changed prior 20 ms record');
  prefix.comparison={status:'available',sharedFrames:shared,exact:true,prior20msRecordHashExact:true,scope:'Exact first 20 ms frames at shared 500 us samples; dense short run has 125 us samples. Saved-sample statistic differences are long-minus-dense.',sampledBinDifferences:compareSampledBins(long.receipt.decay.bins.slice(0,1),short.receipt.decay.bins)};
 }
 prefixControls.push(prefix);
 // A second phase-aligned but non-nested cadence at the finest timestep checks
 // observation effects and exposes some sampling dependence; it is not an
 // anti-aliasing proof or a substitute for resolving every integration step.
 if(step==='finest'){
  const alternateInput=structuredClone(input);alternateInput.motion.sampleDt=.000625;
  const alternate=await calculate(name+'-alternate-sampling',alternateInput),control={...alternate.receipt,comparison:{status:'unavailable',reason:'Complete controls are required.'}};
  if(long.record.status==='completed'&&alternate.record.status==='completed'){
   const shared=exactSharedFrames(long.record,alternate.record);assert.equal(shared,41);
   assert.deepEqual(long.record.finalNodes,alternate.record.finalNodes);assert.deepEqual(long.record.summary,alternate.record.summary);
   control.comparison={status:'available',sharedFrames:shared,exact:true,finalStateAndSummaryExact:true,scope:'Shared 2.5 ms samples and final complete node state/summary agree at 500/625 us cadences. Saved-sample statistic differences are 500-minus-625 us.',sampledBinDifferences:compareSampledBins(long.receipt.decay.bins,alternate.receipt.decay.bins)};
  }
  samplingControls.push(control);
 }
 await saveReport();
}
for(const seed of bundle.cases)for(const rates of ['imported','zero'])for(const [coarse,fine] of [['coarse','fine'],['fine','finest']])comparisons.push({seed:seed.name,rates,coarse,fine,...compareDecay(records.get(seed.name+'-'+rates+'-'+coarse),records.get(seed.name+'-'+rates+'-'+fine))});
await saveReport();console.log('Saved '+join(directory,'review.json'));
if([...cases,...prefixControls,...samplingControls].some(c=>c.status!=='completed'||c.decay.dampingMonotonicity?.passed!==true))process.exitCode=2;
