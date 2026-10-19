// Reproduce numerical controls independently of browser/display timing.
// Run serially; these are accuracy experiments, not performance measurements.
import {run,preset,MODEL,DEFAULTS} from '../dist/moving-wheel.js';
const tail=r=>({status:r.status,termination:r.termination,summary:r.summary,hub:r.frames.at(-1)?.hub,impulse:r.frames.at(-1)?.impulse,momentumResidual:r.frames.at(-1)?.momentumResidual});
const report={model:MODEL,baseParams:DEFAULTS,refinement:[],reflection:[],acceleration:[]};
for(const name of ['flat','square','rounded'])for(const patch of [{dt:.000125},{dt:.0000625},{dt:.00003125},{nodes:32,dt:.00003125},{nodes:128,dt:.00003125},...(name==='rounded'?[{terrainSegments:16,dt:.00003125},{terrainSegments:64,dt:.00003125}]:name==='square'?[{dt:.000015625},{dt:.0000078125}]:[])]){
 const a=preset(name),r=await run({...a,params:{...a.params,...patch,duration:.3}});report.refinement.push({name,patch,...tail(r)});
}
for(const collisionTolerance of [1e-6,1e-10]){
 const a=preset('square');a.params={...a.params,duration:.2,dt:.0000625,collisionTolerance,collisionIterations:collisionTolerance===1e-6?35:100};const l=await run(a),r=await run({...a,params:{...a.params,centerX:.6,velocityX:-a.params.velocityX,omega:-a.params.omega},profile:{...l.profile,points:l.profile.points.map(([x,z])=>[.2-x,z]).reverse()}}),left=l.frames.at(-1),right=r.frames.at(-1);
 report.reflection.push({params:a.params,status:[l.status,r.status],hubError:[left.hub[0]+right.hub[0]-.2,left.hub[1]-right.hub[1],left.hub[2]+right.hub[2]],impulseError:[left.impulse[0]+right.impulse[0],left.impulse[1]-right.impulse[1]]});
}
for(const dt of [.000125,.0000625,.00003125]){
 const a=preset('flight');a.params={...a.params,gravity:9.80665,omega:0,forceX:3,forceZ:2,dt};const r=await run(a),f=r.frames.at(-1),M=r.reference.totalMass,t=f.time,ax=a.params.forceX/M,az=a.params.forceZ/M-a.params.gravity;
 report.acceleration.push({params:a.params,...tail(r),residual:f.residual,expectedAngularResidual:-.5*dt*t*M*(a.params.velocityZ*ax-a.params.velocityX*az),expectedEnergyResidual:.5*M*a.params.gravity*az*dt*t});
}
console.log(JSON.stringify(report,null,2));
