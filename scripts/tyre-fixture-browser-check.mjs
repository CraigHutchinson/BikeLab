import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {replay,MODEL,MEASURED_MODEL} from '../dist/tyre-fixture.js';
import {compareCanonicalTrailRecord} from './trail-section-browser-check.mjs';

export async function checkTyreFixture({page,root,dir,report}){
 const out=join(dir,'tyre-fixture');await mkdir(out,{recursive:true});const cases=[];
 const ready=()=>page.waitForFunction(()=>document.getElementById('status').textContent==='COMPLETED',null,{timeout:240000});
 const save=async name=>{const pending=page.waitForEvent('download');await page.locator('#save').click();const path=join(out,name+'.json');await (await pending).saveAs(path);const r=JSON.parse(await readFile(path,'utf8'));assert.ok([MODEL,MEASURED_MODEL].includes(r.model));const agreement=compareCanonicalTrailRecord(r,await replay(r));cases.push({name,agreement,status:r.status,steps:r.summary.steps});return r;};
 await page.setViewportSize({width:1440,height:1100});await page.goto(root+'tyre-fixture.html');await ready();
 for(const name of ['full-front','full-rear','hardtail-front','hardtail-rear']){
  await page.locator('#example').selectOption(name);assert.equal(await page.locator('#status').textContent(),'UNAPPLIED EDITS');assert.ok(await page.locator('#save').isDisabled());
  await page.locator('#calculate').click();await ready();const imported=await save(name+'-imported');assert.equal(imported.scenario.rates,'imported');assert.equal(imported.scenario.seed.source.wheel,name.split('-')[1]);
  await page.locator('#scrub').fill('160');assert.match(await page.locator('#time').textContent(),/0.02000/);await page.locator('#channel').selectOption('force');
  if(name==='full-front'){await page.locator('.rig').screenshot({path:join(out,'full-front-panel.png')});await page.locator('#history').screenshot({path:join(out,'full-front-force.png')});}
  await page.locator('#rates').selectOption('zero');assert.ok(await page.locator('#save').isDisabled());await page.locator('#calculate').click();await ready();const zero=await save(name+'-zero');assert.equal(zero.frames[0].kineticEnergy,0);assert.deepEqual(zero.frames[0].nodes,imported.frames[0].nodes);
 }
 await page.setViewportSize({width:320,height:844});
 // ResizeObserver redraw is asynchronous; wait for its observable result,
 // without assuming a busy CI runner completes it within a fixed 50 ms.
 await page.waitForFunction(()=>{const c=document.getElementById('rig');return c.clientWidth>0&&c.clientWidth<320&&c.height>0&&c.width===Math.round(c.getBoundingClientRect().width*devicePixelRatio)&&Math.abs(c.width/c.height-c.clientWidth/c.clientHeight)<.01;},null,{timeout:10000});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('.rig').screenshot({path:join(out,'hardtail-rear-320.png')});
 await page.setViewportSize({width:1440,height:1100});await page.locator('#sourceWheel').selectOption('rear');await page.locator('#load').setInputFiles(join(dir,'rider-drive','full-window.json'));await ready();const extracted=await save('loaded-window-rear');assert.equal(extracted.scenario.seed.source.wheel,'rear');assert.equal(extracted.scenario.seed.source.tick,15360);
 // Complete the existing 100 ms control at the finest step; retain exported
 // records and actual late-time captures independently of short-run evidence.
 for(const [name,rates] of [['full-front','imported'],['hardtail-rear','zero']]){
  await page.locator('#example').selectOption(name);await page.locator('#rates').selectOption(rates);await page.locator('#duration').selectOption('0.1');await page.locator('#dt').selectOption('0.0000078125');await page.locator('#calculate').click();await ready();
  const r=await save(name+'-100ms');assert.equal(r.summary.steps,12800);assert.equal(r.frames.length,201);assert.equal(r.scenario.motion.sampleDt,.0005);
  await page.locator('#scrub').fill('200');assert.match(await page.locator('#time').textContent(),/0.10000/);await page.locator('#channel').selectOption('rms');
  await page.locator('.rig').screenshot({path:join(out,name+'-100ms-panel.png')});await page.locator('#history').screenshot({path:join(out,name+'-100ms-rms.png')});
 }
 for(const [name,rates,duration] of [['full-front','imported',.5],['hardtail-rear','zero',5]]){
  await page.locator('#example').selectOption(name);await page.locator('#rates').selectOption(rates);await page.locator('#duration').selectOption(String(duration));assert.ok(await page.locator('#measure').isChecked());assert.ok(await page.locator('#measure').isDisabled());await page.locator('#dt').selectOption('0.00003125');await page.locator('#calculate').click();await ready();
  const r=await save(name+'-settling');assert.equal(r.model,MEASURED_MODEL);assert.equal(r.summary.steps,Math.round(duration/.00003125));assert.equal(r.observation.intervals.length,Math.round(duration/.1));assert.ok(r.frames.length<=600);assert.equal(r.observation.windowFrameIndices.length,161);assert.equal(await page.locator('#channel').inputValue(),'interval-rms');
  await page.locator('#scrub').fill(String(r.frames.length-1));assert.match(await page.locator('#intervalSummary').textContent(),/Every accepted physics step/);assert.equal(await page.locator('#time').textContent(),duration.toFixed(5)+' s');await page.locator('.rig').screenshot({path:join(out,name+'-settling-panel.png')});await page.locator('#history').screenshot({path:join(out,name+'-settling-intervals.png')});
  await page.locator('#historyScope').selectOption('window');assert.equal(await page.locator('#channel').inputValue(),'node');await page.locator('#history').screenshot({path:join(out,name+'-settling-window.png')});await page.locator('#channel').selectOption('interval-force');assert.equal(await page.locator('#historyScope').inputValue(),'all');
 }
 // Playwright 1.56 follows an option's enclosing label to its select for
 // isDisabled(). Inspect the option itself; the whole-run select stays enabled.
 await page.locator('#example').selectOption('full-front');await page.locator('#calculate').click();await ready();
 assert.equal(await page.locator('#historyScope option[value=window]').evaluate(option=>option.disabled),true);assert.ok(await page.locator('#historyScope').isEnabled());assert.equal(await page.locator('#historyScope').inputValue(),'all');assert.equal(await page.locator('#intervalSummary').textContent(),'');
 const legacy=await save('legacy-after-settling');assert.equal(legacy.model,MODEL);assert.equal(legacy.observation,undefined);assert.equal(legacy.scenario.measurement,undefined);
 const bad=structuredClone(extracted.scenario);bad.seed.hub.position[2]=.2;await page.locator('details').evaluate(el=>el.open=true);await page.locator('#setupText').fill(JSON.stringify(bad));await page.locator('#applyJson').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='INITIAL-STATE-REJECTED');assert.ok(await page.locator('#scrub').isDisabled());assert.match(await page.locator('#result').textContent(),/rim-contact/);
 await page.locator('#example').selectOption('full-front');await page.locator('#duration').selectOption('0.1');await page.locator('#dt').selectOption('0.0000078125');await page.locator('#calculate').click();await page.locator('#cancel').click();assert.equal(await page.locator('#status').textContent(),'CANCELLED');assert.ok(await page.locator('#save').isDisabled());await page.waitForTimeout(150);assert.equal(await page.locator('#status').textContent(),'CANCELLED');
 // A pending file read is cancellable, and cancelling does not prevent retrying
 // the very same file. The delayed read must not launch its obsolete worker.
 await page.evaluate(()=>{const text=File.prototype.text;File.prototype.text=function(){File.prototype.text=text;return new Promise((resolve,reject)=>{window.releaseFixtureRead=()=>text.call(this).then(resolve,reject);});};});
 const file={name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(extracted.scenario))};await page.locator('#load').setInputFiles(file);assert.equal(await page.locator('#status').textContent(),'READING FILE');assert.ok(await page.locator('#cancel').isEnabled());await page.locator('#cancel').click();await page.evaluate(()=>window.releaseFixtureRead());await page.waitForTimeout(100);assert.equal(await page.locator('#status').textContent(),'CANCELLED');await page.locator('#load').setInputFiles(file);await ready();
 // A stale examples-fetch parse failure cannot cancel a newer authored run.
 let releaseExamples,requestArrived;const arrived=new Promise(resolve=>requestArrived=resolve),released=new Promise(resolve=>releaseExamples=resolve);
 await page.route('**/tyre-fixture-examples.json',async route=>{requestArrived();await released;await route.fulfill({status:200,contentType:'application/json',body:'invalid json'});});
 await page.goto(root+'tyre-fixture.html',{waitUntil:'commit'});await arrived;await page.locator('details').evaluate(el=>el.open=true);await page.locator('#setupText').fill(JSON.stringify(extracted.scenario));await page.locator('#applyJson').click();releaseExamples();await ready();await page.unroute('**/tyre-fixture-examples.json');assert.equal(await page.locator('#error').textContent(),'');
 const receipt={cases,scope:'Actual worker, both wheels/bikes, imported/zero rates, full replay, JSON source-window extraction, rejected initial state, stale-result cancellation and inspected-later desktop/mobile captures. No equilibrium, calibration or performance claim.'};await writeFile(join(out,'report.json'),JSON.stringify(receipt,null,2)+'\n');report.tyreFixture=receipt;report.checks.push('Fixed-hub casing controls: all four loaded seeds, retained/zero rates, complete worker replay, source-window import and bounded empty/cancel lifecycle.');
}
