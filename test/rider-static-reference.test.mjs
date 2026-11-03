import test from 'node:test';
import assert from 'node:assert/strict';
import {staticRiderReference} from '../dist/rider-static-reference.js';
import {DEFAULTS,constructPosture} from '../dist/rider-posture.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
// Independent forward geometry and potential, without reference-solver moment sums.
function geometry(q,p){
 const step=(a,t,l)=>[a[0]+l*Math.sin(t),a[1]+l*Math.cos(t)];
 const hip=q.slice(0,2),shoulder=step(hip,q[2],p.segments.trunk.length),knee=step(hip,q[2]+q[3],p.segments.thighs.length),foot=step(knee,q[2]+q[3]+q[4],p.segments.shanksFeet.length),elbow=step(shoulder,q[2]+q[5],p.segments.upperArms.length),hand=step(elbow,q[2]+q[5]+q[6],p.segments.forearmsHands.length);
 return {hand,foot,ends:[[hip,shoulder],[hip,knee],[knee,foot],[shoulder,elbow],[elbow,hand]]};
}
function virtualWork(r){
 const p=r.input.passive.posture,names=['trunk','thighs','shanksFeet','upperArms','forearmsHands'],q=[...r.input.goal.hip,r.input.goal.trunkPitch,...r.joints.map(j=>j.angle)];
 const potential=x=>{const g=geometry(x,p);return names.reduce((u,name,i)=>{const body=p.segments[name],com=g.ends[i][0].map((v,k)=>v+body.comFraction*(g.ends[i][1][k]-v));return u+p.riderMass*body.massFraction*r.input.gravity*(com[1]*Math.cos(r.input.framePitch)-com[0]*Math.sin(r.input.framePitch));},0)+r.joints.reduce((u,j,i)=>{const law=r.input.passive.joints[j.name];return u+.5*law.stiffness*(x[3+i]-law.restAngle)**2;},0);};
 for(const h of [1e-5,5e-6])for(let i=0;i<7;i++){
  const plus=[...q],minus=[...q];plus[i]+=h;minus[i]-=h;const a=geometry(plus,p),b=geometry(minus,p);
  let residual=-(potential(plus)-potential(minus))/(2*h)+(i>=3?r.joints[i-3].active:0);
  for(const name of ['hand','foot'])for(let k=0;k<2;k++)residual+=r[name][k]*(a[name][k]-b[name][k])/(2*h);
  near(residual,0,5e-7);
 }
}
test('all seven equilibrium equations satisfy independent potential/virtual-work differences',()=>{
 for(const mass of [20,70,100])for(const framePitch of [-.3,0,.3]){
  const r=staticRiderReference({passive:{posture:{riderMass:mass}},framePitch});assert.equal(r.status,'available');virtualWork(r);
 }
 const r=staticRiderReference({goal:{hip:[-.148,.248],trunkPitch:.552}});assert.equal(r.status,'available');virtualWork(r);assert.ok(r.joints.some(j=>Math.abs(j.passive)>.1));
});
test('selected interior force split minimizes active torque over the balanced one-parameter family',()=>{
 const r=staticRiderReference(),p=r.policy;assert.equal(p.boundActive,false);
 const cost=lambda=>p.activeAtZero.reduce((sum,a,i)=>sum+(a+lambda*p.activeSlope[i])**2,0);
 near(cost(p.lambdaN),p.objectiveNm2,1e-9);
 for(const delta of [-100,-10,-1,1,10,100])assert.ok(cost(p.lambdaN+delta)>cost(p.lambdaN));
 near(r.hand[0]+r.foot[0],0);near(r.hand[1]+r.foot[1],70*9.80665);near(r.residual.momentNm,0);
});
test('torque constraints change force sharing rather than clipping individual torque',()=>{
 for(const patch of [{hip:{maxTorque:1}},{elbow:{maxTorque:0}}]){
  const r=staticRiderReference({drive:{joints:patch}});assert.equal(r.status,'available');assert.equal(r.policy.boundActive,true);
  for(const j of r.joints)assert.ok(Math.abs(j.active)<=j.limit+1e-8);virtualWork(r);
 }
 const allZero={joints:Object.fromEntries(['hip','knee','shoulder','elbow'].map(n=>[n,{maxTorque:0}]))};
 assert.equal(staticRiderReference({drive:allZero}).status,'unavailable');
 assert.equal(staticRiderReference({drive:allZero}).reason,'torque-limits');
 assert.equal(staticRiderReference({drive:allZero,gravity:0}).status,'available');
});
test('mass and gravity scaling hold at passive rest; zero gravity requires no effort',()=>{
 const a=staticRiderReference(),b=staticRiderReference({gravity:9.80665/2}),z=staticRiderReference({gravity:0});
 for(let i=0;i<4;i++){near(b.joints[i].active,a.joints[i].active/2);near(z.joints[i].active,0);}
 for(const name of ['hand','foot'])for(let i=0;i<2;i++){near(b[name][i],a[name][i]/2);near(z[name][i],0);}
});
test('preloaded passive laws contribute once and input ownership is retained',()=>{
 const base=staticRiderReference(),passive=structuredClone(base.input.passive);passive.joints.hip.restAngle+=.05;
 const input={passive},before=structuredClone(input),r=staticRiderReference(input);near(r.joints[0].passive,6);virtualWork(r);assert.deepEqual(input,before);
 r.input.goal.hip[0]=1;assert.equal(input.passive.posture.hip[0],-.15);
});
test('coincident anchors are explicitly unavailable, without manufacturing a force split',()=>{
 const p=structuredClone(DEFAULTS);p.hand=[...p.foot];p.segments.upperArms.length=.65;p.segments.forearmsHands.length=.65;
 const pose=constructPosture(p),joints=Object.fromEntries(['hip','knee','shoulder','elbow'].map(name=>[name,{restAngle:pose.joints[name],stiffness:0,damping:0,minAngle:pose.joints[name]-.01,maxAngle:pose.joints[name]+.01}]));
 assert.equal(staticRiderReference({passive:{posture:p,joints}}).reason,'anchor-separation');
});
test('invalid inputs and unreachable or out-of-domain goals fail explicitly',()=>{
 for(const input of [new Date(),{goal:null},{drive:null},{gravity:null},{gravity:NaN},{gravity:-1},{framePitch:Infinity},{extra:1},{goal:{hip:[0,0]}},{goal:{hip:[9,9],trunkPitch:.55}},{goal:{hip:[-.1,.2],trunkPitch:1.5}}])assert.throws(()=>staticRiderReference(input));
});
