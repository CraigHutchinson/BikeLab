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
  const last=r.frames.length-1,frontLift=r.frames.findIndex(f=>f.time>.2&&!f.contacts.some(c=>c.wheel===0)&&f.contacts.some(c=>c.wheel===1)),rearLift=r.frames.findIndex(f=>f.time>.2&&!f.contacts.some(c=>c.wheel===1)&&f.contacts.some(c=>c.wheel===0));
  for(const [name,index] of [['front-lift',frontLift],['rear-lift',rearLift],['landing',last]]){
   assert.ok(index>=0,name);await page.locator('#scrub').fill(String(index));const image=bike+'-trail-'+name+'.png';await page.screenshot({path:join(dir,image),fullPage:true});report.screenshots.push('trail-bike/'+image);
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(50);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#rig').scrollIntoViewIfNeeded();const image=bike+'-trail-mobile.png';await page.screenshot({path:join(dir,image)});report.screenshots.push('trail-bike/'+image);
 }
 report.trailSection={agreement:'exact complete records',cases};report.checks.push('Both guided-rider bikes traverse the 1.5 s synthetic bump/crest/drop; exact browser/Node records, accepted contact transitions and component guards, desktop lift/landing and 390 px captures. No active or completed both-wheel jump claim.');
}
