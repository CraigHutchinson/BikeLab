import {readFile,writeFile} from 'node:fs/promises';
import {replay,verifyReplay} from '../dist/terrain-request.js';
try {
  const arg=process.argv[2]||'straight';
  const record=arg.endsWith('.json')?await verifyReplay(JSON.parse(await readFile(arg,'utf8'))):await replay(arg);
  if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(record));
  console.log(JSON.stringify({track:record.track,accepted:record.frames.filter(f=>f.accepted).length,status:record.frames.at(-1).response.status,cache:record.frames.at(-1).cache},null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
