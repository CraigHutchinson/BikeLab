import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {run,riderTargetPreset,activePreset} from '../dist/trail-bike.js';
const dir=process.argv[2]||'artifacts/rider-targets';await mkdir(dir,{recursive:true});
const cases=[];
for(const bike of ['full','hardtail'])for(const kind of ['hold','targets']){
 const record=await run(kind==='targets'?riderTargetPreset(bike):activePreset(bike,.1)),text=JSON.stringify(record),file=bike+'-'+kind+'.json';
 await writeFile(join(dir,file),text);const last=record.frames.at(-1);
 cases.push({bike,kind,file,sha256:createHash('sha256').update(text).digest('hex'),status:record.status,termination:record.termination,scenario:record.scenario,
  acceptedTime:record.summary.acceptedTime,riderWork:record.summary.riderWork,maxEnergyResidual:record.summary.maxResidual,maxRootWrench:record.summary.maxSampledRootWrench,
  final:{jointError:last.active.error,...(kind==='targets'?{targetCommand:last.active.targetCommand,targetHip:record.scenario.riderTargets.commands[last.active.targetCommand].hip,actualHip:last.active.actualHip,targetCOM:last.active.targetCOM,actualCOM:last.active.actualCOM,actualTrunkPitch:last.active.actualTrunkPitch}:{})}});
}
const report={scope:'Scheduling and bounded-effort receiver; not stable tracking, continuous-path support or manoeuvre qualification.',node:process.version,cases};
await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(cases.map(({scenario,...c})=>c),null,2));
if(cases.some(c=>c.status!=='completed'))process.exitCode=1;
