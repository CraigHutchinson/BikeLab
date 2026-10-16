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
  for(const key of Object.keys(legacy.params))if((key.startsWith('rider')||(key.startsWith('forkBuffer')||key.startsWith('shockBuffer'))))delete legacy.params[key];
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
}
