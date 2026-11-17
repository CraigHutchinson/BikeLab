import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createSweptCasing,RELAXED_MODEL} from '../dist/sealed-casing.js';
const raw=gunzipSync(Buffer.from((await readFile('docs/evidence/contact-relaxation-report.json.gz.b64','utf8')).trim(),'base64')),r=JSON.parse(raw),hash=b=>createHash('sha256').update(b).digest('hex');assert.equal(r.sourcesSha256['dist/sealed-casing.js'],'4f2bdeb57f9d45aa6ef5ae8d31b2a22b29b52b7bc35667b618f30e972da14e02','Archived sweep source identity changed');let samples=0;
for(const c of r.cases){const m=createSweptCasing(c.configuration,c.model),angle=c.phase*2*Math.PI/c.nodes,cos=Math.cos(angle),sin=Math.sin(angle);
 for(const s of c.states){const q=Float64Array.from(s.coordinates);if(angle)for(let i=0;i<q.length;i+=2){const x=q[i],z=q[i+1];q[i]=cos*x+sin*z;q[i+1]=-sin*x+cos*z;}
  const a=m.evaluate(q);for(const key of ['potential','materialEnergy','gasEnergy','volume','gaugePressure','maxStrain','compressiveCells','relaxedCells','maxRelaxation'])assert.equal(a[key],s.state[key],`${c.nodes}/${key}`);
  for(const key of ['forces','materialForces','gasForces']){const f=Float64Array.from(a[key]);if(angle)for(let i=0;i<f.length;i+=2){const x=f[i],z=f[i+1];f[i]=cos*x-sin*z;f[i+1]=sin*x+cos*z;}const bytes=new Uint8Array(f.length*8),view=new DataView(bytes.buffer);for(let j=0;j<f.length;j++)view.setFloat64(j*8,f[j],true);assert.equal(hash(bytes),s.state.forceHashes[key]);}
  assert.ok(s.metrics.maxKktForce<=1e-5&&s.metrics.minGap>=-1e-12);samples++;
 }
}
const fine=r.cases.filter(c=>c.model===RELAXED_MODEL&&c.nodes>=256),checks=r.comparisons.filter(c=>c.model===RELAXED_MODEL&&c.nodes[0]>=256),returns=r.returns.filter(c=>c.nodes>=256);
const receipt={sweepSourceCommit:'7464f6d88af73c0b9267dfdf2f5862762425f453',scope:'Only the numerical conditioning admission gate changed after the source-bound sweep. All 156 stored force/energy states replay exactly with final guarded factory; no solver or constitutive arithmetic changed.',reportSha256:hash(raw),replayedStates:samples,exact:true,guardedSourcesSha256:{'dist/sealed-casing.js':hash(await readFile('dist/sealed-casing.js')),'dist/tyre-relaxation.js':hash(await readFile('dist/tyre-relaxation.js'))},fineMesh:{nodes:[256,512],cases:fine.length,samples:fine.flatMap(c=>c.states).length,allLocallyAdmissible:fine.every(c=>c.complete&&c.states.every(s=>s.locallyAdmissible)),comparisons:checks.length,comparisonFailures:checks.filter(c=>!c.passed).length,returnComparisons:returns.length,returnFailures:returns.filter(c=>!c.passed).length},coarseCandidateFailures:r.receiving.refinementFailures};
assert.equal(samples,156);assert.ok(receipt.fineMesh.allLocallyAdmissible);assert.equal(receipt.fineMesh.comparisonFailures,0);assert.equal(receipt.fineMesh.returnFailures,0);await writeFile('docs/evidence/contact-relaxation-receiving.json',JSON.stringify(receipt,null,2)+'\n');console.log(receipt.fineMesh);
