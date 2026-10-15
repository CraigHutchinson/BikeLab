import { simulate, serialize } from '../dist/physics.js';
import * as suspension from '../dist/suspension.js';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

try {
  const args = process.argv.slice(2);
  const model = args[0] === '--suspension' ? (args.shift(), suspension) : { simulate, serialize };
  if (args.length > 2) throw new Error('Usage: node scripts/scenario.mjs [--suspension] [setup.json [new-run.json]]');
  if (args[1] && resolve(args[0]) === resolve(args[1])) throw new Error('Output must not replace the input setup.');
  const params = args[0] ? JSON.parse((await readFile(args[0], 'utf8')).replace(/^\uFEFF/, '')) : {};
  const run = model.simulate(params);
  if (args[1]) await writeFile(args[1], model.serialize(run), { flag: 'wx' });
  console.log(JSON.stringify({ model: run.model, params: run.params, status: run.status, termination: run.termination,
    metrics: run.metrics, events: run.events, warnings: run.warnings }, null, 2));
  // A domain-limited run is useful evidence, but cannot pass a batch scenario gate.
  if (run.status === 'travel-limit') process.exitCode = 2;
} catch (error) {
  console.error('Scenario failed: ' + error.message);
  process.exitCode = 1;
}
