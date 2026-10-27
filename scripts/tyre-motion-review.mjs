// Short fresh-state diagnostic; does not qualify uninterrupted idle stability.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {run,inputFromRecord} from '../dist/trail-bike.js';
import {tyreMotionProbe} from '../dist/tyre-motion.js';
const [source,directory='artifacts/tyre-motion',dt,...extra]=process.argv.slice(2);
if(!source||extra.length)throw Error('Usage: node scripts/tyre-motion-review.mjs source-record.json [output-directory] [dt]');
const hash=x=>createHash('sha256').update(x).digest('hex'),raw=await readFile(source),original=JSON.parse(raw);
inputFromRecord(original);const input=tyreMotionProbe(original);if(dt!==undefined)input.motion.dt=Number(dt);
let previous='';const record=await run(input,(phase,steps,total)=>{const label=phase+' '+Math.floor(steps/total*10);if(label!==previous){console.error(phase+' '+steps+'/'+total+' accepted steps');previous=label;}});
await mkdir(directory,{recursive:true});const bytes=JSON.stringify(record)+'\n';await writeFile(join(directory,'record.json'),bytes);
const quantities=['rmsSpeed','residualRmsSpeed','maxNodeSpeed','maxNodeAcceleration','edgeRmsSpeed','foundationEnergy','edgeEnergy','foundationDampingPower','edgeDampingPower','normalPower','tangentPower'];
const wheels=[0,1].map(k=>{
 const rows=record.frames.map(f=>f.wheels[k].tyreMotion),ranges=Object.fromEntries(quantities.map(key=>[key,rows.length?{min:Math.min(...rows.map(r=>r[key])),max:Math.max(...rows.map(r=>r[key]))}:null]));
 const signatures=record.frames.map(f=>f.contacts.filter(c=>c.wheel===k).map(c=>c.edge+':'+c.vertex).sort().join(','));
 return {wheel:k?'rear':'front',ranges,contactSets:new Set(signatures).size,contactSetChanges:signatures.slice(1).filter((s,i)=>s!==signatures[i]).length,
  node0VelocityRange:[0,1].map(i=>rows.length?{min:Math.min(...rows.map(r=>r.node0Velocity[i])),max:Math.max(...rows.map(r=>r.node0Velocity[i]))}:null),initial:rows[0]??null,final:rows.at(-1)??null};
});
const sourcesSha256={};for(const path of ['dist/tyre-motion.js','dist/trail-bike.js'])sourcesSha256[path]=hash(await readFile(new URL('../'+path,import.meta.url)));
const report={format:'bikelab-tyre-motion-review-0.1',scope:'20 ms fresh-state probe; zero warm start and reset work. Statistics use recorded samples, not every physics tick. No long-term decay, equilibrium, calibration or causal proof from this window alone.',
 source:{sha256:hash(raw),model:original.model,bike:original.scenario.bike.bike,endTime:original.summary?.acceptedTime??original.frames.at(-1).time,dt:original.scenario.motion.dt,identity:original.finalState.identity},
 sourcesSha256,scriptSha256:hash(await readFile(new URL(import.meta.url))),input,recordSha256:hash(bytes),status:record.status,termination:record.termination,summary:record.summary,wheels};
await writeFile(join(directory,'review.json'),JSON.stringify(report,null,2)+'\n');console.log('Saved '+join(directory,'review.json'));
