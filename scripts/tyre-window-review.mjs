import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {activePreset,run,validate} from '../dist/trail-bike.js';
import {tailWindow,restartWindow} from '../dist/tyre-window.js';
const [directory='artifacts/tyre-window',mode='short',...extra]=process.argv.slice(2);
if(extra.length||!['short','long'].includes(mode))throw Error('Usage: node scripts/tyre-window-review.mjs [directory] [short|long]');
await mkdir(directory,{recursive:true});const hash=x=>createHash('sha256').update(x).digest('hex'),cases=[];
for(const bike of ['full','hardtail']){
 const {wheelParams,...scenario}=validate(activePreset(bike,mode==='long'?10:.5));
 const input=tailWindow({scenario,status:'completed'});let last='';
 const live=await run(input,(phase,steps,total)=>{const label=phase+' '+Math.floor(steps/total*10);if(label!==last){console.error(bike+' '+phase+' '+steps+'/'+total+' accepted steps');last=label;}});
 if(!live.windowObservation.start||live.summary.steps<input.observationWindow.endTick)throw Error(bike+' did not reach the complete window.');
 const freshInput=restartWindow(live),fresh=await run(freshInput);if(fresh.status!=='completed')throw Error(bike+' fresh comparison stopped.');
 const w=input.observationWindow,dt=input.motion.dt,origin=live.frames[live.windowObservation.start.frameIndex],freshOrigin=fresh.frames[0];
 const liveTicks=new Map(live.frames.map(f=>[Math.round(f.time/dt)-w.startTick,f]));
 const fields={};
 for(const f of fresh.frames){const g=liveTicks.get(Math.round(f.time/dt));if(!g)throw Error('Missing matching uninterrupted observation.');
  const delta={};
  for(let k=0;k<2;k++){const prefix=k?'rear':'front',a=g.wheels[k],b=f.wheels[k];
   delta[prefix+'Node0Position']=Math.hypot(...a.tyreMotion.node0Position.map((x,i)=>x-b.tyreMotion.node0Position[i]));
   delta[prefix+'Node0Velocity']=Math.hypot(...a.tyreMotion.node0Velocity.map((x,i)=>x-b.tyreMotion.node0Velocity[i]));
   delta[prefix+'VerticalForce']=a.ground[1]-b.ground[1];
  }
  delta.riderCOM=Math.hypot(...g.rider.map((x,i)=>x-f.rider[i]));
  for(const key of ['energy','dampingLoss','normalWork','tangentWork','driveWork','residual'])delta[key]=(g[key]-origin[key])-(f[key]-freshOrigin[key]);
  delta.riderWork=(g.active.work-origin.active.work)-f.active.work;
  delta.closureWork=(g.articulated.closureWork-origin.articulated.closureWork)-f.articulated.closureWork;
  for(const [key,value] of Object.entries(delta)){const s=fields[key]??={maxAbsolute:0,sumSquares:0};s.maxAbsolute=Math.max(s.maxAbsolute,Math.abs(value));s.sumSquares+=value*value;}
 }
 for(const s of Object.values(fields)){s.rms=Math.sqrt(s.sumSquares/fresh.frames.length);delete s.sumSquares;}
 const files={};for(const [kind,r] of [['uninterrupted',live],['fresh',fresh]]){const raw=JSON.stringify(r)+'\n',file=bike+'-'+kind+'.json';await writeFile(join(directory,file),raw);files[kind]={file,sha256:hash(raw),status:r.status,summary:r.summary};}
 cases.push({bike,input,freshInput,windowStart:{tick:live.windowObservation.start.tick,time:live.windowObservation.start.time,identity:live.windowObservation.start.state.identity},matchedSamples:fresh.frames.length,fields,files});
 console.error(bike+' compared '+fresh.frames.length+' matched samples');
}
const sourcesSha256={};for(const file of ['dist/trail-bike.js','dist/tyre-window.js','dist/tyre-motion.js'])sourcesSha256[file]=hash(await readFile(new URL('../'+file,import.meta.url)));
const report={format:'bikelab-tyre-window-review-0.1',mode,scope:'Same-window comparison of one uninterrupted run with a fresh reconstruction from its accepted start state. Commands remap exactly; time/warm start and work reset only in the fresh run. Ledger differences compare increments, not cumulative totals. No causal or equilibrium claim from agreement alone.',sourcesSha256,scriptSha256:hash(await readFile(new URL(import.meta.url))),cases};
await writeFile(join(directory,'review.json'),JSON.stringify(report,null,2)+'\n');console.log('Saved '+join(directory,'review.json'));
