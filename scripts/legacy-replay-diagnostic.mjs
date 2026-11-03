// Preserve exact legacy assertions while making cross-runtime failures inspectable.
// This observes a completed run; it never changes integration or reference hashes.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {modelXML,platens} from '../dist/bike-rig.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources=['dist/bike-rig.js','dist/bike-assembly.js','dist/linkage.js','dist/rig-loads.js','dist/travel-buffer.js','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm'];
let sourceHashes;
export async function legacySignalDiagnostic(record,signals,expectedHash,label){
 assert.match(label,/^[a-z0-9-]+$/);const actualHash=hash(JSON.stringify(signals)),directory='artifacts/ci/legacy';await mkdir(directory,{recursive:true});
 sourceHashes??=Promise.all(sources.map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))]));
 const names=Object.keys(signals),count=signals.time.length,values=Buffer.alloc(8*names.length*count);
 for(let k=0;k<names.length;k++){assert.equal(signals[names[k]].length,count);for(let i=0;i<count;i++)values.writeDoubleLE(signals[names[k]][i],8*(k*count+i));}
 const p=record.params,ticks=Math.round(p.duration/p.dt)+1,base=new Float64Array(4),forcing=Buffer.alloc(8*5*ticks);
 for(let tick=0;tick<ticks;tick++){const t=tick*p.dt;platens(p,t,base);forcing.writeDoubleLE(t,40*tick);for(let k=0;k<4;k++)forcing.writeDoubleLE(base[k],40*tick+8*(k+1));}
 const xml=modelXML(p),descriptor=(file,bytes,layout)=>({file,sha256:hash(bytes),bytes:bytes.length,encoding:'float64 little-endian',...layout}),signalsFile=label+'-signals.f64',forcingFile=label+'-forcing.f64';
 await writeFile(join(directory,signalsFile),values);await writeFile(join(directory,forcingFile),forcing);
 await writeFile(join(directory,label+'.json'),JSON.stringify({format:'bikelab-legacy-replay-diagnostic-0.1',runtime:{platform:process.platform,arch:process.arch,node:process.version,v8:process.versions.v8,execArgv:process.execArgv},expectedHash,actualHash,sourcesSha256:Object.fromEntries(await sourceHashes),xml,xmlSha256:hash(xml),record:{...record,signals:undefined},signals:descriptor(signalsFile,values,{layout:'channel-major',columns:names,count}),forcing:descriptor(forcingFile,forcing,{layout:'row-major',columns:['time','frontHeight','frontVelocity','rearHeight','rearVelocity'],count:ticks}),scope:'Exact completed legacy output and independently replayed prescribed forcing arithmetic, for failure localization only. Original exact legacy assertion remains mandatory.'},null,2)+'\n');
 return actualHash;
}
