// Setup-time hold/move/hold/return/hold target producer shared by receiving cases.
import {compileRiderTask} from './rider-task.js';
import {TARGET_FORMAT} from './rider-targets.js';
export function riderCycleTargets(passive,{goal,control=false,dt,phaseSeconds,phases}){
 const stride=(phaseSeconds/20)/dt;
 if(typeof control!=='boolean'||!Number.isSafeInteger(stride)||stride<1||!Number.isFinite(dt)||dt<=0)throw Error('Rider cycle commands must align to physics ticks.');
 if(!Array.isArray(phases)||phases.length!==5||phases.some(p=>typeof p!=='string'||!p.length))throw Error('Rider cycle needs five phase names.');
 const task=compileRiderTask({passive,goal,ticks:20,tickSeconds:phaseSeconds/20}),path=task.frames,base=task.spec.passive.posture;
 const commands=[],add=(tick,phase,index)=>{const p=control?base:path[index];commands.push({tick:tick*stride,phase:phases[phase],hip:[...p.hip],trunkPitch:p.trunkPitch});};
 add(0,0,0);add(20,1,0);for(let i=1;i<20;i++)add(20+i,1,i);
 add(40,2,20);add(60,3,20);for(let i=1;i<20;i++)add(60+i,3,20-i);
 add(80,4,0);
 return {format:TARGET_FORMAT,commands};
}
