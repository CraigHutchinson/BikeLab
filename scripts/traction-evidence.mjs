import {writeFile} from 'node:fs/promises';
import {run,preset} from '../dist/trail-bike.js';
const trials=[];
for(const bike of ['full','hardtail'])for(const name of ['coast','sliding']){const a=preset(name,bike);trials.push({label:bike+'-'+name,scenario:a});}
for(const dt of [.00003125,.000015625,.0000078125]){const a=preset('sliding');a.motion={...a.motion,duration:.08,dt};trials.push({label:'step-'+dt,scenario:a});}
for(const nodes of [32,128]){const a=preset('sliding');a.motion={...a.motion,duration:.08,dt:.000015625};a.wheel={nodes};trials.push({label:'nodes-'+nodes,scenario:a});}
const receipt={scope:'Uncalibrated homogeneous planar contact; numerical sensitivity, not converged grip or real-time evidence.',trials:[]};
for(const {label,scenario} of trials){const r=await run(scenario),last=r.frames.at(-1),contacts=r.frames.flatMap(f=>f.contacts),peakSlip=Math.max(0,...contacts.map(c=>Math.abs(c.slip??0)));receipt.trials.push({label,scenario:r.scenario,status:r.status,termination:r.termination,summary:r.summary,endpoint:last&&{frame:last.frame,momentum:last.momentum,momentumResidual:last.momentumResidual,impulse:last.impulse,constraintWork:last.constraintWork,normalWork:last.normalWork,tangentWork:last.tangentWork},sampled:{contacts:contacts.length,peakSlip,peakPositiveTangentPower:Math.max(0,...contacts.map(c=>c.tangentForce*(c.slip??0))),maxConeExcess:Math.max(0,...contacts.map(c=>Math.abs(c.tangentForce)-r.scenario.surface.friction*c.normalForce))}});console.log(label,r.status);}
await writeFile(new URL('../docs/evidence/iteration-18-traction.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
