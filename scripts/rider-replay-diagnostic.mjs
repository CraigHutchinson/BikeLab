import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createPreviewServer} from '../server.mjs';
import {inputFromRecord} from '../dist/trail-bike.js';
import {inspectRiderReplay} from './rider-replay-state.mjs';
import {replayDifference} from './replay-difference.mjs';
import {compareCanonicalTrailRecord} from './trail-section-browser-check.mjs';

const [file,output='artifacts/rider-replay-diagnostic']=process.argv.slice(2);
if(!file)throw Error('Usage: node scripts/rider-replay-diagnostic.mjs record.json [output-directory]');
const dir=resolve(output);await mkdir(dir,{recursive:true});
const raw=await readFile(file,'utf8'),original=JSON.parse(raw),input=inputFromRecord(original);
const digest=s=>createHash('sha256').update(s).digest('hex');
const report={scope:'Identical serialized input; diagnostic only. Strict replay budgets unchanged.',success:false,inputSha256:digest(JSON.stringify(input)),sourceRecordSha256:digest(raw),node:process.version,platform:process.platform,errors:[]};
const require=createRequire(import.meta.url),assets=createPreviewServer();
let targetDeltaOverride=null;
const worker="import {inspectRiderReplay} from './rider-replay-state.mjs';onmessage=async e=>{try{postMessage({snapshot:await inspectRiderReplay(e.data)})}catch(error){postMessage({error:error.stack})}};";
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/diagnostic.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>BikeLab replay diagnostic</title>');}
  else if(path==='/scripts/replay-worker.mjs'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(worker);}
  else if(path==='/scripts/rider-replay-state.mjs'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(await readFile(new URL('./rider-replay-state.mjs',import.meta.url)));}
  else if(path==='/dist/rider-targets.js'&&targetDeltaOverride){
   const source=await readFile(new URL('../dist/rider-targets.js',import.meta.url),'utf8');
   const needle='q:Object.freeze(angles.map((a,i)=>canonicalTargetDelta(a,base.laws[i].angle0)))';
   if(source.split(needle).length!==2)throw Error('Target compiler changed; refusing diagnostic substitution.');
   res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
   res.end(source.replace(needle,'q:Object.freeze('+JSON.stringify(targetDeltaOverride)+'[index])'));
  }
  else{if(path.startsWith('/dist/'))req.url=req.url.slice(5);assets.emit('request',req,res);}
 }catch(error){res.writeHead(500);res.end('Diagnostic server error');report.errors.push(error.message);}
});
let browser;
try{
 let tooling;try{tooling=require('playwright');report.playwright=require('playwright/package.json').version;}
 catch{tooling=require('playwright-core');report.playwright=require('playwright-core/package.json').version;}
 server.listen(0,'127.0.0.1');await once(server,'listening');
 browser=await tooling.chromium.launch({headless:true,executablePath:process.env.BIKELAB_CHROMIUM||undefined});
 report.browser=browser.version();const page=await browser.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/diagnostic.html');
 const inBrowser=()=>page.evaluate(input=>new Promise((resolve,reject)=>{
  const worker=new Worker('/scripts/replay-worker.mjs',{type:'module'});
  const timer=setTimeout(()=>{worker.terminate();reject(Error('Diagnostic worker timed out'));},120000);
  worker.onmessage=e=>{clearTimeout(timer);worker.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data.snapshot);};
  worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};worker.postMessage(input);
 }),input);
 const actual=await inBrowser();
 const expected=await inspectRiderReplay(input);
 for(const [name,value] of [['browser',actual],['node',expected]])await writeFile(join(dir,name+'.json'),JSON.stringify(value));
 report.xml={equal:actual.xml===expected.xml,browserSha256:digest(actual.xml),nodeSha256:digest(expected.xml)};
 report.comparisons={
  initialAngles:replayDifference(actual.initialAngles,expected.initialAngles),
  targetAngles:replayDifference(actual.targets.map(t=>t.angles),expected.targets.map(t=>t.angles)),
  targetDeltas:replayDifference(actual.targets.map(t=>t.q),expected.targets.map(t=>t.q)),
  nativeAttributes:replayDifference(actual.native,expected.native),
  initialFrame:replayDifference(actual.record.frames[0],expected.record.frames[0]),
  frames:replayDifference(actual.record.frames,expected.record.frames),
  completeRecord:replayDifference(actual.record,expected.record),
  ...(original.frames?{archivedBrowserVersusCurrent:replayDifference(original,actual.record)}:{})
 };
 const firstFrame=actual.record.frames.findIndex((f,i)=>{const d=replayDifference(f,expected.record.frames[i]);return d.outsideBudget||d.structuralDifferences;});
 report.firstSavedFailure=firstFrame<0?null:{index:firstFrame,time:actual.record.frames[firstFrame].time,comparison:replayDifference(actual.record.frames[firstFrame],expected.record.frames[firstFrame])};
 // Controlled intervention, confined to this loopback diagnostic server.
 // Baseline success remains independent of whether the intervention agrees.
 targetDeltaOverride=expected.targets.map(t=>t.q);
 const controlled=await inBrowser();
 await writeFile(join(dir,'browser-node-target-deltas.json'),JSON.stringify(controlled));
 report.nodeTargetDeltaControl={scope:'Browser compiler receives only Node target q values; serialized input and production files unchanged.',xmlEqual:controlled.xml===actual.xml,compiledDeltas:replayDifference(controlled.targets.map(t=>t.q),targetDeltaOverride),completeRecord:replayDifference(controlled.record,expected.record)};
 try{report.nodeTargetDeltaControl.strictComparator=compareCanonicalTrailRecord(controlled.record,expected.record);}
 catch(error){if(error.code!=='ERR_ASSERTION')throw error;report.nodeTargetDeltaControl.strictFailure=error.message;}
 report.success=report.errors.length===0&&report.xml.equal&&report.comparisons.completeRecord.outsideBudget===0&&report.comparisons.completeRecord.structuralDifferences===0;
 if(!report.success)process.exitCode=1;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{
 await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
 if(browser)await browser.close();server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));
}
console.log(JSON.stringify(report,null,2));
