import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {experiment,example} from '../dist/wheel-limits.js';
test('wheel-limit CLI distinguishes boundary, clear, incompatible and invalid records',async()=>{
 const cli=fileURLToPath(new URL('../scripts/wheel-limits.mjs',import.meta.url)),run=(...args)=>{const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});assert.ifError(r.error);return r;};const dir=await mkdtemp(join(tmpdir(),'bikelab-limits-')),path=join(dir,'input.json');
 try{const first=run();assert.equal(first.status,2);assert.equal(first.stdout,JSON.stringify(experiment(example()),null,2)+'\n');await writeFile(path,first.stdout);assert.equal(run(path).stdout,first.stdout);await writeFile(path,JSON.stringify(example('separated')));assert.equal(run(path).status,0);await writeFile(path,JSON.stringify({assembly:{pressure:0}}));assert.equal(run(path).status,2);await writeFile(path,'{"delta":[3,0]}');assert.equal(run(path).status,1);assert.equal(run(path,'extra').status,1);}finally{await rm(dir,{recursive:true,force:true});}
});
