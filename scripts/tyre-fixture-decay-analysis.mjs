// Post-processing only: no solver callbacks, state edits or extra force terms.
import assert from 'node:assert/strict';
export const DAMPING_INCREMENT_TOLERANCE=1e-12; // J; check ledger monotonicity separately from convergence.
const contactKey=f=>[...new Set(f.contacts.map(c=>c.edge+':'+c.vertex))].sort().join(',');
const finite=x=>{assert.ok(Number.isFinite(x),'nonfinite decay observation');return x;};
const mean=(frames,value)=>{
 let integral=0;
 for(let i=1;i<frames.length;i++)integral+=(frames[i].time-frames[i-1].time)*(finite(value(frames[i-1]))+finite(value(frames[i])))/2;
 return integral/(frames.at(-1).time-frames[0].time);
};

export function reviewDecay(record){
 const {frames,status,termination}=record,{dt,duration,sampleDt}=record.scenario.motion;
 for(const v of [dt,duration,sampleDt])assert.ok(Number.isFinite(v)&&v>0,'invalid observation clock');
 const stride=Math.round(sampleDt/dt),binTicks=Math.round(.02/dt),totalTicks=Math.round(duration/dt);
 for(const [ratio,integer] of [[sampleDt/dt,stride],[.02/dt,binTicks],[duration/dt,totalTicks]])assert.ok(integer>0&&Math.abs(ratio-integer)<1e-7,'unaligned observation clock');
 assert.equal(binTicks%stride,0,'20 ms bins must align with saved samples');
 assert.ok(['completed','terminated','initial-state-rejected'].includes(status),'unknown status');
 if(!frames.length){assert.equal(status,'initial-state-rejected');return {status:'unavailable',reason:termination?.reason??status,bins:[]};}
 assert.notEqual(status,'initial-state-rejected');
 const ticks=frames.map(f=>{const tick=Math.round(f.time/dt);assert.ok(Number.isFinite(f.time)&&Math.abs(f.time-tick*dt)<1e-9,'unaligned frame');return tick;});
 assert.equal(ticks[0],0);assert.equal(ticks.at(-1),record.summary.steps);assert.ok(ticks.at(-1)<=totalTicks);
 if(status==='completed')assert.equal(ticks.at(-1),totalTicks);
 let minDampingIncrement=Infinity;
 for(let i=1;i<frames.length;i++){
  assert.ok(ticks[i]>ticks[i-1]&&ticks[i]-ticks[i-1]<=stride,'missing/repeated observation');
  assert.ok(ticks[i]%stride===0||(i===frames.length-1&&status==='terminated'),'unexpected observation');
  minDampingIncrement=Math.min(minDampingIncrement,finite(frames[i].dampingLoss)-finite(frames[i-1].dampingLoss));
 }
 const bins=[];
 for(let start=0;start<ticks.at(-1);start+=binTicks){
  const end=Math.min(start+binTicks,ticks.at(-1)),first=ticks.indexOf(start),last=ticks.indexOf(end);
  assert.ok(first>=0&&last>first,'missing bin endpoint');const fs=frames.slice(first,last+1),a=fs[0],b=fs.at(-1);
  let sampledContactSetChanges=0,maxNodeDisplacement=0;
  for(let i=0;i<fs.length;i++){
   if(i&&contactKey(fs[i])!==contactKey(fs[i-1]))sampledContactSetChanges++;
   assert.equal(fs[i].nodes.length,a.nodes.length);
   for(let j=0;j<a.nodes.length;j++)maxNodeDisplacement=Math.max(maxNodeDisplacement,finite(Math.hypot(...fs[i].nodes[j].map((v,k)=>v-a.nodes[j][k]))));
  }
  const deltaEnergy=finite(b.energy)-finite(a.energy),dampingLoss=finite(b.dampingLoss)-finite(a.dampingLoss),signedContactWork=finite(b.contactWork)-finite(a.contactWork);
  const meanForce=mean(fs,f=>f.ground[1]);
  bins.push({startTick:start,endTick:end,startTime:start*dt,endTime:end*dt,complete:end-start===binTicks,intervals:fs.length-1,
   timeMeanKineticEnergy:mean(fs,f=>f.kineticEnergy),timeRmsNodeSpeed:Math.sqrt(mean(fs,f=>f.tyreMotion.rmsSpeed**2)),
   sampledMaxNodeSpeed:Math.max(...fs.map(f=>finite(f.tyreMotion.maxNodeSpeed))),sampledMaxNodeAcceleration:Math.max(...fs.map(f=>finite(f.tyreMotion.maxNodeAcceleration))),
   timeMeanVerticalForce:meanForce,timeStdVerticalForce:Math.sqrt(mean(fs,f=>(f.ground[1]-meanForce)**2)),sampledMinVerticalForce:Math.min(...fs.map(f=>finite(f.ground[1]))),sampledMaxVerticalForce:Math.max(...fs.map(f=>finite(f.ground[1]))),
   sampledContactSetChanges,sampledMaxNodeDisplacementFromBinStart:maxNodeDisplacement,
   deltaEnergy,dampingLoss,signedContactWork,residualIncrement:deltaEnergy+dampingLoss-signedContactWork,
   startKineticEnergy:a.kineticEnergy,endKineticEnergy:b.kineticEnergy,endRmsNodeSpeed:b.tyreMotion.rmsSpeed});
 }
 return {status:status==='completed'?'complete':'partial',reason:termination?.reason??null,minRecordedDampingIncrement:frames.length>1?minDampingIncrement:null,dampingMonotonicity:{tolerance:DAMPING_INCREMENT_TOLERANCE,units:'J',passed:frames.length>1?minDampingIncrement>=-DAMPING_INCREMENT_TOLERANCE:null},bins};
}

export function compareSampledBins(a,b){
 const fields=['timeMeanKineticEnergy','timeRmsNodeSpeed','sampledMaxNodeSpeed','sampledMaxNodeAcceleration','timeMeanVerticalForce','timeStdVerticalForce','sampledMinVerticalForce','sampledMaxVerticalForce','sampledContactSetChanges'];
 return a.map((bin,i)=>{const other=b[i];assert.equal(bin.startTime,other.startTime);assert.equal(bin.endTime,other.endTime);return {startTime:bin.startTime,endTime:bin.endTime,difference:Object.fromEntries(fields.map(key=>[key,finite(bin[key]-other[key])]))};});
}

export function compareDecay(a,b){
 if(a.status!=='completed'||b.status!=='completed')return {status:'unavailable',reason:'Both complete horizons are required.',runs:[a,b].map(r=>({status:r.status,termination:r.termination,acceptedSteps:r.summary.steps}))};
 assert.equal(a.frames.length,b.frames.length,'mismatched recording schedules');
 assert.equal(a.identity,b.identity);assert.deepEqual(a.scenario.seed,b.scenario.seed);assert.equal(a.scenario.rates,b.scenario.rates);
 assert.equal(a.scenario.motion.sampleDt,b.scenario.motion.sampleDt);assert.equal(a.scenario.motion.duration,b.scenario.motion.duration);
 const fields={node0Velocity:(f,g)=>Math.hypot(...f.tyreMotion.node0Velocity.map((v,k)=>v-g.tyreMotion.node0Velocity[k])),rmsSpeed:(f,g)=>f.tyreMotion.rmsSpeed-g.tyreMotion.rmsSpeed,verticalForce:(f,g)=>f.ground[1]-g.ground[1],kineticEnergy:(f,g)=>f.kineticEnergy-g.kineticEnergy};
 const ar=reviewDecay(a),br=reviewDecay(b),bins=[];
 for(let bin=0;bin<ar.bins.length;bin++){
  const start=Math.round(ar.bins[bin].startTime/a.scenario.motion.sampleDt),end=Math.round(ar.bins[bin].endTime/a.scenario.motion.sampleDt),values={};
  const fs=a.frames.slice(start,end+1),gs=b.frames.slice(start,end+1);
  for(let i=0;i<fs.length;i++)assert.ok(Math.abs(fs[i].time-gs[i].time)<1e-9,'mismatched time');
  for(const [key,delta] of Object.entries(fields)){
   const differences=fs.map((f,i)=>({time:f.time,value:finite(delta(f,gs[i]))}));
   values[key]={sampledMaxAbsolute:Math.max(...differences.map(d=>Math.abs(d.value))),timeRms:Math.sqrt(mean(differences,d=>d.value*d.value))};
  }
  bins.push({startTime:ar.bins[bin].startTime,endTime:ar.bins[bin].endTime,fields:values,residualIncrementDifference:ar.bins[bin].residualIncrement-br.bins[bin].residualIncrement});
 }
 return {status:'available',bins};
}
