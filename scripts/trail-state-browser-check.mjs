import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {replay} from '../dist/trail-bike.js';
import {STATE_MODEL} from '../dist/trail-initial-state.js';

export async function checkTrailState({page,root,dir,report}){
 dir=join(dir,'trail-bike');await mkdir(dir,{recursive:true});
 const ready=()=>page.waitForFunction(()=>['COMPLETED','TERMINATED','INITIAL STATE REJECTED'].includes(document.getElementById('status').textContent),null,{timeout:120000});
 const apply=async a=>{await page.locator('#setupText').fill(JSON.stringify(a));await page.locator('#applyJson').click();await ready();};
 const shot=async name=>{await page.screenshot({path:join(dir,name+'.png'),fullPage:true});report.screenshots.push('trail-bike/'+name+'.png');};
 const agreement=[];
 const save=async name=>{
  const pending=page.waitForEvent('download');await page.locator('#save').click();const path=join(dir,name+'.json');await (await pending).saveAs(path);
  const value=JSON.parse(await readFile(path,'utf8')),expected=await replay(value);let maxAbsolute=0;
  const compare=(a,b,where='record')=>{
   if(typeof b==='number'){assert.ok(Number.isFinite(a),where);const delta=Math.abs(a-b);maxAbsolute=Math.max(maxAbsolute,delta);assert.ok(delta<=1e-9*Math.max(1,Math.abs(b)),where);}
   else if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a),Object.keys(b),where);for(const key of Object.keys(b))compare(a[key],b[key],where+'.'+key);}
   else assert.equal(a,b,where);
  };compare(value,expected);agreement.push({name,maxAbsolute});return {path,value};
 };
 const launchFields=['velocityX','clearance','forkCompression','omega'];
 for(const bike of ['full','hardtail']){
  await page.setViewportSize({width:1440,height:1100});await page.goto(root+'trail-bike.html');await ready();
  await page.locator('[name=bike]').selectOption(bike);await page.locator('#example').selectOption('rider-state');await ready();
  const launch=(await save(bike+'-state-launch')).value;assert.equal(launch.model,STATE_MODEL);assert.equal(launch.status,'completed');
  assert.ok(await page.locator('#restartState').isEnabled());await page.locator('#restartState').click();await ready();
  const fresh=await save(bike+'-state-restart'),r=fresh.value;assert.ok(r.frames.length);assert.equal(r.scenario.initialization.mode,'state');
  assert.deepEqual(r.initialState,launch.finalState);assert.equal(r.frames[0].time,0);assert.equal(r.frames[0].constraintWork,0);assert.equal(r.frames[0].residual,0);
  assert.equal(r.summary.initialEnergy,r.frames[0].energy);assert.match(await page.locator('#initializationStatus').textContent(),/Supplied complete/);
  for(const key of launchFields){assert.ok(await page.locator('[name='+key+']').isDisabled());assert.equal(await page.locator('[name='+key+']').inputValue(),'');}
  await shot(bike+'-state-restart');
  await page.locator('details summary').click();const invalid=structuredClone(r.scenario);invalid.initialization.state.joints.find(j=>j.name==='pitch').position=.4;
  await apply(invalid);const rejected=(await save(bike+'-state-rejected')).value;assert.equal(rejected.status,'initial-state-rejected');assert.equal(rejected.frames.length,0);
  assert.match(await page.locator('#initializationStatus').textContent(),/Supplied complete.*not admitted/);assert.ok(await page.locator('#restartState').isDisabled());await shot(bike+'-state-rejected');
  await page.locator('#load').setInputFiles(fresh.path);await ready();assert.deepEqual((await save(bike+'-state-reimport')).value,r);
  await page.locator('[name=duration]').fill('.02');assert.ok(await page.locator('#restartState').isDisabled());await page.locator('[name=rider]').selectOption('compliant');
  for(const key of launchFields){assert.ok(await page.locator('[name='+key+']').isEnabled());assert.ok(Number.isFinite(Number(await page.locator('[name='+key+']').inputValue())));assert.notEqual(await page.locator('[name='+key+']').inputValue(),'');}
  assert.equal(await page.locator('[name=duration]').inputValue(),'0.02');await page.locator('#restore').click();
  for(const key of launchFields)assert.ok(await page.locator('[name='+key+']').isDisabled());assert.ok(await page.locator('#restartState').isEnabled());
  await page.setViewportSize({width:320,height:844});await page.waitForTimeout(50);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot(bike+'-state-mobile');
 }
 report.trailState={normalizedTolerance:1e-9,agreement};
 report.checks.push('Complete state on both bikes: canonical launch, fresh final-state restart and ledgers, supplied-state export/import parity, rejected-state provenance, disabled launch controls, pending mode conversion and restore, 320 px layout. No equilibrium claim.');
}
