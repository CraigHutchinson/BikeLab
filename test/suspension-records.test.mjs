import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, serialize, DEFAULTS } from '../dist/suspension.js';
import { FIELD_SCALES, setupFromFields, frameAt } from '../dist/suspension-ui-model.js';
import { verifyRecord } from '../scripts/record-validation.mjs';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('suspension verifier rejects altered samples, diagnostics and stopped-run evidence',()=>{
  for(const p of [{},{initialCompression:.001,initialVelocity:-2}]) {
    const original=JSON.parse(serialize(simulate(p)));
    assert.equal(verifyRecord(JSON.stringify(original)).result,'numerical agreement');
    const mutations=[r=>r.signals.force[0]+=1,r=>r.signals.time.pop(),r=>r.metrics.endTime+=1,
      r=>r.status='invented',r=>r.warnings.push('invented'),r=>r.termination={type:'invented'},r=>delete r.params.preload];
    if(original.termination) mutations.push(r=>r.termination.attemptedTime+=.1);
    for(const mutate of mutations) {const r=structuredClone(original);mutate(r);assert.throws(()=>verifyRecord(JSON.stringify(r)));}
  }
});
test('suspension setup edits retain precision, require all fields, and replay off-grid endpoints',()=>{
  const p={...DEFAULTS,travel:.16123456789,initialCompression:.07123456789,reboundDamping:650.125};
  const shown={...Object.fromEntries(Object.entries(FIELD_SCALES).map(([key,scale])=>[key,String(p[key]*scale)])),profile:p.profile};
  assert.deepEqual(setupFromFields(shown,p),p);
  shown.reboundDamping='700.25';assert.deepEqual(setupFromFields(shown,p),{...p,reboundDamping:700.25});
  for(const key of Object.keys(FIELD_SCALES)) assert.throws(()=>setupFromFields({...shown,[key]:' '}),/required/);
  const times=new Float64Array([0,.005,.01,.0135]);
  assert.equal(frameAt(times,-1),0);assert.equal(frameAt(times,.013),2);
  assert.equal(frameAt(times,.0135),3);assert.equal(frameAt(times,1),3);
  assert.equal(frameAt(new Float64Array([0]),0),0);
});
test('suspension CLI preserves evidence, verifies exports, and signals a travel limit with exit 2',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'bikelab-suspension-')), input=join(dir,'setup.json'),output=join(dir,'run.json');
  const cli=fileURLToPath(new URL('../scripts/scenario.mjs',import.meta.url));
  const run=(...args)=>{const r=spawnSync(process.execPath,[cli,'--suspension',...args],{encoding:'utf8'});assert.ifError(r.error);return r;};
  try {
    await writeFile(input,JSON.stringify({duration:.1}));
    assert.equal(run(input,output).status,0);
    const first=await readFile(output,'utf8');assert.equal(verifyRecord(first).result,'numerical agreement');
    assert.equal(run(input,output).status,1);assert.equal(await readFile(output,'utf8'),first);
    assert.equal(run(input,input).status,1);
    await writeFile(input,JSON.stringify({initialCompression:0,initialVelocity:-1}));
    const stopped=join(dir,'stopped.json');assert.equal(run(input,stopped).status,2);
    const record=await readFile(stopped,'utf8');assert.equal(verifyRecord(record).result,'numerical agreement');
    assert.equal(JSON.parse(record).status,'travel-limit');
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('maximum suspension recording and accepted extreme combinations stay bounded',()=>{
  const a=simulate({duration:30,sampleDt:.001});
  assert.equal(verifyRecord(serialize(a)).result,'numerical agreement');
  for(const mass of [1,150]) for(const stiffness of [1000,200000]) for(const damping of [0,8000]) {
    const sag=mass*9.80665/stiffness;
    if(sag>=.3)continue;
    const r=simulate({mass,stiffness,preload:0,travel:.3,initialCompression:sag*1.1,
      compressionDamping:damping,reboundDamping:damping,dt:.00001,duration:.1});
    for(const values of Object.values(r.signals))assert.ok(values.every(Number.isFinite));
    assert.ok(r.signals.compression.every(q=>q>=0&&q<=r.params.travel));
    assert.ok(r.signals.loss.every(d=>d>=0));
    assert.ok(['complete','travel-limit'].includes(r.status));
  }
});
