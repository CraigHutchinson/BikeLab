import {writeFile} from 'node:fs/promises';
import {solveFootprint} from '../dist/footprint.js';
const cases={flat:{},rounded:{fixture:'rounded',centerX:.1,height:.44},stepTop:{fixture:'step',centerX:.1,height:.445},twoSupports:{fixture:'bridge',height:.383}};
const compact=r=>({params:r.params,status:r.status,...(r.summary?{summary:r.summary}:{reason:r.reason,contourIntrusion:r.contourIntrusion})});
const tyre={},terrain={};for(const [name,p] of Object.entries(cases))tyre[name]=[64,128,256,512,1024].map(nodes=>compact(solveFootprint({...p,nodes})));
for(const name of ['rounded','twoSupports'])terrain[name]=[32,64,128,256,512].map(terrainSegments=>compact(solveFootprint({...cases[name],nodes:1024,terrainSegments})));
const p={fixture:'rounded',centerX:-.1,height:.4,rotation:.002},base=solveFootprint(p),derivatives=[];
for(const [key,channel] of [['centerX','forceX'],['height','forceZ'],['rotation','momentY']])for(const epsilon of [2e-7,1e-7]){const hi=solveFootprint({...p,[key]:p[key]+epsilon}),lo=solveFootprint({...p,[key]:p[key]-epsilon}),estimate=-(hi.summary.energy-lo.summary.energy)/(2*epsilon);derivatives.push({key,epsilon,reported:base.summary[channel],energyDerivative:estimate,error:estimate-base.summary[channel]});}
const holdingWork=[];for(const steps of [32,64,128]){let a=solveFootprint({height:.355}),initial=a.summary.energy,work=0;for(let i=1;i<=steps;i++){const b=solveFootprint({height:.355-.015*i/steps});work-=.5*(a.summary.forceZ+b.summary.forceZ)*(b.params.height-a.params.height);a=b;}holdingWork.push({steps,energyChange:a.summary.energy-initial,holdingWork:work,error:work-(a.summary.energy-initial)});}
const unsupported=[compact(solveFootprint({fixture:'step',centerX:-.2,height:.36})),compact(solveFootprint({height:.29}))];
await writeFile(new URL('../docs/evidence/iteration-13-footprint.json',import.meta.url),JSON.stringify({model:base.model,scope:'Uncalibrated static radial-guidance surrogate; not impact, pressure or stress.',tyre,terrain,derivatives,holdingWork,unsupported},null,2)+'\n');
console.log(JSON.stringify({derivatives,holdingWork},null,2));
