import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createMeridianDiagnostic} from './lib/tyre-meridian.mjs';
import {createSealedGas} from './lib/tyre-gas.mjs';
import {meridianFixture} from './lib/tyre-meridian-fixture.mjs';
import {solveMeridianEquilibrium,inspectEquilibriumTangent,BUDGETS} from './lib/tyre-equilibrium.mjs';
if(process.argv.length>3)throw Error('Usage: node scripts/tyre-sealed.mjs [output-directory]');
const cases=[];
for(const segments of [16,32,64])for(const gaugePressure of [80000,160000,240000])for(const exponent of [1,1.4]){
 const c={...meridianFixture(segments),gaugePressure},referenceVolume=createMeridianDiagnostic(c).evaluate(c.restPoints).volume;
 const configuration={...c,gas:{referenceVolume,ambientPressure:101325,exponent,minVolumeFraction:.5,maxVolumeFraction:1.5}},results={};
 for(const tangent of ['finite-difference','analytic-banded'])results[tangent]=solveMeridianEquilibrium(configuration,c.restPoints,{tangent});
 const a=results['analytic-banded'],b=results['finite-difference'],stability=a.converged?inspectEquilibriumTangent(configuration,a.points):null;
 const difference=Math.max(...a.points.flatMap((p,i)=>p.map((v,k)=>Math.abs(v-b.points[i][k]))));
 cases.push({segments,configuration,results,difference,stability});console.log(JSON.stringify({segments,gaugePressure,exponent,converged:a.converged,finalGaugePressure:a.state.gas.gaugePressure,difference}));
}
const gasConfiguration={referenceVolume:.005,initialGaugePressure:160000,ambientPressure:101325,exponent:1.2,minVolumeFraction:.5,maxVolumeFraction:1.5,provenance:'Illustrative reversible path control, not measured'};
const curves=[1,1.2,1.4].map(exponent=>{const gas=createSealedGas({...gasConfiguration,exponent});return {exponent,states:Array.from({length:81},(_,i)=>gas.evaluate(gasConfiguration.referenceVolume*(.8+i*.005)))};});
const paths=['scripts/lib/tyre-gas.mjs','scripts/lib/tyre-pressure.mjs','scripts/lib/tyre-meridian.mjs','scripts/lib/tyre-equilibrium.mjs','scripts/lib/tyre-banded.mjs','scripts/lib/tyre-meridian-fixture.mjs','scripts/lib/tyre-inflation.mjs','scripts/tyre-sealed.mjs','scripts/plot-tyre-sealed.py','test/tyre-sealed.test.mjs'];
const sourcesSha256=Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(new URL('../'+p,import.meta.url))).digest('hex')])));
const report={model:'bikelab-sealed-equilibrium-0.1',scope:'Uncalibrated axisymmetric sealed gas; not a localized ground footprint or production wheel',budgets:BUDGETS,sourcesSha256,gasConfiguration,curves,cases};
const bytes=Buffer.from(JSON.stringify(report)+'\n'),dir=resolve(process.argv[2]??'artifacts/tyre-sealed');await mkdir(dir,{recursive:true});
await writeFile(join(dir,'report.json'),bytes);await writeFile(join(dir,'report.json.gz.b64'),gzipSync(bytes,{level:9}).toString('base64')+'\n');
await writeFile(join(dir,'summary.json'),JSON.stringify({...report,archiveSha256:createHash('sha256').update(bytes).digest('hex'),cases:cases.map(c=>({segments:c.segments,initialGaugePressure:c.configuration.gaugePressure,exponent:c.configuration.gas.exponent,difference:c.difference,stability:c.stability,results:Object.fromEntries(Object.entries(c.results).map(([m,r])=>[m,{converged:r.converged,reason:r.reason,metrics:r.metrics,iterations:r.iterations,gas:r.state.gas,compressiveSegments:r.state.compressiveSegments}]))}))},null,2)+'\n');
assert.ok(cases.every(c=>Object.values(c.results).every(r=>r.converged&&r.state.compressiveSegments===0)&&c.difference<=2e-9&&c.stability?.classification==='positive-with-refinement-margin'),'Receiving incomplete; attempted cases saved');
