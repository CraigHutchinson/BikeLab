import { readFile } from 'node:fs/promises';
import { simulate } from '../dist/suspension.js';
import { compareSuspension, comparisonReport } from '../dist/suspension-reference.js';

try {
  const args = process.argv.slice(2);
  if (args.length > 1) throw new Error('Usage: node scripts/compare-suspension.mjs [setup.json]');
  // Equal damping makes the default comparison applicable without changing station defaults.
  const params = args.length ? JSON.parse((await readFile(args[0], 'utf8')).replace(/^\uFEFF/, ''))
    : { reboundDamping: 350 };
  const result = compareSuspension(simulate(params));
  console.log(JSON.stringify(comparisonReport(result), null, 2));
  if (result.status !== 'pass') process.exitCode = 2;
} catch (error) {
  console.error('Comparison failed: ' + error.message);
  process.exitCode = 1;
}
