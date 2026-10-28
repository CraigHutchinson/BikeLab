import {readFile} from 'node:fs/promises';
import {MODEL,inputFromRecord,fromWindow,run} from '../dist/tyre-fixture.js';
const [path,wheel='front',...extra]=process.argv.slice(2);
try{
 if(extra.length||!['front','rear'].includes(wheel))throw Error('Usage: node scripts/tyre-fixture.mjs [input-or-record.json] [front|rear]');
 const source=path?JSON.parse(await readFile(path,'utf8')):JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))).cases[0].input;
 const input=source.model===MODEL?inputFromRecord(source):source.model?(await fromWindow(source,wheel)).input:source;let last=-1;
 const r=await run(input,(phase,tick,total)=>{const percent=Math.floor(10*tick/total);if(phase!=='integrating'||percent!==last){console.error(phase+' · '+tick+'/'+total+' accepted steps');last=percent;}});
 console.log(JSON.stringify(r));if(r.status!=='completed')process.exitCode=2;
}catch(error){console.error(error.message);process.exitCode=1;}
