import {riderGeometryError} from '../dist/rider-geometry-error.js';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {summarizeRiderLoads} from '../dist/rider-loads.js';
const [source='artifacts/rider-transfer',destination='artifacts/rider-loads']=process.argv.slice(2);
const input=JSON.parse(await readFile(join(source,'report.json'),'utf8')),cases=[];
for(const entry of input.cases){
 if(basename(entry.file)!==entry.file)throw Error('Record filename must be local to source directory.');
 const text=await readFile(join(source,entry.file),'utf8'),sha256=createHash('sha256').update(text).digest('hex');
 if(sha256!==entry.sha256)throw Error('Record hash mismatch: '+entry.file);
 const record=JSON.parse(text),observations=record.frames.map(frame=>riderGeometryError(record.scenario,frame));
 const maxima={};for(const key of ['jointTracking','trunkTracking','attachmentGap','anchorOffset','targetClosure','reconstructionResidual'])maxima[key]=0;
 let maxSumResidual=0;
 for(const observation of observations)for(const chain of Object.values(observation.chains)){
  for(const key of Object.keys(maxima))maxima[key]=Math.max(maxima[key],Math.hypot(...chain[key]));
  maxSumResidual=Math.max(maxSumResidual,Math.hypot(...chain.sum.map((v,i)=>v-observation.hipError[i])));
 }
 const geometry={scope:'Ordered joint-then-trunk geometric accounting, not independent causal contributions.',samples:observations.length,maxNormM:maxima,maxSumResidualM:maxSumResidual,final:observations.at(-1)??null};
 cases.push({file:entry.file,sha256,bike:record.scenario.bike.bike,dt:record.scenario.motion.dt,summary:summarizeRiderLoads(record),geometry});
}
await mkdir(destination,{recursive:true});await writeFile(join(destination,'report.json'),JSON.stringify({source:'Unchanged native records; verified against source receipt hashes.',cases},null,2)+'\n');
console.log('Reviewed '+cases.length+' records; no dynamics rerun.');
