import test from 'node:test';
import assert from 'node:assert/strict';
import {run,replay,preset,validate,profileSupport,rimSweep,MODEL} from '../dist/trail-bike.js';
import {probe} from '../dist/terrain.js';
import {geometryFor} from '../dist/linkage.js';
import {impactMetrics} from '../scripts/impact-diagnostics.mjs';
const near=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}, tolerance ${t}`);
test('sharp terrain retains authored vertices and invalid ordered geometry is rejected',()=>{
 for(const name of ['square','faceted','edge-limit']){const a=preset(name),v=validate(a);assert.deepEqual(v.profile.points,a.profile.points);assert.equal(profileSupport(v.profile).regime,'experimental-sharp-impact');}
 assert.equal(profileSupport(validate(preset('square')).profile).verticalFaces,2);
 assert.equal(profileSupport(validate(preset('bump')).profile).regime,'smooth-reference');
 for(const points of [[[-3,0],[0,0],[-.01,.1],[5,0]],[[-3,0],[0,0],[0,.1],[0,.05],[5,0]],[[-11,0],[5,0]]])assert.throws(()=>validate({...preset('square'),profile:{...preset('square').profile,points}}));
});
test('connected rim guard accepts typed state and catches a thin between-endpoint grazing hit',()=>{
 const p=preset('square').profile;p.points=[[-3,0],[0,0],[0,.1],[.001,.1],[.001,0],[5,0]];
 for(const [height,status] of [[.39,'rim-contact'],[.39001,'clear'],[.38999,'rim-contact']]){
  const start=new Float64Array([-.6,height]),delta=new Float64Array([1.2,0]),gap=probe(p,{center:Array.from(start),radius:.29}).gap;
  assert.ok(gap>0);assert.ok(probe(p,{center:[.6,height],radius:.29}).gap>0);
  const hit=rimSweep(p,start,delta,gap,.29,.36);assert.equal(hit.status,status);if(height===.39)near(hit.fraction,.5,1e-9);
 }
 const far=rimSweep(p,[0,1],[.001,0],.61,.29,.36);assert.equal(far,null);
});
test('both connected bikes receive square and faceted impacts within bounded contact and travel support',async()=>{
 for(const bike of ['full','hardtail'])for(const name of ['square','faceted']){
  const r=await run(preset(name,bike)),m=impactMetrics(r),g=geometryFor(r.scenario.bike);assert.equal(r.status,'completed');
  for(let k=0;k<2;k++){assert.ok(m.contacts[k]>0);assert.ok(m.peakSampledContactHorizontal[k]>20,'both wheels meet the rock');}
  assert.ok(m.maxWitnessDistance<=m.witnessBudget);assert.ok(m.maxNormalAngleError<.005,'native normal within declared 0.005 rad surface/cone accuracy budget');
  assert.ok(m.maxWrenchError<1e-7);assert.ok(r.summary.maxSampledRootWrench<1e-7);assert.ok(r.summary.maxSampledBearingMoment<1e-7);assert.ok(r.summary.maxDiagnosticDifference<1e-7);assert.ok(r.summary.maxResidual/r.summary.initialEnergy<.005);
  for(const f of r.frames){assert.ok(f.fork>=0&&f.fork<=g.forkTravel);assert.ok(f.shock>=0&&f.shock<=g.shockTravel);assert.ok(Math.abs(f.riderOffset)<=r.scenario.bike.riderTravel);for(const w of f.wheels){assert.ok(w.limits.rimGap>0);assert.ok(w.limits.penetration<=r.scenario.wheel.maxPenetration);assert.ok(w.limits.strain<=r.scenario.wheel.maxStrain);}for(const c of f.contacts){assert.ok(c.normalForce>0);near(Math.hypot(...c.normal),1,1e-8);}}
 }
});
test('overload stops before accepting unsupported impact state and replays its rollback',async()=>{
 for(const bike of ['full','hardtail']){const r=await run(preset('edge-limit',bike));assert.equal(r.status,'terminated');assert.match(r.termination.reason,/frontwheel-(casing-strain|contact-penetration)-limit/);const last=r.frames.at(-1);near(last.time,r.termination.time,1e-12);near(r.termination.attemptedTime-last.time,r.scenario.motion.dt,1e-12);for(const w of last.wheels){assert.ok(w.limits.penetration<=r.scenario.wheel.maxPenetration);assert.ok(w.limits.strain<=r.scenario.wheel.maxStrain);}assert.equal(r.termination.attemptedLimits[1].reason,'not-evaluated');assert.equal(r.termination.attemptedLimits[1].strain,null);assert.deepEqual(await replay(JSON.parse(JSON.stringify(r))),r);}
});
test('collinear terrain subdivision cannot create duplicate support or change the trajectory',async()=>{
 const a={...preset('square'),motion:{duration:.3}},split=structuredClone(a),p=a.profile.points;split.profile.points=p.flatMap((v,i)=>i<p.length-1?[v,[(v[0]+p[i+1][0])/2,(v[1]+p[i+1][1])/2]]:[v]);
 const r=await run(a),s=await run(split);assert.deepEqual(s,r);
});
test('legacy smooth records migrate without changing physics; false legacy sharp records are rejected',async()=>{
 const r=await run({...preset('flat'),motion:{duration:.02}}),saved=structuredClone(r);saved.model='bikelab-trail-bike-0.1';delete saved.contactSupport;saved.frames[0].frame[0]=999;const migrated=await replay(saved);assert.equal(migrated.model,MODEL);assert.deepEqual(migrated,r);saved.scenario.profile=preset('square').profile;assert.throws(()=>replay(saved),/Legacy/);
});
