import {checkTrailBike} from './trail-bike-browser-check.mjs';
import {checkMovingWheel} from './moving-wheel-browser-check.mjs';
import {checkWheelLimits} from './wheel-limits-browser-check.mjs';
import {checkFootprint} from './footprint-browser-check.mjs';
import {checkTerrainRequest} from './terrain-request-browser-check.mjs';
import {checkBike} from './bike-browser-check.mjs';
// Optional development check. CI installs pinned Playwright separately from the application.
// NODE_PATH may select that install; BIKELAB_CHROMIUM may select a local Chromium executable.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../server.mjs';
import { verifyRecord } from './record-validation.mjs';
import { simulate as simulateSuspension } from '../dist/suspension.js';
import { compareSuspension, comparisonReport } from '../dist/suspension-reference.js';
import { fixture, probe } from '../dist/terrain.js';
import { runTrial, trialReport } from '../dist/solver-trial.js';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('playwright-core')); }
const dir=resolve(process.env.BIKELAB_ARTIFACTS || 'artifacts/browser');
await mkdir(dir,{recursive:true});
const report={checks:[],exports:[],screenshots:[],browser:null}, errors=[];
const server=createPreviewServer();
// Exercise actual HTTP/module-worker loading at a Pages-like subdirectory.
server.prependListener('request',req=>{
  if(req.url.startsWith('/BikeLab/'))req.url=req.url.slice('/BikeLab'.length);
});
let browser;
try {
  server.listen(0,'127.0.0.1');await once(server,'listening');
  browser=await chromium.launch({headless:true,executablePath:process.env.BIKELAB_CHROMIUM || undefined});
  report.browser=browser.version();
  const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
  const root='http://127.0.0.1:'+server.address().port+'/BikeLab/';
  const ready=()=>page.waitForFunction(()=>['READY','TRAVEL LIMIT'].includes(document.getElementById('status').textContent));
  const field=name=>page.locator(`[name="${name}"]`);
  const apply=async()=>{await page.locator('button[type="submit"]').click();await ready();};
  const shot=async name=>{await page.screenshot({path:join(dir,name+'.png'),fullPage:true});report.screenshots.push(name+'.png');};
  const exportRun=async name=>{
    const pending=page.waitForEvent('download');await page.locator('#save').click();
    const download=await pending;const path=join(dir,name+'.json');await download.saveAs(path);
    const text=await readFile(path,'utf8');report.exports.push({name,result:verifyRecord(text)});return path;
  };
  const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  await page.goto(root);await ready();
  await page.locator('#step').click();assert.equal(await page.locator('#time').textContent(),'0.005 s');
  await page.locator('#pin').click();await field('damping').fill('900');await apply();
  assert.match(await page.locator('#comparison').textContent(),/Pinned:/);
  await page.locator('#scrub').fill('250');await shot('wheel-desktop');
  const wheelFile=await exportRun('wheel-browser');
  await field('frequency').fill('3');await apply();
  assert.match(await page.locator('#comparison').textContent(),/Reference hidden/);
  await page.locator('#load').setInputFiles(wheelFile);await ready();
  assert.equal(await field('frequency').inputValue(),'2');
  await page.locator('.advanced summary').click();await field('lift').fill('200');await field('profile').selectOption('flat');await apply();
  await shot('wheel-high-lift');
  await page.setViewportSize({width:390,height:844});await noOverflow();await shot('wheel-mobile');
  report.checks.push('wheel: step, comparison gating, save/load, high lift, mobile width');

  await page.setViewportSize({width:1440,height:1100});await page.goto(root+'suspension.html');await ready();
  await shot('suspension-desktop');
  const initialFile=await exportRun('suspension-browser');
  await page.locator('#pin').click();await field('reboundDamping').fill('900.125');await apply();
  assert.match(await page.locator('#comparison').textContent(),/Pinned:/);
  await page.locator('#step').click();assert.equal(await page.locator('#time').textContent(),'0.0050 s');
  await page.locator('#speed').selectOption('.25');await page.locator('#play').click();
  await page.waitForFunction(()=>parseFloat(document.getElementById('time').textContent)>.02);
  await page.locator('#play').click();const paused=await page.locator('#time').textContent();
  await page.waitForTimeout(150);assert.equal(await page.locator('#time').textContent(),paused);
  await page.locator('#scrub').fill('100');assert.equal(await page.locator('#time').textContent(),'0.5000 s');
  await shot('suspension-comparison');
  await field('initialCompression').fill('80');await apply();assert.match(await page.locator('#comparison').textContent(),/Reference hidden/);
  await field('initialCompression').fill('300');await page.locator('button[type="submit"]').click();
  assert.equal(await page.locator('#status').textContent(),'SETUP REJECTED');
  assert.equal(await field('initialCompression').inputValue(),'300');
  assert.equal(await page.locator('#play').isDisabled(),true);await page.locator('#discard').click();
  await page.locator('#load').setInputFiles(initialFile);await ready();assert.equal(await field('reboundDamping').inputValue(),'650');
  await page.locator('#load').setInputFiles(wheelFile);
  await page.waitForFunction(()=>document.getElementById('status').textContent==='SETUP REJECTED');
  assert.match(await page.locator('#error').textContent(),/Unsupported suspension/);
  await page.locator('#load').setInputFiles(initialFile);await ready();
  report.checks.push('suspension: signed curves rendered, step/scrub/play/pause, pin gating, reject/discard, save/load and wrong-station rejection');

  await page.locator('.advanced summary').click();await field('duration').fill('30');await field('dt').fill('.01');
  const cancelled=await page.evaluate(()=>{
    document.getElementById('setup').requestSubmit();
    const busy=!document.getElementById('cancel').disabled;
    document.getElementById('cancel').click();
    return {busy,disabled:document.getElementById('cancel').disabled,error:document.getElementById('error').textContent};
  });
  assert.equal(cancelled.busy,true);assert.equal(cancelled.disabled,true);assert.match(cancelled.error,/cancelled/);
  await page.locator('#discard').click();
  await field('initialCompression').fill('0');await field('initialVelocity').fill('-1');await apply();
  assert.equal(await page.locator('#status').textContent(),'TRAVEL LIMIT');assert.equal(await page.locator('#play').isDisabled(),true);
  await exportRun('suspension-top-out');await shot('suspension-travel-limit');
  await page.locator('#shockPreset').click();assert.equal(await field('travel').inputValue(),'65');await apply();
  await exportRun('suspension-shock');
  await page.setViewportSize({width:390,height:844});await noOverflow();await shot('suspension-mobile');
  await page.setViewportSize({width:320,height:780});await noOverflow();await shot('suspension-narrow');
  report.checks.push('suspension: actual worker cancellation, immediate travel limit, shock preset, mobile/narrow width');

  await page.setViewportSize({width:1440,height:1100});
  await page.locator('#forkPreset').click();await apply();
  assert.equal(await page.locator('#referenceResult').textContent(),'UNAVAILABLE FOR THIS SETUP');
  assert.match(await page.locator('#referenceReason').textContent(),/equal compression/);
  await page.locator('#referenceSetup').click();await ready();
  assert.equal(await field('profile').inputValue(),'flat');
  assert.equal(await field('compressionDamping').inputValue(),await field('reboundDamping').inputValue());
  assert.equal(await page.locator('#referenceResult').textContent(),'WITHIN NUMERICAL LIMITS');
  assert.equal(await page.locator('.referenceLegend:visible').count(),2);
  const referenceFile=await exportRun('suspension-reference');
  const paired=compareSuspension(simulateSuspension(JSON.parse(await readFile(referenceFile,'utf8')).params));
  assert.equal(paired.status,'pass');
  const displayed=await page.locator('#referenceErrors').innerText();
  for(const [key,scale]of [['compression',1000],['compressionVelocity',1],['force',1]])
    assert.ok(displayed.includes((paired.errors[key].maxAbsolute*scale).toExponential(3)));
  report.referenceComparison=comparisonReport(paired);
  await page.locator('#scrub').fill('100');await shot('reference-desktop');
  await field('reboundDamping').fill('700');
  assert.equal(await page.locator('#referenceSetup').isDisabled(),true);
  await apply();
  assert.equal(await page.locator('#referenceResult').textContent(),'UNAVAILABLE FOR THIS SETUP');
  assert.equal(await page.locator('.referenceLegend:visible').count(),0);
  await page.locator('#load').setInputFiles(referenceFile);await ready();
  assert.equal(await page.locator('#referenceResult').textContent(),'WITHIN NUMERICAL LIMITS');
  await page.setViewportSize({width:390,height:844});await noOverflow();await shot('reference-mobile');
  report.checks.push('reference: explicit compatible setup, unsupported state, worker overlays, dirty gating, save/load and Node metric agreement');


  await page.setViewportSize({width:1440,height:1100});
  for(const [name,value]of Object.entries({mass:'1',stiffness:'200',preload:'0',initialCompression:'.09',
    compressionDamping:'0',reboundDamping:'0',duration:'4',dt:'.5'}))await field(name).fill(value);
  await apply();assert.equal(await page.locator('#referenceResult').textContent(),'EXCEEDS NUMERICAL LIMITS');
  await shot('reference-coarse-failure');
  await field('dt').fill('.25');await apply();
  assert.equal(await page.locator('#referenceResult').textContent(),'WITHIN NUMERICAL LIMITS');
  report.checks.push('reference: valid coarse integration fails declared limits; half-step refinement passes');

  await page.goto(root+'terrain.html');
  await page.waitForFunction(()=>document.getElementById('status').textContent==='GEOMETRIC OVERLAP');
  const geometry=probe(fixture(),{center:[-.2,.36],radius:.36});
  assert.equal(await page.locator('#gap').textContent(),(geometry.gap*1000).toFixed(2)+' mm');
  assert.equal(await page.locator('#witnesses tbody tr').count(),1);
  assert.match(await page.locator('#witnesses tbody').textContent(),/vertex 2/);
  // Navigation/hidden panels can temporarily have no drawable canvas area.
  await page.locator('#rig').evaluate(async canvas=>{
    canvas.style.display='none';window.dispatchEvent(new Event('resize'));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    canvas.style.display='block';canvas.style.width='20px';window.dispatchEvent(new Event('resize'));
    canvas.width=1;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    canvas.style.width='';
  });
  await page.waitForFunction(()=>{
    const c=document.getElementById('rig');return c.width===Math.round(c.clientWidth*devicePixelRatio);
  });
  assert.deepEqual(errors,[]);
  await shot('terrain-square-desktop');
  const pendingProbe=page.waitForEvent('download');await page.locator('#save').click();
  const probePath=join(dir,'terrain-probe.json');await (await pendingProbe).saveAs(probePath);
  const savedProbe=JSON.parse(await readFile(probePath,'utf8'));
  // Compare the complete profile, setup, witness geometry and diagnostics with Node.
  assert.deepEqual(savedProbe,geometry);report.terrainProbe=savedProbe;
  await page.locator('#fixture').selectOption('rounded');
  const rounded=probe(fixture('rounded'),geometry.setup);
  assert.equal(await page.locator('#gap').textContent(),(rounded.gap*1000).toFixed(2)+' mm');
  await shot('terrain-rounded-desktop');
  await field('x').fill('1');assert.equal(await page.locator('#save').isDisabled(),true);
  assert.equal(await page.locator('#position').isDisabled(),true);
  await page.locator('button[type="submit"]').click();
  assert.equal(await page.locator('#status').textContent(),'UNAVAILABLE');
  assert.match(await page.locator('#reason').textContent(),/domain/);
  assert.equal(await page.locator('#witnesses tbody tr').count(),0);
  await field('x').fill('0');await field('z').fill('0');await page.locator('button[type="submit"]').click();
  assert.equal(await page.locator('#status').textContent(),'UNAVAILABLE');
  await field('z').fill('.36');await page.locator('button[type="submit"]').click();
  await page.locator('details summary').click();
  await page.locator('#profileText').fill('{bad');await page.locator('#applyProfile').click();
  assert.equal(await page.locator('#status').textContent(),'INPUT REJECTED');
  assert.equal(await page.locator('#save').isDisabled(),true);
  await page.locator('#restoreProfile').click();
  assert.notEqual(await page.locator('#status').textContent(),'INPUT REJECTED');
  const valley={...fixture('flat'),points:[[-2,2],[0,0],[2,2]]};
  await page.locator('#profileText').fill(JSON.stringify(valley));await field('z').fill('1');
  await page.locator('#applyProfile').click();
  assert.equal(await page.locator('#count').textContent(),'2');
  assert.equal(await page.locator('#fixture').inputValue(),'custom');
  const profilePath=join(dir,'terrain-profile.json');await writeFile(profilePath,JSON.stringify(fixture('flat')));
  await page.locator('#load').setInputFiles(profilePath);
  await page.waitForFunction(()=>document.getElementById('count').textContent==='1');
  assert.equal(await page.locator('#gap').textContent(),'640.00 mm');
  await page.locator('#position').fill('0.25');assert.equal(await field('x').inputValue(),'0.25');
  // A late file read must not overwrite a newer position/profile edit.
  await page.evaluate(()=>{
    const original=File.prototype.text;
    File.prototype.text=function(){return new Promise(resolve=>{window.finishTerrainRead=()=>original.call(this).then(resolve);});};
    window.restoreTerrainRead=()=>{File.prototype.text=original;};
  });
  await page.locator('#load').setInputFiles(profilePath);
  await page.waitForFunction(()=>typeof window.finishTerrainRead==='function');
  await field('x').fill('-.2');
  await page.evaluate(async()=>{await window.finishTerrainRead();window.restoreTerrainRead();});
  assert.equal(await page.locator('#status').textContent(),'UNAPPLIED EDITS');
  await page.locator('button[type="submit"]').click();
  await field('z').fill('.36');await page.locator('button[type="submit"]').click();
  await page.locator('#fixture').selectOption('square');
  await page.locator('details summary').click();
  await page.setViewportSize({width:390,height:844});await noOverflow();await shot('terrain-mobile');
  await page.setViewportSize({width:320,height:780});await noOverflow();await shot('terrain-narrow');
  report.checks.push('terrain: hidden/small canvas recovery, square/rounded/flat, complete browser/Node report agreement, unavailable/buried states, edit gating, custom profile, load, stale-file guard, co-nearest supports and mobile widths');

  await page.setViewportSize({width:1440,height:1100});await page.goto(root+'solver.html');
  const trialReady=()=>page.waitForFunction(()=>['WITHIN TRIAL LIMITS','EXCEEDS TRIAL LIMITS'].includes(document.getElementById('status').textContent));
  await trialReady();assert.equal(await page.locator('#status').textContent(),'EXCEEDS TRIAL LIMITS');
  assert.match(await page.locator('#restart').textContent(),/Exact/);
  assert.match(await page.locator('#trialDetails').textContent(),/4 internal substeps of 125/);
  assert.match(await page.locator('#timestepNote').textContent(),/Smaller steps can increase error/);
  const trialDownload=page.waitForEvent('download');await page.locator('#save').click();
  const trialFile=join(dir,'solver-browser.json');await (await trialDownload).saveAs(trialFile);
  const savedTrial=JSON.parse(await readFile(trialFile,'utf8'));
  const nodeTrial=trialReport(await runTrial(savedTrial.params));
  const maxDifferences={};
  for(const key of Object.keys(savedTrial.signals)) {
    const a=savedTrial.signals[key],b=nodeTrial.signals[key];assert.equal(a.length,b.length);
    maxDifferences[key]=Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
    if(!key.startsWith('reference'))assert.deepEqual(a,b,'candidate '+key);
    else for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<=1e-12*Math.max(1,Math.abs(b[i])),'oracle '+key);
  }
  for(const key of Object.keys(savedTrial.errors))for(const field of ['maxAbsolute','rms','limit']) {
    const a=savedTrial.errors[key][field],b=nodeTrial.errors[key][field];
    assert.ok(Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(b)),'error metric '+key);
  }
  const metadata=({signals,errors,...rest})=>rest;assert.deepEqual(metadata(savedTrial),metadata(nodeTrial));
  report.solver={model:savedTrial.model,params:savedTrial.params,engine:savedTrial.engine,checks:savedTrial.checks,
    errors:savedTrial.errors,closure:savedTrial.closure,restart:savedTrial.restart,
    completeReportSha256:createHash('sha256').update(JSON.stringify(savedTrial)).digest('hex'),candidateBrowserNodeExact:true,oracleNormalizedTolerance:1e-12,maxAbsoluteBrowserNodeDifferences:maxDifferences};
  await page.locator('#step').click();assert.equal(await page.locator('#time').textContent(),'0.005 s');
  await page.locator('#play').click();await page.waitForFunction(()=>parseFloat(document.getElementById('time').textContent)>.03);
  await page.locator('#play').click();const trialPaused=await page.locator('#time').textContent();
  await page.waitForTimeout(150);assert.equal(await page.locator('#time').textContent(),trialPaused);
  await page.locator('#scrub').fill('100');await shot('solver-desktop');
  await field('dt').selectOption('0.000125');assert.equal(await page.locator('#save').isDisabled(),true);
  await page.locator('button[type="submit"]').click();await trialReady();
  assert.equal(await page.locator('#status').textContent(),'EXCEEDS TRIAL LIMITS');
  await page.locator('#equilibrium').click();await trialReady();assert.equal(await page.locator('#status').textContent(),'WITHIN TRIAL LIMITS');
  await shot('solver-equilibrium');
  await field('initialCompression').fill('0');await page.locator('button[type="submit"]').click();
  assert.equal(await page.locator('#status').textContent(),'SETUP REJECTED');assert.match(await page.locator('#error').textContent(),/envelope/);
  assert.equal(await page.locator('#play').isDisabled(),true);await page.locator('#discard').click();await trialReady();
  const trialCancelled=await page.evaluate(()=>{document.getElementById('setup').requestSubmit();const active=!document.getElementById('cancel').disabled;document.getElementById('cancel').click();return active;});
  assert.equal(trialCancelled,true);assert.match(await page.locator('#error').textContent(),/cancelled/);
  await page.locator('#release').click();await trialReady();
  await page.locator('#rig').evaluate(c=>{c.style.display='none';});await page.waitForTimeout(30);
  await page.locator('#rig').evaluate(c=>{c.style.display='';});await page.waitForTimeout(30);
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>{const c=document.getElementById('rig');return c.width===Math.round(c.clientWidth*devicePixelRatio);});
  await noOverflow();await shot('solver-mobile');
  await page.setViewportSize({width:320,height:780});await noOverflow();await shot('solver-narrow');
  report.checks.push('solver: real WASM module worker; exact candidate browser/Node channels with tolerance-checked analytical channels; release failure and static pass; refinement, replay, dirty/invalid gating, cancellation, restore, hidden canvas, page lifecycle resize recovery and mobile widths');

  await checkBike({page,root,dir,report});
  await checkTerrainRequest({page,root,dir,report});
  await checkFootprint({page,root,dir,report});
  await checkWheelLimits({page,root,dir,report});
  await checkMovingWheel({page,root,dir,report});
  await checkTrailBike({page,root,dir,report});

  // Pixel availability is separate from human inspection of captured images.
  const pixels=await page.locator('#rig').evaluate(canvas=>{
    const a=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let visible=0;for(let i=3;i<a.length;i+=4)if(a[i])visible++;return visible;
  });
  assert.ok(pixels>1000,'rig canvas is empty');assert.deepEqual(errors,[]);
  report.checks.push('no captured page/console errors; rig has rendered pixels');
} catch(error) {
  report.failure=error.stack;process.exitCode=1;
} finally {
  await writeFile(join(dir,'report.json'),JSON.stringify({...report,errors},null,2));
  if(browser)await browser.close();
  server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));
}
console.log(JSON.stringify(report,null,2));
