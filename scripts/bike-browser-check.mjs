import {GEOMETRY_KEYS} from '../dist/linkage.js';
import {CATALOGUE} from '../dist/geometry-catalogue.js';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {runRig} from '../dist/bike-rig.js';
export async function checkBike({page,root,dir,report}) {
  const ready=()=>page.waitForFunction(()=>['READY','TRAVEL LIMIT'].includes(document.getElementById('status').textContent));
  const shot=async name=>{await page.screenshot({path:join(dir,name+'.png'),fullPage:true});report.screenshots.push(name+'.png');};
  const exportRun=async name=>{const pending=page.waitForEvent('download');await page.locator('#save').click();const download=await pending,path=join(dir,name+'.json');await download.saveAs(path);return {path,record:JSON.parse(await readFile(path,'utf8'))};};
  const apply=async()=>{await page.locator('button[type=submit]').click();await ready();};
  await page.setViewportSize({width:1440,height:1100});await page.goto(root+'bike.html');await ready();
  assert.equal(await page.locator('#manufacturerReference option').count(),CATALOGUE.records.length);
  for(const r of CATALOGUE.records){await page.locator('#manufacturerReference').selectOption(r.id);assert.ok((await page.locator('#referenceDescription').textContent()).includes(`${r.year} · size ${r.size} · ${r.configuration}`));assert.match(await page.locator('#referenceReadiness').textContent(),/Reference only/);assert.equal(await page.locator('#save').isDisabled(),false);}
  assert.match(await page.locator('#referenceDimensions').textContent(),/62.5 mm/);
  const catalogueDownload=page.waitForEvent('download');await page.locator('#manufacturerReferences details summary').click();await page.locator('#exportCatalogue').click();const catalogueFile=await catalogueDownload;const cataloguePath=join(dir,'geometry-catalogue.json');await catalogueFile.saveAs(cataloguePath);assert.deepEqual(JSON.parse(await readFile(cataloguePath,'utf8')),CATALOGUE);await page.locator('#manufacturerReferences details summary').click();
  await page.locator('#manufacturerReference').selectOption('orange-five-2020-m');
  report.checks.push('manufacturer catalogue: eight sourced configurations selectable, SI JSON export exact, missing mechanism data explicit, reference selection leaves the calculated rig intact');
  assert.match(await page.locator('#geometryName').textContent(),/Annotated/);
  assert.match(await page.locator('#configuration').textContent(),/210.0 mm; stroke 55.0 mm/);
  await page.locator('#geometrySettings summary').click();
  await page.locator('#referenceGeometry').click();await ready();assert.match(await page.locator('#geometryName').textContent(),/Original/);
  const legacyGeometry=await exportRun('geometry-reference');assert.equal(legacyGeometry.record.params.pivotX,0);await shot('geometry-reference');
  await checkGeometryLabels({page,dir,report});
  await page.locator('[name=pivotX]').fill('.045');assert.equal(await page.locator('#save').isDisabled(),true);await apply();
  assert.match(await page.locator('#geometryName').textContent(),/Custom/);const custom=await exportRun('geometry-custom');const customNode=await runRig(custom.record.params);
  for(const [key,values] of Object.entries(custom.record.signals))for(let i=0;i<values.length;i++)assert.ok(Math.abs(values[i]-customNode.signals[key][i])<1e-8,key);
  await page.locator('#load').setInputFiles(custom.path);await ready();assert.equal(await page.locator('[name=pivotX]').inputValue(),'0.045');
  await page.locator('[name=shockArmZ]').fill('-.15');await page.locator('button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='SETUP REJECTED');assert.match(await page.locator('#error').textContent(),/toggle|coincidence|unreachable/);
  await page.locator('#annotatedGeometry').click();await ready();await shot('geometry-annotated');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    await page.waitForFunction(()=>['rig','linkagePlot'].every(id=>{const c=document.getElementById(id);return c.width===Math.round(c.clientWidth*devicePixelRatio);}));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('geometry-annotated-mobile-'+width);
  }
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('#geometrySettings summary').click();
  report.checks.push('geometry: annotated/reference/custom physical setups, diagnostics, changed/invalid gating, custom reload and browser/headless channels');
  for(const bike of ['full','hardtail']){
    if(bike==='hardtail'){await page.locator('[name=bike]').selectOption('hardtail');assert.equal(await page.locator('#save').isDisabled(),true);await apply();}
    const {path,record}=await exportRun('bike-'+bike),node=await runRig(record.params);
    let max=0;for(const [key,values] of Object.entries(record.signals))for(let i=0;i<values.length;i++){const error=Math.abs(values[i]-node.signals[key][i]);max=Math.max(max,error);assert.ok(error<1e-8,`${bike} ${key} ${i}: ${error}`);}
    assert.equal(record.dofs,bike==='full'?4:3);assert.equal(record.status,'complete');
    report.exports.push({name:'bike-'+bike,result:{dofs:record.dofs,samples:record.signals.time.length,maxBrowserNodeDifference:max}});
    await page.locator('#scrub').fill('240');await shot('bike-'+bike+'-desktop');
    await page.locator('#load').setInputFiles(path);await ready();assert.equal(await page.locator('[name=dt]').inputValue(),'0.000125');
  }
  assert.equal(await page.locator('[name=shockStiffness]').isDisabled(),true);
  await page.locator('#step').click();assert.equal(await page.locator('#time').textContent(),'0.005 s');
  await page.locator('#play').click();await page.waitForFunction(()=>parseFloat(document.getElementById('time').textContent)>.03);await page.locator('#play').click();
  const time=await page.locator('#time').textContent();await page.waitForTimeout(100);assert.equal(await page.locator('#time').textContent(),time);
  await page.locator('[name=forkDamping]').fill('200');await page.locator('[name=amplitude]').fill('.08');await page.locator('[name=bumpDuration]').fill('.2');await apply();
  assert.equal(await page.locator('#status').textContent(),'TRAVEL LIMIT');assert.match(await page.locator('#termination').textContent(),/last valid/);await shot('bike-limit');
  const stopped=await exportRun('bike-limit');const stoppedNode=await runRig(stopped.record.params);assert.equal(stopped.record.termination.reason,stoppedNode.termination.reason);
  assert.ok(Math.abs(stopped.record.termination.lastValidTime-stoppedNode.termination.lastValidTime)<1e-10);
  await page.locator('[name=forkDamping]').fill('0');await page.locator('button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='SETUP REJECTED');assert.match(await page.locator('#error').textContent(),/settle/);
  await page.locator('[name=forkDamping]').fill('700');await page.locator('[name=amplitude]').fill('.025');await page.locator('[name=bumpDuration]').fill('.4');
  const cancelled=await page.evaluate(()=>{document.getElementById('setup').requestSubmit();const busy=!document.getElementById('cancel').disabled;document.getElementById('cancel').click();return busy;});assert.ok(cancelled);assert.equal(await page.locator('#status').textContent(),'CANCELLED');
  await apply();
  await page.locator('[name=amplitude]').fill('');await page.evaluate(()=>document.getElementById('setup').dispatchEvent(new Event('submit',{cancelable:true})));assert.equal(await page.locator('#status').textContent(),'SETUP REJECTED');assert.match(await page.locator('#error').textContent(),/Missing/);await page.locator('[name=amplitude]').fill('.025');await apply();
  const wrong=join(dir,'bike-wrong.json');await writeFile(wrong,JSON.stringify({model:'wrong',params:{}}));await page.locator('#load').setInputFiles(wrong);await page.waitForFunction(()=>document.getElementById('status').textContent==='SETUP REJECTED');assert.match(await page.locator('#error').textContent(),/Unsupported/);await apply();
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.waitForFunction(()=>{const c=document.getElementById('rig');return c.width===Math.round(c.clientWidth*devicePixelRatio);});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('bike-mobile-'+width);}
  // Receive the rider model through real workers, exported samples and saved setup migration.
  await page.setViewportSize({width:1440,height:1100});
  assert.equal(await page.locator('[name=riderMass]').isDisabled(),true);
  await page.locator('[name=rider]').selectOption('compliant');
  await page.locator('#riderSettings summary').click();
  assert.equal(await page.locator('[name=riderMass]').isDisabled(),false);
  for(const bike of ['full','hardtail']) {
    await page.locator('[name=bike]').selectOption(bike);await apply();
    const {path,record}=await exportRun('rider-'+bike),node=await runRig(record.params);
    assert.equal(record.status,'complete');assert.equal(record.dofs,bike==='full'?5:4);
    let max=0;for(const [key,values] of Object.entries(record.signals))for(let i=0;i<values.length;i++){
      const error=Math.abs(values[i]-node.signals[key][i]);max=Math.max(max,error);assert.ok(error<1e-8,`${bike} rider ${key} ${i}: ${error}`);
    }
    report.exports.push({name:'rider-'+bike,result:{dofs:record.dofs,samples:record.signals.time.length,maxBrowserNodeDifference:max,summary:record.summary}});
    await page.locator('#scrub').fill('240');await shot('rider-'+bike+'-desktop');
    await page.locator('#load').setInputFiles(path);await ready();assert.equal(await page.locator('[name=rider]').inputValue(),'compliant');
  }
  const sag=await page.locator('#riderCompression').textContent();
  await page.locator('[name=riderMass]').fill('60');await apply();assert.notEqual(await page.locator('#riderCompression').textContent(),sag);
  await page.locator('[name=riderMass]').fill('80');await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent==='SETUP REJECTED');assert.match(await page.locator('#error').textContent(),/5 kg/);
  await page.locator('[name=riderMass]').fill('70');await page.locator('[name=riderTravel]').fill('.02');await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent==='SETUP REJECTED');assert.match(await page.locator('#error').textContent(),/Rider travel/);
  await page.locator('[name=riderTravel]').fill('.059');await apply();assert.equal(await page.locator('#status').textContent(),'TRAVEL LIMIT');
  assert.match(await page.locator('#termination').textContent(),/Rider travel limit/);await shot('rider-limit');
  const stoppedRider=await exportRun('rider-limit'),stoppedReference=await runRig(stoppedRider.record.params);
  assert.equal(stoppedRider.record.termination.lastValidTime,stoppedReference.termination.lastValidTime);
  await page.locator('[name=riderTravel]').fill('.15');await apply();
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    await page.waitForFunction(()=>['rig','loads','travel','riderTravelPlot','riderForcePlot'].every(id=>{const c=document.getElementById(id);return c.width===Math.round(c.clientWidth*devicePixelRatio);}));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('rider-mobile-'+width);
  }
  const legacy=JSON.parse(await readFile(join(dir,'bike-hardtail.json'),'utf8'));legacy.model='bikelab-planar-rig-0.1';legacy.params.dt=.0001;
  for(const key of Object.keys(legacy.params))if((GEOMETRY_KEYS.includes(key)||key.startsWith('rider')||(key.startsWith('forkBuffer')||key.startsWith('shockBuffer'))))delete legacy.params[key];
  const legacyPath=join(dir,'bike-legacy.json');await writeFile(legacyPath,JSON.stringify(legacy));
  await page.locator('#load').setInputFiles(legacyPath);await ready();
  assert.equal(await page.locator('[name=rider]').inputValue(),'fixed');assert.equal(await page.locator('[name=riderMass]').isDisabled(),true);
  assert.equal(await page.locator('#riderForce').textContent(),'Not resolved');assert.equal(await page.locator('[name=dt]').inputValue(),'0.0001');
  // Fork buffer receiving experiment and unbuffered control use identical forcing.
  await page.setViewportSize({width:1440,height:1100});await page.locator('#bufferExample').click();await ready();
  assert.equal(await page.locator('#status').textContent(),'READY');
  await page.locator('#bufferSettings summary').click();assert.equal(await page.locator('[name=forkBufferWidth]').isDisabled(),false);
  const buffered=await exportRun('fork-buffers'),bufferNode=await runRig(buffered.record.params);
  assert.ok(buffered.record.summary.peakTopForce>100);
  let bufferDifference=0;for(const [key,values] of Object.entries(buffered.record.signals))for(let i=0;i<values.length;i++){const difference=Math.abs(values[i]-bufferNode.signals[key][i]);bufferDifference=Math.max(bufferDifference,difference);assert.ok(difference<1e-8,key);}
  report.exports.push({name:'fork-buffers',result:{maxBrowserNodeDifference:bufferDifference,summary:buffered.record.summary}});
  const peakIndex=buffered.record.signals.forkTopForce.indexOf(Math.max(...buffered.record.signals.forkTopForce));
  await page.locator('#scrub').fill(String(peakIndex));assert.equal(await page.locator('#bufferState').textContent(),'Top-out');await shot('fork-buffers-desktop');
  await page.locator('[name=forkBuffer]').selectOption('none');await apply();assert.equal(await page.locator('#status').textContent(),'TRAVEL LIMIT');assert.equal(await page.locator('[name=forkBufferWidth]').isDisabled(),true);
  await page.locator('#load').setInputFiles(buffered.path);await ready();assert.equal(await page.locator('[name=forkBuffer]').inputValue(),'progressive');
  await page.locator('[name=forkBufferWidth]').fill('.005');await page.locator('[name=forkBufferStiffness]').fill('50000');await page.locator('[name=forkBufferDamping]').fill('0');await apply();assert.equal(await page.locator('#status').textContent(),'TRAVEL LIMIT');await shot('fork-buffers-ultimate');
  await page.locator('#bottomBufferExample').click();await ready();const bottom=await exportRun('fork-bottom-buffer'),bottomNode=await runRig(bottom.record.params);assert.ok(bottom.record.summary.peakBottomForce>100);for(const [key,values] of Object.entries(bottom.record.signals))for(let i=0;i<values.length;i++)assert.ok(Math.abs(values[i]-bottomNode.signals[key][i])<1e-8,key);const bottomIndex=bottom.record.signals.forkBottomForce.indexOf(Math.max(...bottom.record.signals.forkBottomForce));await page.locator('#scrub').fill(String(bottomIndex));assert.equal(await page.locator('#bufferState').textContent(),'Bottom-out');await shot('fork-bottom-buffer-desktop');
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.waitForFunction(()=>['bufferForcePlot','bufferEnergyPlot'].every(id=>{const c=document.getElementById(id);return c.width===Math.round(c.clientWidth*devicePixelRatio);}));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('fork-buffers-mobile-'+width);}
  await page.setViewportSize({width:1440,height:1100});
  for(const [id,channel,state] of [['shockTopExample','shockTopForce','Top-out'],['shockBottomExample','shockBottomForce','Bottom-out']]){
    await page.locator('#'+id).click();await ready();assert.equal(await page.locator('#status').textContent(),'READY');
    const saved=await exportRun(id),node=await runRig(saved.record.params);let max=0;
    for(const [key,values] of Object.entries(saved.record.signals))for(let i=0;i<values.length;i++){const error=Math.abs(values[i]-node.signals[key][i]);max=Math.max(max,error);assert.ok(error<1e-8,key);}
    const values=saved.record.signals[channel],peak=values.indexOf(Math.max(...values));assert.ok(values[peak]>100);
    await page.locator('#scrub').fill(String(peak));assert.equal(await page.locator('#shockBufferState').textContent(),state);await shot(id+'-desktop');
    await page.locator('#load').setInputFiles(saved.path);await ready();assert.equal(await page.locator('[name=shockBuffer]').inputValue(),'progressive');
    report.exports.push({name:id,result:{maxBrowserNodeDifference:max,summary:saved.record.summary}});
  }
  await page.locator('[name=bike]').selectOption('hardtail');assert.equal(await page.locator('[name=shockBuffer]').isDisabled(),true);assert.equal(await page.locator('[name=shockBufferWidth]').isDisabled(),true);await apply();assert.equal(await page.locator('#shockBufferForce').textContent(),'No shock');assert.equal(await page.locator('#shockTotal').textContent(),'No shock');
  await page.locator('#shockBottomExample').click();await ready();await page.locator('#shockBufferSettings summary').click();assert.equal(await page.locator('[name=shockBufferWidth]').isDisabled(),false);
  await page.locator('[name=shockBuffer]').selectOption('none');assert.equal(await page.locator('[name=shockBufferWidth]').isDisabled(),true);await apply();await page.locator('#shockBottomExample').click();await ready();
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.waitForFunction(()=>['shockBufferForcePlot','shockBufferEnergyPlot'].every(id=>{const c=document.getElementById(id);return c.width===Math.round(c.clientWidth*devicePixelRatio);}));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('shock-buffers-mobile-'+width);}
  report.checks.push('shock buffers: both end presets, worker/headless signals, engagement, save/load, dormant hardtail controls, disabled settings, responsive plots and lifecycle');
  report.checks.push('fork buffers: supported top/bottom loading; real worker/headless parity; unbuffered control and weak-buffer ultimate termination; setup reconstruction, engagement display and responsive plots');
  report.checks.push('rider: both compliant assemblies; exact setup restoration and explicit v0.1 fixed migration; browser/Node channels; mass control; invalid mass budget; settling and dynamic rider travel rejection; signed plots; five-canvas lifecycle and mobile recovery');
  report.checks.push('bicycle: both actual assemblies; WASM worker under Pages path; browser/Node sample agreement; setup save/load; replay; dirty/cancel/rejection and travel-limit handling; mobile and page lifecycle');
  await page.setViewportSize({width:1440,height:1100});await page.locator('#riderStopExample').click();await ready();assert.equal(await page.locator('#status').textContent(),'READY');
  if(!await page.locator('#riderSettings').evaluate(e=>e.open))await page.locator('#riderSettings summary').click();
  assert.equal(await page.locator('[name=riderBufferWidth]').isDisabled(),false);
  for(const bike of ['full','hardtail']){
    await page.locator('[name=bike]').selectOption(bike);await apply();const saved=await exportRun('rider-stops-'+bike),node=await runRig(saved.record.params);assert.equal(saved.record.status,'complete');let max=0;
    for(const [key,values] of Object.entries(saved.record.signals))for(let i=0;i<values.length;i++){const e=Math.abs(values[i]-node.signals[key][i]);max=Math.max(max,e);assert.ok(e<1e-8,key);}
    for(const [channel,state] of [['riderLowerForce','Lower stop'],['riderUpperForce','Upper stop']]){const values=saved.record.signals[channel];assert.ok(Math.max(...values)>20);await page.locator('#scrub').fill(String(values.indexOf(Math.max(...values))));assert.equal(await page.locator('#riderForce').textContent(),saved.record.signals.riderTotalForce[values.indexOf(Math.max(...values))].toFixed(1)+' N');assert.match(await page.locator('#riderStopState').textContent(),new RegExp(state));await shot('rider-stops-'+bike+'-'+state.split(' ')[0]);}
    await page.locator('#load').setInputFiles(saved.path);await ready();assert.equal(await page.locator('[name=riderBuffer]').inputValue(),'progressive');
    report.exports.push({name:'rider-stops-'+bike,result:{maxBrowserNodeDifference:max,summary:saved.record.summary}});
  }
  await page.locator('[name=riderBufferWidth]').fill('.03');await page.locator('button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='SETUP REJECTED');assert.match(await page.locator('#error').textContent(),/overlap/);
  await page.locator('#riderStopExample').click();await ready();await page.locator('[name=riderBufferWidth]').fill('.002');await page.locator('[name=riderBufferStiffness]').fill('50000');await page.locator('[name=riderBufferDamping]').fill('0');await apply();assert.equal(await page.locator('#status').textContent(),'TRAVEL LIMIT');assert.match(await page.locator('#termination').textContent(),/Rider travel limit/);await shot('rider-stops-ultimate');
  await page.locator('#riderStopExample').click();await ready();await page.locator('[name=rider]').selectOption('fixed');assert.equal(await page.locator('[name=riderBuffer]').isDisabled(),true);assert.equal(await page.locator('[name=riderBufferWidth]').isDisabled(),true);await apply();assert.match(await page.locator('#attachmentLoads').textContent(),/unresolved/);
  await page.locator('#riderStopExample').click();await ready();await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.waitForFunction(()=>['riderGuidePlot','attachmentForcePlot','riderStopForcePlot','riderStopEnergyPlot'].every(id=>{const c=document.getElementById(id);return c.width===Math.round(c.clientWidth*devicePixelRatio);}));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('rider-stops-mobile-'+width);}
  report.checks.push('rider stops and loads: both assemblies, lower/upper engagement, worker/headless parity, record reconstruction, invalid overlapping zones, weak-stop ultimate termination, fixed-mode dormancy, responsive plots and lifecycle');
}

// Shared by the full station suite and the focused local receiving command.
export async function checkGeometryLabels({page,dir,report}) {
  const ready=()=>page.waitForFunction(()=>['READY','TRAVEL LIMIT'].includes(document.getElementById('status').textContent));
  const shot=async name=>{await page.locator('section.panel:has(#geometryName)').screenshot({path:join(dir,name+'.png')});report.screenshots.push(name+'.png');};
  const exportRun=async name=>{const pending=page.waitForEvent('download');await page.locator('#save').click();const download=await pending,path=join(dir,name+'.json');await download.saveAs(path);return {path,record:JSON.parse(await readFile(path,'utf8'))};};
  const apply=async()=>{await page.locator('button[type=submit]').click();await ready();};
  if(!await page.locator('#geometrySettings').evaluate(element=>element.open))await page.locator('#geometrySettings summary').click();
  await page.locator('#annotatedGeometry').click();await ready();
  const annotated=await exportRun('geometry-annotated-label');
  const rounded=structuredClone(annotated.record);
  rounded.params.shockFrameX+=Number.EPSILON;
  assert.notEqual(rounded.params.shockFrameX,annotated.record.params.shockFrameX);
  await page.locator('#load').setInputFiles({name:'rounded-geometry.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(rounded))});await ready();
  assert.match(await page.locator('#geometryName').textContent(),/Annotated/);
  assert.equal(Number(await page.locator('[name=shockFrameX]').inputValue()),rounded.params.shockFrameX);
  const roundedExport=await exportRun('geometry-rounded-label');
  assert.equal(roundedExport.record.params.shockFrameX,rounded.params.shockFrameX);
  await page.locator('#load').setInputFiles(roundedExport.path);await ready();
  assert.match(await page.locator('#geometryName').textContent(),/Annotated/);await shot('geometry-rounded-label');
  await page.locator('[name=shockFrameX]').fill(String(annotated.record.params.shockFrameX+1e-12));await apply();
  assert.match(await page.locator('#geometryName').textContent(),/Custom/);
  await page.locator('#annotatedGeometry').click();await ready();
  report.checks.push('geometry labels: rounded derived coordinates survive import/export/reload without snapping; a nearby custom edit remains custom');
}
