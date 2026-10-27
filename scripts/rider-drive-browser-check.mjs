import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {replay,activePreset} from '../dist/trail-bike.js';
import {TYRE_MOTION_MODEL} from '../dist/tyre-motion.js';
import {ACTIVE_MODEL} from '../dist/rider-drive.js';
import {compareCanonicalTrailRecord} from './trail-section-browser-check.mjs';

export async function checkRiderDrive({page,root,dir,report}){
 const prefix='rider-drive';dir=join(dir,prefix);await mkdir(dir,{recursive:true});const cases=[];
 const ready=()=>page.waitForFunction(()=>document.getElementById('status').textContent==='COMPLETED',null,{timeout:180000});
 const capture=async name=>{await page.locator('#riderDrive').screenshot({path:join(dir,name+'.png')});report.screenshots.push(prefix+'/'+name+'.png');};
 await page.setViewportSize({width:1440,height:1100});await page.goto(root+'trail-bike.html');await ready();
 for(const bike of ['full','hardtail']){
  await page.locator('[name=bike]').selectOption(bike);await page.locator('#example').selectOption('rider-hold');await ready();
  assert.ok(await page.locator('#riderDrive').isVisible());assert.match(await page.locator('#riderSupportNote').innerText(),/Bounded internal joint effort/);
  const pending=page.waitForEvent('download');await page.locator('#save').click();const path=join(dir,bike+'.json');await (await pending).saveAs(path);
  const actual=JSON.parse(await readFile(path,'utf8')),expected=await replay(actual),agreement=compareCanonicalTrailRecord(actual,expected);
  assert.equal(actual.model,ACTIVE_MODEL);assert.equal(actual.status,'completed');assert.ok(Math.abs(actual.summary.riderWork)>1);
  assert.deepEqual(JSON.parse(await page.locator('#setupText').inputValue()).active,actual.scenario.active);
  await page.locator('#scrub').fill(String(actual.frames.length-1));await capture(bike+'-desktop');
  await page.locator('#rig').screenshot({path:join(dir,bike+'-rig.png')});report.screenshots.push(prefix+'/'+bike+'-rig.png');
  assert.match(await page.locator('#riderDriveWork').innerText(),/Rider work/);assert.match(await page.locator('#riderDriveRates').innerText(),/tyre and suspension/);
  if(bike==='full')for(const width of [390,320]){await page.setViewportSize({width,height:1100});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await capture('full-'+width);}
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('#inspectTyres').click();await ready();
  assert.ok(await page.locator('#tyreMotion').isVisible());
  assert.equal(await page.locator('#forceAxis').inputValue(),'tyre-node0');
  assert.match(await page.locator('#tyreMotionStatus').innerText(),/125.0 µs/);
  const tyrePending=page.waitForEvent('download');await page.locator('#save').click();const tyrePath=join(dir,bike+'-tyre.json');await (await tyrePending).saveAs(tyrePath);
  const tyreRecord=JSON.parse(await readFile(tyrePath,'utf8'));assert.equal(tyreRecord.model,TYRE_MOTION_MODEL);assert.equal(tyreRecord.frames.length,161);
  assert.deepEqual(tyreRecord.initialState,actual.finalState);const tyreAgreement=compareCanonicalTrailRecord(tyreRecord,await replay(tyreRecord));
  await page.locator('#scrub').fill(String(tyreRecord.frames.length-1));
  await page.locator('#tyreMotion').screenshot({path:join(dir,bike+'-tyre-desktop.png')});report.screenshots.push(prefix+'/'+bike+'-tyre-desktop.png');
  await page.locator('#history').screenshot({path:join(dir,bike+'-tyre-history.png')});report.screenshots.push(prefix+'/'+bike+'-tyre-history.png');
  for(const channel of ['tyre-rms','tyre-edge','z'])await page.locator('#forceAxis').selectOption(channel);
  if(bike==='full')for(const width of [390,320]){
   await page.setViewportSize({width,height:1100});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await page.locator('#riderDrive th').evaluateAll(cells=>cells.every(c=>c.scrollWidth<=c.clientWidth)),true);
   await page.locator('#tyreMotion').screenshot({path:join(dir,'full-tyre-'+width+'.png')});report.screenshots.push(prefix+'/full-tyre-'+width+'.png');
  }
  await page.setViewportSize({width:1440,height:1100});
  // Mode edits remove active drive before the legacy consumer executes.
  await page.locator('[name=rider]').selectOption('compliant');await page.locator('[name=duration]').fill('.02');await page.locator('#setup button[type=submit]').click();await ready();
  assert.ok(await page.locator('#riderDrive').isHidden());assert.equal(Object.hasOwn(JSON.parse(await page.locator('#setupText').inputValue()),'active'),false);
  assert.ok(await page.locator('#tyreMotion').isHidden());assert.ok(await page.locator('#inspectTyres').isDisabled());
  assert.equal(Object.hasOwn(JSON.parse(await page.locator('#setupText').inputValue()),'diagnostics'),false);
  cases.push({bike,status:actual.status,steps:actual.summary.steps,riderWork:actual.summary.riderWork,agreement,tyreProbe:{status:tyreRecord.status,steps:tyreRecord.summary.steps,agreement:tyreAgreement}});
 }
 // Authored drive settings survive JSON normalization; invalid controls fail visibly.
 const authored=activePreset('full');authored.motion.duration=.02;
 await page.locator('#scenarioEditor').evaluate(el=>{el.open=true;});await page.locator('#setupText').fill(JSON.stringify(authored));await page.locator('#applyJson').click();await ready();
 authored.active={joints:{hip:{maxTorque:-1}}};await page.locator('#setupText').fill(JSON.stringify(authored));await page.locator('#applyJson').click();
 assert.match(await page.locator('#error').innerText(),/maxTorque/);assert.ok(await page.locator('#save').isDisabled());
 // Long-horizon selection exposes truthful progress and remains cancellable.
 await page.locator('#example').selectOption('rider-hold-long');await page.waitForFunction(()=>!document.getElementById('calculationPanel').hidden);
 assert.equal(await page.locator('[name=duration]').getAttribute('max'),'10');
 await page.locator('#cancel').click();assert.ok(await page.locator('#save').isDisabled());
 report.riderDrive={cases,scope:'Actual worker, full-record replay, active readouts, mobile layout, JSON admission, legacy mode transition and long-probe cancellation. Also receives short fresh-state tyre diagnostics, dense observations, unchanged native identity, plots and mode cleanup. No equilibrium or calibrated active rider claim.'};
 report.checks.push('Active rider hold on both bikes: full browser/headless records, target/torque/work readouts, mobile panels and lifecycle controls.');
 await writeFile(join(dir,'report.json'),JSON.stringify(report.riderDrive,null,2)+'\n');
}
