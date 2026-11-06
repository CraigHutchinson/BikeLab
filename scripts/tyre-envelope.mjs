import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {envelopeCases,compareEnvelopeCase} from './lib/tyre-envelope.mjs';
if(process.argv.length>3)throw Error('Usage: node scripts/tyre-envelope.mjs [output-directory]');
const rows=[];
for(const c of envelopeCases()){
 rows.push(compareEnvelopeCase(c));
 if(rows.length%12===0)console.log(`${rows.length} cases; ${rows.filter(r=>r.accepted).length} accepted`);
}
const pairs=rows.filter(r=>r.start==='asymmetric').map(r=>{
 const rest=rows.find(s=>s.id===r.id.replace('/asymmetric','/rest'));
 const a=r.results['analytic-banded'],b=rest.results['analytic-banded'];
 return {id:r.id,difference:a.converged&&b.converged?Math.max(...a.points.flatMap((p,i)=>p.map((v,k)=>Math.abs(v-b.points[i][k])))):null};
});
const paths=['scripts/lib/tyre-gas.mjs','scripts/lib/tyre-envelope.mjs','scripts/lib/tyre-meridian-fixture.mjs','scripts/lib/tyre-inflation.mjs','scripts/lib/tyre-equilibrium.mjs','scripts/lib/tyre-meridian.mjs','scripts/lib/tyre-banded.mjs','scripts/tyre-envelope.mjs','scripts/plot-tyre-envelope.py','test/tyre-envelope.test.mjs'];
const sourcesSha256=Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(new URL('../'+p,import.meta.url))).digest('hex')])));
const report={model:'bikelab-equilibrium-envelope-0.1',scope:'Illustrative constant-pressure grid; no physical validation or continuous-envelope proof',sourcesSha256,rows,pairs};
const bytes=Buffer.from(JSON.stringify(report)+'\n');
const summary={model:report.model,scope:report.scope,sourcesSha256,archiveSha256:createHash('sha256').update(bytes).digest('hex'),cases:rows.length,accepted:rows.filter(r=>r.accepted).length,maxCoordinateDifference:Math.max(...rows.map(r=>r.coordinateDifference??0)),pairs,
 rows:rows.map(r=>({id:r.id,geometry:r.geometry,material:r.material,segments:r.segments,start:r.start,pressure:r.configuration.gaugePressure,accepted:r.accepted,rejections:r.rejections,coordinateDifference:r.coordinateDifference,stability:r.stability?.classification,methods:Object.fromEntries(Object.entries(r.results).map(([m,s])=>[m,{converged:s.converged,reason:s.reason,metrics:s.metrics,iterations:s.iterations,compressiveSegments:s.state.compressiveSegments,minMeridionalResultant:Math.min(...s.state.strains.map(v=>v.meridionalStressResultant)),minHoopResultant:Math.min(...s.state.strains.map(v=>v.hoopStressResultant)),volume:s.state.volume}]))}))};
const dir=resolve(process.argv[2]??'artifacts/tyre-envelope');await mkdir(dir,{recursive:true});
await writeFile(join(dir,'report.json'),bytes);await writeFile(join(dir,'report.json.gz.b64'),gzipSync(bytes,{level:9}).toString('base64')+'\n');
await writeFile(join(dir,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({cases:summary.cases,accepted:summary.accepted,maxCoordinateDifference:summary.maxCoordinateDifference,maxStartDifference:Math.max(...pairs.map(p=>p.difference??0))}));
// Failed receiving is saved, never silently filtered out of the grid.
if(summary.accepted!==summary.cases||pairs.some(p=>p.difference===null||p.difference>2e-9))process.exitCode=1;
