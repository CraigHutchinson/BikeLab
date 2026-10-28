import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createPreviewServer} from '../server.mjs';
import {checkGeometryLabels} from './bike-browser-check.mjs';

const require=createRequire(import.meta.url),dir=resolve(process.env.BIKELAB_ARTIFACTS||'artifacts/geometry-labels');
await mkdir(dir,{recursive:true});
const report={success:false,node:process.version,platform:process.platform,playwright:null,browser:null,checks:[],screenshots:[],errors:[]};
const server=createPreviewServer();let browser;
server.prependListener('request',request=>{if(request.url.startsWith('/BikeLab/'))request.url=request.url.slice('/BikeLab'.length);});
try {
  let tooling;
  try {tooling=require('playwright');report.playwright=require('playwright/package.json').version;}
  catch {tooling=require('playwright-core');report.playwright=require('playwright-core/package.json').version;}
  server.listen(0,'127.0.0.1');await once(server,'listening');
  browser=await tooling.chromium.launch({headless:true,timeout:15000,executablePath:process.env.BIKELAB_CHROMIUM||undefined});
  report.browser=browser.version();
  const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
  page.setDefaultTimeout(15000);
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
  await page.goto(`http://127.0.0.1:${server.address().port}/BikeLab/bike.html`);
  await page.waitForFunction(()=>document.getElementById('status').textContent==='READY');
  await checkGeometryLabels({page,dir,report});
  assert.deepEqual(report.errors,[]);report.success=true;
} catch(error) {
  report.failure=error.stack;process.exitCode=1;
} finally {
  await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
  if(browser)await browser.close();
  server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));
}
console.log(JSON.stringify(report,null,2));
