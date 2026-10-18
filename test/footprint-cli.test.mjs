import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {solveFootprint} from '../dist/footprint.js';
test('footprint CLI replays records and separates unsupported from invalid input',async()=>{
 const cli=fileURLToPath(new URL('../scripts/footprint.mjs',import.meta.url)),run=(...args)=>{const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});assert.ifError(r.error);return r;};
 const dir=await mkdtemp(join(tmpdir(),'bikelab-footprint-')),path=join(dir,'input.json');
 try{
  const first=run();assert.equal(first.status,0);assert.deepEqual(JSON.parse(first.stdout),solveFootprint());
  await writeFile(path,first.stdout);assert.equal(run(path).stdout,first.stdout);
  await writeFile(path,JSON.stringify({height:.29}));const unsupported=run(path);assert.equal(unsupported.status,2);assert.equal(JSON.parse(unsupported.stdout).status,'unsupported');
  await writeFile(path,'{"nodes":0}');assert.equal(run(path).status,1);assert.equal(run(path,'extra').status,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
