import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, unlinkSync, rmdirSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {unboundExample} from '../dist/rider-unbound.js';
const script = fileURLToPath(new URL('../scripts/rider-posture.mjs', import.meta.url));
const invoke = args => spawnSync(process.execPath, [script, ...args], {encoding:'utf8', timeout:30000, maxBuffer:2*1024*1024});
test('all rider CLI modes export canonical replay; malformed specifications and option combinations fail cleanly', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bikelab-rider-cli-')), file = join(dir, 'spec.json');
  try {
    for (const [mode, format] of [[[], 'bikelab-rider-posture-0.1'], [['--native'], 'bikelab-rider-native-0.2'], [['--passive'], 'bikelab-rider-native-passive-0.2'], [['--unbound'], 'bikelab-rider-unbound-0.1']]) {
      const first = invoke(mode); assert.equal(first.error, undefined); assert.equal(first.status, 0, first.stderr);
      const value = JSON.parse(first.stdout); assert.equal(value.format, format);
      writeFileSync(file, JSON.stringify(value.spec)); const replay = invoke([...mode, file]);
      assert.equal(replay.error, undefined); assert.equal(replay.status, 0, replay.stderr); assert.equal(replay.stdout, first.stdout);
      writeFileSync(file, '{'); const malformed = invoke([...mode, file]); assert.equal(malformed.status, 1); assert.equal(malformed.stdout, ''); assert.ok(malformed.stderr.length > 0);
    }
    for (const args of [['--unknown'], ['--native', '--passive'], ['--passive', '--native'], ['--unbound','--passive'], ['--native','--unbound'], [file, file]]) {
      const r = invoke(args); assert.equal(r.status, 1); assert.equal(r.stdout, ''); assert.match(r.stderr, /Usage:/);
    }
  } finally {if (existsSync(file)) unlinkSync(file); rmdirSync(dir);}
});

test('unbound CLI distinguishes accepted prefix, initial rejection and invalid input', () => {
  const dir=mkdtempSync(join(tmpdir(),'bikelab-unbound-cli-')),file=join(dir,'spec.json');
  try {
    for(const name of ['joint-limit','initial-rejection']) {
      writeFileSync(file,JSON.stringify(unboundExample(name)));const r=invoke(['--unbound',file]);
      assert.equal(r.error,undefined);assert.equal(r.status,2,r.stderr);assert.equal(r.stderr,'');
      const record=JSON.parse(r.stdout);assert.equal(record.status,name==='joint-limit'?'terminated':'initial-state-rejected');
      assert.equal(record.summary.steps,name==='joint-limit'?33:0);assert.equal(record.frames.length,name==='joint-limit'?2:0);
    }
    writeFileSync(file,JSON.stringify({duration:1}));const bad=invoke(['--unbound',file]);
    assert.equal(bad.status,1);assert.equal(bad.stdout,'');assert.match(bad.stderr,/Unknown unbound field/);
  } finally {if(existsSync(file))unlinkSync(file);rmdirSync(dir);}
});
