import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {MODEL,run} from '../dist/fixed-hub.js';
const dir=resolve(process.argv[2]||'artifacts/fixed-hub');await mkdir(dir,{recursive:true});
const sha=s=>createHash('sha256').update(s).digest('hex');
const sources={};for(const path of ['dist/fixed-hub.js','dist/moving-wheel.js','dist/trail-bike.js','dist/trail-initial-state.js','dist/tyre-motion.js','dist/fixed-hub-full.json','dist/fixed-hub-hardtail.json'])sources[path]=sha((await readFile(path,'utf8')).replace(/\r\n/g,'\n'));
const cases=[];
for(const bike of ['full','hardtail'])for(const wheel of ['front','rear'])for(const velocityMode of ['imported','zero'])for(const dt of [.00003125,.000015625,.0000078125]){
 const source=JSON.parse(await readFile('dist/fixed-hub-'+bike+'.json','utf8')),input={format:MODEL,source,wheel,velocityMode,motion:{duration:.02,dt,sampleDt:.000125}},r=await run(input),name=[bike,wheel,velocityMode,dt].join('-'),bytes=JSON.stringify(r)+'\n';
 await writeFile(join(dir,name+'.json'),bytes);
 const tail=r.frames.filter(f=>f.time>=.015);
 cases.push({bike,wheel,velocityMode,dt,status:r.status,summary:r.summary,initialRmsSpeed:r.frames[0].motion.rmsSpeed,finalRmsSpeed:r.frames.at(-1).motion.rmsSpeed,tailMaxRmsSpeed:Math.max(...tail.map(f=>f.motion.rmsSpeed)),tailMaxNodeSpeed:Math.max(...tail.map(f=>f.motion.maxNodeSpeed)),finalDampingLoss:r.frames.at(-1).dampingLoss,finalContactWork:r.frames.at(-1).contactWork,record:name+'.json',sha256:sha(bytes)});
 console.log(name,r.status,r.summary.maxResidual);
}
await writeFile(join(dir,'report.json'),JSON.stringify({model:MODEL,sources,cases,scope:'24 bounded 20 ms fresh casing controls; no long-time stability or damping calibration.'},null,2)+'\n');

