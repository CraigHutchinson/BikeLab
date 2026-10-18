import {readFile,stat} from 'node:fs/promises';
import {solveFootprint,replayFootprint} from '../dist/footprint.js';
try{
 const args=process.argv.slice(2);if(args.length>1)throw Error('Usage: node scripts/footprint.mjs [setup-or-record.json]');
 let result;if(args.length){if((await stat(args[0])).size>2*1024*1024)throw Error('Input exceeds 2 MiB.');const input=JSON.parse((await readFile(args[0],'utf8')).replace(/^\uFEFF/,''));result=input?.model?replayFootprint(input):solveFootprint(input);}else result=solveFootprint();
 console.log(JSON.stringify(result,null,2));if(result.status!=='solved')process.exitCode=2;
}catch(error){console.error(error.message);process.exitCode=1;}
