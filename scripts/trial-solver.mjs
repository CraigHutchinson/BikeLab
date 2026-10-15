import { readFile, stat } from 'node:fs/promises';
import { runTrial, trialReport } from '../dist/solver-trial.js';
try {
  const args=process.argv.slice(2);
  if(args.length>1)throw new Error('Usage: node scripts/trial-solver.mjs [setup.json]');
  let p={};
  if(args.length) { if((await stat(args[0])).size>16384)throw new Error('Setup exceeds 16 KiB.');const text=await readFile(args[0],'utf8');if(Buffer.byteLength(text)>16384)throw new Error('Setup exceeds 16 KiB.');p=JSON.parse(text.replace(/^\uFEFF/,'')); }
  const result=await runTrial(p);console.log(JSON.stringify(trialReport(result),null,2));
  if(result.status!=='pass')process.exitCode=2;
} catch(error) { console.error(error.message);process.exitCode=1; }
