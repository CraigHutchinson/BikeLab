import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createStaticReference,publishedGeometryAudit,MODEL,BUDGETS} from './lib/tyre-static-reference.mjs';

export function staticReferenceStudy(onProgress){
 assert.ok(onProgress===undefined||typeof onProgress==='function');
 const sourceAudit=publishedGeometryAudit(),{majorRadius:ignored,...printedIndependent}=sourceAudit.printed;
 const configurations=[120000,160000,200000].map(gaugePressure=>({name:'illustrative-mtb-'+gaugePressure,parameters:{rimRadius:.311,rimWidth:.03,sectionRadius:.03,gaugePressure,provenance:{kind:'illustrative',reference:'Declared static membrane geometry, not a measured MTB tyre'}}}));
 configurations.push({name:'figure4-consistent-reconstruction',parameters:{...printedIndependent,provenance:{kind:'source-derived',reference:'Renart/Roura-Grabulosa2019 Figure4: retain RL,WL,RT0,P; derive RW. Printed RW is inconsistent; not exact figure reproduction.'}}});
 const curves=[],refinements=[],asymptotes=[],profiles=[];
 let completed=0;const total=4*31+2*3*(6+5)+2*3+3+1; // all load solves, including controls
 const progress=()=>onProgress?.(++completed,total);
 for(const fixture of configurations){
  const model=createStaticReference(fixture.parameters),geometry=model.geometry(),samples=[];
  for(let k=0;k<=30;k++){samples.push(model.solve(geometry.maxDeflection*k/30));progress();}
  assert.ok(samples.every((s,i)=>i===0||s.stressLoad>samples[i-1].stressLoad));
  curves.push({...fixture,geometry,samples});
 }
 for(const fixture of [configurations[1],configurations[3]]){
  const model=createStaticReference(fixture.parameters),g=model.geometry();
  for(const fraction of [.01,.2,.5]){
   const deflection=fraction*g.height,quadrature=[16,32,64,128,256,512].map(panels=>{const s=model.solve(deflection,{panels});progress();return s;}),roots=[1e-8,1e-10,1e-12,1e-13,2e-15].map(angleTolerance=>{const s=model.solve(deflection,{panels:256,angleTolerance});progress();return s;});
   const quadratureError=Math.abs(quadrature[3].stressLoad-quadrature.at(-1).stressLoad),rootError=Math.abs(roots[3].stressLoad-roots.at(-1).stressLoad);
   assert.ok(quadratureError<=BUDGETS.forceAbsolute+BUDGETS.quadratureRelative*quadrature.at(-1).stressLoad);assert.ok(rootError<=BUDGETS.forceAbsolute);
   refinements.push({fixture:fixture.name,deflection,quadrature,roots,defaultQuadratureError:quadratureError,defaultRootError:rootError});
  }
  const samples=[1e-3,1e-4,1e-5].map(fraction=>{const state=model.solve(fraction*g.height,{panels:256});progress();return {...state,footprintRatio:state.footprintLoad/(state.deflection**1.5*g.smallLoadFootprintCoefficient),stressRatio:state.stressLoad/(state.deflection**1.5*g.smallLoadStressCoefficient)};});
  assert.ok(Math.abs(samples.at(-1).footprintRatio-1)<=BUDGETS.asymptoteRelative);asymptotes.push({fixture:fixture.name,geometry:g,samples});
 }
 const model=createStaticReference(configurations[1].parameters),g=model.geometry();
 for(const fraction of [.1,.25,.5]){profiles.push({fraction,state:model.solve(fraction*g.height,{recordSections:true})});progress();}
 const road=createStaticReference(configurations[3].parameters),comparison=road.solve(.006);progress();assert.equal(completed,total);
 return {model:MODEL,scope:'Offline constant-pressure thin inextensible membrane reference with an explicit half-height geometry envelope. Not a calibrated tyre, sealed chamber, production casing, insert, impact/failure or performance qualification.',physicalValidation:false,applicability:'Dimension/root admission does not validate the thin-torus approximation; record each thinRatio and both load estimates.',source:{url:'https://arxiv.org/pdf/1902.03661',accessed:'2026-11-05',equations:'Cross-section geometry derived from contour closure; stress load Eq16 and footprint area from Eq7, yielding Eq20. Printed Eq19 is not used directly.'},sourceAudit,budgets:BUDGETS,budgetUnits:{geometry:'m',angle:'rad',quadratureRelative:'relative',forceAbsolute:'N',asymptoteRelative:'relative'},curves,refinements,asymptotes,profiles,figureComparison:{deflection:.006,reportedLoad:659,stressLoad:comparison.stressLoad,footprintLoad:comparison.footprintLoad,status:'not-an-acceptance-test',reason:'Printed geometry is inconsistent; retain both approximate load estimates without fitting or claiming exact reproduction.'},summary:{loadSolves:total,curveStates:124,refinementGroups:refinements.length,asymptoteGroups:asymptotes.length,profiles:profiles.length}};
}

async function main(){
 assert.ok(process.argv.length<=3,'Usage: node scripts/tyre-static-reference.mjs [output-directory]');const directory=resolve(process.argv[2]??'artifacts/tyre-static-reference');
 const paths=['scripts/lib/tyre-static-reference.mjs','scripts/tyre-static-reference.mjs','scripts/plot-tyre-static-reference.py','test/tyre-static-reference.test.mjs'];
 const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex')]))),sourcesSha256=await hashes();
 const report=staticReferenceStudy((n,total)=>console.log('static reference '+n+'/'+total));assert.deepEqual(await hashes(),sourcesSha256,'Sources changed during receiving');
 await mkdir(directory,{recursive:true});await writeFile(join(directory,'report.json'),JSON.stringify({...report,sourcesSha256})+'\n');console.log(JSON.stringify(report.summary));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
