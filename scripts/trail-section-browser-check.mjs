import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {replay} from '../dist/trail-bike.js';
import {reviewTrailSection} from './trail-section-review.mjs';
import {CANONICAL_MODEL,CANONICAL_NUMERICS} from '../dist/trail-canonical.js';

// Compare every field, but let a failed assertion print only the differing leaf.
// Node's full-object assertion formatter can exhaust memory on a large run record.
export function assertExactTrailRecord(actual,expected,path='record'){
 if(expected&&typeof expected==='object'){
  assert.ok(actual&&typeof actual==='object',path);
  assert.equal(Array.isArray(actual),Array.isArray(expected),path);
  if(Array.isArray(expected))assert.equal(actual.length,expected.length,path+' length');
  assert.deepEqual(Object.keys(actual),Object.keys(expected),path+' keys');
  for(const key of Object.keys(expected))assertExactTrailRecord(actual[key],expected[key],path+'.'+key);
 }else{
  if(typeof expected==='number')assert.ok(Number.isFinite(actual)&&Number.isFinite(expected),path);
  assert.equal(actual,expected,path);
 }
}

// The new canonical model receives the existing articulated 1e-9 budget, which
// is stricter than the historical guided 1e-7 budget. Preserve exact diagnostics
// separately; host atan2/hypot leaves are not promised bit-identical everywhere.
export function compareCanonicalTrailRecord(actual,expected){
 let maxAbsolute=0,maxNormalized=0;const tolerance=1e-9;
 const compare=(a,b,path)=>{
  if(typeof b==='number'){
   assert.ok(Number.isFinite(a)&&Number.isFinite(b),path);const delta=Math.abs(a-b),normalized=delta/Math.max(1,Math.abs(b));
   maxAbsolute=Math.max(maxAbsolute,delta);maxNormalized=Math.max(maxNormalized,normalized);assert.ok(normalized<=tolerance,path+': '+a+' vs '+b);
  }else if(b&&typeof b==='object'){
   assert.ok(a&&typeof a==='object',path);assert.equal(Array.isArray(a),Array.isArray(b),path);if(Array.isArray(b))assert.equal(a.length,b.length,path+' length');
   assert.deepEqual(Object.keys(a),Object.keys(b),path+' keys');for(const key of Object.keys(b))compare(a[key],b[key],path+'.'+key);
  }else assert.equal(a,b,path);
 };
 compare(actual,expected,'record');return {tolerance,maxAbsolute,maxNormalized,exact:maxAbsolute===0};
}

export async function checkTrailSection({page,root,dir,report}){
 dir=join(dir,'trail-bike');const cases=[];
 const ready=()=>page.waitForFunction(()=>document.getElementById('status').textContent==='COMPLETED',null,{timeout:120000});
 for(const bike of ['full','hardtail']){
  await page.setViewportSize({width:1440,height:1100});await page.goto(root+'trail-bike.html');await ready();
  await page.locator('[name=bike]').selectOption(bike);await page.locator('#example').selectOption('trail');await ready();
  const pending=page.waitForEvent('download');await page.locator('#save').click();const path=join(dir,bike+'-trail-section.json');await (await pending).saveAs(path);
  const r=JSON.parse(await readFile(path,'utf8')),expected=await replay(r);assert.equal(r.model,CANONICAL_MODEL);
  assertExactTrailRecord(r.numericalPolicy,expected.numericalPolicy,'record.numericalPolicy');
  const agreement=compareCanonicalTrailRecord(r,expected),review=reviewTrailSection(r);cases.push({...review,agreement});
  assert.equal(r.scenario.bike.bike,bike);assert.match(r.scenario.profile.source.description,/Short 2D trail/);assert.ok(await page.locator('#riderSupport').isHidden());
  const supported=(f,k)=>f.contacts.filter(c=>c.wheel===k).reduce((sum,c)=>sum+c.normalForce,0)>1e-6;
  const longestUnloaded=k=>{
   let start=-1,best=null;
   for(let i=0;i<=r.frames.length;i++){
    const f=r.frames[i],unloaded=f&&f.time>.2&&!supported(f,k)&&supported(f,1-k);
    if(unloaded&&start<0)start=i;
    if(!unloaded&&start>=0){if(!best||i-start>best.end-best.start)best={start,end:i};start=-1;}
   }
   assert.ok(best&&best.end<r.frames.length,'unloading followed by a saved support return');
   assert.ok(supported(r.frames[best.end],k));return best;
  };
  const front=longestUnloaded(0),rear=longestUnloaded(1),recontact=Math.max(front.end,rear.end);
  assert.ok([0,1].every(k=>supported(r.frames[recontact],k)));
  for(const [name,index] of [['front-unloaded',Math.floor((front.start+front.end-1)/2)],['rear-unloaded',Math.floor((rear.start+rear.end-1)/2)],['both-supported-again',recontact]]){
   assert.ok(index>=0,name);await page.locator('#scrub').fill(String(index));const image=bike+'-trail-'+name+'.png';await page.screenshot({path:join(dir,image),fullPage:true});report.screenshots.push('trail-bike/'+image);
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(50);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#rig').scrollIntoViewIfNeeded();const image=bike+'-trail-mobile.png';await page.screenshot({path:join(dir,image)});report.screenshots.push('trail-bike/'+image);
  // Keep the numerical contract when changing supported rider coupling modes.
  await page.locator('[name=duration]').fill('.02');
  for(const mode of ['fixed','compliant']){
   await page.locator('[name=rider]').selectOption(mode);await page.locator('#setup button[type=submit]').click();await ready();
   const applied=JSON.parse(await page.locator('#setupText').inputValue());assert.equal(applied.bike.rider,mode);assert.equal(applied.numerics,CANONICAL_NUMERICS);
  }
  await page.locator('[name=rider]').selectOption('articulated');await page.locator('#setup button[type=submit]').click();
  await page.waitForFunction(()=>!['CALCULATING','UNAPPLIED EDITS'].includes(document.getElementById('status').textContent));
  assert.notEqual(await page.locator('#status').textContent(),'INPUT REJECTED');
  assert.equal(JSON.parse(await page.locator('#setupText').inputValue()).numerics,undefined);
 }
 report.trailSection={agreement:'Canonical complete records: 1e-9 normalized; exact model/launch receipt',cases};report.checks.push('Both guided-rider bikes traverse the 1.5 s canonical synthetic bump/crest/drop; complete browser/Node replay, accepted contact transitions and component guards, desktop unloading/recontact and 390 px captures. No active or completed both-wheel jump claim.');
}
