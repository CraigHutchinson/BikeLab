import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {POSE_EXAMPLES,inspectRiderPose} from '../dist/rider-pose-study.js';

export async function checkRiderPoses({page,root,dir,report}) {
  dir=join(dir,'rider-poses');await mkdir(dir,{recursive:true});
  const snapshot=()=>page.evaluate(()=>{
    const $=id=>document.getElementById(id);
    return {scenario:$('setupText').value,status:$('status').textContent,time:$('time').textContent,
      scrub:$('scrub').value,controls:['play','save','step','restartState','cancel'].map(id=>[$(id).disabled,$(id).textContent])};
  });
  const download=async(id,name)=>{
    const pending=page.waitForEvent('download');await page.locator('#'+id).click();
    const path=join(dir,name+'.json');await (await pending).saveAs(path);return await readFile(path,'utf8');
  };
  // Called after Trail section checks, with an applied articulated run on the page.
  const cases=[];
  for(const bike of ['full','hardtail']) {
    await page.setViewportSize({width:1440,height:1100});
    await page.locator('[name=bike]').selectOption(bike);await page.locator('#example').selectOption('rider-state');
    await page.waitForFunction(()=>document.getElementById('status').textContent==='COMPLETED',null,{timeout:120000});
    await page.locator('#scrub').fill('1');
    const before=await snapshot(), recordBefore=await download('save',bike+'-before');
    await page.locator('#riderPoseStudy').evaluate(el=>{el.open=true;});
    for(const example of POSE_EXAMPLES) {
      await page.locator('#poseExample').selectOption(example.id);
      assert.ok(await page.locator('#poseResult').isVisible());assert.ok(await page.locator('#savePose').isEnabled());
      const expected=inspectRiderPose(example.posture);
      assert.equal(await page.locator('#poseCom').textContent(),expected.posture.aggregate.com.map(n=>n.toFixed(3)).join(' / ')+' m');
      assert.match(await page.locator('#poseDomain').textContent(),expected.defaultPassive.accepted?/Within the default/:/Outside the default/);
      const spec=JSON.parse(await download('savePose',bike+'-'+example.id));
      assert.deepEqual(spec,expected.posture.spec);
      const actual=await page.evaluate(async({root,spec})=>(await import(root+'rider-pose-study.js')).inspectRiderPose(spec),{root,spec});
      let maxAbsolute=0;
      const compare=(a,b)=>{
        if(typeof b==='number'){assert.ok(Number.isFinite(a));const d=Math.abs(a-b);maxAbsolute=Math.max(maxAbsolute,d);assert.ok(d<=1e-12*Math.max(1,Math.abs(b)));}
        else if(b&&typeof b==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(b))compare(a[k],b[k]);}
        else assert.equal(a,b);
      };compare(actual,expected);
      cases.push({bike,pose:example.id,maxAbsolute,defaultPassive:actual.defaultPassive});
      assert.deepEqual(await snapshot(),before);
      const name=bike+'-'+example.id+'.png';await page.locator('#riderPoseStudy').screenshot({path:join(dir,name)});report.screenshots.push('rider-poses/'+name);
    }
    for(const value of ['', '2']) {
      await page.locator('#poseHipZ').fill(value);assert.ok(await page.locator('#savePose').isDisabled());
      assert.ok(await page.locator('#poseResult').isHidden());await page.locator('#previewPose').click();
      assert.match(await page.locator('#poseStatus').textContent(),/Pose rejected/);
      assert.ok(await page.locator('#savePose').isDisabled());assert.deepEqual(await snapshot(),before);
    }
    await page.locator('#poseExample').selectOption('seating');
    await page.locator('#poseHipX').fill('-.21');
    assert.ok(await page.locator('#savePose').isDisabled());
    await page.locator('#previewPose').click();
    const custom=JSON.parse(await download('savePose',bike+'-custom'));
    assert.deepEqual(custom,inspectRiderPose({hip:[-.21,.07],trunkPitch:.65}).posture.spec);
    assert.deepEqual(await snapshot(),before);
    for(const width of [390,320]) {
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
      const name=bike+'-pose-'+width+'.png';await page.locator('#riderPoseStudy').screenshot({path:join(dir,name)});report.screenshots.push('rider-poses/'+name);
    }
    assert.equal(await download('save',bike+'-after'),recordBefore,'pose edits changed applied record');
    // One JS turn: the worker cannot deliver completion before the pose edit.
    const pending=await page.evaluate(()=>{
      const $=id=>document.getElementById(id);
      $('restartState').click();const before=$('status').textContent;
      $('poseHipX').value='-.20';$('poseHipX').dispatchEvent(new Event('input',{bubbles:true}));$('previewPose').click();
      return {before,after:$('status').textContent,cancelEnabled:!$('cancel').disabled};
    });
    assert.deepEqual(pending,{before:'CALCULATING',after:'CALCULATING',cancelEnabled:true});
    await page.waitForFunction(()=>!['CALCULATING','UNAPPLIED EDITS'].includes(document.getElementById('status').textContent),null,{timeout:120000});
    assert.notEqual(await page.locator('#status').textContent(),'INPUT REJECTED');assert.ok(await page.locator('#save').isEnabled());
    await page.locator('#riderPoseStudy').evaluate(el=>{el.open=false;});
  }
  report.riderPoses={cases,tolerance:1e-12,scope:'Geometry only; no support or active transition'};
  report.checks.push('Rider pose study: four preserved-body geometries, default-domain diagnosis, export parity, invalid/blank rejection, unchanged applied records and worker completion, both bikes and 390/320 px captures.');
  await writeFile(join(dir,'report.json'),JSON.stringify(report.riderPoses,null,2));
}
