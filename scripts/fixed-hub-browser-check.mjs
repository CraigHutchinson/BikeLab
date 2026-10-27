import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {run} from '../dist/fixed-hub.js';
export async function checkFixedHub({page,root,dir,report}){
 const out=join(dir,'fixed-hub');await mkdir(out,{recursive:true});
 await page.setViewportSize({width:1440,height:1100});await page.goto(root+'fixed-hub.html');
 const ready=()=>page.waitForFunction(()=>['completed','terminated','Failed'].includes(document.getElementById('status').textContent),null,{timeout:60000});
 const save=async name=>{const download=page.waitForEvent('download');await page.locator('#save').click();const d=await download,path=join(out,name+'.json');await d.saveAs(path);const {readFile}=await import('node:fs/promises');return {path,record:JSON.parse(await readFile(path,'utf8'))};};
 await ready();assert.equal(await page.locator('#status').textContent(),'completed');
 for(const bike of ['full','hardtail']){
  await page.locator('#bike').selectOption(bike);
  for(const mode of ['imported','zero']){
   await page.locator('#velocityMode').selectOption(mode);await page.locator('#calculate').click();await ready();assert.equal(await page.locator('#error').textContent(),'');assert.equal(await page.locator('#status').textContent(),'completed');
   const saved=await save(bike+'-'+mode);assert.deepEqual(await run(saved.record.input),saved.record);
   await page.locator('#scrub').fill('0');assert.match(await page.locator('#time').textContent(),/0.00 ms/);if(mode==='zero')assert.equal(await page.locator('#speed').textContent(),'0.00000 m/s');
   await page.locator('#scrub').fill(String(saved.record.frames.length-1));await page.screenshot({path:join(out,bike+'-'+mode+'.png'),fullPage:true});report.screenshots.push('fixed-hub/'+bike+'-'+mode+'.png');
   await page.locator('#load').setInputFiles(saved.path);await ready();assert.deepEqual((await save(bike+'-'+mode+'-replay')).record,saved.record);
  }
 }
 for(const width of [390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#rig').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,'mobile-'+width+'.png')});report.screenshots.push('fixed-hub/mobile-'+width+'.png');}
 await page.setViewportSize({width:1440,height:1100});
 await page.locator('#dt').selectOption('.0000078125'.replace(/^\./,'0.'));await page.locator('#calculate').click();await page.locator('#cancel').click();assert.equal(await page.locator('#status').textContent(),'Cancelled');assert.equal(await page.locator('#calculate').isDisabled(),false);
 await page.locator('#load').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});await ready();assert.equal(await page.locator('#status').textContent(),'Failed');assert.notEqual(await page.locator('#error').textContent(),'');
 report.checks.push('Fixed hub: both bike seeds, moving/zero controls, exact complete browser/headless replay, scrub, mobile fit, cancellation and invalid import.');
}

