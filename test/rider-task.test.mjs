import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {compileRiderTask,MAX_TICKS} from '../dist/rider-task.js';
import {constructPosture,DEFAULTS,SEGMENTS} from '../dist/rider-posture.js';
import {compilePassiveRider,JOINTS} from '../dist/rider-passive.js';
import {validateDrive} from '../dist/rider-drive.js';
import {drawRiderPose} from '../dist/rider-pose-view.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
const point=(p,a,l)=>[p[0]+l*Math.sin(a),p[1]+l*Math.cos(a)];

test('sampled task targets independently close both chains and preserve mass-weighted COM',()=>{
  const r=compileRiderTask(),s=r.spec.passive.posture;
  assert.equal(r.frames.length,101);assert.deepEqual(r.spec.passive,compilePassiveRider().spec);
  for(const f of r.frames){
    const [hip,knee,shoulder,elbow]=f.jointAngles,pitch=f.trunkPitch;
    const shoulderPoint=point(f.hip,pitch,s.segments.trunk.length);
    const kneePoint=point(f.hip,pitch+hip,s.segments.thighs.length);
    const foot=point(kneePoint,pitch+hip+knee,s.segments.shanksFeet.length);
    const elbowPoint=point(shoulderPoint,pitch+shoulder,s.segments.upperArms.length);
    const hand=point(elbowPoint,pitch+shoulder+elbow,s.segments.forearmsHands.length);
    foot.forEach((v,i)=>close(v,s.foot[i]));hand.forEach((v,i)=>close(v,s.hand[i]));
    const ends=[[f.hip,shoulderPoint],[f.hip,kneePoint],[kneePoint,foot],[shoulderPoint,elbowPoint],[elbowPoint,hand]];
    for(let axis=0;axis<2;axis++){
      const weighted=SEGMENTS.reduce((sum,name,i)=>{const b=s.segments[name],p=ends[i];return sum+b.massFraction*(p[0][axis]+b.comFraction*(p[1][axis]-p[0][axis]));},0);
      close(weighted,f.com[axis]);
    }
    assert.notDeepEqual(f.com,f.hip);
    const drive=validateDrive({joints:Object.fromEntries(JOINTS.map((name,i)=>[name,{targetAngle:f.jointAngles[i]}]))},r.spec.passive);
    JOINTS.forEach((name,i)=>assert.equal(drive.joints[name].targetAngle,f.jointAngles[i]));
  }
});

test('integer clocks own exact endpoints, zero hold, and common samples at different resolutions',()=>{
  const a=compileRiderTask({ticks:10,tickSeconds:.02}),b=compileRiderTask({ticks:20,tickSeconds:.01});
  assert.deepEqual(a.frames[0].hip,a.spec.passive.posture.hip);assert.deepEqual(a.frames.at(-1).hip,a.spec.goal.hip);
  assert.equal(a.frames.at(-1).trunkPitch,a.spec.goal.trunkPitch);
  for(let i=0;i<a.frames.length;i++){
    assert.equal(a.frames[i].tick,i);assert.equal(a.frames[i].time,i*.02);
    assert.deepEqual(a.frames[i].jointAngles,b.frames[2*i].jointAngles);
  }
  const hold=compileRiderTask({goal:{hip:DEFAULTS.hip,trunkPitch:DEFAULTS.trunkPitch},ticks:1});
  assert.deepEqual(hold.frames[0].jointAngles,hold.frames[1].jointAngles);
  assert.ok(hold.frames.every(f=>f.relativeAngles.every(x=>x===0)));
  assert.equal(compileRiderTask({ticks:MAX_TICKS}).frames.length,MAX_TICKS+1);
});

test('task specification round-trips and owns its inputs without mutating body, bindings or laws',()=>{
  const input=JSON.parse(JSON.stringify(compileRiderTask().spec)),saved=structuredClone(input);
  const report=compileRiderTask(input);assert.deepEqual(input,saved);
  assert.deepEqual(compileRiderTask(JSON.parse(JSON.stringify(report.spec))),report);
  input.goal.hip[0]=2;input.passive.posture.hand[0]=2;
  assert.notEqual(report.spec.goal.hip[0],2);assert.notEqual(report.spec.passive.posture.hand[0],2);
  assert.throws(()=>{report.frames[0].jointAngles[0]=0;},TypeError);
  assert.throws(()=>{report.spec.passive.joints.hip.restAngle=0;},TypeError);
});

test('invalid contracts, released bindings and bounded-work violations reject explicitly',()=>{
  for(const input of [null,[],{extra:1},{format:'old'},{bindings:'released-hand'},{passive:undefined},{goal:{}},{goal:{hip:[0,0],trunkPitch:0,hand:[0,0]}},{goal:{hip:[,0],trunkPitch:0}},
    ...[0,-1,1.5,MAX_TICKS+1,NaN,Infinity].map(ticks=>({ticks})),...[0,NaN,Infinity,.101].map(tickSeconds=>({tickSeconds}))])assert.throws(()=>compileRiderTask(input));
  assert.throws(()=>compileRiderTask({goal:{hip:[2,2],trunkPitch:0}}),/Task rejected at tick/);
  assert.throws(()=>compileRiderTask({goal:{hip:[-.22,.07],trunkPitch:.65}}),/original passive domain/);
});

test('admissible endpoints cannot conceal an unreachable sampled interior',()=>{
  const posture={...DEFAULTS,hip:[-.2,0],foot:[0,0],hand:[0,.2],trunkPitch:0,segments:{...DEFAULTS.segments,trunk:{...DEFAULTS.segments.trunk,length:.2}}};
  const start=constructPosture(posture),goal={hip:[.2,0],trunkPitch:0};
  const joints=Object.fromEntries(JOINTS.map(name=>[name,{restAngle:start.joints[name],stiffness:0,damping:0,minAngle:name==='knee'?.06:-3.08,maxAngle:name==='elbow'?-.06:3.08}]));
  compilePassiveRider({posture,joints});compilePassiveRider({posture:{...posture,...goal},joints});
  assert.throws(()=>compileRiderTask({passive:{posture,joints},goal,ticks:2}),/tick 1: Leg chain is unreachable or singular/);
});

test('custom retained anchors and body identity are consumed without recentering passive laws',()=>{
  const source=compilePassiveRider({posture:{hip:[-.13,.29],trunkPitch:.60}}).spec;
  const r=compileRiderTask({passive:source,goal:{hip:source.posture.hip,trunkPitch:source.posture.trunkPitch},ticks:2});
  assert.deepEqual(r.spec.passive,source);
  assert.ok(r.frames.every(f=>f.relativeAngles.every(v=>v===0)));
  const changed=structuredClone(source);changed.posture.hand[0]+=.001;
  const custom=compileRiderTask({passive:changed,goal:{hip:changed.posture.hip,trunkPitch:changed.posture.trunkPitch},ticks:2});
  assert.equal(custom.spec.passive.posture.hand[0],changed.posture.hand[0]);
  assert.deepEqual(custom.spec.passive.joints,source.joints);
});

test('shared SVG renderer emits finite geometry and keeps selected and reference attachments',t=>{
  const original=globalThis.document;
  globalThis.document={createElementNS:(_ns,name)=>({name,attributes:{},setAttribute(key,value){this.attributes[key]=value;}})};
  t.after(()=>{if(original===undefined)delete globalThis.document;else globalThis.document=original;});
  const svg={children:[],append(node){this.children.push(node);},replaceChildren(){this.children=[];}};
  const r=compileRiderTask(),f=r.frames.at(-1),base=constructPosture(r.spec.passive.posture);
  drawRiderPose(svg,base,constructPosture({...base.spec,hip:f.hip,trunkPitch:f.trunkPitch}));
  assert.equal(svg.children.filter(x=>x.name==='line').length,11);
  assert.equal(svg.children.filter(x=>x.name==='circle').length,8);
  for(const child of svg.children)for(const key of ['x','y','x1','x2','y1','y2','cx','cy','r'])if(Object.hasOwn(child.attributes,key))assert.ok(Number.isFinite(child.attributes[key]));
  assert.deepEqual(svg.children.filter(x=>x.name==='text'&&['Hands','Feet'].includes(x.textContent)).map(x=>x.textContent),['Hands','Feet']);
});

test('headless task tool receives saved inputs and rejects unsupported input without a report',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'bikelab-task-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const path=join(dir,'task.json'),spec=compileRiderTask({ticks:2}).spec;await writeFile(path,JSON.stringify(spec));
  const cli=new URL('../scripts/rider-task.mjs',import.meta.url);
  const result=spawnSync(process.execPath,[fileURLToPath(cli),path],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),compileRiderTask(spec));
  await writeFile(path,'{"ticks":1001}');const bad=spawnSync(process.execPath,[fileURLToPath(cli),path],{encoding:'utf8'});
  assert.equal(bad.status,1);assert.equal(bad.stdout,'');assert.match(bad.stderr,/ticks/);
});
