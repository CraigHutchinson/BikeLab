import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {replay,compareReplay} from '../dist/terrain-request.js';
export async function checkTerrainRequest({page,root,dir,report}){
  await page.setViewportSize({width:1440,height:1100});await page.goto(root+'terrain-request.html');
  const ready=()=>page.waitForFunction(()=>['READY','MISSING DATA','VERIFIED'].includes(document.getElementById('status').textContent));
  const shot=async name=>{await page.screenshot({path:join(dir,name+'.png'),fullPage:true});report.screenshots.push(name+'.png');};
  const save=async name=>{const pending=page.waitForEvent('download');await page.locator('#save').click();const download=await pending,path=join(dir,name+'.json');await download.saveAs(path);return {path,value:JSON.parse(await readFile(path,'utf8'))};};
  const agreement=[];
  await ready();const first=await save('terrain-request-straight');agreement.push(compareReplay(first.value,await replay('straight')));
  await page.locator('#scrub').fill('14');await shot('terrain-request-step');
  await page.locator('#reset').click();assert.match(await page.locator('#time').textContent(),/^0.00/);await page.locator('#step').click();assert.match(await page.locator('#time').textContent(),/^0.05/);
  await page.locator('#play').click();await page.waitForFunction(()=>parseFloat(document.getElementById('time').textContent)>.1);await page.locator('#play').click();
  const paused=await page.locator('#time').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('#time').textContent(),paused);
  for(const name of ['left','right','reverse','steer','missing']){
    await page.locator('#track').selectOption(name);assert.equal(await page.locator('#save').isDisabled(),true);await page.locator('#calculate').click();await ready();
    const saved=await save('terrain-request-'+name);agreement.push(compareReplay(saved.value,await replay(name)));
    if(name==='left'){await page.locator('#row').selectOption('0.13');await page.locator('#scrub').fill('2');await shot('terrain-request-off-centre');await page.locator('#cutMode').selectOption('cross');await shot('terrain-request-transverse');}
    if(name==='missing'){assert.equal(await page.locator('#status').textContent(),'MISSING DATA');assert.match(await page.locator('#detail').textContent(),/Movement held/);await shot('terrain-request-missing');}
  }
  await page.locator('#load').setInputFiles(first.path);await ready();assert.equal(await page.locator('#track').inputValue(),'straight');assert.equal(await page.locator('#status').textContent(),'VERIFIED');
  await page.locator('#load').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"format":"wrong"}')});await page.waitForFunction(()=>document.getElementById('status').textContent==='REJECTED');assert.equal(await page.locator('#save').isDisabled(),true);
  await page.locator('#latency').selectOption('150');await page.locator('#calculate').click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('WAITING'));await page.locator('#cancel').click();
  await page.waitForTimeout(400);assert.equal(await page.locator('#status').textContent(),'CANCELLED');assert.equal(await page.locator('#save').isDisabled(),true);
  await page.locator('#calculate').click();await page.locator('#track').selectOption('reverse');await page.locator('#latency').selectOption('0');await page.locator('#calculate').click();await ready();
  const latest=await save('terrain-request-after-cancel');assert.equal(latest.value.track,'reverse');agreement.push(compareReplay(latest.value,await replay('reverse')));
  await page.locator('#cutMode').selectOption('long');await page.locator('#row').selectOption('0.01');
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.waitForTimeout(50);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'terrain request horizontal overflow');await shot('terrain-request-mobile-'+width);}
  report.terrainRequest={agreement};
  report.checks.push('terrain R0a: six browser/Node replays with exact discrete identities and 1e-12 geometric tolerance; explicit missing-data stop; cut directions/rows; play/pause/rewind/scrub; export/verified import and invalid rejection; delayed wait/cancel/supersession; mobile 390/320');
}
