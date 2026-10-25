import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {riderSetupExample, compileRiderSetup, riderSetupReceipt} from '../dist/rider-setup.js';
const script = fileURLToPath(new URL('../scripts/rider-setup.mjs', import.meta.url));
const invoke = args => spawnSync(process.execPath, [script, ...args], {encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024});
test('portable rider CLI exports examples, canonical scenarios and provenance receipts with clean rejection', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bikelab-rider-setup-')), path = join(dir, 'setup.json');
  try {
    for (const bike of ['full', 'hardtail']) {
      const example = invoke(['--example', bike]);assert.equal(example.error, undefined);assert.equal(example.status, 0, example.stderr);
      const spec = JSON.parse(example.stdout);assert.deepEqual(spec, riderSetupExample(bike));
      writeFileSync(path, '\uFEFF' + example.stdout);
      for (const receipt of [false, true]) {
        const r = invoke([...(receipt ? ['--receipt'] : []), path]);assert.equal(r.status, 0, r.stderr);
        assert.deepEqual(JSON.parse(r.stdout), receipt ? await riderSetupReceipt(spec) : compileRiderSetup(spec).scenario);
      }
    }
    for (const args of [[], ['--unknown'], ['--example', 'unknown'], ['--receipt'], [path, path]]) {
      const r = invoke(args);assert.equal(r.status, 1);assert.equal(r.stdout, '');assert.ok(r.stderr.length);
    }
    for (const content of ['{', '{}', ' '.repeat(8 * 1024 * 1024 + 1)]) {
      writeFileSync(path, content);const r = invoke([path]);assert.equal(r.status, 1);assert.equal(r.stdout, '');assert.ok(r.stderr.length);
    }
  } finally {rmSync(dir, {recursive: true, force: true});}
});
