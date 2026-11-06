import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {solveMeridianEquilibrium,inspectEquilibriumTangent,BUDGETS} from './lib/tyre-equilibrium.mjs';
import {meridianFixture} from './lib/tyre-meridian-fixture.mjs';
import {createMeridianDiagnostic} from './lib/tyre-meridian.mjs';
if(process.argv.length>3)throw Error('Usage: node scripts/tyre-tangent.mjs [output-directory]');
const methods=['finite-difference','analytic-banded'],cases=[];
for(const segments of [16,32,64])for(const gaugePressure of [80000,160000,240000]){
 const configuration={...meridianFixture(segments),gaugePressure},results={},timings=Object.fromEntries(methods.map(m=>[m,[]]));
 // Warm both paths, then rotate whole-solve order. Timing is descriptive, not a CI gate.
 for(const tangent of methods)solveMeridianEquilibrium(configuration,configuration.restPoints,{tangent});
 for(let round=0;round<6;round++)for(const tangent of round%2?[...methods].reverse():methods){
  const start=performance.now(),r=solveMeridianEquilibrium(configuration,configuration.restPoints,{tangent});
  timings[tangent].push(performance.now()-start);results[tangent]=r;
 }
 const a=results['analytic-banded'],b=results['finite-difference'];
 const maxCoordinateDifference=Math.max(...a.points.flatMap((p,i)=>p.map((v,k)=>Math.abs(v-b.points[i][k]))));
 const stability=inspectEquilibriumTangent(configuration,a.points),bands=createMeridianDiagnostic(configuration).tangentBands(a.points);
 const n=2*(segments-1);
 cases.push({segments,configuration,timings,maxCoordinateDifference,volumeDifference:Math.abs(a.state.volume-b.state.volume),tangentEntries:{dense:n*n,banded:bands.length},stability,results});
 console.log(JSON.stringify({segments,gaugePressure,maxCoordinateDifference,converged:methods.every(m=>results[m].converged)}));
}
const paths=['scripts/lib/tyre-meridian.mjs','scripts/lib/tyre-banded.mjs','scripts/lib/tyre-equilibrium.mjs','scripts/lib/tyre-meridian-fixture.mjs','scripts/lib/tyre-inflation.mjs','scripts/tyre-tangent.mjs','scripts/plot-tyre-tangent.py','test/tyre-tangent.test.mjs'];
const sourcesSha256=Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(new URL('../'+p,import.meta.url))).digest('hex')])));
const dir=resolve(process.argv[2]??'artifacts/tyre-tangent');await mkdir(dir,{recursive:true});
await writeFile(join(dir,'report.json'),JSON.stringify({model:'bikelab-analytic-tangent-0.1',scope:'Offline constant-pressure reference; descriptive warm local timings, not production or calibrated performance',runtime:{node:process.version,platform:process.platform,arch:process.arch},budgets:BUDGETS,sourcesSha256,cases},null,2)+'\n');
assert.ok(cases.every(c=>methods.every(m=>c.results[m].converged)&&c.results['analytic-banded'].state.compressiveSegments===0&&c.maxCoordinateDifference<=2e-9&&c.stability.classification==='positive-with-refinement-margin'),'Receiving incomplete; attempted cases saved');
