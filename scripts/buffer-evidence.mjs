import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {runRig} from '../dist/bike-rig.js';
const scenarios=[];for(const bike of ['hardtail','full'])for(const rider of ['fixed','compliant'])scenarios.push({name:bike+'-'+rider+'-top',setup:{bike,rider,forkStiffness:9000}});
scenarios.push({name:'hardtail-fixed-bottom',setup:{bike:'hardtail',rider:'fixed',forkStiffness:4000}});
const rows=[];
for(const scenario of scenarios){const runs=[];for(const dt of [.000125,.0000625,.00003125]){const run=await runRig({...scenario.setup,forkBuffer:'progressive',forkDamping:200,amplitude:.08,bumpDuration:.2,dt});assert.equal(run.status,'complete');runs.push(run);rows.push({scenario:scenario.name,params:run.params,summary:run.summary,minFork:Math.min(...run.signals.fork),maxFork:Math.max(...run.signals.fork),traceSha256:createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(run.signals).map(([k,v])=>[k,Array.from(v)])))).digest('hex')});}
 const [a,b]=runs.slice(1);let travelDifference=0;for(let i=0;i<a.signals.time.length;i++)travelDifference=Math.max(travelDifference,Math.abs(a.signals.fork[i]-b.signals.fork[i]));
 const peakKey=scenario.name.endsWith('bottom')?'peakBottomForce':'peakTopForce',peakDifference=Math.abs(a.summary[peakKey]-b.summary[peakKey])/b.summary[peakKey];
 assert.ok(peakDifference<.02);assert.ok(travelDifference<.0002);for(const r of runs)assert.ok(r.summary.maxResidual/Math.max(1,Math.abs(r.summary.work),r.summary.loss)<.01);
 rows.at(-1).refinement={peakKey,relativePeakDifference:peakDifference,maxTravelDifference:travelDifference};
}
const receipt={model:rows.length?'bikelab-planar-rig-0.3':null,node:process.version,baseline:'30b81657d5a5f1631525ee5a5240fd8c0c2c6ad9',rows};
await writeFile('docs/evidence/iteration-8-buffers.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(rows.filter(r=>r.refinement).map(r=>({scenario:r.scenario,...r.refinement,residual:r.summary.maxResidual})),null,2));
