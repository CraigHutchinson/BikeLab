import {writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runRig} from '../dist/bike-rig.js';
const report={model:'bikelab-planar-rig-0.4',runs:[],comparisons:[]};
for(const rider of ['fixed','compliant'])for(const shockStiffness of [30000,70000]){
 const runs=[];for(const dt of [.000125,.0000625,.00003125]){const r=await runRig({bike:'full',rider,shockStiffness,shockDamping:900,shockBuffer:'progressive',forkBuffer:'progressive',input:'rear',amplitude:.08,bumpDuration:.2,dt});assert.equal(r.status,'complete');assert.ok(r.summary.maxResidual/Math.max(1,Math.abs(r.summary.work),r.summary.loss)<.01);runs.push(r);report.runs.push({params:r.params,status:r.status,summary:r.summary,minShock:Math.min(...r.signals.shock),maxShock:Math.max(...r.signals.shock)});}
 const [a,b]=runs.slice(1),key=shockStiffness===30000?'peakShockBottomForce':'peakShockTopForce',relativePeak=Math.abs(a.summary[key]-b.summary[key])/b.summary[key];let maxTravel=0;for(let i=0;i<a.signals.time.length;i++)maxTravel=Math.max(maxTravel,Math.abs(a.signals.shock[i]-b.signals.shock[i]));assert.ok(relativePeak<.02&&maxTravel<.0002);report.comparisons.push({rider,shockStiffness,relativePeak,maxTravel});
}
const baseline=process.argv[2]?JSON.parse(await readFile(process.argv[2],'utf8')):[];report.baseline=[];
for(const old of baseline){const current=await runRig(old.params);for(const [key,values] of Object.entries(old.signals))assert.deepEqual(Array.from(current.signals[key]),values,key);report.baseline.push({bike:old.params.bike,rider:old.params.rider,samples:old.signals.time.length,allOldChannelsExact:true});}
await writeFile('docs/evidence/iteration-10-shock-buffers.json',JSON.stringify(report,null,2));console.log(report.comparisons);
