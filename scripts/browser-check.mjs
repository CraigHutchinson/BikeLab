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
