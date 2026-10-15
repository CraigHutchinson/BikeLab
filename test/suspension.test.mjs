import { oscillatorState } from '../dist/suspension-reference.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../dist/physics.js';
import { DEFAULTS, PRESETS, Solver, validate, element, simulate, serialize, replay, readRecord, sameScenario } from '../dist/suspension.js';
const near = (a, b, tol, label = '') => assert.ok(Math.abs(a-b) <= tol, `${label}: ${a} vs ${b}, tolerance ${tol}`);

// Shared analytical oracle, independently checked by suspension-reference.test.mjs.
function reference(m, k, c, e0, u0, t) {
  const out = new Float64Array(2);
  oscillatorState(m, k, c, e0, u0, t, out);
  return out;
}

test('axial preload changes intercept but not stiffness; damper is signed and passive', () => {
  const p=validate(), a=new Float64Array(5), b=new Float64Array(5);
  for (const q of [0,.03,p.travel]) for (const u of [-2,-.001,0,.001,2]) {
    element(p,q,u,a);
    near(a[0],p.preload+p.stiffness*q,1e-12);
    near(a[1],(u<0?p.reboundDamping:p.compressionDamping)*u,1e-12);
    near(a[2],a[0]+a[1],1e-12); assert.ok(a[4]>=0);
    near(a[4],a[1]*u,1e-12);
    // Attachment power + spring storage rate + dissipation = 0.
    near(-a[2]*u + a[0]*u + a[4],0,1e-10,'power balance');
  }
  element(p,.03,-2,a); assert.ok(a[2]<0,'captured rebound damper may pull');
  element(p,.03,0,a); element(p,.04,0,b); near((b[0]-a[0])/.01,p.stiffness,1e-9);
  for (const q of [-1e-8,p.travel+1e-8,NaN]) assert.throws(()=>element(p,q,0,a));
  assert.throws(()=>element(p,.03,Infinity,a));
});
test('equilibrium and displaced settling at multiple mass, preload and stiffness scales', () => {
  for (const [mass,stiffness,preload] of [[12,5000,20],[45,9000,50],[95,22000,200]]) {
    const sag=(mass*G-preload)/stiffness;
    const p={mass,stiffness,preload,initialCompression:sag};
    const equilibrium=simulate(p); assert.equal(equilibrium.status,'complete');
    near(equilibrium.signals.compression.at(-1),sag,1e-12);
    near(equilibrium.signals.force[0],mass*G,1e-10);
    const r=simulate({...p,initialCompression:sag+.01,duration:12});
    near(r.signals.compression.at(-1),sag,.001*r.params.travel);
    near(r.signals.compressionVelocity.at(-1),0,1e-5);
  }
});
test('conservative, underdamped, critical and overdamped traces match independent solutions', () => {
  for (const [mass,stiffness] of [[12,5000],[95,22000]]) for (const ratio of [0,.25,1,2]) {
    const c=2*ratio*Math.sqrt(mass*stiffness), sag=mass*G/stiffness, a=sag*.2;
    const r=simulate({mass,stiffness,preload:0,compressionDamping:c,reboundDamping:c,initialCompression:sag+a,duration:8});
    assert.equal(r.status,'complete');
    for (let i=0;i<r.signals.time.length;i++) {
      const [e,u]=reference(mass,stiffness,c,a,0,r.signals.time[i]);
      near(r.signals.compression[i],sag+e,a*.001,'analytical compression');
      near(r.signals.compressionVelocity[i],u,a*Math.sqrt(stiffness/mass)*.001,'analytical velocity');
    }
    assert.ok(r.metrics.maxResidual < mass*G*r.params.travel*.0001);
  }
});
test('unequal damping coefficients follow the correct independent monotonic half-cycle', () => {
  for (const sign of [-1,1]) {
    const sag=(DEFAULTS.mass*G-DEFAULTS.preload)/DEFAULTS.stiffness, a=sign*.005;
    const r=simulate({initialCompression:sag+a,duration:.1,compressionDamping:100,reboundDamping:1000});
    const c=sign>0?1000:100;
    for(let i=0;i<r.signals.time.length;i++) {
      const [e,u]=reference(r.params.mass,r.params.stiffness,c,a,0,r.signals.time[i]);
      near(r.signals.compression[i],sag+e,1e-7);
      near(r.signals.compressionVelocity[i],u,1e-6);
    }
  }
});
test('dissipative energy is monotone; conservative energy and moving-support work balance', () => {
  for (const p of [{}, {compressionDamping:0,reboundDamping:0,initialCompression:.05},
    {profile:'sine',amplitude:.002,compressionDamping:500,reboundDamping:500}]) {
    const r=simulate(p); assert.equal(r.status,'complete');
    for(let i=1;i<r.signals.time.length;i++) {
      assert.ok(r.signals.loss[i]>=r.signals.loss[i-1]-1e-12);
      if(r.params.profile==='flat') assert.ok(r.signals.energy[i]<=r.signals.energy[i-1]+1e-8);
    }
    assert.ok(r.metrics.maxResidual < r.params.mass*G*r.params.travel*.001);
    if(r.params.profile==='flat') assert.equal(r.signals.work.at(-1),0);
    else assert.ok(Math.abs(r.signals.work.at(-1))>.01);
  }
});
test('moving support agrees with independently derived harmonic amplitude and phase', () => {
  const r=simulate({profile:'sine',amplitude:.001,frequency:2,compressionDamping:600,reboundDamping:600,duration:12});
  assert.equal(r.status,'complete');
  const p=r.params,w=2*Math.PI*p.frequency,a=p.stiffness-p.mass*w*w,b=p.compressionDamping*w;
  const re=(p.stiffness*a+b*b)/(a*a+b*b), im=(b*a-p.stiffness*b)/(a*a+b*b);
  const zEq=-(p.mass*G-p.preload)/p.stiffness;
  for(let i=0;i<r.signals.time.length;i++) if(r.signals.time[i]>=8) {
    const t=r.signals.time[i], expected=zEq+p.amplitude*(re*Math.sin(w*t)+im*Math.cos(w*t));
    near(r.signals.height[i],expected,p.amplitude*.001);
  }
});
test('top-out and bottom-out stop transactionally with final valid samples and explicit limits', () => {
  for (const [initialCompression,initialVelocity,type] of [[.001,-2,'top-out'],[.159,2,'bottom-out'],[0,-1,'top-out'],[.16,1,'bottom-out']]) {
    const p={initialCompression,initialVelocity,compressionDamping:0,reboundDamping:0,sampleDt:.02};
    const r=simulate(p);
    assert.equal(r.status,'travel-limit'); assert.equal(r.termination.type,type);
    assert.equal(r.signals.time.at(-1),r.termination.lastValidTime);
    assert.equal(r.metrics.endTime,r.termination.lastValidTime);
    assert.ok(r.signals.compression.every(q=>q>=0 && q<=r.params.travel));
    near(r.termination.attemptedTime-r.termination.lastValidTime,r.params.dt,1e-12);
    const fine=simulate({...p,sampleDt:.001});
    assert.deepEqual(r.termination,fine.termination); assert.deepEqual(r.metrics,fine.metrics);
    const solver=new Solver({...p,initialCompression:0,initialVelocity:-1});
    const state=solver.state.slice(); assert.throws(()=>solver.step(),/top-out/);
    assert.deepEqual(solver.state,state); assert.equal(solver.t,0); assert.equal(solver.q,0);
  }
});
test('inward boundary motion is admitted and travel event refines with timestep', () => {
  for(const [q,u] of [[0,1],[.16,-1]]) {
    const s=new Solver({initialCompression:q,initialVelocity:u}); s.step();
    assert.ok(s.q>0 && s.q<s.p.travel);
  }
  const p={initialCompression:.002,initialVelocity:-1,compressionDamping:0,reboundDamping:0};
  const runs=[.0005,.00025,.000125].map(dt=>simulate({...p,dt}));
  assert.ok(runs.every(r=>r.termination.type==='top-out'));
  near(runs[1].metrics.endTime,runs[2].metrics.endTime,.0005);
});
test('smooth and asymmetric responses converge independently of recording interval', () => {
  for(const p of [{},{profile:'sine',amplitude:.002,compressionDamping:450,reboundDamping:450}]) {
    const runs=[.0005,.00025,.000125].map(dt=>simulate({...p,dt}));
    for(const r of runs) assert.equal(r.status,'complete');
    const [,m,f]=runs;
    near(m.metrics.peakForce,f.metrics.peakForce,.01*Math.abs(f.metrics.peakForce));
    near(m.metrics.impulse,f.metrics.impulse,.01*Math.abs(f.metrics.impulse));
    for(let i=0;i<m.signals.time.length;i++) near(m.signals.compression[i],f.signals.compression[i],1e-6);
    assert.deepEqual(simulate({...p,sampleDt:.02}).metrics,simulate({...p,sampleDt:.001}).metrics);
  }
});
test('suspension validation rejects malformed, incomplete, unstable and out-of-domain setups', () => {
  for(const p of [null,[],2,{typo:1},{preload:NaN},{mass:0},{compressionDamping:-1},{initialCompression:.2},
    {mass:1,stiffness:1000,preload:0,compressionDamping:8000},{preload:1000},{travel:.02},{dt:.01},{duration:.101}])
    assert.throws(()=>validate(p));
  for(const p of Object.values(PRESETS)) assert.equal(simulate(p).status,'complete');
  assert.ok(simulate({mass:5,stiffness:5000,preload:0,initialCompression:.01,reboundDamping:1500}).warnings.some(w=>w.includes('time scales')));
  const data=JSON.parse(serialize(simulate()));
  for(const key of Object.keys(DEFAULTS)) { const r=structuredClone(data); delete r.params[key]; assert.throws(()=>readRecord(JSON.stringify(r)),/complete/); }
  for(const text of ['null','[]','{','{}']) assert.throws(()=>readRecord(text));
});
test('complete and stopped suspension runs replay exactly without trusting saved samples', () => {
  for(const p of [{},{initialCompression:0,initialVelocity:-1}]) {
    const a=simulate(p), data=JSON.parse(serialize(a)); data.signals.force[0]=99999;
    const b=replay('\uFEFF'+JSON.stringify(data));
    assert.deepEqual(a,b);
  }
  assert.ok(sameScenario(DEFAULTS,{...DEFAULTS,reboundDamping:900}));
  assert.ok(!sameScenario(DEFAULTS,{...DEFAULTS,initialCompression:.07}));
});
