import {writeFile} from 'node:fs/promises';
import {run,preset} from '../dist/trail-bike.js';
const trials=[];
for(const bike of ['full','hardtail'])for(const name of ['coast','drive','brake'])trials.push({label:bike+'-'+name,scenario:preset(name,bike)});
function braking(dt,nodes=64){const a=preset('brake');a.motion={...a.motion,duration:.15,dt};a.wheel={nodes};a.commands=[{tick:0,rearDrive:0,frontBrake:0,rearBrake:0},{tick:Math.round(.05/dt),rearDrive:0,frontBrake:55,rearBrake:35},{tick:Math.round(.1/dt),rearDrive:0,frontBrake:0,rearBrake:0}];return a;}
for(const dt of [.00003125,.000015625,.0000078125])trials.push({label:'brake-step-'+dt,scenario:braking(dt)});
for(const nodes of [32,128])trials.push({label:'brake-nodes-'+nodes,scenario:braking(.000015625,nodes)});
for(const dt of [.00003125,.000015625]){const a=preset('flight');a.motion={...a.motion,dt,duration:.02,omega:2,forkCompression:.02,rearAngle:.04,riderOffset:-.02};a.commands=[{tick:0,rearDrive:2,frontBrake:1,rearBrake:1},{tick:Math.round(.015625/dt),rearDrive:-2,frontBrake:0,rearBrake:0}];trials.push({label:'airborne-step-'+dt,scenario:a});}
const receipt={scope:'Uncalibrated planar hub torque and native regularized dry-friction brakes. Numerical sensitivity is distinct from convergence, physical calibration and real-time evidence.',trials:[]};
for(const {label,scenario} of trials){const r=await run(scenario),f=r.frames.at(-1);receipt.trials.push({label,scenario:r.scenario,status:r.status,termination:r.termination,summary:r.summary,endpoint:f&&{time:f.time,frame:f.frame,comVelocityX:f.momentum[0]/r.massBudget.total,momentumResidual:f.momentumResidual,impulse:f.impulse,driveWork:f.driveWork,brakeWork:f.brakeWork,normalWork:f.normalWork,tangentWork:f.tangentWork,constraintWork:f.constraintWork,spin:f.wheels.map(w=>w.spinVelocity)},sampled:{peakPositiveBrakePower:Math.max(0,...r.frames.map(f=>f.brakePower)),maxBrakeCapacityExcess:Math.max(0,...r.frames.flatMap(f=>f.wheels.map(w=>Math.abs(w.brakeTorque)-w.brakeCapacity)))}});console.log(label,r.status);}
await writeFile(new URL('../docs/evidence/iteration-19-drive-brake.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
