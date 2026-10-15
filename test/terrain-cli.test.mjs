import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, probe } from '../dist/terrain.js';

test('terrain CLI reports reproducible geometry and distinguishes unavailable from invalid',async()=>{
  const cli=fileURLToPath(new URL('../scripts/probe-terrain.mjs',import.meta.url));
  const invoke=(...args)=>{const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});assert.ifError(r.error);return r;};
  const initial=invoke();assert.equal(initial.status,0);
  assert.deepEqual(JSON.parse(initial.stdout),probe(fixture(),{center:[-.2,.36],radius:.36}));
  const dir=await mkdtemp(join(tmpdir(),'bikelab-terrain-')),path=join(dir,'profile.json');
  try {
    await writeFile(path,JSON.stringify(fixture('flat')));
    const outside=invoke(path,'1','.36','.36');assert.equal(outside.status,2);
    assert.equal(JSON.parse(outside.stdout).status,'unavailable');
    const touching=invoke(path,'0','.36','.36');assert.equal(touching.status,0);
    assert.equal(JSON.parse(touching.stdout).gap,0);
    assert.equal(invoke(path,'0').status,1);assert.equal(invoke(path,'NaN','.36','.36').status,1);
    await writeFile(path,'{"format":"unknown"}');assert.equal(invoke(path).status,1);
  } finally {await rm(dir,{recursive:true,force:true});}
});
