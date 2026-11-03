import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {run,MEASUREMENT} from '../dist/tyre-fixture.js';
const [directory='artifacts/tyre-fixture-settling',group='all',...extra]=process.argv.slice(2);
if(extra.length||!['all','coarse','refined'].includes(group))throw Error('Usage: node scripts/tyre-fixture-settling.mjs [directory] [all|coarse|refined]');
await mkdir(directory,{recursive:true});const hash=b=>createHash('sha256').update(b).digest('hex'),sourcesSha256={};
for(const path of ['dist/tyre-fixture.js','dist/tyre-fixture-observation.js','dist/tyre-fixture-examples.json','dist/moving-wheel.js','dist/tyre-motion.js','scripts/tyre-fixture-settling.mjs'])sourcesSha256[path]=hash(await readFile(new URL('../'+path,import.meta.url)));
const bundle=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))),cases=[];
const report={format:'bikelab-fixed-hub-settling-review-0.1',group,sourcesSha256,scope:'Uninterrupted 5 s fixed-hub controls; 0.5/1/5 s horizons use prefixes of the same path. Every accepted endpoint contributes to 100 ms interval statistics. All eight starts at 31.25 us; two representative starts additionally at15.625/7.8125 us. Sparse playback plus a dense final20ms window. No universal settling, calibrated damping, continuous-time peak or performance claim.',cases};
const save=()=>writeFile(join(directory,'review-'+group+'.json'),JSON.stringify(report,null,2)+'\n');
for(const seed of bundle.cases)for(const rates of ['imported','zero'])for(const [step,dt] of [['coarse',.00003125],['fine',.000015625],['finest',.0000078125]]){
 const representative=(seed.name==='full-front'&&rates==='imported')||(seed.name==='hardtail-rear'&&rates==='zero');
 if((step!=='coarse'&&!representative)||(group==='coarse'&&step!=='coarse')||(group==='refined'&&step==='coarse'))continue;
 const input=structuredClone(seed.input),endTick=Math.round(5/dt);input.rates=rates;input.motion={dt,duration:5,sampleDt:.025};input.measurement={format:MEASUREMENT,binDt:.1,window:{startTick:endTick-Math.round(.02/dt),endTick,strideTicks:Math.round(.000125/dt)}};
 const name=seed.name+'-'+rates+'-'+step;let posted=-1;
 const r=await run(input,(phase,tick,total)=>{const p=Math.floor(100*tick/total);if(phase==='integrating'&&p>posted){posted=p;console.error(name+': '+p+'% · '+(tick*dt).toFixed(2)+' / 5.00 s · '+tick+'/'+total+' accepted');}}),raw=JSON.stringify(r)+'\n';
 await writeFile(join(directory,name+'.json'),raw);
 const intervals=r.observation.intervals;
 cases.push({name,input,recordSha256:hash(raw),status:r.status,termination:r.termination,summary:r.summary,intervals,
  horizons:[.5,1,5].map(time=>{const tick=Math.round(time/dt),complete=r.summary.steps>=tick,available=intervals.filter(b=>b.endTick<=tick);return {time,tick,available:complete,completeIntervals:available.filter(b=>b.complete).length,lastInterval:complete?available.at(-1):null,reason:complete?null:r.termination?.reason??r.status};}),
  denseWindow:{...input.measurement.window,frames:r.observation.windowFrameIndices.length,complete:r.summary.steps>=endTick}});
 await save();
}
await save();console.log('Saved '+join(directory,'review-'+group+'.json'));if(cases.some(c=>c.status!=='completed'))process.exitCode=2;
