import {validate,MEASUREMENT} from './tyre-fixture.js';
// Select a recording stride from exact divisors of the horizon, including for
// authored timesteps which are not one of the built-in dyadic choices.
function nearestDivisor(total,target,min,max){
 let best=0,error=Infinity;
 function consider(n){const e=Math.abs(n-target);if(n>=min&&n<=max&&(e<error||(e===error&&n<best))){best=n;error=e;}}
 for(let i=1;i*i<=total;i++)if(total%i===0){consider(i);consider(total/i);}
 if(!best)throw Error('No bounded recording schedule fits the authored timestep.');return best;
}
export function fixtureControls(input,{rates,dt,duration,measure}){
 const a=structuredClone(input),steps=Math.round(duration/dt);
 if(!Number.isFinite(duration)||!Number.isFinite(dt)||dt<=0||duration<=0||!Number.isSafeInteger(steps)||Math.abs(duration/dt-steps)>1e-7)throw Error('Duration must align to the integration step.');
 const measured=measure||duration>.1,targetSample=duration>.1?duration/200:duration>.02?.0005:.000125;
 const stride=nearestDivisor(steps,targetSample/dt,Math.max(1,Math.ceil(steps/300),Math.ceil((measured?dt:.000125)/dt-1e-9)),Math.floor((measured ? .05 : .005)/dt+1e-9));
 a.rates=rates;a.motion={dt,duration,sampleDt:stride*dt};
 if(measured){
  if(!a.measurement||input.motion.dt!==dt||input.motion.duration!==duration){
   const binTicks=nearestDivisor(steps,(duration>.1?.1:.005)/dt,Math.max(1,Math.ceil(steps/250)),steps),windowTicks=Math.min(steps,Math.round(.02/dt)),windowStride=Math.max(1,Math.round(.000125/dt),Math.ceil(windowTicks/256)),span=Math.floor(windowTicks/windowStride)*windowStride;
   a.measurement={format:MEASUREMENT,binDt:binTicks*dt,window:span?{startTick:steps-span,endTick:steps,strideTicks:windowStride}:null};
  }
 }else delete a.measurement;
 return validate(a);
}
