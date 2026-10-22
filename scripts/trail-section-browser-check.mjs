import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {replay} from '../dist/trail-bike.js';
import {reviewTrailSection} from './trail-section-review.mjs';

export async function checkTrailSection({page,root,dir,report}){
 dir=join(dir,'trail-bike');const cases=[];
 const ready=()=>page.waitForFunction(()=>document.getElementById('status').textContent==='COMPLETED',null,{timeout:120000});
 for(const bike of ['full','hardtail']){
  await page.setViewportSize({width:1440,height:1100});await page.goto(root+'trail-bike.html');await ready();
  await page.locator('[name=bike]').selectOption(bike);await page.locator('#example').selectOption('trail');await ready();
  const pending=page.waitForEvent('download');await page.locator('#save').click();const path=join(dir,bike+'-trail-section.json');await (await pending).saveAs(path);
  const r=JSON.parse(await readFile(path,'utf8')),expected=await replay(r);assert.deepEqual(r,expected);const review=reviewTrailSection(r);cases.push(review);
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
 }
 report.trailSection={agreement:'exact complete records',cases};report.checks.push('Both guided-rider bikes traverse the 1.5 s synthetic bump/crest/drop; exact browser/Node records, accepted contact transitions and component guards, desktop unloading/recontact and 390 px captures. No active or completed both-wheel jump claim.');
}
