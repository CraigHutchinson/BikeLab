import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runTranslation,translationXML,createTranslationGuard,compareTranslation,STEPS,BUDGETS} from '../scripts/casing-translate.mjs';
import {controlInput} from '../scripts/casing-derivative.mjs';
import {oscillatorState} from '../dist/suspension-reference.js';
import {getRuntime} from '../dist/moving-wheel.js';
const examples=JSON.parse(await readFile(new URL('../dist/tyre-fixture-examples.json',import.meta.url))).cases;
const near=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}, tolerance ${t}`);

test('translating mass and free fall use absolute node motion under rotated local axes',async()=>{
 const a=await controlInput({nodes:32});a.seed.q.fill(0);a.seed.v.fill(0);a.seed.gravity=9.80665;const angle=.17;a.seed.hub.quaternion=[Math.cos(angle/2),0,Math.sin(angle/2),0];
 const v0=[.13,-.07],r=await runTranslation(a,{hubVelocity:v0}),gx=a.seed.gravity*Math.sin(angle),gz=-a.seed.gravity*Math.cos(angle);
 assert.equal(r.status,'completed');near(r.compiled.totalMass,2.5,1e-14);assert.ok(r.compiled.massError<=BUDGETS.mass);assert.equal(r.summary.maxContacts,0);assert.equal(r.frames.at(-1).contactWork,0);assert.ok(r.summary.maxMomentumError<BUDGETS.momentum);
 for(const f of r.frames){for(let k=0;k<2;k++){const g=k?gz:gx;near(f.q[k],v0[k]*f.time+.5*g*f.time**2,1e-12);near(f.v[k],v0[k]+g*f.time,1e-10);}for(let j=2;j<f.q.length;j++){near(f.q[j],0,1e-12);near(f.v[j],0,1e-10);}assert.ok(f.dampingLoss<1e-18);}
 assert.deepEqual(await runTranslation(a,{hubVelocity:v0}),r);
});

test('uniform relative mode follows the reduced-mass oscillator and physical hub reaction',async()=>{
 const a=await controlInput({nodes:32,edgeViscosity:3}),v0=[-.03,.02],r=await runTranslation(a,{hubVelocity:v0}),mt=r.compiled.tyreMass,mh=r.compiled.hubMass,M=mt+mh,K=r.compiled.foundationStiffness.filter((_,i)=>i%2===0).reduce((x,y)=>x+y,0),mu=mt*mh/M,out=new Float64Array(2);
 assert.equal(r.status,'completed');assert.ok(Object.values(r.summary.maxObserver).every(x=>x===0));
 for(const f of r.frames){oscillatorState(mu,K,0,.001,.01,f.time,out);near(f.q[0],(v0[0]+mt/M*.01)*f.time-mt/M*(out[0]-.001),1e-11);near(f.v[0],v0[0]+mt/M*(.01-out[1]),1e-8);near(f.q[1],v0[1]*f.time,1e-12);near(f.hubReaction[0],K*out[0],1e-7);for(let i=0;i<32;i++){near(f.q[2+2*i],out[0],1e-11);near(f.v[2+2*i],out[1],1e-8);}assert.ok(f.dampingLoss<1e-18);assert.equal(f.contactWork,0);assert.ok(Math.abs(f.residual)<1e-10);}
});

test('loaded release records the changed compiled contact approximation and full wheel force/work',async()=>{
 for(const example of examples){
  const r=await runTranslation(example.input,{duration:.000125});assert.equal(r.status,'completed');assert.ok(r.summary.minContacts>0);assert.ok(r.summary.maxResidual<1e-10);assert.ok(r.summary.maxMomentumError<1e-10);
  const {fixed,translating}=r.compiled;assert.equal(fixed.rows.length,translating.rows.length);for(let i=0;i<fixed.rows.length;i++){near(translating.rows[i].diagonalApproximation/fixed.rows[i].diagonalApproximation,2/3,1e-12);near(translating.rows[i].regularizer/fixed.rows[i].regularizer,2/3,1e-12);}
  assert.ok(r.frames.at(-1).hub[1]>r.frames[0].hub[1]);assert.ok(r.frames[0].hubReaction[1]>200);assert.notEqual(r.frames[0].hubReaction[1],r.frames[0].verticalForce);
 }
});

test('bad stage restores coupled coordinates, warm start, momentum and work prefix',async()=>{
 const a=examples[0].input,clean=await runTranslation(a),mj=await getRuntime(),forward=mj.mj_forwardSkip;let calls=0,accepted;
 // Observe the actual accepted pre-step state without modifying the native step.
 const step=mj.mj_step;mj.mj_step=(m,d)=>{step(m,d);if(d.time>=.000125-1e-12&&d.time<.000126)accepted={q:Array.from(d.qpos),v:Array.from(d.qvel),warmstart:Array.from(d.qacc_warmstart)};};
 mj.mj_forwardSkip=(m,d,s,skip)=>{forward(m,d,s,skip);if(++calls===3*64+2)d.geom_xpos[2]+=.01;};let r;
 try{r=await runTranslation(a);}finally{mj.mj_forwardSkip=forward;mj.mj_step=step;}
 assert.equal(r.status,'terminated');assert.equal(r.summary.steps,64);assert.match(r.termination.reason,/Vertex-plane gap mismatch/);assert.deepEqual(r.finalState,accepted);assert.deepEqual(r.frames,clean.frames.slice(0,2));assert.ok(r.summary.maxResidual<=clean.summary.maxResidual);assert.ok(r.summary.maxMomentumError<=clean.summary.maxMomentumError);
});

test('translation admission, finite domain and refinement keep inputs and boundary conditions distinct',async()=>{
 const a=examples[0].input;for(const options of [{dt:.00003125},{duration:1},{hubVelocity:[0,NaN]},{hubVelocity:[0,0,0]},{hubVelocity:Array(2)},{bogus:true},{comparison:1}])await assert.rejects(runTranslation(a,options));assert.throws(()=>translationXML(a,.001));const accessor=[0,0];Object.defineProperty(accessor,'0',{get(){throw Error('getter invoked');},enumerable:true});await assert.rejects(runTranslation(a,{hubVelocity:accessor}),/Invalid hub-local velocity/);
 const outside=structuredClone(a);outside.seed.hub.position[0]=9;await assert.rejects(runTranslation(outside),/authored-domain/);
 const x=await runTranslation(a,{duration:.000125,comparison:true}),y=await runTranslation(a,{dt:STEPS[1],duration:.000125,comparison:true});assert.equal(compareTranslation(x,y).samples,65);assert.equal(compareTranslation(x,y).withinBudgets,true);assert.throws(()=>compareTranslation(x,x),/halving/);const combined=structuredClone(y);combined.comparison.trajectory.set(x.comparison.trajectory);combined.comparison.trajectory[0]+=.75e-7;combined.comparison.trajectory[2]+=.75e-7;const physical=compareTranslation(x,combined);assert.ok(physical.maxima.position>1e-7);assert.equal(physical.withinBudgets,false);
 const altered=structuredClone(y);altered.diagnostic.hubVelocity[0]=.1;assert.throws(()=>compareTranslation(x,altered));
});

test('attempted native and observer warnings retain the accepted coupled record',async()=>{
 const a=examples[0].input,clean=await runTranslation(a),mj=await getRuntime(),step=mj.mj_step,forward=mj.mj_forwardSkip;
 const warn=d=>{const w=d.warning,s=w.get(0);try{s.number=1;s.lastinfo=99;w.set(0,s);}finally{s.delete();}};
 for(const source of ['native','observer'])for(const tick of [1,65]){
  let calls=0;if(source==='native')mj.mj_step=(m,d)=>{step(m,d);if(++calls===tick)warn(d);};else mj.mj_forwardSkip=(m,d,s,skip)=>{forward(m,d,s,skip);if(++calls===3*(tick-1)+2)warn(d);};let r;
  try{r=await runTranslation(a);}finally{mj.mj_step=step;mj.mj_forwardSkip=forward;}
  assert.equal(r.status,'terminated');assert.equal(r.summary.steps,tick-1);assert.match(r.termination.reason,/warning/i);assert.deepEqual(r.frames,clean.frames.slice(0,tick===1?1:2));assert.equal((source==='native'?r.nativeWarnings:r.observerWarnings).length,1);
 }
});

test('normal oracle checks source coefficients independently and receives configured contact parameters',async()=>{
 const mj=await getRuntime();
 for(const [tau,impedance] of [[.0005,.99],[.0015,.97]]){
  const a=structuredClone(examples[0].input);a.seed.wheel.contactTime=tau;a.seed.wheel.contactImpedance=impedance;
  const m=mj.MjModel.from_xml_string(translationXML(a)),d=new mj.MjData(m);
  try{
   d.qpos.set(a.seed.q,2);d.qvel.set(a.seed.v,2);mj.mj_forward(m,d);assert.ok(d.nefc>0);
   const guard=createTranslationGuard(mj,m,d,a),o=guard.observe(d);
   for(const k of ['normalForce','referenceAcceleration','regularizer'])assert.ok(o.metrics[k]<=BUDGETS[k]);
   for(const [field,delta,reason] of [['efc_aref',.001,/referenceAcceleration/],['efc_R',.001,/regularizer/],['efc_force',.001,/normalForce|force/]]){
    const previous=d[field][0];d[field][0]+=delta;assert.throws(()=>guard.observe(d),reason);d[field][0]=previous;
   }
   guard.observe(d);
   m.opt.enableflags|=mj.mjtEnableBit.mjENBL_DIAGEXACT.value;assert.throws(()=>createTranslationGuard(mj,m,d,a));
  }finally{d.delete();m.delete();}
  const r=await runTranslation(a,{duration:.000125});assert.equal(r.status,'completed');
 }
});

test('separated fast-closing vertices get no force; active rows distinguish compression from separation',async()=>{
 const a=await controlInput({nodes:32});a.seed.q.fill(0);a.seed.v.fill(0);const mj=await getRuntime(),w=a.seed.wheel;
 for(const {gap,vz,detectionGap} of [{gap:1e-5,vz:-.1,detectionGap:false},{gap:1e-5,vz:-.1,detectionGap:true},{gap:-1e-5,vz:-.1,detectionGap:false},{gap:-1e-5,vz:.1,detectionGap:false}]){
  let xml=translationXML(a);
  // A synthetic detection margin creates an owned but excluded contact with
  // zero inclusion margin. Production XML retains zero detection margin.
  if(detectionGap)xml=xml.replace('<geom name="ground1"','<geom gap=".0001" name="ground1"');
  const m=mj.MjModel.from_xml_string(xml),d=new mj.MjData(m);
  try{
   mj.mj_forward(m,d);let low=Infinity;for(let i=0;i<w.nodes;i++)low=Math.min(low,d.flexvert_xpos[3*i+2]);
   d.qpos[1]=a.seed.profile.points[0][1]+m.flex_radius[0]+gap-low;d.qvel[1]=vz;mj.mj_forward(m,d);
   const o=createTranslationGuard(mj,m,d,a).observe(d),ungatedReference=-2*vz/(w.contactImpedance*w.contactTime)-gap/(w.contactImpedance*w.contactTime**2);
   if(gap>0){assert.ok(ungatedReference>300);assert.equal(d.nefc,0);assert.equal(d.ncon,detectionGap?1:0);assert.ok(d.qfrc_constraint.every(x=>x===0));assert.equal(o.verticalForce,0);}
   else{assert.equal(d.nefc,1);if(vz<0)assert.ok(o.verticalForce>1);else assert.equal(o.verticalForce,0);assert.ok(o.metrics.normalForce<BUDGETS.normalForce);}
  }finally{d.delete();m.delete();}
 }
});
