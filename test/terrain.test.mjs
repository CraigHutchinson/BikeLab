import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, probe, validateProfile, parseProfile, MAX_PROFILE_BYTES } from '../dist/terrain.js';

const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}`);
const query=(profile,center,radius=.36)=>probe(profile,{center,radius});
const profile=points=>({...fixture('flat'),points});

test('spatial clearance agrees with independent plane and inclined-line geometry',()=>{
  for(const r of [.01,.36,2]) for(const gap of [-.005,0,.1]) {
    const a=query(profile([[-4,0],[4,0]]),[0,r+gap],r);
    assert.equal(a.status,'available');near(a.gap,gap);assert.equal(a.witnesses.length,1);
    assert.deepEqual(a.witnesses[0].point,[0,0]);assert.deepEqual(a.witnesses[0].normal,[0,1]);
  }
  // z=x, centre (0,1): perpendicular distance 1/sqrt(2), foot (.5,.5).
  const a=query(profile([[-2,-2],[2,2]]),[0,1]);
  near(a.gap,1/Math.sqrt(2)-.36);
  near(a.witnesses[0].point[0],.5);near(a.witnesses[0].point[1],.5);
  near(a.witnesses[0].normal[0],-1/Math.sqrt(2));near(a.witnesses[0].normal[1],1/Math.sqrt(2));
});
test('square corner is encountered before axle arrival and differs from rounded/flat controls',()=>{
  const a=query(fixture('square'),[-.2,.36]);
  near(a.gap,Math.hypot(.2,.26)-.36);assert.ok(a.gap<0);
  assert.equal(a.witnesses.length,1);assert.deepEqual(a.witnesses[0].feature,{kind:'vertex',index:2});
  assert.deepEqual(a.witnesses[0].point,[0,.1]);assert.ok(a.witnesses[0].normal[0]<0);
  near(query(fixture('flat'),[-.2,.36]).gap,0);
  const rounded=query(fixture('rounded'),[-.2,.36]);
  assert.ok(rounded.gap>a.gap+.02);
  // Tiny wheel centred opposite the vertical face, above the ground.
  const face=query(fixture('square'),[-.02,.05],.01);
  assert.deepEqual(face.witnesses[0].feature,{kind:'segment',index:1});
  near(face.gap,.01);assert.deepEqual(face.witnesses[0].normal,[-1,0]);
});
test('nearest witnesses retain separate supports, deduplicate vertices and have unit normals',()=>{
  const valley=profile([[-2,2],[0,0],[2,2]]),a=query(valley,[0,1]);
  assert.equal(a.witnesses.length,2);
  for(const w of a.witnesses)near(Math.hypot(...w.normal),1,1e-12);
  near(a.witnesses[0].point[0],-.5);near(a.witnesses[1].point[0],.5);
  const vertex=query(profile([[-1,0],[0,0],[1,0]]),[0,.36]);
  assert.equal(vertex.witnesses.length,1);near(vertex.gap,0);
});
test('clearance is invariant to segment subdivision, translation and uniform scale',()=>{
  const original=fixture('square'),center=[-.2,.36],base=query(original,center);
  const points=[];
  for(let i=0;i<original.points.length-1;i++) {
    const a=original.points[i],b=original.points[i+1];points.push(a,[(a[0]+b[0])/2,(a[1]+b[1])/2]);
  }
  points.push(original.points.at(-1));near(query(profile(points),center).gap,base.gap);
  for(const factor of [.1,2]) {
    const map=([x,z])=>[factor*x+13,factor*z-7];
    const a=query(profile(original.points.map(map)),map(center),.36*factor);
    near(a.gap,base.gap*factor);
    for(let j=0;j<2;j++)near(a.witnesses[0].normal[j],base.witnesses[0].normal[j]);
  }
});
test('rounded polyline approaches circle-circle clearance within independent sagitta bounds',()=>{
  const center=[-.1,.3],R=.1,r=.2,exact=Math.hypot(center[0]-.1,center[1])-R-r;
  let previous=Infinity;
  for(const n of [8,16,32,64,128]) {
    const a=query(fixture('rounded',n),center,r),error=a.gap-exact;
    assert.ok(error>=-1e-14);assert.ok(error<=R*(1-Math.cos(Math.PI/(2*n)))+1e-14);
    assert.ok(error<=previous+1e-14);previous=error;
  }
  assert.ok(previous<1e-5);
});
test('domain, buried and boundary states report unavailable without invented contacts',()=>{
  const flat=fixture('flat');
  for(const center of [[.9,.36],[0,-.1],[0,0]]) {
    const a=query(flat,center);assert.equal(a.status,'unavailable');assert.ok(a.reason);
    assert.equal(a.gap,undefined);assert.equal(a.witnesses,undefined);
  }
  assert.equal(query(flat,[.64,.36]).status,'available');
  assert.equal(query(flat,[.640001,.36]).status,'unavailable');
  assert.equal(query(fixture(),[.1,.05],.01).status,'unavailable');
  assert.equal(query(fixture(),[0,.05],.01).status,'unavailable');
});
test('profile authoring rejects ambiguous, unsupported, nonfinite and oversized input',()=>{
  for(const mutate of [p=>p.units='mm',p=>p.axes='other',p=>p.solid='above',p=>p.interpolation='spline',
    p=>p.format='future',p=>p.layers=[],p=>delete p.source,p=>p.source.kind='unknown',p=>p.source.description='',
    p=>p.points=[[0,0],[0,1]],p=>p.points=[[1,0],[0,0]],p=>p.points=[[0,0],[0,0],[1,0]],
    p=>p.points=[[0,0],[0,1],[0,.5],[1,0]],p=>p.points=[[0,0],[NaN,0]],
    p=>p.points=[[0,0],[1001,0]],p=>p.points=[[0,0],[1e-8,0]],p=>p.points=Array(2049).fill([0,0])]) {
    const p=fixture();mutate(p);assert.throws(()=>validateProfile(p));
  }
  assert.throws(()=>parseProfile(' '.repeat(MAX_PROFILE_BYTES+1)),/256 KiB/);
  assert.throws(()=>parseProfile('{'));
  for(const setup of [{center:[0,.36],radius:0},{center:[0,.36],radius:3},{center:[0,Infinity],radius:.36},
    {center:[0,.36],radius:.36,layers:[]},{center:[0,.36]}]) assert.throws(()=>probe(fixture(),setup));
  assert.throws(()=>fixture('unknown'));assert.throws(()=>fixture('rounded',3));
});
test('profile/report JSON preserves provenance and reports own their inputs',()=>{
  const p=parseProfile('\uFEFF'+JSON.stringify(fixture())),setup={center:[-.2,.36],radius:.36};
  const a=probe(p,setup),copy=JSON.parse(JSON.stringify(a));
  assert.deepEqual(probe(copy.profile,copy.setup),a);
  p.points[0][0]=-9;setup.center[0]=1;
  assert.equal(a.profile.points[0][0],-1);assert.equal(a.setup.center[0],-.2);
});
