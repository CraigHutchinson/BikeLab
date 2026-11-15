import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {createSweptCasing} from '../dist/sealed-casing.js';
import {meridianFixture} from './lib/tyre-meridian-fixture.mjs';
import {solveSealedPlane,MODEL,BUDGETS} from './lib/tyre-sealed-load.mjs';
const dir=resolve(process.argv[2]??'artifacts/sealed-load');assert.ok(process.argv.length<=3);await mkdir(dir,{recursive:true});
const paths=['dist/sealed-casing.js','dist/wheel-ring.js','dist/tyre-gas.js','scripts/lib/tyre-dense.mjs','scripts/lib/tyre-sealed-load.mjs','scripts/lib/tyre-meridian-fixture.mjs','scripts/lib/tyre-inflation.mjs','scripts/tyre-sealed-load.mjs','scripts/plot-tyre-sealed-load.py','test/tyre-sealed-load.test.mjs'];
const hash=b=>createHash('sha256').update(b).digest('hex'),hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(p))]))),sourcesSha256=await hashes();
const cases=[];
for(const segments of [8,16])for(const nodes of [32,64,128])for(const pressure of [120000,160000,200000]){
 const c=meridianFixture(segments),configuration={nodes,rimRadius:c.rimRadius,section:c.restPoints,meridionalRigidity:c.meridionalRigidity,hoopRigidity:c.hoopRigidity,couplingRigidity:c.couplingRigidity,gaugePressure:pressure,ambientPressure:101325,exponent:1.2,provenance:'Illustrative load diagnostic; no measured tyre data'},R=createSweptCasing(configuration).reference.radius,states=[];let q;
 for(const [index,deflection] of [0,.001,.002,.003,.004,.003,.002,.001,0].entries()){
  const s=solveSealedPlane(configuration,R-deflection,q);states.push({...s,branch:index<=4?'load':'unload'});if(!s.converged)break;q=s.coordinates;
 }
 cases.push({segments,nodes,pressure,configuration,states});console.log('loaded diagnostic',cases.length+'/18');
}
const comparisons=[];
for(const c of cases){for(const axis of ['nodes','segments']){const d=cases.find(a=>a.pressure===c.pressure&&a[axis]===2*c[axis]&&a[axis==='nodes'?'segments':'nodes']===c[axis==='nodes'?'segments':'nodes']);if(!d)continue;for(let i=0;i<Math.min(c.states.length,d.states.length,5);i++){
 const a=c.states[i],b=d.states[i],difference=Math.abs(a.reaction-b.reaction),budget=1+.05*Math.max(a.reaction,b.reaction);
 comparisons.push({axis,coarse:[c.nodes,c.segments],fine:[d.nodes,d.segments],pressure:c.pressure,deflection:a.deflection,reactionDifference:difference,budget,passed:difference<=budget,locallyAdmissible:a.locallyAdmissible&&b.locallyAdmissible});
}}}
const samples=cases.flatMap(c=>c.states),receiving={completeCycles:cases.every(c=>c.states.length===9),convergence:samples.every(s=>s.converged),localMaterialAndStability:samples.every(s=>s.locallyAdmissible),reactionRefinement:comparisons.every(c=>c.passed)};receiving.complete=Object.values(receiving).every(Boolean);
const summary={model:MODEL,scope:'Quasi-static zero-thickness swept surface against a plane. Mathematical continuation through rejected compression states is preserved diagnostically, not admitted motion. Active vertex span is not physical footprint width. No native contact or calibration claim.',budgets:BUDGETS,refinementBudget:'1 N + 5% of larger reaction; numerical receiving target, not measured physical error',receiving,counts:{cases:cases.length,samples:samples.length,converged:samples.filter(s=>s.converged).length,locallyAdmissible:samples.filter(s=>s.locallyAdmissible).length,compressive:samples.filter(s=>s.state.compressiveCells>0).length,refinementComparisons:comparisons.length,refinementFailures:comparisons.filter(s=>!s.passed).length},maxKktForce:Math.max(...samples.map(s=>s.metrics.maxKktForce)),comparisons,cases:cases.map(c=>({...c,states:c.states.map(s=>({branch:s.branch,deflection:s.deflection,reaction:s.reaction,materialReaction:s.materialReaction,gasReaction:s.gasReaction,pressure:s.state.gaugePressure,volume:s.state.volume,potential:s.state.potential,compression:s.state.compressiveCells,activeVertexSpan:s.activeVertexSpan,rimClearance:s.rimClearance,locallyAdmissible:s.locallyAdmissible,admission:s.admission,converged:s.converged,iterations:s.iterations,stability:s.stability.classification,kkt:s.metrics.maxKktForce}))})),sourcesSha256};
assert.deepEqual(await hashes(),sourcesSha256);await writeFile(join(dir,'report.json'),JSON.stringify({model:MODEL,cases,comparisons,receiving,sourcesSha256})+'\n');summary.reportSha256=hash(await readFile(join(dir,'report.json')));await writeFile(join(dir,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({receiving,counts:summary.counts,maxKktForce:summary.maxKktForce},null,2));if(!receiving.complete)process.exitCode=1;
