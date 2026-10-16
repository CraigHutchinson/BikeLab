import {linkageDiagnostics} from '../dist/linkage.js';
import {readFile,writeFile} from 'node:fs/promises';
import {runRig,rigRecord,setupFromRecord} from '../dist/bike-rig.js';
try {
  const args=process.argv.slice(2);if(args.length>2)throw new Error('Usage: node scripts/bike-rig.mjs [setup.json] [output.json]');
  let p={};if(args[0]){const text=await readFile(args[0],'utf8');if(text.length>4_000_000)throw new Error('Setup exceeds 4 MB.');const value=JSON.parse(text);p=Object.hasOwn(value??{},'model')?setupFromRecord(value):value;}
  const run=await runRig(p);if(args[1])await writeFile(args[1],JSON.stringify(rigRecord(run),null,2)+'\n');
  console.log(JSON.stringify({model:run.model,engine:run.engine,status:run.status,dofs:run.dofs,initial:run.initial,summary:run.summary,configuration:linkageDiagnostics(run),termination:run.termination},null,2));
  if(run.status!=='complete')process.exitCode=2;
} catch(error){console.error(error.message);process.exitCode=1;}
