import test from 'node:test';
import assert from 'node:assert/strict';
import {run,replay,preset,validate,modelXML,wheelParts,canonicalProfile,geometryLimits,getRuntime} from '../dist/moving-wheel.js';
import {illustrativeAssembly} from '../dist/wheel-limits.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}, tolerance ${t}`),last=r=>r.frames.at(-1);
const short=(name,patch={})=>{const a=preset(name);return {...a,params:{...a.params,duration:.2,...patch}};};
test('ring mass, inertia, energy and native spring forces agree with independent expressions',async()=>{
 const mj=await getRuntime();for(const nodes of [32,64,128]){const p=validate({...preset('flight').params,nodes}),m=mj.MjModel.from_xml_string(modelXML(p)),d=new mj.MjData(m);try{
  const ref=wheelParts(p).reference;near(Array.from(m.body_mass).reduce((a,b)=>a+b,0),ref.totalMass);
  d.qvel[2]=2;mj.mj_forward(m,d);mj.mj_energyVel(m,d);near(d.energy[1],.5*ref.rigidSpinInertia*4);
  d.qvel.fill(0);for(let i=3;i<m.nq;i++)d.qpos[i]=.001*Math.sin(i*1.7);mj.mj_forward(m,d);mj.mj_energyPos(m,d);
  let expected=0;for(let i=3;i<m.nq;i++)expected+=.5*p.foundation*ref.arcWeight*d.qpos[i]**2;
  for(let i=0;i<nodes;i++)expected+=.5*p.extension/ref.chordLength*(d.flexedge_length[i]-ref.chordLength)**2;near(d.energy[0],expected,1e-10);
  const forces=Array.from(d.qfrc_spring);for(const i of [0,1,2,3,4,15]){const q=d.qpos[i],h=1e-7;d.qpos[i]=q+h;mj.mj_forward(m,d);mj.mj_energyPos(m,d);const hi=d.energy[0];d.qpos[i]=q-h;mj.mj_forward(m,d);mj.mj_energyPos(m,d);const lo=d.energy[0];d.qpos[i]=q;near(-(hi-lo)/(2*h),forces[i],1e-5);}
 }finally{d.delete();m.delete();}}
});
test('free flight, gravity and external work preserve whole-wheel momentum with spin',async()=>{
 for(const patch of [{},{gravity:9.80665,omega:0,forceX:3,forceZ:2,torque:0}]){const a=short('flight',patch),r=await run(a),f=last(r);assert.equal(r.status,'completed');assert.equal(r.summary.contactSteps,0);
  const M=r.reference.totalMass,t=f.time;near(f.momentum[0],r.summary.initialMomentum[0]+a.params.forceX*t,1e-8);near(f.momentum[1],r.summary.initialMomentum[1]+(a.params.forceZ-M*a.params.gravity)*t,1e-8);
  // Semi-implicit position drift is O(h); endpoint-trapezoid work/torque
  // exposes that discretization error. Check its independently derived value.
  if(patch.gravity){const ax=a.params.forceX/M,az=a.params.forceZ/M-a.params.gravity;
   near(f.momentumResidual[2],-.5*a.params.dt*t*M*(a.params.velocityZ*ax-a.params.velocityX*az),1e-7);
   near(f.residual,.5*M*a.params.gravity*az*a.params.dt*t,1e-6);
  }else{assert.ok(Math.abs(f.momentumResidual[2])<2e-5);assert.ok(r.summary.maxResidual<.001);}
  assert.ok(f.dampingLoss>=0);
  if(!patch.gravity){near(f.hub[0],a.params.centerX+a.params.velocityX*t,1e-9);near(f.hub[1],a.params.height+a.params.velocityZ*t,1e-9);}
 }
});
test('square and rounded features produce distinct distributed frictionless loads and complete wrenches',async()=>{
 const results=[];for(const name of ['square','rounded']){const r=await run(short(name,{duration:.3}));assert.equal(r.status,'completed');results.push(r);assert.ok(r.frames.some(f=>f.contacts.some(c=>c.edge>=0)),'edge-interior contact is present');assert.ok(r.frames.some(f=>f.contacts.length>1));
  for(const f of r.frames){let fx=0,fz=0,my=0;for(const c of f.contacts){assert.ok(c.normalForce>0);near(Math.hypot(...c.normal),1,1e-7);fx+=c.force[0];fz+=c.force[1];my+=(c.point[1]-f.hub[1])*c.force[0]-(c.point[0]-f.hub[0])*c.force[1];}near(fx,f.groundWrench[0],1e-6);near(fz,f.groundWrench[1],1e-6);near(my,f.groundWrench[2],1e-6);assert.ok(f.limits.penetration<=r.params.maxPenetration);assert.ok(f.limits.inner>0);}
  assert.ok(Math.max(...last(r).momentumResidual.map(Math.abs))<.002);assert.ok(r.summary.maxResidual/r.summary.initialEnergy<.003);
 }
 assert.ok(Math.abs(last(results[0]).impulse[0]-last(results[1]).impulse[0])>.5);
});
test('mirrored impact and equivalent terrain subdivision preserve native dynamics',async()=>{
 const a=short('square',{duration:.2}),left=await run(a),points=left.profile.points;
 const right=await run({...a,params:{...a.params,centerX:.6,velocityX:-a.params.velocityX,omega:-a.params.omega},profile:{...left.profile,points:points.map(([x,z])=>[.2-x,z]).reverse()}});
 near(last(left).hub[0],.2-last(right).hub[0],3e-5);near(last(left).hub[1],last(right).hub[1],3e-5);near(last(left).impulse[0],-last(right).impulse[0],.005);
 const split={...left.profile,points:points.flatMap((v,i)=>i===points.length-1?[v]:[v,[(v[0]+points[i+1][0])/2,(v[1]+points[i+1][1])/2]])};assert.deepEqual(canonicalProfile(split).points,points);
 const divided=await run({...a,profile:split});assert.deepEqual(divided.frames,left.frames);
});
test('timestep refinement reduces work residual while bounding trajectory and impulse differences',async()=>{
 const rows=[];for(const dt of [.00003125,.000015625,.0000078125])rows.push(await run(short('square',{duration:.3,dt})));
 for(const r of rows)assert.equal(r.status,'completed');assert.ok(rows[2].summary.maxResidual<rows[1].summary.maxResidual);assert.ok(rows[1].summary.maxResidual<rows[0].summary.maxResidual);
 const [a,b]=rows.slice(1).map(last);assert.ok(Math.hypot(a.hub[0]-b.hub[0],a.hub[1]-b.hub[1])<.002);near(a.impulse[0],b.impulse[0],.04);near(a.impulse[1],b.impulse[1],.04);
});
test('initial compression contributes to peak diagnostics and nonadjacent casing touches are rejected',async()=>{
 const a=short('flat',{height:.3599,gravity:0,velocityX:0,velocityZ:4,duration:.02}),r=await run(a);
 assert.equal(r.status,'completed');assert.ok(r.frames[0].limits.penetration>0);assert.ok(r.summary.peakPenetration>=r.frames[0].limits.penetration);assert.ok(r.summary.peakForce>=Math.hypot(...r.frames[0].groundWrench.slice(0,2)));
 const p={...validate(),nodes:4,radius:2,rimRadius:.1,skin:.01},profile={points:[[-4,0],[4,0]]};
 const xyz=new Float64Array([1,0,2,2,0,2,1,0,2,3,0,3]);assert.equal(geometryLimits(p,profile,[0,2],xyz).reason,'casing-self-crossing');
});
test('overload, rim/strain/domain limits and invalid declarations suppress unsupported continuation',async()=>{
 const r=await run(preset('overload'));assert.equal(r.status,'terminated');assert.equal(r.termination.reason,'contact-penetration-limit');near(last(r).time,r.termination.time);assert.ok(last(r).limits.penetration<=r.params.maxPenetration);assert.ok(r.termination.attemptedDiagnostics.penetration>r.params.maxPenetration);
 const a=short('flight');const init=await run({...a,params:{...a.params,height:.29}});assert.equal(init.status,'initial-state-rejected');assert.equal(init.frames.length,0);
 const domain=await run({...a,params:{...a.params,centerX:1.63,velocityX:1}});assert.equal(domain.status,'terminated');assert.equal(domain.termination.reason,'authored-domain');assert.ok(last(domain).hub[0]+domain.params.radius<=2);
 const strain=await run(short('square',{maxStrain:.05,duration:.3}));assert.equal(strain.termination.reason,'casing-strain-limit');assert.ok(last(strain).limits.strain<=.05);
 const blocked=await run({...a,params:{...a.params,rimRadius:.305},assembly:{...illustrativeAssembly(),pressure:260000}});assert.equal(blocked.status,'assembly-rejected');assert.equal(blocked.frames.length,0);
});
test('configuration and replay are strict, owned and independent of observation frequency',async()=>{
 for(const p of [{extra:1},{dt:.00025,nodes:128,extension:2000,foundation:600000},{nodes:100},{gravity:NaN},{skin:.1},{rimRadius:.35},{sampleDt:.003},{duration:1,sampleDt:.001}])assert.throws(()=>validate(p));
 const a=short('flight',{duration:.04}),r=await run(a),record=JSON.parse(JSON.stringify(r));record.frames[0].hub[0]=999;assert.deepEqual(await replay(record),r);delete record.params.skin;assert.throws(()=>replay(record));
 const finer=await run({...a,params:{...a.params,sampleDt:.0025}});assert.deepEqual(last(finer),last(r));a.params.centerX=1;assert.equal(r.params.centerX,-.4);
 const xml=modelXML();assert.match(xml,/dim="1"/);assert.match(xml,/condim="1"/);assert.throws(()=>wheelParts({},'bad"name'));
});
