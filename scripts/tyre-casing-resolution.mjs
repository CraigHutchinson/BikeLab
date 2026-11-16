import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createSweptCasing,ENDPOINT_MODEL} from '../dist/sealed-casing.js';
import {meridianFixture} from './lib/tyre-meridian-fixture.mjs';
import {solveSealedPlane} from './lib/tyre-sealed-load.mjs';
const dir='artifacts/casing-resolution';await mkdir(dir,{recursive:true});
const paths=['dist/sealed-casing.js','dist/wheel-ring.js','dist/tyre-gas.js','scripts/lib/tyre-dense.mjs','scripts/lib/tyre-sealed-load.mjs','scripts/lib/tyre-meridian-fixture.mjs','scripts/lib/tyre-inflation.mjs','scripts/tyre-casing-resolution.mjs'];
const hash=x=>createHash('sha256').update(x).digest('hex');
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(p))])));
const sourcesSha256=await hashes(),cases=[];
for(const nodes of [32,64,128])for(const segments of [8,16,32]){
 const f=meridianFixture(segments),configuration={nodes,rimRadius:f.rimRadius,section:f.restPoints,meridionalRigidity:f.meridionalRigidity,hoopRigidity:f.hoopRigidity,couplingRigidity:f.couplingRigidity,gaugePressure:160000,ambientPressure:101325,exponent:1.2,provenance:'Uncalibrated independent section/circumference sampling; unchanged affine shape freedoms'},m=createSweptCasing(configuration,ENDPOINT_MODEL),states=[];let q;
 for(const lowering of [0,.001,.002]){const s=solveSealedPlane(configuration,m.reference.radius-lowering,q,{casingModel:ENDPOINT_MODEL});states.push(s);if(!s.converged)break;q=s.coordinates;}
 cases.push({nodes,segments,configuration,states});console.log(`resolution ${cases.length}/9`);
}
const comparisons=[];
for(const axis of ['nodes','segments'])for(const a of cases){const b=cases.find(b=>b[axis]===2*a[axis]&&b[axis==='nodes'?'segments':'nodes']===a[axis==='nodes'?'segments':'nodes']);if(!b)continue;const x=a.states.at(-1),y=b.states.at(-1),error=Math.abs(x.reaction-y.reaction),budget=1+.05*Math.max(x.reaction,y.reaction),complete=a.states.length===3&&b.states.length===3&&x.converged&&y.converged;comparisons.push({axis,from:[a.nodes,a.segments],to:[b.nodes,b.segments],error,budget,complete,passed:complete&&error<=budget});}
assert.deepEqual(await hashes(),sourcesSha256);
const report={scope:'Separate sampling convergence from affine section freedom. Fixed 1.6 bar and 2 mm lowering, not a pressure envelope or model acceptance.',sourcesSha256,cases,comparisons};await writeFile(`${dir}/report.json`,JSON.stringify(report)+'\n');
const summary={...report,reportSha256:hash(await readFile(`${dir}/report.json`)),cases:cases.map(c=>({...c,configuration:undefined,states:c.states.map(s=>({deflection:s.deflection,radius:s.reference.radius,reaction:s.reaction,contacts:s.contacts,activeVertexSpan:s.activeVertexSpan,kkt:s.metrics.maxKktForce,converged:s.converged,admission:s.admission,compression:s.state.compressiveCells,locallyAdmissible:s.locallyAdmissible}))}))};await writeFile(`${dir}/summary.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary.cases.map(c=>({nodes:c.nodes,segments:c.segments,...c.states.at(-1)})),null,2));if(cases.some(c=>c.states.length!==3||c.states.some(s=>!s.locallyAdmissible))||comparisons.some(c=>!c.passed))process.exitCode=1;
