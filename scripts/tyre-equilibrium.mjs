import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {solveMeridianEquilibrium,inspectEquilibriumTangent,BUDGETS} from './lib/tyre-equilibrium.mjs';
import {meridianFixture} from './lib/tyre-meridian-fixture.mjs';
if(process.argv.length>3)throw Error('Usage: node scripts/tyre-equilibrium.mjs [output-directory]');
const cases=[];
for(const segments of [16,32,64]){
 let initial=meridianFixture(segments).restPoints;
 for(const gaugePressure of [80000,160000,240000]){
  const configuration={...meridianFixture(segments),gaugePressure},result=solveMeridianEquilibrium(configuration,initial);
  const stability=result.converged?inspectEquilibriumTangent(configuration,result.points):null;
  cases.push({segments,configuration,result,stability});initial=result.points;
  console.log(JSON.stringify({segments,gaugePressure,converged:result.converged,reason:result.reason,metrics:result.metrics,stability:stability?.classification}));
 }
}
const paths=['scripts/lib/tyre-banded.mjs','scripts/lib/tyre-gas.mjs','scripts/lib/tyre-equilibrium.mjs','scripts/lib/tyre-meridian.mjs','scripts/lib/tyre-meridian-fixture.mjs','scripts/lib/tyre-inflation.mjs','scripts/tyre-equilibrium.mjs','scripts/plot-tyre-equilibrium.py','test/tyre-equilibrium.test.mjs'];
const sourcesSha256=Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(new URL('../'+p,import.meta.url))).digest('hex')])));
const dir=resolve(process.argv[2]??'artifacts/tyre-equilibrium');await mkdir(dir,{recursive:true});
await writeFile(join(dir,'report.json'),JSON.stringify({model:'bikelab-fixed-bead-equilibrium-0.1',scope:'Offline dense fixed-bead axisymmetric equilibrium; uncalibrated material, no loaded contact or azimuthal stability',budgets:BUDGETS,sourcesSha256,cases},null,2)+'\n');
assert.ok(cases.every(c=>c.result.converged&&c.result.state.compressiveSegments===0&&c.stability.classification==='positive-with-refinement-margin'),'Receiving incomplete; full attempted cases saved');
