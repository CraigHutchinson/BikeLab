import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {replayFootprint} from '../dist/footprint.js';
export async function checkFootprint({page,root,dir,report}){
 dir=join(dir,'footprint');await mkdir(dir,{recursive:true});
 await page.setViewportSize({width:1440,height:1100});await page.goto(root+'footprint.html');
 const ready=()=>page.waitForFunction(()=>['SOLVED','UNSUPPORTED'].includes(document.getElementById('status').textContent));
 const shot=async name=>{await page.screenshot({path:join(dir,name+'.png'),fullPage:true});report.screenshots.push('footprint/'+name+'.png');};
 const save=async name=>{const pending=page.waitForEvent('download');await page.locator('#save').click();const download=await pending,path=join(dir,name+'.json');await download.saveAs(path);return {path,value:JSON.parse(await readFile(path,'utf8'))};};
 const agreement=[];
 function compare(a,b){let max=0;function visit(x,y){if(typeof x==='number'){assert.ok(Number.isFinite(y));max=Math.max(max,Math.abs(x-y));assert.ok(Math.abs(x-y)<1e-7);}else if(x&&typeof x==='object'){assert.deepEqual(Object.keys(x),Object.keys(y));for(const k of Object.keys(x))visit(x[k],y[k]);}else assert.equal(x,y);}visit(a,b);agreement.push(max);}
 await ready();const first=await save('footprint-flat');compare(first.value,replayFootprint(first.value));await shot('footprint-flat');
 for(const name of ['rounded','step','bridge','edge','rim']){
  await page.locator('#example').selectOption(name);await ready();const saved=await save('footprint-'+name);compare(saved.value,replayFootprint(saved.value));
  assert.equal(saved.value.status,['edge','rim'].includes(name)?'unsupported':'solved');
  assert.equal(await page.locator('#contacts tr').count(),saved.value.contacts?.length??0);
  if(name==='bridge'){await page.locator('#view').selectOption('contact');await shot('footprint-two-supports');}
  if(name==='edge'){assert.match(await page.locator('#reason').textContent(),/contour|corner/);await shot('footprint-unsupported-edge');}
 }
 await page.locator('#load').setInputFiles(first.path);await ready();compare((await save('footprint-reloaded')).value,first.value);
 await page.locator('[name=height]').fill('.34');assert.equal(await page.locator('#save').isDisabled(),true);assert.equal(await page.locator('#status').textContent(),'UNAPPLIED EDITS');await page.locator('#restore').click();assert.equal(await page.locator('[name=height]').inputValue(),'.345'.replace(/^\./,'0.'));
 await page.locator('#load').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"model":"future"}')});await page.waitForFunction(()=>document.getElementById('status').textContent==='INPUT REJECTED');assert.equal(await page.locator('#save').isDisabled(),true);await page.locator('#restore').click();
 // Empty layout must recover; arbitrary small dimensions must not create negative canvas geometry.
 await page.evaluate(()=>document.getElementById('rig').style.display='none');await page.locator('#view').selectOption('wheel');await page.evaluate(()=>document.getElementById('rig').style.display='');await page.waitForFunction(()=>document.getElementById('rig').width>0);
 // Restore and supersede in one event loop turn: terminated workers cannot publish stale work.
 await page.evaluate(()=>{const e=document.getElementById('example');e.value='bridge';e.dispatchEvent(new Event('change'));document.getElementById('cancel').click();});await page.waitForTimeout(100);assert.equal(await page.locator('#status').textContent(),'CANCELLED');assert.equal(await page.locator('#save').isDisabled(),true);
 await page.evaluate(()=>{const e=document.getElementById('example');e.value='rounded';e.dispatchEvent(new Event('change'));e.value='bridge';e.dispatchEvent(new Event('change'));});await ready();assert.equal((await save('footprint-superseded')).value.params.fixture,'bridge');
 // A profile loaded from a record is authoritative. Author an inclined plane and recompute.
 const profile={...first.value.profile,points:[[-1,-.1],[1,.1]],source:{kind:'synthetic',description:'Browser-authored incline.'}};
 await page.locator('#profileText').evaluate((e,text)=>{e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));},JSON.stringify(profile));await page.locator('details.panel').last().evaluate(e=>e.open=true);await page.locator('#applyProfile').click();await ready();const authored=await save('footprint-authored');compare(authored.value,replayFootprint(authored.value));assert.deepEqual(authored.value.profile,profile);
 await page.evaluate(()=>{const e=document.getElementById('example');e.value='flat';e.dispatchEvent(new Event('change'));document.getElementById('cancel').click();document.getElementById('restore').click();});await page.locator('#setup button[type=submit]').click();await ready();assert.deepEqual((await save('footprint-custom-restored')).value.profile,profile);assert.match(await page.locator('#source').textContent(),/^Custom profile/);
 await page.locator('#example').selectOption('bridge');await ready();await page.locator('#view').selectOption('contact');await page.locator('details.panel').last().evaluate(e=>e.open=false);
 for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.waitForTimeout(50);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'footprint horizontal overflow');await shot('footprint-mobile-'+width);}
 report.footprint={agreement};report.checks.push('static footprint: browser/Node complete report agreement; flat/round/step-top/two-supports; explicit edge/rim rejection; all contact rows; zoom; owned authored profile and recomputed import; edit/invalid/cancel/supersession gating; hidden-canvas recovery; 390/320 px inspection captures');
}
