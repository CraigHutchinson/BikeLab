// Offline scalar screening only: these curves are not Cartesian casing laws.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {createStaticReference} from './lib/tyre-static-reference.mjs';
if(process.argv.length>3)throw Error('Usage: node scripts/tyre-candidate-screen.mjs [output-directory]');
const output=resolve(process.argv[2]??'artifacts/tyre-candidate-screen');
const geometries=[{name:'illustrative-mtb',rimRadius:.311,rimWidth:.03,sectionRadius:.03},{name:'illustrative-narrow',rimRadius:.31,rimWidth:.024,sectionRadius:.02}];
const pressures=[120000,160000,200000],fractions=[.01,.025,.05,.1,.2,.35,.5],anchorFraction=.1;
const rows=[];
for(const {name,...dimensions} of geometries)for(const gaugePressure of pressures){
 const configuration={...dimensions,gaugePressure,provenance:{kind:'illustrative',reference:'Scalar candidate screen, no measured tyre or fitted casing'}};
 const model=createStaticReference(configuration),geometry=model.geometry(),anchorDepth=anchorFraction*geometry.height;
 const anchor=model.solve(anchorDepth,{panels:512}),linearStiffness=anchor.stressLoad/anchorDepth,powerCoefficient=anchor.stressLoad/anchorDepth**1.5;
 for(const fraction of fractions){
  const deflection=fraction*geometry.height,reference=model.solve(deflection,{panels:512});
  const candidates={linearAtAnchor:linearStiffness*deflection,threeHalvesAtAnchor:powerCoefficient*deflection**1.5,derivedSmallLoad:geometry.smallLoadStressCoefficient*deflection**1.5};
  const relativeErrors=Object.fromEntries(Object.entries(candidates).map(([key,value])=>[key,(value-reference.stressLoad)/reference.stressLoad]));
  assert.ok(Object.values(relativeErrors).every(Number.isFinite));
  if(fraction===anchorFraction){assert.ok(Math.abs(relativeErrors.linearAtAnchor)<1e-12);assert.ok(Math.abs(relativeErrors.threeHalvesAtAnchor)<1e-12);}
  // The two reference estimates differ by approximation, not integration error.
  assert.ok(Math.abs(reference.stressLoad/reference.footprintLoad-geometry.stressToFootprintRatio)<1e-12);
  rows.push({name,configuration,fraction,deflection,anchorFraction,reference:{stressLoad:reference.stressLoad,footprintLoad:reference.footprintLoad,footprintArea:reference.footprintArea,centreWidth:reference.centre.footprintWidth},candidates,relativeErrors});
 }
}
const names=Object.keys(rows[0].candidates),heldOut=rows.filter(r=>r.fraction!==anchorFraction);
const summary=Object.fromEntries(names.map(name=>[name,{maxAbsRelativeError:Math.max(...heldOut.map(r=>Math.abs(r.relativeErrors[name]))),rmsRelativeError:Math.sqrt(heldOut.reduce((s,r)=>s+r.relativeErrors[name]**2,0)/heldOut.length)}]));
// Constant-pressure reference scales linearly: changing pressure alone adds no
// independent shape constraint. Explicitly check that rather than overcount it.
for(const name of geometries.map(g=>g.name))for(const fraction of fractions){
 const group=rows.filter(r=>r.name===name&&r.fraction===fraction),base=group[0];
 for(const row of group)for(const key of names)assert.ok(Math.abs(row.relativeErrors[key]-base.relativeErrors[key])<1e-12);
}
const sources=['scripts/tyre-candidate-screen.mjs','scripts/lib/tyre-static-reference.mjs','scripts/plot-tyre-candidate-screen.py'];
const sourcesSha256=Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await readFile(new URL('../'+p,import.meta.url))).digest('hex')])));
const report={model:'bikelab-scalar-tyre-candidate-screen-0.1',scope:'Offline scalar load screen against an approximate constant-pressure reference; no casing equilibrium, calibration, timing or production selection',anchorFraction,heldOutCount:heldOut.length,summary,rows,sourcesSha256};
await mkdir(output,{recursive:true});await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({rows:rows.length,heldOut:heldOut.length,summary},null,2));
