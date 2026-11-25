import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createPreviewServer} from '../server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright-core'),dir='artifacts/pressure-footprint';
await mkdir(dir,{recursive:true});
const numerical=JSON.parse(await readFile(dir+'/numerical.json','utf8'));
const hashes=async()=>Object.fromEntries(await Promise.all(Object.keys(numerical.sourcesSha256).map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const report={success:false,node:process.version,playwright:require('playwright-core/package.json').version,sourcesSha256:await hashes(),checks:[],cases:[],errors:[]};
const server=createPreviewServer();server.prependListener('request',r=>{if(r.url.startsWith('/BikeLab/'))r.url=r.url.slice('/BikeLab'.length);});let browser;
const compare=(a,b,path='state')=>{if(path.endsWith('.stability')){
 // Finite-difference roundoff estimates are engine-sensitive diagnostics, not physical signals.
 // Require each engine's unchanged admission gate and overlap of its eigenvalue error bound.
 assert.equal(a.classification,'positive-with-refinement-margin');assert.equal(b.classification,a.classification);assert.deepEqual(a.unshiftedPositive,[true,true]);assert.deepEqual(b.unshiftedPositive,a.unshiftedPositive);assert.equal(b.freeCoordinates,a.freeCoordinates);assert.deepEqual(b.steps,a.steps);
 for(const s of [a,b])assert.ok(Number.isFinite(s.errorEstimate)&&s.errorEstimate>=0&&s.eigenvalueLowerBound>s.errorEstimate);
 assert.ok(Math.abs(a.eigenvalueLowerBound-b.eigenvalueLowerBound)<=a.errorEstimate+b.errorEstimate);return;
 }if(typeof a==='number'){assert.ok(Number.isFinite(b)&&Math.abs(a-b)<=1e-7+1e-8*Math.abs(a),path);}else if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a),Object.keys(b),path);for(const k of Object.keys(a))if(k!=='elapsedMs')compare(a[k],b[k],path+'.'+k);}else assert.equal(a,b,path);};
try{
 server.listen(0,'127.0.0.1');await once(server,'listening');browser=await chromium.launch({headless:true,executablePath:process.env.BIKELAB_CHROMIUM});report.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(65000);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
 await page.goto(`http://127.0.0.1:${server.address().port}/BikeLab/pressure-footprint.html`);await page.waitForFunction(()=>document.getElementById('status').textContent==='READY');
 await page.click('button[type=submit]');await page.waitForFunction(()=>document.getElementById('status').textContent==='CALCULATING 1/7');let start=performance.now();await page.click('#cancel');assert.equal(await page.textContent('#status'),'CANCELLED');assert.ok(await page.isDisabled('#save'));report.checks.push({name:'cancel terminates active worker and discards partial cycle',elapsedMs:performance.now()-start});
 // Supersede a live worker; generation identity excludes an old completion.
 await page.click('button[type=submit]');await page.selectOption('#pressure','120000');assert.equal(await page.textContent('#status'),'READY');
 for(const pressure of [120000,160000,200000]){
  await page.selectOption('#pressure',String(pressure));await page.evaluate(()=>{window.frameTimes=[];let last=performance.now();window.framesActive=true;function tick(t){if(!window.framesActive)return;window.frameTimes.push(t-last);last=t;requestAnimationFrame(tick);}requestAnimationFrame(tick);});
  start=performance.now();await page.click('button[type=submit]');await page.waitForFunction(()=>document.getElementById('status').textContent==='COMPLETED');const elapsedMs=performance.now()-start;
  const gaps=await page.evaluate(()=>{window.framesActive=false;return window.frameTimes;});assert.ok(gaps.length>10);const sorted=gaps.slice().sort((a,b)=>a-b),p95=sorted[Math.floor(.95*sorted.length)];assert.ok(p95<100,'p95 animation frame gap below 100 ms');
  const download=page.waitForEvent('download');await page.click('#save');const d=await download,path=dir+`/browser-${pressure}.json`;await d.saveAs(path);const result=JSON.parse(await readFile(path,'utf8'));assert.equal(result.input.pressure,pressure);compare(numerical.cases.find(c=>c.pressure===pressure).states,result.states);
  await page.locator('#scrub').fill('3');await page.locator('#scrub').dispatchEvent('input');assert.match(await page.textContent('#position'),/4 mm/);assert.match(await page.textContent('#metrics'),/REACTION/);await page.screenshot({path:dir+`/pressure-${pressure}.png`,fullPage:true});
  await page.locator('#scrub').fill('6');await page.locator('#scrub').dispatchEvent('input');assert.match(await page.textContent('#position'),/unload/);
  report.cases.push({pressure,elapsedMs,frames:gaps.length,p95FrameGapMs:p95,maxFrameGapMs:Math.max(...gaps),headlessAgreement:true});
 }
 await page.setInputFiles('#load',dir+'/browser-160000.json');await page.waitForFunction(()=>document.getElementById('status').textContent==='COMPLETED');assert.equal(await page.inputValue('#pressure'),'160000');
 const dl=page.waitForEvent('download');await page.click('#save');await (await dl).saveAs(dir+'/replayed.json');const replay=JSON.parse(await readFile(dir+'/replayed.json','utf8'));compare(numerical.cases.find(c=>c.pressure===160000).states,replay.states);report.checks.push('saved file reruns and agrees with headless; scrub reaches unload');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:dir+'/mobile-completed.png',fullPage:true});
 await page.setInputFiles('#load',{name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({model:'legacy-footprint',states:[]}))});await page.waitForFunction(()=>document.getElementById('status').textContent==='REFUSED');assert.ok(await page.isDisabled('#save'));assert.match(await page.textContent('#error'),/Legacy footprint/);report.checks.push('legacy record refused without stale result');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile has no horizontal overflow');await page.screenshot({path:dir+'/mobile.png',fullPage:true});
 await page.evaluate(()=>{window.RealWorker=window.Worker;window.Worker=class{constructor(){throw Error('Worker unavailable');}};});await page.click('button[type=submit]');assert.equal(await page.textContent('#status'),'REFUSED');assert.match(await page.textContent('#error'),/Worker unavailable/);assert.ok(await page.isDisabled('#cancel'));await page.evaluate(()=>{window.Worker=window.RealWorker;});report.checks.push('worker construction failure refuses and unlocks retry');
 // Run the real wall-clock timeout against a worker that accepts input but never responds.
 await page.evaluate(()=>{window.Worker=class{postMessage(){} terminate(){window.inertWorkerTerminated=true;}};});
 await page.click('button[type=submit]');
 await page.waitForFunction(()=>document.getElementById('status').textContent==='REFUSED',null,{timeout:75000});
 assert.match(await page.textContent('#error'),/60 second/);
 assert.ok(await page.evaluate(()=>window.inertWorkerTerminated));
 assert.ok(await page.isDisabled('#save'));
 report.checks.push('60 second wall-clock timeout terminates an inert worker and rejects partial output');
 assert.deepEqual(report.errors,[]);assert.deepEqual(await hashes(),report.sourcesSha256);report.success=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await writeFile(dir+'/browser.json',JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));}
console.log(JSON.stringify(report,null,2));
