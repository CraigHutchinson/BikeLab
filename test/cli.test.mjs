import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile,rm,rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
test('scenario CLI rejects invalid inputs without overwriting evidence',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'bikelab-test-')),input=join(dir,'input.json'),output=join(dir,'output.json');
  const cli=fileURLToPath(new URL('../scripts/scenario.mjs',import.meta.url));
  const run=(...args)=>{const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});assert.ifError(r.error);return r;};
  try {
    await writeFile(input,JSON.stringify({stifness:50000}));
    assert.equal(run(input,output).status,1);
    await assert.rejects(readFile(output));
    await writeFile(input,'\uFEFF'+JSON.stringify({duration:.1,profile:'flat'}));
    assert.equal(run(input,input).status,1);
    assert.equal(run(input,output).status,0);
    const first=await readFile(output,'utf8');
    assert.equal(run(input,output).status,1);
    assert.equal(await readFile(output,'utf8'),first);
    assert.equal(run(input,output,'extra').status,1);
  } finally {
    await rm(input,{force:true});await rm(output,{force:true});await rmdir(dir);
  }
});
