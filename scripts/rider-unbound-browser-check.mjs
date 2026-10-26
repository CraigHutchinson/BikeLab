import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {runUnbound} from '../dist/rider-unbound.js';
import {compareCanonicalTrailRecord} from './trail-section-browser-check.mjs';

export async function checkRiderUnbound({page, root, dir, report}) {
  const prefix='rider-unbound';dir=join(dir,prefix);await mkdir(dir,{recursive:true});
  // Already on an applied short articulated Trail run. Observe only this probe's
  // real workers; fault callbacks below are explicit lifecycle controls.
  await page.evaluate(()=>{
    const NativeWorker=window.Worker;window.unboundWorkers=[];
    window.Worker=class extends NativeWorker {
      constructor(url,...args){super(url,...args);this.isUnbound=String(url).includes('rider-unbound-worker.js');
        if(this.isUnbound){this.progressEvents=[];window.unboundWorkers.push(this);this.addEventListener('message',e=>{if(e.data.progress)this.progressEvents.push(e.data.progress);});}}
      terminate(){if(this.isUnbound)this.probeTerminated=true;return super.terminate();}
    };
  });
  const snapshot=()=>page.evaluate(()=>{
    const $=id=>document.getElementById(id);
    return {scenario:$('setupText').value,status:$('status').textContent,time:$('time').textContent,scrub:$('scrub').value,
      controls:['play','save','step','restartState','cancel'].map(id=>[$(id).disabled,$(id).textContent]),
      pose:$('riderPoseStudy').innerHTML,poseInputs:['poseExample','poseHipX','poseHipZ','posePitch'].map(id=>$(id).value)};
  });
  const probeState=()=>page.evaluate(()=>{
    const $=id=>document.getElementById(id);return {status:$('unboundStatus').textContent,busy:$('unboundPanel').getAttribute('aria-busy'),
      progress:$('unboundProgress').value,hidden:$('unboundProgress').hidden,result:$('unboundResult').hidden,
      save:$('saveUnbound').disabled,cancel:$('cancelUnbound').disabled};
  });
  const download=async(id,name)=>{
    const pending=page.waitForEvent('download');await page.locator('#'+id).click();
    const path=join(dir,name+'.json');await (await pending).saveAs(path);return await readFile(path,'utf8');
  };
  const shot=async name=>{await page.locator('#unboundPanel').screenshot({path:join(dir,name+'.png')});report.screenshots.push(prefix+'/'+name+'.png');};
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('#unboundPanel').evaluate(el=>{el.open=true;});
  const before=await snapshot(),recordBefore=await download('save','trail-before'),cases=[];
  for(const [name,dt] of [['spin','0.00003125'],['translation','0.00003125'],['zero-gravity','0.00003125'],['spin','0.000015625'],['spin','0.0000078125'],['joint-limit','0.00003125'],['initial-rejection','0.00003125']]) {
    await page.locator('#unboundExample').selectOption(name);await page.locator('#unboundDt').selectOption(dt);
    assert.ok(await page.locator('#saveUnbound').isDisabled());assert.ok(await page.locator('#unboundResult').isHidden());
    await page.locator('#calculateUnbound').click();
    await page.waitForFunction(()=>!document.getElementById('saveUnbound').disabled,null,{timeout:60000});
    const key=name+'-'+dt,actual=JSON.parse(await download('saveUnbound',key)),expected=await runUnbound(actual.spec);
    const agreement=compareCanonicalTrailRecord(actual,expected),state=await probeState();
    const worker=await page.evaluate(()=>{const w=window.unboundWorkers.at(-1);return {events:w.progressEvents,terminated:w.probeTerminated};});
    assert.equal(worker.terminated,true);assert.equal(state.busy,'false');assert.equal(state.cancel,true);
    const total=Math.round(actual.duration/actual.spec.dt);assert.equal(state.progress,actual.summary.steps/total);
    assert.ok(worker.events.length<=8);assert.equal(worker.events[0].phase,'preparing');assert.equal(worker.events.at(-1).phase,'finalizing');
    let previous=0;for(const p of worker.events){assert.equal(p.totalSteps,total);assert.equal(p.dt,actual.spec.dt);assert.ok(p.acceptedSteps>=previous&&p.acceptedSteps<=actual.summary.steps);previous=p.acceptedSteps;}
    assert.equal(previous,actual.summary.steps);
    const last=actual.frames.at(-1);assert.equal(state.result,!last);
    if(last){
      assert.equal(await page.locator('#unboundTime').textContent(),last.time.toFixed(5)+' s · '+actual.summary.steps+' accepted steps');
      assert.equal(await page.locator('#unboundEnergy').textContent(),last.energyResidual.toExponential(3)+' J');
      assert.equal(await page.locator('#unboundCOM').textContent(),[0,2].map(k=>last.com[k].toFixed(5)).join(' / ')+' m');
      assert.equal(await page.locator('#unboundView line').count(),11);assert.equal(await page.locator('#unboundView circle').count(),actual.frames.length);
    }
    if(name==='joint-limit'){assert.equal(actual.status,'terminated');assert.equal(actual.summary.steps,33);assert.match(state.status,/last accepted/);}
    else if(name==='initial-rejection'){assert.equal(actual.status,'initial-state-rejected');assert.match(state.status,/no pose admitted/);}
    else assert.equal(actual.status,'completed');
    assert.deepEqual(await snapshot(),before);
    if(dt==='0.00003125')await shot(name+'-desktop');
    if(name==='spin'&&dt==='0.00003125')for(const width of [390,320]){
      await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'unbound horizontal overflow');await shot('spin-'+width);
    }
    await page.setViewportSize({width:1440,height:1100});
    cases.push({name,dt:actual.spec.dt,status:actual.status,steps:actual.summary.steps,frames:actual.frames.length,progressMessages:worker.events.length,agreement});
  }
  // Worker delivery cannot interleave these synchronous transitions, even when
  // the real finite calculation is too short to click Cancel manually.
  await page.locator('#unboundExample').selectOption('spin');
  const cancelled=await page.evaluate(()=>{
    const $=id=>document.getElementById(id);$('calculateUnbound').click();
    const w=window.unboundWorkers.at(-1);window.staleUnboundMessage=w.onmessage;window.staleUnboundError=w.onerror;
    const pending={busy:$('unboundPanel').getAttribute('aria-busy'),indeterminate:!$('unboundProgress').hasAttribute('value'),cancelEnabled:!$('cancelUnbound').disabled};
    $('cancelUnbound').click();return {...pending,terminated:w.probeTerminated};
  });
  assert.deepEqual(cancelled,{busy:'true',indeterminate:true,cancelEnabled:true,terminated:true});
  const afterCancel=await probeState();assert.match(afterCancel.status,/Cancelled/);assert.equal(afterCancel.busy,'false');assert.equal(afterCancel.save,true);
  await page.evaluate(()=>{window.staleUnboundMessage({data:{progress:{phase:'integrating',acceptedSteps:99,totalSteps:100,dt:.001}}});window.staleUnboundMessage({data:{result:{}}});window.staleUnboundError({});});
  assert.deepEqual(await probeState(),afterCancel);await shot('cancelled');
  const replacement=await page.evaluate(()=>{
    const $=id=>document.getElementById(id);$('calculateUnbound').click();const old=window.unboundWorkers.at(-1),late=old.onmessage,lateError=old.onerror;
    $('calculateUnbound').click();const fresh=window.unboundWorkers.at(-1);
    late({data:{progress:{phase:'integrating',acceptedSteps:99,totalSteps:100,dt:.001}}});late({data:{result:{}}});lateError({});
    const result={oldTerminated:old.probeTerminated,busy:$('unboundPanel').getAttribute('aria-busy'),indeterminate:!$('unboundProgress').hasAttribute('value')};
    fresh.onerror({});return {...result,freshTerminated:fresh.probeTerminated};
  });
  assert.deepEqual(replacement,{oldTerminated:true,busy:'true',indeterminate:true,freshTerminated:true});
  assert.match((await probeState()).status,/Calculation failed/);assert.equal((await probeState()).save,true);
  for(const kind of ['construction','post']){
    await page.evaluate(kind=>{
      const NormalWorker=window.Worker;
      window.Worker=kind==='construction'?class extends NormalWorker{constructor(url,...args){if(String(url).includes('rider-unbound-worker.js'))throw Error('Injected probe construction failure');super(url,...args);}}:
        class extends NormalWorker{postMessage(...args){if(this.isUnbound)throw Error('Injected probe post failure');return super.postMessage(...args);}};
      try{document.getElementById('calculateUnbound').click();}finally{window.Worker=NormalWorker;}
    },kind);
    const s=await probeState();assert.match(s.status,/Calculation failed.*Injected probe/);assert.equal(s.busy,'false');assert.equal(s.cancel,true);assert.equal(s.save,true);
  }
  // Input editing must terminate its active worker and revoke only its result.
  assert.equal(await page.evaluate(()=>{
    const $=id=>document.getElementById(id);$('calculateUnbound').click();const w=window.unboundWorkers.at(-1);
    $('unboundDt').value='0.000015625';$('unboundDt').dispatchEvent(new Event('change',{bubbles:true}));return w.probeTerminated;
  }),true);
  assert.match((await probeState()).status,/Unapplied probe edits/);assert.equal((await probeState()).save,true);
  assert.deepEqual(await snapshot(),before);assert.equal(await download('save','trail-after'),recordBefore);
  // A probe cancel must also leave a concurrently started Trail calculation alive.
  const concurrent=await page.evaluate(()=>{
    const $=id=>document.getElementById(id);$('restartState').click();$('calculateUnbound').click();$('cancelUnbound').click();
    return {trail:$('status').textContent,trailCancel:!$('cancel').disabled,probeBusy:$('unboundPanel').getAttribute('aria-busy')};
  });
  assert.deepEqual(concurrent,{trail:'CALCULATING',trailCancel:true,probeBusy:'false'});
  await page.waitForFunction(()=>document.getElementById('status').textContent==='COMPLETED',null,{timeout:120000});
  assert.equal(await page.evaluate(()=>{
    document.getElementById('calculateUnbound').click();const w=window.unboundWorkers.at(-1);
    window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
    window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));return w.probeTerminated;
  }),true);
  assert.match((await probeState()).status,/page left during calculation/);assert.equal((await probeState()).save,true);
  // Successful retry after every injected failure uses an actual worker again.
  await page.locator('#calculateUnbound').click();await page.waitForFunction(()=>!document.getElementById('saveUnbound').disabled,null,{timeout:60000});
  const retry=JSON.parse(await download('saveUnbound','retry'));assert.equal(retry.status,'completed');compareCanonicalTrailRecord(retry,await runUnbound(retry.spec));
  await page.locator('#unboundPanel').evaluate(el=>{el.open=false;});
  report.riderUnbound={cases,isolation:'Trail scenario/playback/record and pose study unchanged; probe cancellation leaves a concurrent Trail run active.',
    scope:'Actual module workers and whole-record comparison at normalized 1e-9. Injected stale/error controls test lifecycle only. Authored 0.02 s planar flight; no live release, collision or runtime actor transfer.'};
  report.checks.push('Unbound rider: seven actual worker launches, accepted-step progress, complete browser/Node export parity, true joint-limit prefix and empty initial rejection; desktop/390/320 px captures; cancel/replacement/stale/error/edit/page-lifecycle controls, successful retry and independent Trail/pose consumers.');
  await writeFile(join(dir,'report.json'),JSON.stringify(report.riderUnbound,null,2));
}
