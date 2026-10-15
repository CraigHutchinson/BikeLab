import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { G } from '../dist/physics.js';
const cli=new URL('../scripts/trial-solver.mjs',import.meta.url);
function run(args=[]) {
  const p=spawnSync(process.execPath,[cli.pathname.replace(/^\/([A-Za-z]:)/,'$1'),...args],{encoding:'utf8',maxBuffer:2*1024*1024});
  assert.ifError(p.error);return p;
}
test('solver CLI distinguishes unmet numerical gates, successful trial and invalid input',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'bikelab-trial-'));
  try {
    const a=run();assert.equal(a.status,2);assert.equal(JSON.parse(a.stdout).checks.reference,false);
    const path=join(dir,'setup.json');await writeFile(path,JSON.stringify({tiltDegrees:0,initialCompression:(45*G-50)/9000,duration:.5}));
    const b=run([path]);assert.equal(b.status,0,b.stderr);assert.equal(JSON.parse(b.stdout).status,'pass');
    await writeFile(path,'{"mass":0}');const c=run([path]);assert.equal(c.status,1);assert.match(c.stderr,/mass/);assert.equal(c.stdout,'');
    await writeFile(path,' '.repeat(16385));assert.match(run([path]).stderr,/16 KiB/);
    assert.equal(run(['one','two']).status,1);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
