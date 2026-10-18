import {writeFile} from 'node:fs/promises';
import {experiment,example,illustrativeAssembly,assessAssembly,PRESSURE_BANDS} from '../dist/wheel-limits.js';
const geometry=['flat','edge','rounded','domain','separated'].map(name=>{const r=experiment(example(name));return {name,status:r.status,params:r.params,delta:r.delta,sweep:r.sweep,staticStartingStatus:r.staticAtStart.status};});
const assembly=illustrativeAssembly(),pressure=[180000,250000,250001,0].map(pressure=>({pressure,assessment:assessAssembly({...assembly,pressure},.305)}));
await writeFile(new URL('../docs/evidence/iteration-14-limits.json',import.meta.url),JSON.stringify({scope:'Continuous geometry and declared service limits; no impact, blowout or fracture prediction.',geometry,pressure,sourceBands:PRESSURE_BANDS},null,2)+'\n');
console.log(JSON.stringify(geometry.map(r=>({name:r.name,status:r.status,fraction:r.sweep.fraction,center:r.sweep.center})),null,2));
