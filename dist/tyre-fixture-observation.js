// Positive-weight central-moment recurrence: NAG g02btc, section 3.
// https://www.originlab.com/pdfs/nagcl09/manual/pdf/G02/g02btc.pdf
// Duration weights give population time variance, without Bessel correction.
export const MEASUREMENT='bikelab-fixed-hub-observation-0.1';
export const MEASURED_MODEL='bikelab-fixed-hub-measured-0.1';
export function createMoment(){return {weight:0,mean:0,m2:0};}
export function addMoment(s,x,w){
 if(!Number.isFinite(x)||!Number.isFinite(w)||w<=0)throw Error('Invalid weighted observation.');
 const weight=s.weight+w,delta=x-s.mean,mean=s.weight?s.mean+delta*(w/weight):x,m2=s.weight?s.m2+delta*delta*(s.weight/weight)*w:0;
 if(!Number.isFinite(weight)||!Number.isFinite(mean)||!Number.isFinite(m2))throw Error('Nonfinite observation accumulator.');
 s.weight=weight;s.mean=mean;s.m2=m2;
}
function exactObject(a,keys){
 if(!a||typeof a!=='object'||Array.isArray(a)||![Object.prototype,null].includes(Object.getPrototypeOf(a)))throw Error('Invalid fixture measurement.');
 const own=Reflect.ownKeys(a);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))throw Error('Unknown or incomplete fixture measurement.');
 for(const k of keys){const d=Object.getOwnPropertyDescriptor(a,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))throw Error('Non-data measurement field.');}
}
export function validateMeasurement(value,motion){
 exactObject(value,['format','binDt','window']);const {dt,duration}=motion;
 if(value.format!==MEASUREMENT||!Number.isFinite(value.binDt)||value.binDt<dt||value.binDt>duration)throw Error('Unsupported measurement interval.');
 const bins=duration/value.binDt,ticks=value.binDt/dt;
 if(bins>250||Math.abs(bins-Math.round(bins))>1e-7||Math.abs(ticks-Math.round(ticks))>1e-7)throw Error('Measurement bins must align and cover the horizon (at most 250).');
 let window=null;
 if(value.window!==null){
  exactObject(value.window,['startTick','endTick','strideTicks']);const w=value.window;
  if(!Number.isSafeInteger(w.startTick)||!Number.isSafeInteger(w.endTick)||!Number.isSafeInteger(w.strideTicks)||w.startTick<0||w.endTick<=w.startTick||w.endTick>Math.round(duration/dt)||w.strideTicks<1||(w.endTick-w.startTick)%w.strideTicks!==0||(w.endTick-w.startTick)/w.strideTicks>256)throw Error('Invalid dense measurement window (at most 257 points).');
  window={...w};
 }
 return {format:MEASUREMENT,binDt:value.binDt,window};
}
export function recordingTicks(motion,measurement){
 const steps=Math.round(motion.duration/motion.dt),stride=Math.round(motion.sampleDt/motion.dt),ticks=new Set();
 for(let tick=0;tick<=steps;tick+=stride)ticks.add(tick);
 const w=measurement.window;if(w)for(let tick=w.startTick;tick<=w.endTick;tick+=w.strideTicks)ticks.add(tick);
 if(ticks.size>600)throw Error('Fixture recording capacity exceeded.');return Uint32Array.from([...ticks].sort((a,b)=>a-b));
}
export function createEndpoint(){return {kineticEnergy:0,meanSquareSpeed:0,verticalForce:0,maxSpeed:0,maxSpeedIndex:0,maxAcceleration:0,maxAccelerationIndex:0};}
export function createIntervals(dt,duration,binDt){
 const binTicks=Math.round(binDt/dt),bins=Array.from({length:Math.round(duration/binDt)},()=>({intervals:0,force:createMoment(),kineticIntegral:0,speedSquareIntegral:0,maxSpeed:0,maxSpeedTick:0,maxSpeedIndex:0,maxAcceleration:0,maxAccelerationTick:0,maxAccelerationIndex:0,minForce:0,maxForce:0,startEnergy:0,startLoss:0,startWork:0,endEnergy:0,endLoss:0,endWork:0,maxResidual:0}));
 let accepted=0;
 function maxima(bin,e,tick){
  if(e.maxSpeed>bin.maxSpeed){bin.maxSpeed=e.maxSpeed;bin.maxSpeedTick=tick;bin.maxSpeedIndex=e.maxSpeedIndex;}
  if(e.maxAcceleration>bin.maxAcceleration){bin.maxAcceleration=e.maxAcceleration;bin.maxAccelerationTick=tick;bin.maxAccelerationIndex=e.maxAccelerationIndex;}
  bin.minForce=Math.min(bin.minForce,e.verticalForce);bin.maxForce=Math.max(bin.maxForce,e.verticalForce);
 }
 return {
  accept(tick,old,current,oldEnergy,oldLoss,oldWork,energy,loss,work){
   if(tick!==accepted+1||tick>bins.length*binTicks)throw Error('Nonsequential accepted observation.');
   const bin=bins[Math.floor((tick-1)/binTicks)];
   if(bin.intervals===0){bin.startEnergy=oldEnergy;bin.startLoss=oldLoss;bin.startWork=oldWork;bin.minForce=old.verticalForce;bin.maxForce=old.verticalForce;bin.maxSpeed=old.maxSpeed;bin.maxSpeedTick=tick-1;bin.maxSpeedIndex=old.maxSpeedIndex;bin.maxAcceleration=old.maxAcceleration;bin.maxAccelerationTick=tick-1;bin.maxAccelerationIndex=old.maxAccelerationIndex;}
   addMoment(bin.force,old.verticalForce,dt/2);addMoment(bin.force,current.verticalForce,dt/2);
   bin.kineticIntegral+=dt/2*(old.kineticEnergy+current.kineticEnergy);bin.speedSquareIntegral+=dt/2*(old.meanSquareSpeed+current.meanSquareSpeed);
   maxima(bin,current,tick);bin.intervals++;bin.endEnergy=energy;bin.endLoss=loss;bin.endWork=work;bin.maxResidual=Math.max(bin.maxResidual,Math.abs(energy-bin.startEnergy+loss-bin.startLoss-work+bin.startWork));accepted=tick;
  },
  result(){return bins.flatMap((b,i)=>b.intervals?[{startTick:i*binTicks,endTick:i*binTicks+b.intervals,startTime:i*binTicks*dt,endTime:(i*binTicks+b.intervals)*dt,complete:b.intervals===binTicks,acceptedIntervals:b.intervals,
   timeMeanKineticEnergy:b.kineticIntegral/(b.intervals*dt),timeRmsNodeSpeed:Math.sqrt(b.speedSquareIntegral/(b.intervals*dt)),
   timeMeanVerticalForce:b.force.mean,timeStdVerticalForce:Math.sqrt(b.force.m2/b.force.weight),
   minEndpointVerticalForce:b.minForce,maxEndpointVerticalForce:b.maxForce,
   maxEndpointNodeSpeed:{value:b.maxSpeed,tick:b.maxSpeedTick,node:b.maxSpeedIndex},maxEndpointNodeAcceleration:{value:b.maxAcceleration,tick:b.maxAccelerationTick,node:b.maxAccelerationIndex},
   deltaEnergy:b.endEnergy-b.startEnergy,dampingLoss:b.endLoss-b.startLoss,signedContactWork:b.endWork-b.startWork,residualIncrement:b.endEnergy-b.startEnergy+b.endLoss-b.startLoss-b.endWork+b.startWork,maxResidual:b.maxResidual,
  }]:[]);}
 };
}
