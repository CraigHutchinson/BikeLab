import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {createInflationDiagnostic,MODEL} from './lib/tyre-inflation.mjs';
if(process.argv.length>3)throw Error('Usage: node scripts/tyre-inflation.mjs [output-directory]');
const cases=[];
for(const gaugePressure of [80000,160000,240000]){
 const configuration={rimRadius:.311,rimWidth:.03,restHeight:.05,maxHeight:.075,meridionalRigidity:200000,gaugePressure,provenance:'Illustrative effective meridional rigidity and stress-free geometry; not measured casing'};
 const model=createInflationDiagnostic(configuration),equilibrium=model.solve(),H=equilibrium.state.height,h=1e-6;
 const scalarCurvature=(model.evaluate(H-h).residual-model.evaluate(H+h).residual)/(2*h);
 assert.ok(scalarCurvature>0);assert.ok(Math.abs(equilibrium.state.residual)<2e-6);
 const samples=Array.from({length:101},(_,i)=>model.evaluate(configuration.restHeight+(configuration.maxHeight-configuration.restHeight)*i/100));
 cases.push({configuration,equilibrium,scalarCurvature,samples});
}
const paths=['scripts/lib/tyre-inflation.mjs','scripts/tyre-inflation.mjs','test/tyre-inflation.test.mjs','scripts/plot-tyre-inflation.py'];
const sourcesSha256=Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(new URL('../'+p,import.meta.url))).digest('hex')])));
const dir=resolve(process.argv[2]??'artifacts/tyre-inflation');await mkdir(dir,{recursive:true});
await writeFile(join(dir,'report.json'),JSON.stringify({model:MODEL,scope:'Constant-pressure reservoir, one axisymmetric coordinate, effective meridional energy only; local scalar stability, not shell equilibrium or calibration',sourcesSha256,cases},null,2)+'\n');
console.log(JSON.stringify(cases.map(c=>({pressure:c.configuration.gaugePressure,height:c.equilibrium.state.height,residual:c.equilibrium.state.residual,scalarCurvature:c.scalarCurvature}))));
