import {readFile,stat} from 'node:fs/promises';
import {compileRiderTask} from '../dist/rider-task.js';
try{
  const args=process.argv.slice(2);
  if(args.length>1||args[0]?.startsWith('--'))throw Error('Usage: node scripts/rider-task.mjs [task-input.json]');
  if(args[0]&&(await stat(args[0])).size>1024*1024)throw Error('Task input exceeds 1 MiB.');
  console.log(JSON.stringify(compileRiderTask(args[0]?JSON.parse(await readFile(args[0],'utf8')):{}),null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
