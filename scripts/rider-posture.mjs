import {readFile,stat} from 'node:fs/promises';
import {constructPosture} from '../dist/rider-posture.js';
import {inspectNativePosture, inspectNativePassive} from '../dist/rider-native.js';
import {runUnbound} from '../dist/rider-unbound.js';

try {
  const args = process.argv.slice(2), mode = args[0];
  if (mode === '--native' || mode === '--passive' || mode === '--unbound') args.shift();
  if (args.length > 1 || args[0]?.startsWith('--')) throw Error('Usage: node scripts/rider-posture.mjs [--native | --passive | --unbound] [spec.json]');
  if (mode === '--unbound' && args[0] && (await stat(args[0])).size > 8*1024*1024) throw Error('Input exceeds 8 MiB.');
  const input = args[0] ? JSON.parse(await readFile(args[0], 'utf8')) : {};
  const report = mode === '--unbound' ? await runUnbound(input) : mode === '--passive' ? await inspectNativePassive(input) : mode === '--native' ? await inspectNativePosture(input) : constructPosture(input);
  console.log(JSON.stringify(report, null, 2));
  if (mode === '--unbound' && report.status !== 'completed') process.exitCode = 2;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
