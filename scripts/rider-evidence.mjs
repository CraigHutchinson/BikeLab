// Fixed, bounded receiving cases. Numerical evidence only; no timing benchmark.
import {runRig,G,GEOMETRY as g} from '../dist/bike-rig.js';
import {createHash} from 'node:crypto';
if(process.argv.length!==2)throw new Error('Usage: node scripts/rider-evidence.mjs');
const rows=[];
for(const bike of ['hardtail','full'])for(const rider of ['fixed','compliant'])for(const dt of [.00025,.0000625]) {
  const r=await runRig({bike,rider,dt}),s=r.signals,p=r.params,total=(p.mass+g.wheelMass+g.rearMass)*G;
  const expectedFront=total*(r.initial.comX-s.rearX[0])/(s.frontX[0]-s.rearX[0]);
  const values=Object.fromEntries(Object.entries(s).map(([key,v])=>[key,Array.from(v)]));
  rows.push({params:p,engine:r.engine,riderModel:r.riderModel,status:r.status,dofs:r.dofs,initial:r.initial,
    summary:r.summary,static:{weightResidual:r.initial.frontForce+r.initial.rearForce-total,
      frontMomentResidual:r.initial.frontForce-expectedFront,
      riderSagResidual:rider==='compliant'?s.riderCompression[0]*p.riderStiffness-p.riderMass*G*Math.cos(s.pitch[0]):null},
    peaks:Object.fromEntries(['frontForce','rearForce','riderForce'].map(k=>[k,Math.max(...s[k])])),
    traceSha256:createHash('sha256').update(JSON.stringify(values)).digest('hex'),signals:s});
}
const refinement=[];
for(let i=0;i<rows.length;i+=2) {
  const a=rows[i],b=rows[i+1];
  refinement.push({bike:a.params.bike,rider:a.params.rider,
    relativeEndpointRiderPeakDifference:b.summary.peakRiderForce===0?null:Math.abs(a.summary.peakRiderForce-b.summary.peakRiderForce)/b.summary.peakRiderForce,
    relativePeakDifferences:Object.fromEntries(['frontForce','rearForce','riderForce'].map(k=>[k,b.peaks[k]===0?null:Math.abs(a.peaks[k]-b.peaks[k])/Math.abs(b.peaks[k])])),
    maxCompressionDifferences:Object.fromEntries(['fork','shock','riderCompression'].map(k=>[k,Math.max(...a.signals[k].map((v,j)=>Math.abs(v-b.signals[k][j])))]))});
}
const stopped=await runRig({bike:'hardtail',rider:'compliant',riderTravel:.059});
console.log(JSON.stringify({format:'bikelab-rider-evidence-1',runtime:process.version,
  scope:'Illustrative smooth platen fixture; endpoint domain checking. No anatomy, impact, calibration or real-time claim.',
  rows:rows.map(({signals,...row})=>row),refinement,travel:{params:stopped.params,status:stopped.status,termination:stopped.termination,lastRiderCompression:stopped.signals.riderCompression.at(-1)}},null,2));
