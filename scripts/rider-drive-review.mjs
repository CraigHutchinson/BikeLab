// Reproducible probes, not an automatic equilibrium or calibrated-human verdict.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {activePreset,run} from '../dist/trail-bike.js';
const [directory='artifacts/rider-drive',mode='short',...extra]=process.argv.slice(2);
if(extra.length||!['short','long'].includes(mode))throw Error('Usage: node scripts/rider-drive-review.mjs [output-directory] [short|long]');
await mkdir(directory,{recursive:true});
const hash=x=>createHash('sha256').update(x).digest('hex'),cases=[];
const sources=['dist/rider-drive.js','dist/trail-bike.js','dist/trail-initial-state.js'];
for(const bike of ['full','hardtail'])for(const kind of mode==='long'?['coarse','fine']:['active','passive']){
 const input=activePreset(bike,mode==='long'?10:.5);if(kind==='passive')delete input.active;if(kind==='fine')input.motion.dt=.000015625;
 const name=bike+'-'+kind;let previous='';
 const record=await run(input,(phase,steps,total)=>{const label=phase+' '+Math.floor(steps/total*10);if(label!==previous){console.error(name+': '+phase+' '+steps+'/'+total+' accepted steps');previous=label;}});
 const raw=JSON.stringify(record)+'\n',file=name+'.json';await writeFile(join(directory,file),raw);
 const first=record.frames[0],last=record.frames.at(-1),window=record.frames.filter(f=>f.time>=Math.max(0,(last?.time??0)-1));
 const range=key=>[0,1].map(i=>Math.max(...window.map(f=>f[key][i]))-Math.min(...window.map(f=>f[key][i])));
 cases.push({name,input,record:file,sha256:hash(raw),status:record.status,termination:record.termination,summary:record.summary,
  initialRiderCOM:first?.rider??null,finalRiderCOM:last?.rider??null,finalDrive:last?.active??null,
  sampledWindow:window.length?{start:window[0].time,end:last.time,riderCOMRange:range('rider'),frameTranslationRange:range('frame')}:null});
 console.error(name+': '+record.status+' at '+(record.summary?.acceptedTime??0)+' s'+(record.termination?' / '+record.termination.reason:''));
}
const sourcesSha256={};for(const source of sources)sourcesSha256[source]=hash(await readFile(new URL('../'+source,import.meta.url)));
const report={format:'bikelab-rider-drive-review-0.1',mode,sourcesSha256,scriptSha256:hash(await readFile(new URL(import.meta.url))),
 scope:'Uncalibrated fixed-target sampled joint effort; matched passive control uses the same 0.01 s closure regularization. Completion alone is not stationarity, perturbation stability, support-aware balance or 60 s idle qualification. Max coordinate rates/accelerations are sampled; energy residual maxima are integration-step observations.',cases};
await writeFile(join(directory,'review.json'),JSON.stringify(report,null,2)+'\n');console.log('Saved '+join(directory,'review.json'));
