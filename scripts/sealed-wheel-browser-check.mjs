import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createPreviewServer} from '../server.mjs';
import {createSweptCasing,ENDPOINT_MODEL,RELAXED_MODEL} from '../dist/sealed-casing.js';
import {preset,run} from '../dist/moving-wheel.js';
const require=createRequire(import.meta.url),{chromium}=require('playwright-core');
const dir='artifacts/swept-browser';await mkdir(dir,{recursive:true});
const receipt={success:false,node:process.version,checks:[],errors:[]},server=createPreviewServer();let browser;
function compare(a,b,path='report'){
 if(typeof a==='number'){assert.ok(Number.isFinite(b));assert.ok(Math.abs(a-b)<=1e-7+1e-8*Math.abs(a),`${path}: ${a} vs ${b}`);}
 else if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a),Object.keys(b),path);for(const k of Object.keys(a))compare(a[k],b[k],path+'.'+k);}
 else assert.equal(a,b,path);
}
try{
 server.listen(0,'127.0.0.1');await once(server,'listening');
 browser=await chromium.launch({headless:true,executablePath:process.env.BIKELAB_CHROMIUM});receipt.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(30000);
 page.on('pageerror',e=>receipt.errors.push(e.message));await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
 await page.goto(`http://127.0.0.1:${server.address().port}/moving-wheel.html`);
 await page.waitForFunction(()=>document.getElementById('status').textContent==='COMPLETED');
 await page.selectOption('#example','sealed');
 await page.waitForFunction(()=>document.getElementById('status').textContent==='COMPLETED'&&document.getElementById('casingStatus').textContent.includes('Sealed casing'));
 const downloadPromise=page.waitForEvent('download');await page.click('#save');const download=await downloadPromise;const path=await download.path(),record=JSON.parse(await readFile(path,'utf8'));
 await writeFile(dir+'/record.json',JSON.stringify(record));compare(await run(preset('sealed')),record);receipt.checks.push('worker saved record agrees with headless at 1e-7 absolute plus 1e-8 relative');
 await page.click('#step');assert.match(await page.textContent('#casingStatus'),/bar gauge/);
 await page.locator('#scrub').fill(String(record.frames.length-1));await page.locator('#scrub').dispatchEvent('input');
 await page.screenshot({path:dir+'/sealed.png',fullPage:true});
 await page.locator('[name=hubMass]').fill('4');await page.click('#restore');assert.equal(JSON.parse(await page.inputValue('#setupText')).casing.gaugePressure,160000);
 await page.setInputFiles('#load',{name:'sealed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(record))});
 await page.waitForFunction(()=>document.getElementById('status').textContent==='COMPLETED');assert.equal(await page.inputValue('#example'),'sealed');
 receipt.candidateChecks=[];
 for(const nodes of [32,64])for(const pressure of [120000,160000,200000]){
  const c={...preset('sealed').casing,nodes,gaugePressure:pressure},m=createSweptCasing(c,ENDPOINT_MODEL),q=Float64Array.from(m.initial);q[1]+=.0003;q[6]+=.0001;
  const s=m.evaluate(q),expected={model:m.model,pressure:s.gaugePressure,volume:s.volume,potential:s.potential,forces:Array.from(s.forces)};
  const actual=await page.evaluate(async c=>{const {createSweptCasing,ENDPOINT_MODEL,RELAXED_MODEL}=await import('./sealed-casing.js'),m=createSweptCasing(c,ENDPOINT_MODEL),q=Float64Array.from(m.initial);q[1]+=.0003;q[6]+=.0001;const s=m.evaluate(q);return {model:m.model,pressure:s.gaugePressure,volume:s.volume,potential:s.potential,forces:Array.from(s.forces)};},c);
  compare(expected,actual,'endpoint');receipt.candidateChecks.push({nodes,pressure,passed:true});
 }
 receipt.checks.push('endpoint candidate browser JavaScript matches headless at six configurations; not native integration or loaded acceptance');
 receipt.relaxedChecks=[];
 for(const nodes of [32,128,256])for(const pressure of [120000,160000,200000]){
  const c={...preset('sealed').casing,nodes,gaugePressure:pressure},m=createSweptCasing(c,RELAXED_MODEL),q=Float64Array.from(m.initial);q[1]+=.003;
  const s=m.evaluate(q),expected={model:m.model,pressure:s.gaugePressure,volume:s.volume,potential:s.potential,relaxedCells:s.relaxedCells,maxRelaxation:s.maxRelaxation,forces:Array.from(s.forces)};
  const actual=await page.evaluate(async c=>{const {createSweptCasing,RELAXED_MODEL}=await import('./sealed-casing.js'),m=createSweptCasing(c,RELAXED_MODEL),q=Float64Array.from(m.initial);q[1]+=.003;const s=m.evaluate(q);return {model:m.model,pressure:s.gaugePressure,volume:s.volume,potential:s.potential,relaxedCells:s.relaxedCells,maxRelaxation:s.maxRelaxation,forces:Array.from(s.forces)};},c);
  compare(expected,actual,'relaxed');assert.ok(expected.relaxedCells>0);receipt.relaxedChecks.push({nodes,pressure,passed:true});
 }
 receipt.checks.push('restricted relaxed candidate browser/headless comparison at nine configurations, including active relaxation; no native candidate integration');
 receipt.checks.push('selection, save, scrub, restore and load preserve sealed model');assert.deepEqual(receipt.errors,[]);receipt.sources={};for(const name of ['dist/tyre-relaxation.js','dist/moving-wheel.js','dist/moving-wheel-app.js','dist/moving-wheel.html','dist/sealed-casing.js','dist/sealed-casing-example.js','dist/wheel-ring.js','dist/tyre-gas.js','scripts/sealed-wheel-browser-check.mjs'])receipt.sources[name]=createHash('sha256').update(await readFile(name)).digest('hex');receipt.screenshotSha256=createHash('sha256').update(await readFile(dir+'/sealed.png')).digest('hex');receipt.success=true;
}catch(e){receipt.failure=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));await writeFile(dir+'/report.json',JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify(receipt,null,2));
