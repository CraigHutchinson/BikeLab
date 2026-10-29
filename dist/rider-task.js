// Setup-time target study. Does not write native state or claim supported motion.
import {constructPosture} from './rider-posture.js';
import {compilePassiveRider, JOINTS} from './rider-passive.js';

export const FORMAT='bikelab-rider-task-0.1';
export const MAX_TICKS=1000;
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function object(value,keys,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error(label+' must be a plain object.');
  for(const key of Reflect.ownKeys(value))if(!keys.includes(key))throw Error('Unknown '+label+' field: '+String(key));
}
function number(value,min,max,label){if(!Number.isFinite(value)||value<min||value>max)throw Error(label+' outside supported range.');return value;}

export function compileRiderTask(input={}){
  object(input,['format','passive','goal','ticks','tickSeconds','bindings'],'task');
  if(Object.hasOwn(input,'format')&&input.format!==FORMAT)throw Error('Unsupported rider task format.');
  if(Object.hasOwn(input,'bindings')&&input.bindings!=='retained-hands-feet')throw Error('Task requires retained hands and feet.');
  if(Object.hasOwn(input,'passive')&&input.passive===undefined)throw Error('Task passive definition is missing.');
  const base=compilePassiveRider(input.passive),start=base.posture.spec;
  const goal=Object.hasOwn(input,'goal')?input.goal:{hip:[start.hip[0]+.01,start.hip[1]-.01],trunkPitch:start.trunkPitch+.01};
  object(goal,['hip','trunkPitch'],'goal');
  if(!Array.isArray(goal.hip)||goal.hip.length!==2)throw Error('Goal hip needs x/z coordinates.');
  const hip=Array.from({length:2},(_,i)=>number(goal.hip[i],-2,2,'goal hip'));
  const trunkPitch=number(goal.trunkPitch,-Math.PI,Math.PI,'goal trunk pitch');
  const ticks=Object.hasOwn(input,'ticks')?input.ticks:100;
  if(!Number.isSafeInteger(ticks)||ticks<1||ticks>MAX_TICKS)throw Error('Task ticks must be an integer from 1 to '+MAX_TICKS+'.');
  const tickSeconds=number(Object.hasOwn(input,'tickSeconds')?input.tickSeconds:.01,.001,.1,'tickSeconds');
  const spec={format:FORMAT,passive:base.spec,goal:{hip,trunkPitch},ticks,tickSeconds,bindings:'retained-hands-feet'};
  const frames=[];
  for(let tick=0;tick<=ticks;tick++){
    // Integer indexing owns endpoints; no accumulated clock or angular wrapping.
    const u=tick/ticks,lerp=(a,b)=>tick===0?a:tick===ticks?b:a+(b-a)*u;
    const requested={hip:start.hip.map((x,i)=>lerp(x,hip[i])),trunkPitch:lerp(start.trunkPitch,trunkPitch)};
    try{
      const pose=constructPosture({...start,...requested});
      const jointAngles=JOINTS.map((name,i)=>{
        const angle=pose.joints[name],law=base.laws[i];
        if(angle<law.minAngle||angle>law.maxAngle)throw Error(name+' target outside the original passive domain.');
        if(tick&&Math.abs(angle-frames[tick-1].jointAngles[i])>=Math.PI)throw Error(name+' target crosses an angle branch.');
        return angle;
      });
      frames.push({tick,time:tick*tickSeconds,...requested,jointAngles,
        relativeAngles:jointAngles.map((a,i)=>a-base.laws[i].angle0),
        com:[...pose.aggregate.com],conditioning:{...pose.conditioning},closure:{...pose.closure}});
    }catch(error){throw Error('Task rejected at tick '+tick+': '+error.message);}
  }
  return freeze({format:FORMAT,spec,jointOrder:[...JOINTS],frames,
    scope:'Sampled kinematic targets only; no continuous-path certification, actual motion, support forces, torque or work.',
    numerics:{clock:'integer command tick; time = tick * tickSeconds',interpolation:'linear hip x/z and unwrapped trunk pitch',transcendentals:'host JavaScript Math; geometry comparison 1e-12, not cross-platform bit identity'}});
}
