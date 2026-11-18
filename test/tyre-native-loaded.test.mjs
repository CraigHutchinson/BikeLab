import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
import {getRuntime,modelXML,preset,validate} from '../dist/moving-wheel.js';
import {createSweptCasing,RELAXED_MODEL} from '../dist/sealed-casing.js';
import {chordRatio} from '../dist/wheel-ring.js';
import {nativeLoadedXML,runLoaded} from '../scripts/lib/tyre-native-loaded.mjs';
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} vs ${b}, tolerance ${t}`);
test('offline fine fixture receives native mass, damping and loaded contact against production geometry',async()=>{
 const mj=await getRuntime();
 for(const nodes of [32,128]){
 const casing=createSweptCasing({...preset('sealed').casing,nodes},RELAXED_MODEL),p=validate({nodes,rimRadius:.311,radius:casing.reference.radius+.008,height:casing.reference.radius+.008-.0002,gravity:0,dt:.0000078125,duration:.02}),models=[modelXML(p,undefined,casing),nativeLoadedXML(casing,p)].map(xml=>mj.MjModel.from_xml_string(xml)),data=[],buffers=[];
 try{
 for(const m of models){const d=new mj.MjData(m);data.push(d);for(let i=0;i<m.nv;i++)d.qvel[i]=.001*Math.sin(i*.7);mj.mj_forward(m,d);const b=new mj.DoubleBuffer(m.nv*m.nv);buffers.push(b);mj.mj_fullM(m,d,b);}
 // Independent edge-length Rayleigh damping: -c J^T J v.
 const expected=new Float64Array(models[0].nv),v=data[0].qvel,c=p.edgeViscosity/(casing.reference.radius*chordRatio[nodes]);
 for(let i=0;i<nodes;i++){const j=(i+1)%nodes,dx=casing.initial[2*j]-casing.initial[2*i],dz=casing.initial[2*j+1]-casing.initial[2*i+1],l=Math.hypot(dx,dz),tx=dx/l,tz=dz/l,rate=tx*(v[3+2*j]-v[3+2*i])+tz*(v[4+2*j]-v[4+2*i]),f=c*rate;expected[3+2*i]+=tx*f;expected[4+2*i]+=tz*f;expected[3+2*j]-=tx*f;expected[4+2*j]-=tz*f;}
 for(let i=0;i<expected.length;i++)near(data[0].qfrc_damper[i],expected[i],1e-10);
 assert.ok(data[0].ncon>0);assert.equal(data[0].ncon,data[1].ncon);
 for(const key of ['qfrc_passive','qfrc_damper','qfrc_constraint','qacc']){const a=data[0][key],b=data[1][key];assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)near(a[i],b[i],1e-8*Math.max(1,Math.abs(a[i])));}
 const a=buffers[0].GetView(),b=buffers[1].GetView();for(let i=0;i<a.length;i++)near(a[i],b[i],1e-12);
 }finally{for(const b of buffers)b.delete();for(const d of data)d.delete();for(const m of models)m.delete();}
 }
});
test('loaded reference retains finite contact and energy/work receiving on the fine mesh',async()=>{
 const archive=JSON.parse(gunzipSync(Buffer.from((await readFile('docs/evidence/contact-relaxation-report.json.gz.b64','utf8')).trim(),'base64'))),c=archive.cases.find(c=>c.nodes===256&&c.model===RELAXED_MODEL&&c.pressure===160000&&c.phase===0),m=createSweptCasing(c.configuration,c.model),r=await runLoaded(m,c.states[2],{duration:.002,dt:.0000078125,sampleDt:.001});
 assert.equal(r.status,'completed');assert.equal(r.params.gravity,0);near(r.acceptedTime,.002,1e-12);assert.ok(r.frames.some(f=>f.contacts>0));assert.ok(r.maxPenetration<.0005);assert.ok(r.maxResidual<.001);assert.ok(r.frames.at(-1).dampingLoss>=0);assert.ok(r.frames.every(f=>f.pressure>0&&f.volume>0));
 await assert.rejects(runLoaded(m,c.states[2],{sampleDt:.000123}));await assert.rejects(runLoaded(m,c.states[2],{duration:-1}));assert.throws(()=>nativeLoadedXML(m,{height:1,hubMass:0}));
});

test('implicit damping candidate receives the light fine-mesh failure without changing edge viscosity',async()=>{
 const archive=JSON.parse(gunzipSync(Buffer.from((await readFile('docs/evidence/contact-relaxation-report.json.gz.b64','utf8')).trim(),'base64'))),c=archive.cases.find(c=>c.nodes===512&&c.model===RELAXED_MODEL&&c.pressure===160000&&c.phase===0);
 const results=[];for(const integrator of ['Euler','implicitfast'])results.push(await runLoaded(createSweptCasing(c.configuration,c.model),c.states[2],{integrator,hubMass:1.5,tyreMass:.5,hubInertia:.04,duration:.002,dt:.0000078125,sampleDt:.001}));
 assert.equal(results[0].status,'terminated');assert.equal(results[0].termination.reason,'casing-domain');assert.ok(results[0].acceptedTime<results[0].attemptedTime);
 assert.equal(results[1].status,'completed');assert.ok(results[1].maxResidual<.001);assert.ok(results[1].maxPenetration<.0005);assert.ok(results[1].frames.at(-1).dampingLoss>=0);
});

test('constant applied hub load is distinct from the initial equilibrium reaction and owns work',async()=>{
 const archive=JSON.parse(gunzipSync(Buffer.from((await readFile('docs/evidence/contact-relaxation-report.json.gz.b64','utf8')).trim(),'base64'))),c=archive.cases.find(c=>c.nodes===256&&c.model===RELAXED_MODEL&&c.pressure===160000&&c.phase===0),m=createSweptCasing(c.configuration,c.model),r=await runLoaded(m,c.states[2],{integrator:'implicitfast',appliedLoad:400,duration:.002});
 assert.equal(r.status,'completed');assert.equal(r.load,400);assert.equal(r.initialStaticReaction,c.states[2].reaction);assert.notEqual(r.load,r.initialStaticReaction);
 for(const f of r.frames){near(f.externalWork,-400*(f.hubZ-r.frames[0].hubZ),1e-12);assert.ok(f.maxBodySpeed>=Math.abs(f.hubVz)-1e-12);near(f.momentumResidualZ,f.momentumZ-f.groundImpulse+400*f.time,1e-12);}
 await assert.rejects(runLoaded(m,c.states[2],{appliedLoad:-1}));await assert.rejects(runLoaded(m,c.states[2],{appliedLoad:NaN}));
});
