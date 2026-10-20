import {readFile} from 'node:fs/promises';
import {constructPosture} from '../dist/rider-posture.js';
import {inspectNativePosture, inspectNativePassive} from '../dist/rider-native.js';

try {
  const args = process.argv.slice(2), mode = args[0];
  if (mode === '--native' || mode === '--passive') args.shift();
  if (args.length > 1 || args[0]?.startsWith('--')) throw Error('Usage: node scripts/rider-posture.mjs [--native | --passive] [spec.json]');
  const input = args[0] ? JSON.parse(await readFile(args[0], 'utf8')) : {};
  console.log(JSON.stringify(mode === '--passive' ? await inspectNativePassive(input) : mode === '--native' ? await inspectNativePosture(input) : constructPosture(input), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
