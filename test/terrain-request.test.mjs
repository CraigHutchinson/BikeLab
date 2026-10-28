import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {LEGACY_FORMAT} from '../dist/terrain-request.js';
import {GRID,FORMAT,ENVELOPE,LIMITS,TerrainCache,makeRequest,sweptBox,envelopeCorners,fixtureColumn,replay,verifyReplay,serializable,compareReplay} from '../dist/terrain-request.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
const request=(overrides={})=>makeRequest({a:[6,0,0],b:[6.01,0,0],...overrides});
const gate=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('independent plane, ramp and three stepped-cover columns; no duplicated support',()=>{
  assert.deepEqual(fixtureColumn('plane',2,.1),{top:0,normal:[0,0,1],spans:[[0,-.2,2]]});
  const ramp=fixtureColumn('ramp',2,.3);close(ramp.top,.026);close(ramp.normal[0]/ramp.normal[2],-.01);close(ramp.normal[1]/ramp.normal[2],-.02);close(Math.hypot(...ramp.normal),1);
  assert.deepEqual(fixtureColumn('layered',5.98,0).spans,[[.02,-.03,1],[-.03,-.2,2]]);
  assert.deepEqual(fixtureColumn('layered',6.02,0).spans,[[.05,-.2,2]]);
  assert.deepEqual(fixtureColumn('layered',6.02,.12).spans,[[.02,-.2,1]]);
  assert.deepEqual(fixtureColumn('layered',5,.13).spans,[[.07,-.2,2]]);
});

test('swept certificate contains intermediate corners, stationary rotation, reversal and mirror',()=>{
  const box=sweptBox([2,0,0],[3.25,0,0]);[1.52,3.63,-.05,.05].forEach((v,i)=>close(box[i],v));
  const reverse=sweptBox([3.25,0,0],[2,0,0]);close(reverse[0],1.62);close(reverse[1],3.73);
  for(const [a,b] of [[[2,0,0],[2,0,1.5]],[[2,.1,-.4],[2.4,.7,1.8]],[[2,0,0],[1.8,.3,-1]]]){
    const box=sweptBox(a,b),mirrored=sweptBox([a[0],-a[1],-a[2]],[b[0],-b[1],-b[2]]);
    close(box[0],mirrored[0]);close(box[1],mirrored[1]);close(box[2],-mirrored[3]);close(box[3],-mirrored[2]);
    // Independent explicit rotated points at 1001 instants, including behind.
    for(let i=0;i<=1000;i++){const u=i/1000,x=a[0]+u*(b[0]-a[0]),y=a[1]+u*(b[1]-a[1]),yaw=a[2]+u*(b[2]-a[2]),dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy);
      for(const l of [-.38,.38])for(const w of [-.05,.05])for(const back of [0,.1]){
        const px=x+l*Math.cos(yaw)-w*Math.sin(yaw)-back*(d?dx/d:Math.cos(a[2])),py=y+l*Math.sin(yaw)+w*Math.cos(yaw)-back*(d?dy/d:Math.sin(a[2]));
        assert.ok(px>=box[0]-1e-12&&px<=box[1]+1e-12&&py>=box[2]-1e-12&&py<=box[3]+1e-12);
      }
    }
  }
});

test('typed extraction agrees with independent grid and layer expectations across seams',async()=>{
  const cache=new TerrainCache(),r=await cache.request(request());assert.equal(r.status,'complete');assert.ok(r.tiles.length>1);assert.ok(r.x instanceof Float64Array);assert.equal(r.offset.at(-1),r.lower.length);
  for(let j=0;j<r.ids.length;j++){
    close(r.x[j],(r.ids[j]%400+.5)*.02);close(r.y[j],-1.6+(Math.floor(r.ids[j]/400)+.5)*.02);
    assert.deepEqual(Array.from(r.normal.slice(3*j,3*j+3)),[0,0,1]);
    const rock=r.x[j]>=5.8&&r.x[j]<6.4&&r.y[j]>=-.1&&r.y[j]<.1;
    close(r.top[j],rock&&r.x[j]>=6?.05:.02);
    const start=r.offset[j],end=r.offset[j+1];assert.equal(end-start,rock&&r.x[j]<6?2:1);
    for(let k=start;k<end;k++){assert.ok(r.upper[k]>r.lower[k]);if(k>start)close(r.upper[k],r.lower[k-1]);}
    close(r.lower[end-1],-.2);
  }
  const step=r.features.find(f=>f.id==='stepped-rock'),face=step.faces.find(f=>f.normal[0]===-1&&f.indices.every(i=>step.vertices[i][0]===6));assert.ok(face);
  assert.deepEqual(face.normal,[-1,0,0]);assert.deepEqual([...new Set(face.indices.map(i=>step.vertices[i][2]))].sort((a,b)=>a-b),[-.03,.05]);
  assert.equal(new Set(r.features.map(f=>f.id)).size,r.features.length);
  for(const feature of r.features)for(const face of feature.faces){const [a,b,c]=face.indices.slice(0,3).map(i=>feature.vertices[i]),u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert.ok(cross.reduce((sum,x,i)=>sum+x*face.normal[i],0)>0,'outward winding agrees with face normal');}
  assert.equal(cache.bytes,cache.resident.length*97600);
});

test('off-centre edge within finite width survives extraction and source identities',async()=>{
  const r=await new TerrainCache().request(request({a:[5,.10,0],b:[5.02,.10,0]}));assert.equal(r.status,'complete');
  assert.ok(r.features.some(f=>f.id==='off-centre-edge'));
  const i=Array.from(r.y).findIndex((y,i)=>Math.abs(y-.13)<1e-12&&r.x[i]>4.8&&r.x[i]<5.4);assert.ok(i>=0);close(r.top[i],.07);
  const centre=Array.from(r.y).findIndex(y=>Math.abs(y-.09)<1e-12);close(r.top[centre],.02);
});

test('unknown cells/depth, outside source, revisions and bounded requests cannot admit movement',async()=>{
  assert.equal((await new TerrainCache({fixture:'hole'}).request(request({fixture:'hole'}))).status,'partial');
  assert.equal((await new TerrainCache().request(request({depth:[-.201,.2]}))).status,'unsupported');
  assert.equal((await new TerrainCache().request(request({a:[0,0,0],b:[.1,0,0]}))).status,'outside-domain');
  assert.equal((await new TerrainCache().request({...request(),snapshot:1})).status,'unsupported');
  assert.equal((await new TerrainCache().request({...request(),source:'layered/2'})).status,'unsupported');
  const budget=await new TerrainCache({tileLimit:1}).request(request());assert.equal(budget.status,'pending');assert.match(budget.reason,/budget/);
  const large=await new TerrainCache().request(request({a:[2,0,0],b:[6,0,Math.PI]}));assert.notEqual(large.status,'complete');
  const forged=await new TerrainCache({fixture:'hole'}).request({...request({fixture:'hole'}),box:[0,0,0,0]});assert.equal(forged.status,'partial');
  for(const p of [[NaN,0,0],[0,Infinity,0],[0,0]])assert.throws(()=>request({a:p}));
  assert.throws(()=>request({sequence:-1}));assert.throws(()=>request({optional:Array(9).fill([[1,0,0],[2,0,0]])}));
});

test('optional coverage can be clipped or miss the actual route without shrinking required cells',async()=>{
  const a=await new TerrainCache().request(request()),b=await new TerrainCache().request(request({optional:[[[.1,0,0],[.2,0,0]]]}));
  assert.equal(b.status,'complete');assert.equal(b.optionalClipped,true);assert.deepEqual(a.ids,b.ids);assert.deepEqual(a.lower,b.lower);
});

test('cache reuse, front/rear deduplication and eviction never mutate owned outputs',async()=>{
  const g=gate(),cache=new TerrainCache({delay:()=>g.promise,tileLimit:4});
  const front=cache.request(request()),rear=cache.request(request({wheel:'rear'}));await Promise.resolve();g.resolve();
  const [a,b]=await Promise.all([front,rear]);assert.equal(a.status,'complete');assert.equal(b.status,'complete');assert.equal(cache.stats.loads,a.tiles.length);
  const saved=serializable(a);const c=await cache.request(request({sequence:1,a:[2,0,0],b:[2.01,0,0]}));assert.equal(c.status,'complete');assert.ok(cache.stats.evictions>0);assert.deepEqual(serializable(a),saved);
  a.top.fill(99);const again=await cache.request(request({sequence:2}));assert.notEqual(again.top[0],99);assert.notEqual(b.top[0],99);
  const before=cache.stats.loads;await cache.request(request({sequence:3}));assert.equal(cache.stats.loads,before);
});

test('late results cannot cross reset, cancellation, sequence or failure boundaries',async()=>{
  const g=gate(),cache=new TerrainCache({delay:()=>g.promise});const old=cache.request(request());const newer=cache.request(request({sequence:1}));await Promise.resolve();g.resolve();
  assert.equal((await old).status,'cancelled');assert.equal((await newer).status,'complete');
  const h=gate(),reset=new TerrainCache({delay:()=>h.promise});const pending=reset.request(request());reset.reset();h.resolve();assert.equal((await pending).status,'cancelled');
  assert.equal((await reset.request(request())).status,'cancelled');assert.equal((await reset.request(request({generation:1}))).status,'complete');
  const c=gate(),cancel=new TerrainCache({delay:()=>c.promise});const cancelled=cancel.request(request());cancel.cancel('front');c.resolve();assert.equal((await cancelled).status,'cancelled');assert.equal((await cancel.request(request({sequence:1}))).status,'complete');
  const fail=new TerrainCache({delay:()=>Promise.reject(Error('source unavailable'))});const bad=await fail.request(request());assert.equal(bad.status,'failed');assert.match(bad.reason,/unavailable/);
});

test('whole-interval admission and deterministic replay match despite delivery order',async()=>{
  for(const name of ['straight','left','right','reverse','steer','missing']){
    const r=await replay(name);assert.equal(r.format,FORMAT);assert.ok(r.frames.length<=24);
    if(name==='missing'){assert.equal(r.frames.at(-1).accepted,false);assert.ok(r.frames.at(-1).response.missing.length);assert.ok(r.frames.slice(0,-1).every(f=>f.accepted));}
    else {assert.equal(r.frames.length,24);assert.ok(r.frames.every(f=>f.accepted));}
    assert.deepEqual(await verifyReplay(r),r);
  }
  const baseline=await replay('left'),delayed=await replay('left',{delay:key=>new Promise(resolve=>setTimeout(resolve,key.charCodeAt(0)%3))});
  assert.equal(compareReplay(delayed,baseline).maxDifference,0);
  assert.equal(compareReplay(delayed,baseline).cacheObservationsCompared,false);
  const changed=structuredClone(baseline);changed.frames[0].response.top[0]+=1;await assert.rejects(()=>verifyReplay(changed),/differs/);
});

test('out-of-order disjoint loads and queue pressure retain the newest request',async()=>{
  const oldGate=gate(),newGate=gate();
  const cache=new TerrainCache({delay:key=>Number(key.split(',')[0])<4?oldGate.promise:newGate.promise});
  const old=cache.request(request({a:[2,0,0],b:[2.01,0,0]}));
  const latest=cache.request(request({sequence:1}));await Promise.resolve();newGate.resolve();
  assert.equal((await latest).status,'complete');oldGate.resolve();assert.equal((await old).status,'cancelled');
  const g=gate(),limited=new TerrainCache({delay:()=>g.promise});
  const promises=Array.from({length:4},(_,sequence)=>limited.request(request({sequence})));
  assert.equal((await limited.request(request({sequence:4}))).status,'pending');g.resolve();
  const results=await Promise.all(promises);assert.equal(results.at(-1).status,'complete');assert.ok(results.slice(0,-1).every(r=>r.status==='cancelled'));
  assert.ok(limited.bytes<=LIMITS.tiles*97600);
});


test('global pending-load pressure is a visible wait, not a source failure',async()=>{
  const g=gate(),cache=new TerrainCache({delay:()=>g.promise});
  const a=cache.request(request({a:[2,0,0],b:[2.01,0,0]})),b=cache.request(request({sequence:1}));
  const wait=await cache.request(request({sequence:2,a:[4,0,0],b:[4.01,0,0]}));
  assert.equal(wait.status,'pending');assert.match(wait.reason,/budget/);g.resolve();await Promise.all([a,b]);
  assert.equal((await cache.request(request({sequence:3,a:[4,0,0],b:[4.01,0,0]}))).status,'complete');
});


test('cross-runtime geometry tolerance never relaxes source identities or topology',async()=>{
  const base=await replay('straight'),near=structuredClone(base);near.frames[0].response.top[0]+=5e-13;
  assert.ok(compareReplay(near,base).maxDifference>0);await verifyReplay(near);
  near.frames[0].response.top[0]+=2e-12;assert.throws(()=>compareReplay(near,base),/differs/);
  const wrong=structuredClone(base);wrong.frames[0].response.ids[0]++;assert.throws(()=>compareReplay(wrong,base),/identity/);
  const shape=structuredClone(base);shape.frames[0].response.offset.pop();assert.throws(()=>compareReplay(shape,base),/fields/);
});

const turn=()=>new Promise(resolve=>setImmediate(resolve));
const lookahead=[[[2,0,0],[2.01,0,0]]];
const low=key=>Number(key.split(',')[0])<4;
const beforeOptional=async promise=>{
  const value=await Promise.race([promise,turn().then(()=>null)]);
  assert.ok(value,'mandatory response must arrive before the optional gate is released');
  assert.equal(value.status,'complete');return value;
};

test('mandatory delivery and subsequent demand finish while unrelated optional I/O is held',async t=>{
  const g=gate();t.after(()=>g.resolve());
  const cache=new TerrainCache({delay:key=>low(key)?g.promise:Promise.resolve()});
  const response=await beforeOptional(cache.request(request({optional:lookahead})));
  const baseline=await new TerrainCache().request(request());
  assert.deepEqual(response.ids,baseline.ids);assert.deepEqual(response.lower,baseline.lower);
  const saved=serializable(response);assert.equal(cache.prefetch.active,1);assert.ok(cache.prefetch.queued>0);
  await beforeOptional(cache.request(request({sequence:1,a:[4,0,0],b:[4.01,0,0]})));
  assert.equal(cache.prefetch.queued,0);g.resolve();await turn();
  assert.equal(cache.prefetch.active,0);assert.ok(cache.resident.every(key=>!low(key)));
  assert.deepEqual(serializable(response),saved);
});

test('reset and cancellation discard queued and late optional tiles',async t=>{
  for(const stop of [cache=>cache.reset(),cache=>cache.cancel('front')]){
    const g=gate();t.after(()=>g.resolve());const cache=new TerrainCache({delay:key=>low(key)?g.promise:Promise.resolve()});
    await beforeOptional(cache.request(request({optional:lookahead})));stop(cache);
    assert.equal(cache.prefetch.queued,0);g.resolve();await turn();
    assert.equal(cache.prefetch.active,0);assert.ok(cache.resident.every(key=>!low(key)));
    assert.ok(cache.prefetch.discarded>0);
  }
});

test('optional failures are observed without rejecting or mutating mandatory output',async()=>{
  const cache=new TerrainCache({delay:key=>low(key)?Promise.reject(Error('optional unavailable')):Promise.resolve()});
  const response=await cache.request(request({optional:lookahead})),saved=serializable(response);
  assert.equal(response.status,'complete');await turn();
  assert.ok(cache.prefetch.failed>0);assert.equal(cache.prefetch.active,0);
  assert.deepEqual(serializable(response),saved);
});

test('new demand promotes an in-flight optional tile and shares its source load',async t=>{
  const g=gate(),calls=new Map();t.after(()=>g.resolve());
  const cache=new TerrainCache({delay:key=>{calls.set(key,(calls.get(key)||0)+1);return low(key)?g.promise:Promise.resolve();}});
  await beforeOptional(cache.request(request({optional:lookahead})));
  const demand=cache.request(request({sequence:1,a:[2,0,0],b:[2.01,0,0]}));
  await turn();g.resolve();const response=await demand;
  assert.equal(response.status,'complete');assert.ok(response.tiles.every(key=>calls.get(key)===1));
  const baseline=await new TerrainCache().request(request({a:[2,0,0],b:[2.01,0,0]}));
  assert.deepEqual(response.top,baseline.top);assert.deepEqual(response.ids,baseline.ids);
});

test('prefetch is bounded and cannot evict demand-resident tiles',async t=>{
  const g=gate();t.after(()=>g.resolve());let active=0,peak=0;
  const cache=new TerrainCache({tileLimit:6,delay:async key=>{active++;peak=Math.max(peak,active);try{if(low(key))await g.promise;}finally{active--;}}});
  await beforeOptional(cache.request(request({optional:lookahead})));
  assert.equal(active,1);assert.ok(cache.prefetch.queued<=LIMITS.prefetchQueued);
  await beforeOptional(cache.request(request({wheel:'rear',a:[4,0,0],b:[4.01,0,0]})));
  const resident=cache.resident;assert.equal(resident.length,6);g.resolve();await turn();
  assert.deepEqual(cache.resident,resident);assert.ok(cache.prefetch.discarded>0);
  assert.ok(peak<=LIMITS.pending);assert.equal(cache.prefetch.active,0);assert.equal(cache.bytes,6*97600);
});

test('new replay validates cache observations without claiming deterministic cache timing',async()=>{
  const base=await replay('straight'),changed=structuredClone(base);
  changed.frames[0].cache.hits+=7;assert.equal(compareReplay(changed,base).cacheObservationsCompared,false);
  assert.deepEqual(await verifyReplay(changed),changed);
  for(const corrupt of [c=>c.bytes++,c=>c.prefetch.queued=9,c=>c.prefetch.active=2,c=>c.extra=1,c=>c.resident.push('99,0')]){
    const bad=structuredClone(base);corrupt(bad.frames[0].cache);assert.throws(()=>compareReplay(bad,base),/cache observation/);
  }
});

test('all six legacy records retain their original bytes and strict cache verification',async()=>{
  const hashes=JSON.parse(await readFile(new URL('./fixtures/terrain-request-legacy-hashes.json',import.meta.url),'utf8'));
  for(const [name,hash] of Object.entries(hashes)){
    const record=await replay(name,{format:LEGACY_FORMAT});
    assert.equal(createHash('sha256').update(JSON.stringify(record)).digest('hex'),hash,name);
    assert.deepEqual(await verifyReplay(record),record);
    const changed=structuredClone(record);changed.frames[0].cache.hits++;
    assert.throws(()=>compareReplay(changed,record),/identity/);
  }
});

test('the same held source blocks legacy delivery but not mandatory-first delivery',async t=>{
  const g=gate();t.after(()=>g.resolve());const delay=key=>low(key)?g.promise:Promise.resolve();
  let legacyFinished=false;
  const old=new TerrainCache({delay}).request(request({format:LEGACY_FORMAT,optional:lookahead})).then(r=>{legacyFinished=true;return r;});
  const current=await beforeOptional(new TerrainCache({delay}).request(request({optional:lookahead})));
  assert.equal(legacyFinished,false);g.resolve();const legacy=await old;
  assert.equal(legacy.status,'complete');assert.deepEqual(current.ids,legacy.ids);assert.deepEqual(current.top,legacy.top);
});

test('wide speculative routes cap the queue and keep only one optional load active',async t=>{
  const g=gate();t.after(()=>g.resolve());let held=0;
  const cache=new TerrainCache({delay:key=>{
    const [x,y]=key.split(',').map(Number);if((x===6||x===7)&&(y===1||y===2))return Promise.resolve();
    held++;return g.promise.finally(()=>held--);
  }});
  const optional=Array.from({length:8},(_,i)=>[[.8+i*.7,.8,0],[.81+i*.7,.8,0]]);
  await beforeOptional(cache.request(request({optional})));await turn();
  assert.equal(held,1);assert.equal(cache.prefetch.active,1);
  assert.ok(cache.prefetch.queued<=LIMITS.prefetchQueued);assert.ok(cache.prefetch.discarded>0);
  cache.cancel('front');g.resolve();await turn();assert.equal(held,0);assert.equal(cache.prefetch.queued,0);
});
