import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {run} from '../dist/trail-bike.js';
import {riderTransferPreset,summarizeRiderTracking,compareRiderTransfers} from '../dist/rider-transfer.js';
const dir=process.argv[2]||'artifacts/rider-transfer';await mkdir(dir,{recursive:true});const cases=[],pairs=[];
for(const bike of ['full','hardtail'])for(const dt of [.00003125,.000015625]){
 const records=[];
 for(const control of [true,false]){
  const r=await run(riderTransferPreset(bike,{control,dt})),file=`${bike}-${dt}-${control?'hold':'transfer'}.json`,text=JSON.stringify(r);
  await writeFile(join(dir,file),text);records.push(r);
  cases.push({file,status:r.status,sha256:createHash('sha256').update(text).digest('hex'),scenario:r.scenario,summary:r.frames.length?summarizeRiderTracking(r):null,termination:r.termination,energyResidual:r.summary.maxResidual});
  console.log(bike,dt,control?'hold':'transfer',r.status);
 }
 try{pairs.push({bike,dt,...compareRiderTransfers(records[1],records[0])});}
 catch(error){pairs.push({bike,dt,unavailable:error.message});}
}
await writeFile(join(dir,'report.json'),JSON.stringify({scope:'Matched hold and slow transfer; no stable-tracking or manoeuvre qualification.',node:process.version,cases,pairs},null,2)+'\n');
if(cases.some(c=>c.status!=='completed')||pairs.some(p=>p.unavailable))process.exitCode=1;
