import {TYRE_MOTION} from './tyre-motion.js';
export const TYRE_WINDOW='bikelab-tyre-window-0.1';
export const TYRE_WINDOW_MODEL='bikelab-trail-bike-tyre-window-0.1';
export const WINDOW_SCOPE='Additional samples from one uninterrupted native run. State at the accepted start tick omits native warm start/history; importing it starts a fresh run. Whole-run ledgers do not reset at the window. No equilibrium or continuation-checkpoint claim.';

export function validateWindow(value,motion,commands){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Observation window must be an object.');
 const keys=['format','startTick','endTick','strideTicks'];
 for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(!keys.includes(key)||!d.enumerable||!Object.hasOwn(d,'value'))throw Error('Observation window requires known enumerable data properties.');}
 if(keys.some(k=>!Object.hasOwn(value,k))||value.format!==TYRE_WINDOW)throw Error('Incomplete observation window format.');
 const {startTick,endTick,strideTicks}=value,total=Math.round(motion.duration/motion.dt);
 if(![startTick,endTick,strideTicks].every(Number.isSafeInteger)||startTick<0||endTick<=startTick||endTick>total||strideTicks<1||(endTick-startTick)%strideTicks!==0)throw Error('Observation window ticks must be aligned integers within this run.');
 const duration=(endTick-startTick)*motion.dt,cadence=strideTicks*motion.dt;
 if(duration<.02-1e-12||cadence<.000125-1e-12||cadence>.05+1e-12||(endTick-startTick)/strideTicks>300)throw Error('Observation window needs at least 20 ms, a 125 µs to 50 ms cadence and at most 300 intervals.');
 const window=Object.freeze({format:TYRE_WINDOW,startTick,endTick,strideTicks});windowSchedule(motion,commands,window);return window;
}

// Allocation and set union happen before native integration, never on a tick.
export function windowSchedule(motion,commands,window){
 const total=Math.round(motion.duration/motion.dt),stride=Math.round(motion.sampleDt/motion.dt),ticks=new Set([0,total]);
 for(let tick=0;tick<=total;tick+=stride)ticks.add(tick);
 for(const c of commands)ticks.add(c.tick);
 for(let tick=window.startTick;tick<=window.endTick;tick+=window.strideTicks)ticks.add(tick);
 if(ticks.size>512)throw Error('Observation schedule exceeds 512 distinct samples.');
 return Int32Array.from([...ticks].sort((a,b)=>a-b));
}

export function tailWindow(record){
 if(!record?.scenario?.active||record.status!=='completed')throw Error('Uninterrupted observation requires a completed active run.');
 const a=structuredClone(record.scenario),dt=a.motion.dt,endTick=Math.round(a.motion.duration/dt);
 // Authored timesteps need not divide 125 µs. Choose an admitted integer
 // cadence and derive its span, falling back toward the source coarse cadence
 // when a short horizon or the union's storage cap requires it.
 for(let strideTicks=Math.ceil(.000125/dt-1e-9);strideTicks<=Math.round(a.motion.sampleDt/dt);strideTicks++){
  const span=Math.ceil(.02/(strideTicks*dt)-1e-9)*strideTicks;if(span>endTick)continue;
  const window={format:TYRE_WINDOW,startTick:endTick-span,endTick,strideTicks};
  try{validateWindow(window,a.motion,a.commands);}catch{continue;}
  a.diagnostics=TYRE_MOTION;a.observationWindow=window;return a;
 }
 throw Error('No representable final observation interval fits this run.');
}

export function restartWindow(record){
 const w=record?.scenario?.observationWindow,start=record?.windowObservation?.start;
 if(!w||!start||record.summary?.steps<w.endTick)throw Error('A complete accepted observation window is required.');
 const a=structuredClone(record.scenario),frame=record.frames[start.frameIndex];delete a.observationWindow;
 a.initialization={mode:'state',state:structuredClone(start.state)};
 a.motion={gravity:a.motion.gravity,duration:(w.endTick-w.startTick)*a.motion.dt,dt:a.motion.dt,sampleDt:w.strideTicks*a.motion.dt};
 a.commands=[{...frame.command,tick:0},...a.commands.filter(c=>c.tick>w.startTick&&c.tick<=w.endTick).map(c=>({...c,tick:c.tick-w.startTick}))];
 return a;
}
