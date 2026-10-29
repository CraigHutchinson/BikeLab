import {riderLoadSample} from '../dist/rider-loads.js';
import {summarizeRiderTracking,compareRiderTransfers} from '../dist/rider-transfer.js';
import {TARGET_MODEL} from '../dist/rider-targets.js';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {replay,activePreset} from '../dist/trail-bike.js';
import {TYRE_MOTION_MODEL} from '../dist/tyre-motion.js';
import {TYRE_WINDOW_MODEL} from '../dist/tyre-window.js';
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
  // Rerun the original launch and add a late window without resetting native history.
  await page.locator('#scenarioEditor').evaluate(el=>{el.open=true;});await page.locator('#setupText').fill(JSON.stringify(actual.scenario));await page.locator('#applyJson').click();await ready();
  await page.locator('#observeTyreWindow').click();await ready();
  assert.match(await page.locator('#tyreMotionStatus').innerText(),/Uninterrupted run.*0.4800 to 0.5000/);
  const windowPending=page.waitForEvent('download');await page.locator('#save').click();const windowPath=join(dir,bike+'-window.json');await (await windowPending).saveAs(windowPath);
  const windowRecord=JSON.parse(await readFile(windowPath,'utf8'));assert.equal(windowRecord.model,TYRE_WINDOW_MODEL);assert.deepEqual(windowRecord.finalState,actual.finalState);
  const windowAgreement=compareCanonicalTrailRecord(windowRecord,await replay(windowRecord));
  await page.locator('#scrub').fill(String(windowRecord.frames.length-1));
  for(const [selector,suffix] of [['#tyreMotion','window-panel'],['#history','window-history']]){await page.locator(selector).screenshot({path:join(dir,bike+'-'+suffix+'.png')});report.screenshots.push(prefix+'/'+bike+'-'+suffix+'.png');}
  if(bike==='full'){await page.setViewportSize({width:320,height:1100});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('#tyreMotion').screenshot({path:join(dir,'full-window-320.png')});report.screenshots.push(prefix+'/full-window-320.png');await page.setViewportSize({width:1440,height:1100});}
  await page.locator('#restartTyreWindow').click();await ready();assert.match(await page.locator('#tyreMotionStatus').innerText(),/fresh-state probes reset/);
  assert.ok(await page.locator('#restartTyreWindow').isDisabled());
  const freshPending=page.waitForEvent('download');await page.locator('#save').click();const freshPath=join(dir,bike+'-window-fresh.json');await (await freshPending).saveAs(freshPath);
  const freshRecord=JSON.parse(await readFile(freshPath,'utf8'));assert.deepEqual(freshRecord.initialState,windowRecord.windowObservation.start.state);
  const freshAgreement=compareCanonicalTrailRecord(freshRecord,await replay(freshRecord));
  await page.locator('#example').selectOption('rider-targets');await ready();
  assert.ok(await page.locator('#restartState').isDisabled());assert.ok(await page.locator('#inspectTyres').isDisabled());assert.ok(await page.locator('#observeTyreWindow').isDisabled());
  const targetPending=page.waitForEvent('download');await page.locator('#save').click();const targetPath=join(dir,bike+'-targets.json');await (await targetPending).saveAs(targetPath);
  const targetRecord=JSON.parse(await readFile(targetPath,'utf8'));assert.equal(targetRecord.model,TARGET_MODEL);
  const targetAgreement=compareCanonicalTrailRecord(targetRecord,await replay(targetRecord));
  await page.locator('#scrub').fill(String(targetRecord.frames.length-1));
  assert.match(await page.locator('#riderTargetStatus').innerText(),/recover.*Actual hip.*Target \/ actual frame-local rider COM/);
  await capture(bike+'-targets-desktop');
  for(const width of [390,320]){await page.setViewportSize({width,height:1100});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await capture(bike+'-targets-'+width);}
  await page.setViewportSize({width:1440,height:1100});
  const transfers=[];
  for(const example of ['rider-transfer-control','rider-transfer']){
   await page.locator('#example').selectOption(example);await ready();
   const pending=page.waitForEvent('download');await page.locator('#save').click();const path=join(dir,bike+'-'+example+'.json');await (await pending).saveAs(path);
   const record=JSON.parse(await readFile(path,'utf8')),agreement=compareCanonicalTrailRecord(record,await replay(record)),tracking=summarizeRiderTracking(record);
   assert.equal(record.status,'completed');assert.equal(tracking.phases.length,5);assert.ok(tracking.phases.every(p=>p.complete));
   await page.locator('#scrub').fill(String(record.frames.length-1));
   assert.match(await page.locator('#riderTrackingSummary').innerText(),/recovery-hold.*Phase interval completed.*not a tracking or support pass/);
   const loads=riderLoadSample(record.scenario,record.frames.at(-1));
   assert.match(await page.locator('#riderLoadEffort').innerText(),/posture error \/ velocity damping.*knee.*before limits/);
   assert.ok(Math.abs(Number.parseFloat(await page.locator('#riderVerticalNet').innerText())-loads.netForce[2])<=.051);
   assert.ok(Math.abs(Number.parseFloat(await page.locator('#riderVerticalVelocity').innerText())-loads.comVelocity[2])<=.00051);
   await page.locator('#riderSupport').screenshot({path:join(dir,bike+'-'+example+'-loads.png')});report.screenshots.push(prefix+'/'+bike+'-'+example+'-loads.png');
   assert.ok(await page.locator('#restartState').isDisabled());await capture(bike+'-'+example);
   if(bike==='full'){await page.setViewportSize({width:320,height:1100});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await capture(bike+'-'+example+'-320');await page.setViewportSize({width:1440,height:1100});}
   transfers.push({record,agreement,tracking});
  }
  const transferComparison=compareRiderTransfers(transfers[1].record,transfers[0].record);
  // Mode edits remove active drive before the legacy consumer executes.
  await page.locator('[name=rider]').selectOption('compliant');await page.locator('[name=duration]').fill('.02');await page.locator('#setup button[type=submit]').click();await ready();
  assert.ok(await page.locator('#riderDrive').isHidden());assert.equal(Object.hasOwn(JSON.parse(await page.locator('#setupText').inputValue()),'active'),false);
  assert.ok(await page.locator('#tyreMotion').isHidden());assert.ok(await page.locator('#inspectTyres').isDisabled());
  assert.equal(Object.hasOwn(JSON.parse(await page.locator('#setupText').inputValue()),'diagnostics'),false);
  assert.equal(Object.hasOwn(JSON.parse(await page.locator('#setupText').inputValue()),'riderTargets'),false);
  cases.push({bike,heldTransfer:{cases:transfers.map(({agreement,tracking})=>({agreement,tracking})),comparison:transferComparison},targetSequence:{agreement:targetAgreement,status:targetRecord.status,riderWork:targetRecord.summary.riderWork},status:actual.status,steps:actual.summary.steps,riderWork:actual.summary.riderWork,agreement,tyreProbe:{status:tyreRecord.status,steps:tyreRecord.summary.steps,agreement:tyreAgreement},window:{agreement:windowAgreement,freshAgreement,startTick:windowRecord.windowObservation.start.tick}});
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
 report.riderDrive={cases,scope:'Actual worker, full-record replay, active readouts, mobile layout, JSON admission, legacy mode transition and long-probe cancellation. Also receives short fresh-state tyre diagnostics, dense observations, unchanged native identity, plots and mode cleanup. Also receives uninterrupted late windows, unchanged final state, window plots and fresh-start comparison controls. No equilibrium or calibrated active rider claim.'};
 report.checks.push('Matched hold and slow transfer/recovery on both bikes: phase summaries, full-record replay and mobile capture.');
 report.checks.push('Active rider hold on both bikes: full browser/headless records, timed target sequences and requested/actual hip/trunk/COM, target/torque/work readouts, mobile panels and lifecycle controls.');
 await writeFile(join(dir,'report.json'),JSON.stringify(report.riderDrive,null,2)+'\n');
}
