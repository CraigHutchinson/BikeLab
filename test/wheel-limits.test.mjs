import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,probe} from '../dist/terrain.js';
import {sweepRim,assessAssembly,illustrativeAssembly,experiment,example,replay,PRESSURE_BANDS,validateAssembly} from '../dist/wheel-limits.js';
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}`);
const flat=()=>fixture('flat'),profile=points=>({...flat(),points});
test('continuous rim cast matches independent plane, slope and corner geometry',()=>{
 const a=sweepRim(flat(),[0,.4],[0,-.3],.29,.36);assert.equal(a.status,'rim-contact');near(a.fraction,(.4-.29)/.3);near(a.clearance.gap,0);assert.deepEqual(a.clearance.witnesses[0].normal,[0,1]);
 const b=sweepRim(profile([[-2,-2],[2,2]]),[0,1],[0,-1],.2,.3);near(b.fraction,1-.2*Math.sqrt(2));near(b.clearance.gap,0);
 const step=fixture('square'),r=.29,h=.36,x=-Math.sqrt(r*r-(h-.1)**2),c=sweepRim(step,[-.4,h],[.7,0],r,.36);assert.equal(c.status,'rim-contact');near(c.center[0],x);assert.deepEqual(c.clearance.witnesses[0].point,[0,.1]);
});
test('continuous search catches thin between-endpoint obstacles and grazing without sample rate',()=>{
 const p=profile([[-2,0],[0,0],[0,.1],[.001,.1],[.001,0],[2,0]]),start=[-.6,.39],delta=[1.2,0];
 assert.ok(probe(p,{center:start,radius:.29}).gap>0);assert.ok(probe(p,{center:[.6,.39],radius:.29}).gap>0);
 const a=sweepRim(p,start,delta,.29,.36);assert.equal(a.status,'rim-contact');near(a.fraction,.5);near(a.clearance.gap,0);
 const missed=sweepRim(p,[-.6,.39001],delta,.29,.36);assert.equal(missed.status,'clear');
 const hit=sweepRim(p,[-.6,.38999],delta,.29,.36);assert.equal(hit.status,'rim-contact');assert.ok(hit.fraction<.5);
});
test('subdivision, translated geometry, reversal and tied witnesses preserve contact',()=>{
 const p=profile([[-2,0],[2,0]]),start=[0,.4],delta=[0,-.2],a=sweepRim(p,start,delta,.29,.36),split=profile([[-2,0],[-.5,0],[0,0],[.5,0],[2,0]]);near(sweepRim(split,start,delta,.29,.36).fraction,a.fraction);
 const shift=([x,z])=>[x+12,z-7],moved={...p,points:p.points.map(shift)};near(sweepRim(moved,shift(start),delta,.29,.36).fraction,a.fraction);
 const valley=profile([[-2,2],[0,0],[2,2]]),tie=sweepRim(valley,[0,1],[0,-1],.2,.3);near(tie.fraction,1-.2*Math.sqrt(2));assert.equal(tie.clearance.witnesses.length,2);
 const step=fixture('square'),left=sweepRim(step,[-.4,.36],[.7,0],.29,.36),right=sweepRim(step,[.6,.36],[-.7,0],.29,.36);near(left.fraction,right.fraction);
});
test('domain precedence, initial limits and zero movement are explicit',()=>{
 const p=flat(),outside=sweepRim(p,[.65,.4],[0,-.1],.29,.36);assert.equal(outside.status,'invalid-start');near(outside.fraction,0);
 const domain=sweepRim(p,[0,.5],[1,0],.29,.36);assert.equal(domain.status,'domain-boundary');near(domain.fraction,.64);
 const endpoint=sweepRim(p,[0,.5],[.64,0],.29,.36);assert.equal(endpoint.status,'domain-boundary');near(endpoint.fraction,1);
 const endTie=sweepRim(p,[0,.4],[.64,-.11],.29,.36);assert.deepEqual(endTie.events,['rim-contact','authored-domain-boundary']);
 const initialTie=sweepRim(p,[.64,.29],[.1,0],.29,.36);assert.deepEqual(initialTie.events,['rim-contact','authored-domain-boundary']);
 assert.equal(sweepRim(p,[.64,.5],[-.1,0],.29,.36).status,'clear');
 assert.equal(sweepRim(p,[0,.2],[0,1],.29,.36).status,'initial-rim-overlap');
 assert.equal(sweepRim(p,[0,.29],[0,1],.29,.36).status,'rim-contact');
 const zero=sweepRim(p,[0,.4],[0,0],.29,.36);assert.equal(zero.status,'clear');assert.equal(zero.distance,0);
 const same=sweepRim(p,[0,.4],[1,-(.4-.29)/.64],.29,.36);near(same.fraction,.64);assert.deepEqual(same.events,['rim-contact','authored-domain-boundary']);
 assert.throws(()=>sweepRim(p,[0,.4],[3,0],.29,.36));assert.throws(()=>sweepRim(p,[0,NaN],[0,0],.29,.36));
});
test('sourced width bands, lower component maximum and exact pressure boundaries govern admission',()=>{
 for(const [lo,hi,max] of PRESSURE_BANDS)for(const mm of [lo,hi]){const a={...illustrativeAssembly(),tyreWidth:mm/1000,tyreMaxPressure:1000000,rimMaxPressure:1000000,pressure:max};assert.equal(assessAssembly(a,.305).status,'within-declared-limits');assert.equal(assessAssembly({...a,pressure:max+1},.305).status,'incompatible');}
 const a=illustrativeAssembly();near(assessAssembly(a,.305).knownMaximumPa,250000);near(assessAssembly({...a,rimMaxPressure:190000},.305).knownMaximumPa,190000);near(assessAssembly({...a,tyreMaxPressure:185000},.305).knownMaximumPa,185000);
 assert.equal(assessAssembly({...a,pressure:250001},.305).issues[0].code,'pressure-exceeded');
 assert.equal(assessAssembly({...a,brand:'other',pressure:270000},.305).status,'within-declared-limits');assert.equal(assessAssembly({...a,rimType:'hooked',pressure:270000},.305).status,'within-declared-limits');
 assert.equal(assessAssembly({...a,tyreWidth:.085},.305).status,'unknown');assert.throws(()=>validateAssembly({...a,tyreWidth:.0605}));
});
test('unknown evidence and incompatible components cannot masquerade as strength or safe inflation',()=>{
 const unknown=assessAssembly();assert.equal(unknown.status,'unknown');assert.equal(unknown.knownMaximumPa,null);assert.ok(Object.values(unknown.failureCriteria).every(x=>x===null));
 const a=illustrativeAssembly();for(const patch of [{rimBsd:.622},{widthPairApproved:false},{pairApproved:false},{rimTubelessApproved:false},{construction:'other'},{standardCompliant:false}])assert.equal(assessAssembly({...a,...patch},.32).status,'incompatible');
 assert.equal(assessAssembly(a,.29).status,'incompatible');assert.equal(assessAssembly({...a,rimMaxPressure:null},.305).status,'unknown');
 assert.equal(assessAssembly({...a,pressure:0},.305).status,'incompatible');assert.throws(()=>assessAssembly(a,NaN));
 assert.equal(assessAssembly({...a,pressure:null},.305).status,'unknown');assert.throws(()=>validateAssembly({pressure:Infinity}));assert.throws(()=>validateAssembly({rimType:'fake'}));assert.throws(()=>validateAssembly({tyreId:3}));assert.throws(()=>validateAssembly({sources:{extra:{}}}));
});
test('assessment is consumed, replay owns inputs and historical static law is not pressure-scaled',()=>{
 const a=example(),r=experiment(a);assert.equal(r.assessment.status,'unknown');assert.equal(r.status,'rim-contact');assert.equal(r.staticAtStart.status,'solved');
 const known={...a,params:{...a.params,rimRadius:.305},assembly:illustrativeAssembly()},low=experiment(known),high=experiment({...known,assembly:{...known.assembly,pressure:250000}});assert.deepEqual(low.staticAtStart,high.staticAtStart);
 const rejected=experiment({...known,assembly:{...known.assembly,pressure:250001}});assert.equal(rejected.status,'assembly-rejected');assert.equal(rejected.sweep,undefined);assert.equal(rejected.staticAtStart,undefined);
 const copied=JSON.parse(JSON.stringify(low));copied.sweep.fraction=-1;assert.deepEqual(replay(copied),low);delete copied.assembly.pressure;assert.throws(()=>replay(copied));
 a.profile.points[0][0]=-9;assert.equal(r.profile.points[0][0],-1);assert.throws(()=>experiment({delta:[0,-3]}));assert.throws(()=>replay({...r,model:'future'}));
});
