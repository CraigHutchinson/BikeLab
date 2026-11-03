import {createEffortGeometry,createEffortSolution,solveEffortBalance} from './rider-effort-balance.js';
// Offline ideal-anchor statics. Sources/sign derivation: docs/RIDER_STATIC_REFERENCE.md.
import {constructPosture} from './rider-posture.js';
import {compilePassiveRider,JOINTS} from './rider-passive.js';
import {validateDrive} from './rider-drive.js';
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
 const acceleration=[gravity*Math.sin(framePitch),-gravity*Math.cos(framePitch)],weight=acceleration.map(v=>v*pose.aggregate.mass);
 const common={format:'bikelab-rider-static-reference-0.1',scope:'Ideal fixed bilateral anchors; minimum squared active torque within torque bounds. No contact feasibility, soft-closure equilibrium, dynamics or human calibration.',input:{passive:base.spec,drive,goal:{hip:[...pose.spec.hip],trunkPitch:pose.spec.trunkPitch},gravity,framePitch},pose};
 const g=createEffortGeometry(),out=createEffortSolution();g.gravity.set(acceleration);g.anchors.set([...pose.points.hand,...pose.points.foot]);
 for(let i=0;i<5;i++){g.mass[i]=pose.bodies[i].mass;g.com.set(pose.bodies[i].com,2*i);}
 for(let i=0;i<4;i++){g.joints.set(pose.points[JOINTS[i]],2*i);g.passive[i]=-base.laws[i].stiffness*(angles[i]-base.laws[i].restAngle);g.limits[i]=drive.joints[JOINTS[i]].maxTorque;}
 if(!solveEffortBalance(g,out))return {...common,status:'unavailable',reason:out.status};
 const joints=JOINTS.map((name,i)=>({name,angle:angles[i],passive:g.passive[i],total:out.total[i],active:out.active[i],limit:g.limits[i],margin:g.limits[i]-Math.abs(out.active[i])}));
 if(Math.hypot(...out.forceResidual)>1e-8||Math.abs(out.momentResidual)>1e-8||joints.some(j=>j.margin < -1e-8))throw Error('Static reference residual budget exceeded.');
 return {...common,status:'available',policy:{lambdaN:out.lambda,unconstrainedLambdaN:out.unconstrained,feasibleLambdaN:[Number.isFinite(out.lower)?out.lower:null,Number.isFinite(out.upper)?out.upper:null],boundActive:out.lambda!==out.unconstrained,objectiveNm2:out.objective,activeAtZero:Array.from(out.atZero),activeSlope:Array.from(out.slope)},hand:Array.from(out.hand),foot:Array.from(out.foot),gravityForce:weight,joints,residual:{forceN:Array.from(out.forceResidual),momentNm:out.momentResidual}};
}
