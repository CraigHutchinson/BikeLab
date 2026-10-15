import { readFile } from 'node:fs/promises';
import { verifyRecord } from './record-validation.mjs';
try {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/verify-record.mjs run.json');
  console.log(JSON.stringify(verifyRecord(await readFile(process.argv[2], 'utf8')), null, 2));
} catch (error) {
  console.error('Verification failed: ' + error.message);
  process.exitCode = 1;
}
