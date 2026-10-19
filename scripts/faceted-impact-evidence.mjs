import {run,preset,MODEL} from '../dist/trail-bike.js';
import {impactMetrics} from './impact-diagnostics.mjs';
import {writeFile} from 'node:fs/promises';
const rows=[],records=new Map();
async function sample(name,a){
 const r=await run(a),last=r.frames.at(-1);records.set(name,r);
 rows.push({name,status:r.status,termination:r.termination,scenario:r.scenario,summary:r.summary,metrics:impactMetrics(r),last:last?{frame:last.frame,impulse:last.impulse,momentumResidual:last.momentumResidual,fork:last.fork,shock:last.shock,riderOffset:last.riderOffset}:null});
 console.log(name,r.status,r.summary?.maxResidual,rows.at(-1).metrics.maxNormalAngleError);
}
for(const bike of ['full','hardtail'])for(const name of ['square','faceted','edge-limit'])await sample(bike+'-'+name,preset(name,bike));
// Common 0.4 s window contains the front wheel impact. Change one resolution
// axis at a time; changing a rock's authored shape is not a mesh refinement.
for(const name of ['square','faceted']){
 for(const dt of [.00003125,.000015625,.0000078125])await sample(name+'-dt-'+dt,{...preset(name),motion:{duration:.4,dt}});
 await sample(name+'-nodes-128',{...preset(name),wheel:{nodes:128},motion:{duration:.4,dt:.000015625}});
}
const differences=[];
for(const name of ['square','faceted']){
 const baseline=records.get(name+'-dt-0.000015625').frames.at(-1);
 for(const row of rows.filter(r=>r.name.startsWith(name+'-')))differences.push({name:row.name,relativeTo:name+'-dt-0.000015625',positionDistance:Math.hypot(row.last.frame[0]-baseline.frame[0],row.last.frame[1]-baseline.frame[1]),pitchDifference:row.last.frame[2]-baseline.frame[2],impulseDifference:row.last.impulse.map((v,i)=>v-baseline.impulse[i])});
}
const normalPrecision=[];
for(const collisionTolerance of [1e-10,1e-12]){const r=await run({...preset('faceted'),wheel:{collisionTolerance,collisionIterations:200},motion:{duration:.3}});normalPrecision.push({collisionTolerance,collisionIterations:200,status:r.status,summary:r.summary,metrics:impactMetrics(r)});}
await writeFile('docs/evidence/iteration-17-impacts.json',JSON.stringify({model:MODEL,note:'Synthetic frictionless faceted-impact MVP. Sampled contact metrics are not all-step extrema. Not calibrated component stress, fracture, full CCD or real-time qualification.',rows,differences,normalPrecision},null,2)+'\n');
