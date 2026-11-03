// Command scheduling is separate from target production and effort feedback.
import {constructPosture} from './rider-posture.js';
import {compilePassiveRider,JOINTS} from './rider-passive.js';
import {canonicalTargetDelta} from './rider-drive.js';
export const TARGET_MODEL='bikelab-trail-bike-targets-0.1';
export const TARGET_FORMAT='bikelab-rider-targets-0.1';
function object(v,keys,label){
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw Error(label+' must be a plain object.');
 for(const k of Reflect.ownKeys(v)){const d=Object.getOwnPropertyDescriptor(v,k);if(!keys.includes(k)||!d.enumerable||!Object.hasOwn(d,'value'))throw Error('Unsupported '+label+' field: '+String(k));}
}
export function compileRiderTargets(input,passive,steps){
 object(input,['format','commands'],'rider targets');
 if(input.format!==TARGET_FORMAT)throw Error('Unsupported rider target format.');
 if(!Number.isSafeInteger(steps)||steps<1)throw Error('Invalid run step count.');
 if(!Array.isArray(input.commands)||input.commands.length<1||input.commands.length>64)throw Error('Use 1 to 64 rider target commands.');
 const base=compilePassiveRider(passive),spec=[],commands=[];
 for(let index=0;index<input.commands.length;index++){
  const c=input.commands[index];object(c,['tick','phase','hip','trunkPitch'],'target command');
  if(!Number.isSafeInteger(c.tick)||c.tick<0||c.tick>steps||(index?c.tick<=spec[index-1].tick:c.tick!==0))throw Error('Target ticks must start at zero, increase and fit the run.');
  if(typeof c.phase!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(c.phase))throw Error('Invalid target phase label.');
  if(!Array.isArray(c.hip)||c.hip.length!==2||!c.hip.every(Number.isFinite)||!Number.isFinite(c.trunkPitch))throw Error('Invalid target hip/trunk request.');
  const pose=constructPosture({...base.spec.posture,hip:c.hip,trunkPitch:c.trunkPitch});
  const angles=JOINTS.map((name,i)=>{
   const a=pose.joints[name],law=base.laws[i];
   if(a<law.minAngle||a>law.maxAngle)throw Error('Rider target '+name+' outside original domain.');
   if(index&&Math.abs(a-commands[index-1].angles[i])>=Math.PI)throw Error('Rider target angle branch crossing.');
   return a;
  });
  if(!index&&(c.hip.some((x,i)=>x!==base.spec.posture.hip[i])||c.trunkPitch!==base.spec.posture.trunkPitch))throw Error('First target must match the original posture.');
  spec.push(Object.freeze({tick:c.tick,phase:c.phase,hip:Object.freeze([...c.hip]),trunkPitch:c.trunkPitch}));
  commands.push(Object.freeze({angles:Object.freeze(angles),q:Object.freeze(angles.map((a,i)=>canonicalTargetDelta(a,base.laws[i].angle0))),com:pose.aggregate.com}));
 }
 return Object.freeze({spec:Object.freeze({format:TARGET_FORMAT,commands:Object.freeze(spec)}),commands:Object.freeze(commands)});
}
