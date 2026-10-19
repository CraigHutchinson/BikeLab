import {run,preset,smoothProfile} from '../dist/trail-bike.js';
import {writeFile} from 'node:fs/promises';
const records=new Map(),rows=[];
async function sample(name,a){const r=await run(a);records.set(name,r);const f=r.frames.at(-1);rows.push({name,status:r.status,termination:r.termination,scenario:r.scenario,massBudget:r.massBudget,summary:r.summary,last:f?{frame:f.frame,fork:f.fork,shock:f.shock,rider:f.rider,wheels:f.wheels.map(w=>({hub:w.hub,ground:w.ground,bearing:w.bearing})),impulse:f.impulse,momentumResidual:f.momentumResidual,residual:f.residual}:null});console.log(name,r.status,r.summary?.maxResidual);return r;}
for(const bike of ['full','hardtail'])await sample(bike+'-bump',preset('bump',bike));
for(const dt of [.00003125,.000015625,.0000078125])await sample('flat-dt-'+dt,{...preset('flat'),motion:{duration:.15,dt}});
for(const [nodes,segments] of [[64,16],[64,32],[64,64],[128,32]])await sample('bump-mesh-'+nodes+'-'+segments,{...preset('bump'),profile:smoothProfile('bump',segments),wheel:{nodes},motion:{duration:.4,dt:.000015625}});
const sampling=[];for(const [sampleDt,dt] of [[.001,.00003125],[.0005,.00003125],[.00025,.00003125],[.000125,.00003125],[.000125,.000015625],[.000125,.0000078125]]){
 const r=await run({...preset('flat'),motion:{clearance:0,duration:.03,sampleDt,dt}}),errors=[];
 for(let k=0;k<2;k++){const impulse=[0,0,0],mass=r.massBudget.eachHub+r.massBudget.eachTyre,g=r.scenario.motion.gravity,force=f=>{const w=f.wheels[k],fx=w.bearing[0]+w.ground[0],fz=w.bearing[1]+w.ground[1];return [fx,fz-mass*g,w.bearing[2]+w.ground[2]+w.hub[1]*fx-w.hub[0]*fz+mass*g*w.centerOfMass[0]];};
 for(let i=1;i<r.frames.length;i++){const a=r.frames[i-1],b=r.frames[i],fa=force(a),fb=force(b);for(let j=0;j<3;j++)impulse[j]+=.5*(b.time-a.time)*(fa[j]+fb[j]);}errors.push(impulse.map((v,j)=>r.frames.at(-1).wheels[k].momentum[j]-r.frames[0].wheels[k].momentum[j]-v));}
 sampling.push({sampleDt,dt,errors,endFrame:r.frames.at(-1).frame});console.log('sampling',sampleDt,dt,errors);
}
const baseline=records.get('bump-mesh-64-32').frames.at(-1),meshDifferences=rows.filter(r=>r.name.startsWith('bump-mesh')).map(r=>({name:r.name,frameDistance:Math.hypot(r.last.frame[0]-baseline.frame[0],r.last.frame[1]-baseline.frame[1]),pitchDifference:r.last.frame[2]-baseline.frame[2],impulseDifference:r.last.impulse.map((v,i)=>v-baseline.impulse[i])}));
await writeFile('docs/evidence/iteration-16-connected-bike.json',JSON.stringify({model:'bikelab-trail-bike-0.1',note:'Synthetic numerical controls, not physical calibration or real-time performance qualification.',rows,meshDifferences,sampling},null,2)+'\n');
