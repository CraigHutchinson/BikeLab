import {readFile} from 'node:fs/promises';
import {constructPosture} from '../dist/rider-posture.js';

try {
  if (process.argv.length > 3) throw Error('Usage: node scripts/rider-posture.mjs [posture-spec.json]');
  const input = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : {};
  console.log(JSON.stringify(constructPosture(input), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
