// Offline ideal-anchor statics. Sources/sign derivation: docs/RIDER_STATIC_REFERENCE.md.
import {constructPosture} from './rider-posture.js';
import {compilePassiveRider,JOINTS} from './rider-passive.js';
import {validateDrive} from './rider-drive.js';
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(r,f)=>r[1]*f[0]-r[0]*f[1]; // positive y
function object(value,keys,label){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Invalid '+label);
 for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(!keys.includes(key)||!d.enumerable||!Object.hasOwn(d,'value'))throw Error('Unknown '+label+' field.');}
}
export function staticRiderReference(input={}){
 object(input,['passive','drive','goal','gravity','framePitch'],'static reference');
 const base=compilePassiveRider(input.passive),drive=validateDrive(Object.hasOwn(input,'drive')?input.drive:{},base.spec),goal=Object.hasOwn(input,'goal')?input.goal:{hip:base.spec.posture.hip,trunkPitch:base.spec.posture.trunkPitch};
 object(goal,['hip','trunkPitch'],'static goal');if(!Object.hasOwn(goal,'hip')||!Object.hasOwn(goal,'trunkPitch'))throw Error('Static goal needs hip and trunkPitch.');
 const pose=constructPosture({...base.spec.posture,...goal}),gravity=Object.hasOwn(input,'gravity')?input.gravity:9.80665,framePitch=Object.hasOwn(input,'framePitch')?input.framePitch:0;
 if(!Number.isFinite(gravity)||gravity<0||gravity>20||!Number.isFinite(framePitch)||Math.abs(framePitch)>Math.PI)throw Error('Invalid gravity or frame pitch.');
 const angles=JOINTS.map((name,i)=>{const angle=pose.joints[name],law=base.laws[i];if(angle<law.minAngle||angle>law.maxAngle)throw Error('Static goal outside '+name+' domain.');return angle;});
 const acceleration=[gravity*Math.sin(framePitch),-gravity*Math.cos(framePitch)],weight=acceleration.map(v=>v*pose.aggregate.mass),d=sub(pose.points.hand,pose.points.foot),length=Math.hypot(...d);
 const common={format:'bikelab-rider-static-reference-0.1',scope:'Ideal fixed bilateral anchors; minimum squared active torque within torque bounds. No contact feasibility, soft-closure equilibrium, dynamics or human calibration.',input:{passive:base.spec,drive,goal:{hip:[...pose.spec.hip],trunkPitch:pose.spec.trunkPitch},gravity,framePitch},pose};
 if(length<1e-6)return {...common,status:'unavailable',reason:'anchor-separation'};
 const direction=d.map(v=>v/length),moment=-cross(sub(pose.aggregate.com,pose.points.foot),weight),hand0=[d[1]*moment/(length*length),-d[0]*moment/(length*length)];
 const bodies=Object.fromEntries(pose.bodies.map(b=>[b.name,b]));
 const groups=[['hip','foot',['thighs','shanksFeet']],['knee','foot',['shanksFeet']],['shoulder','hand',['upperArms','forearmsHands']],['elbow','hand',['forearmsHands']]];
 const passive=base.laws.map((law,i)=>-law.stiffness*(angles[i]-law.restAngle));
 function evaluate(lambda){
  const hand=hand0.map((v,i)=>v+lambda*direction[i]),foot=weight.map((v,i)=>-v-hand[i]);
  const total=groups.map(([joint,anchor,names])=>{
   const origin=pose.points[joint],force=anchor==='hand'?hand:foot;
   return -cross(sub(pose.points[anchor],origin),force)-names.reduce((sum,name)=>sum+cross(sub(bodies[name].com,origin),acceleration.map(v=>v*bodies[name].mass)),0);
  });
  return {hand,foot,total,active:total.map((v,i)=>v-passive[i])};
 }
 const atZero=evaluate(0),slope=groups.map(([joint,anchor])=>-cross(sub(pose.points[anchor],pose.points[joint]),direction.map(v=>anchor==='hand'?v:-v)));
 const denominator=slope.reduce((s,v)=>s+v*v,0);
 if(denominator<1e-20)return {...common,status:'unavailable',reason:'degenerate-torque-policy'};
 let lower=-Infinity,upper=Infinity;
 for(let i=0;i<4;i++){
  const limit=drive.joints[JOINTS[i]].maxTorque,a=atZero.active[i],b=slope[i];
  if(Math.abs(b)<1e-12){if(Math.abs(a)>limit+1e-9)return {...common,status:'unavailable',reason:'torque-limits'};continue;}
  const ends=[(-limit-a)/b,(limit-a)/b].sort((a,b)=>a-b);lower=Math.max(lower,ends[0]);upper=Math.min(upper,ends[1]);
 }
 if(lower>upper)return {...common,status:'unavailable',reason:'torque-limits'};
 const unconstrained=-slope.reduce((sum,b,i)=>sum+b*atZero.active[i],0)/denominator,lambda=Math.max(lower,Math.min(upper,unconstrained)),solution=evaluate(lambda);
 const forceResidual=solution.hand.map((v,i)=>v+solution.foot[i]+weight[i]);
 const momentResidual=cross(sub(pose.points.hand,pose.points.foot),solution.hand)+cross(sub(pose.aggregate.com,pose.points.foot),weight);
 const joints=JOINTS.map((name,i)=>({name,angle:angles[i],passive:passive[i],total:solution.total[i],active:solution.active[i],limit:drive.joints[name].maxTorque,margin:drive.joints[name].maxTorque-Math.abs(solution.active[i])}));
 if(Math.hypot(...forceResidual)>1e-8||Math.abs(momentResidual)>1e-8||joints.some(j=>j.margin < -1e-8))throw Error('Static reference residual budget exceeded.');
 return {...common,status:'available',policy:{lambdaN:lambda,unconstrainedLambdaN:unconstrained,feasibleLambdaN:[Number.isFinite(lower)?lower:null,Number.isFinite(upper)?upper:null],boundActive:lambda!==unconstrained,objectiveNm2:solution.active.reduce((sum,v)=>sum+v*v,0),activeAtZero:atZero.active,activeSlope:slope},hand:solution.hand,foot:solution.foot,gravityForce:weight,joints,residual:{forceN:forceResidual,momentNm:momentResidual}};
}
