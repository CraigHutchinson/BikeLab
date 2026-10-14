import test from 'node:test';
import assert from 'node:assert/strict';
import { Solver, simulate, validate, road, serialize, replay, sameScenario, G } from '../dist/physics.js';
const near=(a,b,tol,label)=>assert.ok(Math.abs(a-b)<=tol, label+': '+a+' vs '+b+' (tol '+tol+')');
test('static equilibrium at two supported-mass scales',()=>{
  for(const mass of [12,95]){
    const r=simulate({mass,profile:'flat'});
    near(r.signals.compression.at(-1),mass*G/r.params.stiffness,mass*G/r.params.stiffness*.001,'static compression');
    near(r.signals.force.at(-1),mass*G,1e-8,'weight balance');
  }
});
test('settles to independent equilibrium from displaced initial state',()=>{
  const r=simulate({profile:'flat',lift:.002,duration:8});
  near(r.signals.height.at(-1),r.params.radius-r.params.mass*G/r.params.stiffness,1e-7,'settled height');
});
test('separated wheel follows closed-form ballistic trajectory',()=>{
  const r=simulate({profile:'flat',lift:.15,duration:.1});
  const z0=r.signals.height[0];
  for(let i=0;i<r.signals.time.length;i++){
    const t=r.signals.time[i];near(r.signals.height[i],z0-.5*G*t*t,1e-12,'ballistic position');
    near(r.signals.velocity[i],-G*t,1e-12,'ballistic velocity');assert.equal(r.signals.force[i],0);
  }
});
test('undamped sustained-contact trajectory matches analytical oscillator at two scales',()=>{
  for(const mass of [12,95]){
    const lift=mass*G/90000/4,r=simulate({mass,lift,damping:0,profile:'flat',duration:2});
    const z0=r.params.radius-mass*G/r.params.stiffness,w=Math.sqrt(r.params.stiffness/mass);
    let max=0;
    for(let i=0;i<r.signals.time.length;i++)max=Math.max(max,Math.abs(r.signals.height[i]-(z0+lift*Math.cos(w*r.signals.time[i]))));
    assert.ok(max<lift*1e-4,'oscillator relative trajectory error '+max/lift);
    assert.ok(r.metrics.maxResidual<.5*r.params.stiffness*lift*lift*1e-4,'conservative energy budget');
  }
});
test('harmonic transfer function agrees in amplitude and phase after settling',()=>{
  for(const mass of [12,95]){
    const r=simulate({mass,profile:'sine',amplitude:.0002,frequency:2,damping:600,duration:12});
    const p=r.params,w=2*Math.PI*p.frequency,a=p.stiffness-p.mass*w*w,b=p.damping*w;
    const re=(p.stiffness*a+b*b)/(a*a+b*b),im=(b*a-p.stiffness*b)/(a*a+b*b);
    const equilibrium=p.radius-p.mass*G/p.stiffness;
    let max=0;
    for(let i=0;i<r.signals.time.length;i++)if(r.signals.time[i]>=8){
      const phase=w*r.signals.time[i],expected=equilibrium+p.amplitude*(re*Math.sin(phase)+im*Math.cos(phase));
      max=Math.max(max,Math.abs(expected-r.signals.height[i]));
    }
    assert.ok(max<p.amplitude*1e-4,'harmonic trajectory error '+max);
    assert.equal(r.metrics.unloadedTime,0);
  }
});
test('dissipative flat case loses energy without external work',()=>{
  const r=simulate({profile:'flat',lift:.002});
  for(let i=1;i<r.signals.time.length;i++){
    assert.ok(r.signals.loss[i]>=r.signals.loss[i-1]-1e-10);
    assert.ok(r.signals.energy[i]<=r.signals.energy[i-1]+1e-9);
  }
  assert.ok(r.signals.loss.at(-1)>0);
  assert.equal(r.signals.work.at(-1),0);
  assert.ok(r.metrics.maxResidual<1e-6);
});
test('smooth driven case accounts for work and converges at three steps',()=>{
  const runs=[.0005,.00025,.000125].map(dt=>simulate({profile:'sine',amplitude:.001,frequency:2,dt}));
  const [coarse,middle,fine]=runs;
  const amplitude=r=>Math.max(...r.signals.height)-Math.min(...r.signals.height);
  near(amplitude(middle),amplitude(fine),amplitude(fine)*.01,'amplitude convergence');
  near(middle.metrics.impulse,fine.metrics.impulse,fine.metrics.impulse*.01,'impulse convergence');
  assert.ok(coarse.metrics.maxResidual<1e-5,'driven energy residual '+coarse.metrics.maxResidual);
  assert.ok(Math.abs(coarse.signals.work.at(-1))>.01);
});
test('lift-off and recontact stay unilateral with bounded event error',()=>{
  const runs=[.0005,.00025,.000125].map(dt=>simulate({amplitude:.06,frequency:6,dt}));
  for(const r of runs){
    assert.ok(r.events.some(e=>e.type==='load-lost'));
    assert.ok(r.events.some(e=>e.type==='load-restored'));
    assert.ok(r.signals.force.every(f=>f>=0));
    assert.ok(r.signals.loss.every(d=>d>=-1e-8));
    assert.ok(r.metrics.maxResidual<.05,'impact energy residual '+r.metrics.maxResidual);
  }
  const [,m,f]=runs;
  near(m.metrics.peakForce,f.metrics.peakForce,f.metrics.peakForce*.01,'impact peak convergence');
  near(m.metrics.impulse,f.metrics.impulse,f.metrics.impulse*.01,'impact impulse convergence');
  assert.equal(m.events.length,f.events.length);
  for(let i=0;i<m.events.length;i++)near(m.events[i].time,f.events[i].time,.00501,'sampled event time');
});
test('save and reload recompute the same run and do not trust imported samples',()=>{
  const a=simulate(),data=JSON.parse(serialize(a));data.signals.height[10]=999;
  const b=replay(JSON.stringify(data));
  for(const key of Object.keys(a.signals))assert.deepEqual(a.signals[key],b.signals[key]);
  assert.deepEqual(a.events,b.events);assert.deepEqual(a.metrics,b.metrics);
  assert.throws(()=>replay('{"model":"old"}'));
});
test('scenario comparison excludes setup differences but detects forcing differences',()=>{
  assert.ok(sameScenario(validate(),validate({damping:1000,mass:60})));
  assert.ok(!sameScenario(validate(),validate({frequency:3})));
});
test('rejects invalid or unbounded inputs and unsupported compression',()=>{
  for(const input of [{mass:NaN},{mass:0},{damping:-1},{frequency:Infinity},{profile:'unknown'},{dt:.01},{duration:1.001},{sampleDt:.0011},{stiffness:10}])
    assert.throws(()=>validate(input));
  assert.throws(()=>simulate({mass:150,stiffness:10000,amplitude:.1,frequency:12,profile:'sine'}));
});
test('bump forcing is continuous at boundaries and derivative matches finite differences',()=>{
  const p=validate(),out=new Float64Array(2),left=new Float64Array(2),right=new Float64Array(2);
  for(const t of [1,1+1/p.frequency]){road(p,t,out);near(out[0],0,1e-12,'endpoint position');near(out[1],0,1e-12,'endpoint velocity');}
  for(const t of [1.1,1.2,1.3]){road(p,t,out);road(p,t-1e-6,left);road(p,t+1e-6,right);near((right[0]-left[0])/2e-6,out[1],1e-8,'forcing derivative');}
});
test('solver reset reconstruction reproduces each integration step',()=>{
  const a=new Solver(),b=new Solver();
  for(let i=0;i<3000;i++){a.step();b.step();assert.deepEqual(a.state,b.state);}
});
