import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runRig,MODEL} from '../dist/bike-rig.js';
import {ANNOTATION,PHOTO_GEOMETRY,linkageDiagnostics} from '../dist/linkage.js';
const rows=[];
for(const bike of ['full','hardtail'])for(const rider of ['fixed','compliant']){
  const runs=[];for(const dt of [.00025,.000125,.0000625]){const r=await runRig({bike,rider,dt});assert.equal(r.status,'complete');assert.ok(r.summary.maxResidual<.02);runs.push(r);}
  const [a,b]=runs.slice(1),refinement={};
  for(const key of ['frontForce','rearForce']){const relative=Math.abs(Math.max(...a.signals[key])-Math.max(...b.signals[key]))/Math.max(...b.signals[key]);assert.ok(relative<.01);refinement[key]=relative;}
  for(const key of ['fork','shock']){let max=0;for(let i=0;i<a.signals.time.length;i++)max=Math.max(max,Math.abs(a.signals[key][i]-b.signals[key][i]));assert.ok(max<.0001);refinement[key]=max;}
  rows.push({bike,rider,params:b.params,steps:runs.map(r=>({dt:r.params.dt,summary:r.summary})),diagnostics:linkageDiagnostics(b),refinement});
}
await writeFile('docs/evidence/iteration-11-linkage.json',JSON.stringify({model:MODEL,annotation:ANNOTATION,photoGeometry:PHOTO_GEOMETRY,rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({bike:r.bike,rider:r.rider,refinement:r.refinement})),null,2));
