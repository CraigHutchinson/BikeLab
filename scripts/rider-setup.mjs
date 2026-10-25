import {readFile, stat} from 'node:fs/promises';
import {compileRiderSetup, riderSetupExample, riderSetupReceipt} from '../dist/rider-setup.js';

try {
  const args = process.argv.slice(2);
  let result;
  if (args.length === 2 && args[0] === '--example') result = riderSetupExample(args[1]);
  else {
    const receipt = args[0] === '--receipt', paths = receipt ? args.slice(1) : args;
    if (paths.length !== 1 || paths[0].startsWith('--')) throw Error('Usage: node scripts/rider-setup.mjs --example full|hardtail | [--receipt] setup.json');
    if ((await stat(paths[0])).size > 8 * 1024 * 1024) throw Error('Input exceeds 8 MiB.');
    const input = JSON.parse((await readFile(paths[0], 'utf8')).replace(/^\uFEFF/, ''));
    result = receipt ? await riderSetupReceipt(input) : compileRiderSetup(input).scenario;
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {console.error(error.message);process.exitCode = 1;}
