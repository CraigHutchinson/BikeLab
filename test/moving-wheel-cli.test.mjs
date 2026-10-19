import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {run,preset} from '../dist/moving-wheel.js';
test('moving-wheel CLI shares mechanics and distinguishes completed, terminated and invalid input',async()=>{
 const cli=fileURLToPath(new URL('../scripts/moving-wheel.mjs',import.meta.url)),invoke=(...args)=>{const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',maxBuffer:8*1024*1024});assert.ifError(r.error);return r;},dir=await mkdtemp(join(tmpdir(),'bikelab-moving-')),path=join(dir,'input.json');
 try{const a=preset('flight');a.params={...a.params,duration:.02};const expected=await run(a);await writeFile(path,'\uFEFF'+JSON.stringify(a));const first=invoke(path);assert.equal(first.status,0);assert.equal(first.stdout,JSON.stringify(expected)+'\n');await writeFile(path,first.stdout);assert.equal(invoke(path).stdout,first.stdout);await writeFile(path,JSON.stringify(preset('overload')));const stopped=invoke(path);assert.equal(stopped.status,2);assert.equal(JSON.parse(stopped.stdout).status,'terminated');await writeFile(path,'{"params":{"dt":0}}');assert.equal(invoke(path).status,1);assert.equal(invoke(path,'extra').status,1);}finally{await rm(dir,{recursive:true,force:true});}
});
