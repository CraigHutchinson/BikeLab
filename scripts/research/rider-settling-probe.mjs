// Parked exploratory producer; no equilibrium certification. See docs/RIDER_SADDLE_CHECKPOINT.md.
import {run,articulatedPreset} from '../../dist/trail-bike.js';
import {writeFile} from 'node:fs/promises';
for(const bike of ['full','hardtail'])for(const saddle of [false,true]){
 let a=articulatedPreset(bike);a.initialization={mode:'launch'};if(saddle)a.saddle={};a.articulated=structuredClone(a.articulated);for(const law of Object.values(a.articulated.passive.joints)){law.stiffness*=10;law.damping*=5;}a.motion={...a.motion,duration:1,sampleDt:.01};
 for(let i=0;i<6;i++){
  const r=await run(a);console.log(bike,saddle,i,r.status,r.termination?.reason,JSON.stringify(r.finalDiagnostics));if(!r.finalState||r.status!=='completed')break;
  a=r.scenario;a.initialization={mode:'state',state:r.finalState};a.motion=Object.fromEntries(['gravity','duration','dt','sampleDt'].map(k=>[k,a.motion[k]]));
  if(i===5){const zero=structuredClone(a);zero.initialization.state.joints.forEach(j=>j.velocity=0);zero.motion.duration=.25;zero.motion.sampleDt=.005;const hold=await run(zero);await writeFile('artifacts/equilibrium-'+bike+'-'+saddle+'.json',JSON.stringify(hold));console.log('HOLD',bike,saddle,hold.status,hold.termination?.reason,JSON.stringify(hold.initialDiagnostics),JSON.stringify(hold.finalDiagnostics));}
 }
}
