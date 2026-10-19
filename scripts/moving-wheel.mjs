import {readFile,stat} from 'node:fs/promises';
import {run,replay} from '../dist/moving-wheel.js';
try{const args=process.argv.slice(2);if(args.length>1)throw Error('Usage: node scripts/moving-wheel.mjs [setup-or-record.json]');let a={};if(args.length){if((await stat(args[0])).size>8*1024*1024)throw Error('Input exceeds 8 MiB.');a=JSON.parse((await readFile(args[0],'utf8')).replace(/^\uFEFF/,''));}const r=await (a.model?replay(a):run(a));console.log(JSON.stringify(r));if(r.status!=='completed')process.exitCode=2;}catch(error){console.error(error.message);process.exitCode=1;}
