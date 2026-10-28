import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {run} from '../dist/tyre-fixture.js';
const [directory='artifacts/tyre-fixture',...extra]=process.argv.slice(2);
if(extra.length)throw Error('Usage: node scripts/tyre-fixture-review.mjs [directory]');
await mkdir(directory,{recursive:true});const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sourcesSha256={};
for(const path of ['dist/tyre-fixture.js','dist/tyre-fixture-examples.json','dist/moving-wheel.js','dist/tyre-motion.js','dist/trail-initial-state.js','scripts/tyre-fixture-review.mjs'])sourcesSha256[path]=hash(await readFile(new URL('../'+path,import.meta.url)));
const bundle=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))),cases=[],records=new Map();
for(const seed of bundle.cases)for(const rates of ['imported','zero'])for(const [step,dt] of [['coarse',.00003125],['fine',.000015625],['finest',.0000078125]]){
 const input=structuredClone(seed.input);input.rates=rates;input.motion.dt=dt;const name=seed.name+'-'+rates+'-'+step;console.error('Calculating '+name);
 const r=await run(input),raw=JSON.stringify(r)+'\n';await writeFile(join(directory,name+'.json'),raw);records.set(name,r);
 let changes=0,previous=null;for(const f of r.frames){const key=f.contacts.map(c=>c.edge+':'+c.vertex).sort().join(',');if(previous!==null&&key!==previous)changes++;previous=key;}
 const range=fn=>r.frames.length?{min:Math.min(...r.frames.map(fn)),max:Math.max(...r.frames.map(fn))}:null;
 cases.push({name,input,transfer:seed.transfer,recordSha256:hash(raw),status:r.status,termination:r.termination,summary:r.summary,sampledContactSetChanges:changes,sampledRanges:{rmsSpeed:range(f=>f.tyreMotion.rmsSpeed),maxNodeSpeed:range(f=>f.tyreMotion.maxNodeSpeed),maxNodeAcceleration:range(f=>f.tyreMotion.maxNodeAcceleration),edgeDampingPower:range(f=>f.tyreMotion.edgeDampingPower),contactMomentDifference:range(f=>f.contactMomentDifference)},final:r.frames.length?{rmsSpeed:r.frames.at(-1).tyreMotion.rmsSpeed,dampingLoss:r.frames.at(-1).dampingLoss,contactWork:r.frames.at(-1).contactWork}:null});
}
const comparisons=[];
for(const seed of bundle.cases)for(const rates of ['imported','zero'])for(const [coarse,fine] of [['coarse','fine'],['fine','finest']]){
 const a=records.get(seed.name+'-'+rates+'-'+coarse),b=records.get(seed.name+'-'+rates+'-'+fine),fields={};if(a.status!=='completed'||b.status!=='completed')continue;
 if(a.frames.length!==b.frames.length)throw Error('Mismatched observation schedule.');
 for(let i=0;i<a.frames.length;i++){
  const f=a.frames[i],g=b.frames[i];if(Math.abs(f.time-g.time)>1e-10)throw Error('Mismatched observation time.');
  for(const [key,delta] of Object.entries({node0Velocity:Math.hypot(...f.tyreMotion.node0Velocity.map((v,k)=>v-g.tyreMotion.node0Velocity[k])),rmsSpeed:f.tyreMotion.rmsSpeed-g.tyreMotion.rmsSpeed,verticalForce:f.ground[1]-g.ground[1]})){const s=fields[key]??={maxAbsolute:0,sumSquares:0};s.maxAbsolute=Math.max(s.maxAbsolute,Math.abs(delta));s.sumSquares+=delta*delta;}
 }
 for(const f of Object.values(fields)){f.rms=Math.sqrt(f.sumSquares/a.frames.length);delete f.sumSquares;}
 comparisons.push({seed:seed.name,rates,coarse,fine,samples:a.frames.length,fields});
}
const report={format:'bikelab-fixed-hub-review-0.1',scope:'Four 9.98 s loaded seeds; retained local rates versus zero rates at identical deformation, each at three steps over20 ms. Sampled motion/contact changes, not continuous peaks, long-time decay, calibrated stability or a unique cause. Fixed boundary changes world kinetic energy. Source hashes collected before execution.',sourcesSha256,cases,comparisons};
await writeFile(join(directory,'review.json'),JSON.stringify(report,null,2)+'\n');console.log('Saved '+join(directory,'review.json'));
