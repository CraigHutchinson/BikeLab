import test from 'node:test';
import assert from 'node:assert/strict';
import {riderGeometryError} from '../dist/rider-geometry-error.js';
const near=(a,b)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>assert.ok(Math.abs(x-b[i])<1e-12,`${a} != ${b}`));};
function fixture(){
 const scenario={articulated:{passive:{posture:{foot:[0,-2],hand:[0,-1],segments:Object.fromEntries(['trunk','thighs','shanksFeet','upperArms','forearmsHands'].map(name=>[name,{length:1}]))}}},riderTargets:{commands:[{hip:[0,0],trunkPitch:0}]}};
 const frame={frame:[0,0,0],active:{targetCommand:0,angles:[Math.PI,0,Math.PI,0],targetAngles:[Math.PI,0,Math.PI,0],actualTrunkPitch:0,actualHip:[0,0]},articulated:{interfaces:{attachments:[{name:'hand',active:true,bike:[0,0,-1],rider:[0,0,-1]},{name:'foot',active:true,bike:[0,0,-2],rider:[0,0,-2]}]}}};
 return {scenario,frame};
}
const read=x=>riderGeometryError(x.scenario,x.frame);
const attachment=(x,name)=>x.frame.articulated.interfaces.attachments.find(a=>a.name===name);
test('both chains close a hand-computed straight geometry without input mutation',()=>{
 const x=fixture(),before=structuredClone(x),r=read(x);near(r.hipError,[0,0]);
 for(const c of Object.values(r.chains))for(const term of Object.values(c))near(term,[0,0]);assert.deepEqual(x,before);
});
test('a translated rider is assigned to attachment gap with zero angle terms',()=>{
 const x=fixture();x.frame.active.actualHip=[.03,-.02];for(const a of x.frame.articulated.interfaces.attachments){a.rider[0]+=.03;a.rider[2]-=.02;}
 for(const c of Object.values(read(x).chains)){near(c.attachmentGap,[.03,-.02]);near(c.jointTracking,[0,0]);near(c.trunkTracking,[0,0]);near(c.reconstructionResidual,[0,0]);near(c.sum,[.03,-.02]);}
});
test('a known joint rotation accounts for foot-anchored hip displacement',()=>{
 const x=fixture();x.frame.active.angles[0]=Math.PI/2;x.frame.active.actualHip=[-2,-2];attachment(x,'hand').rider=[-2,0,-3];
 const r=read(x);near(r.chains.foot.jointTracking,[-2,-2]);near(r.chains.foot.trunkTracking,[0,0]);near(r.chains.foot.attachmentGap,[0,0]);
 for(const c of Object.values(r.chains)){near(c.sum,[-2,-2]);near(c.reconstructionResidual,[0,0]);}
});
test('a known trunk rotation is separate from joint changes in the declared order',()=>{
 const x=fixture();x.frame.active.actualTrunkPitch=Math.PI/2;x.frame.active.actualHip=[2,-2];attachment(x,'hand').rider=[1,0,-2];
 const r=read(x);near(r.chains.foot.jointTracking,[0,0]);near(r.chains.foot.trunkTracking,[2,-2]);near(r.chains.hand.trunkTracking,[1,-1]);
 for(const c of Object.values(r.chains)){near(c.sum,[2,-2]);near(c.reconstructionResidual,[0,0]);}
});
test('world translation and rotation do not change frame-local accounting',()=>{
 const x=fixture();x.frame.active.actualHip=[.03,-.02];for(const a of x.frame.articulated.interfaces.attachments){a.rider[0]+=.03;a.rider[2]-=.02;}const a=read(x);
 x.frame.frame=[10,-3,Math.PI/2];for(const end of x.frame.articulated.interfaces.attachments)for(const key of ['bike','rider']){const [px,y,pz]=end[key];end[key]=[10+pz,y,-3-px];}
 x.frame.articulated.interfaces.attachments.reverse();const b=read(x);near(a.hipError,b.hipError);for(const name of ['hand','foot'])for(const key of Object.keys(a.chains[name]))near(a.chains[name][key],b.chains[name][key]);
});
test('anchor, target and geometry inconsistencies remain explicit residual terms',()=>{
 const x=fixture();attachment(x,'foot').bike[0]=.1;const a=read(x);near(a.chains.foot.anchorOffset,[.1,0]);near(a.chains.foot.attachmentGap,[-.1,0]);near(a.chains.foot.sum,[0,0]);
 x.scenario.riderTargets.commands[0].hip=[.02,0];x.frame.active.actualHip=[.01,0];const b=read(x);
 for(const c of Object.values(b.chains)){near(c.targetClosure,[-.02,0]);near(c.reconstructionResidual,[.01,0]);near(c.sum,[-.01,0]);}
});
test('missing, duplicate, inactive and invalid geometry is rejected',()=>{
 for(const edit of [x=>x.frame.active.targetCommand=1,x=>attachment(x,'hand').active=false,x=>attachment(x,'hand').name='foot',x=>x.frame.frame[2]=NaN,x=>x.frame.active.angles=Array(4),x=>attachment(x,'foot').bike[0]=Infinity,x=>x.scenario.articulated.passive.posture.segments.trunk.length=0]){const x=fixture();edit(x);assert.throws(()=>read(x));}
});

test('combined joint and trunk changes can cancel; component magnitudes are not additive',()=>{
 const x=fixture();x.frame.active.angles[0]=Math.PI/2;x.frame.active.actualTrunkPitch=Math.PI/2;attachment(x,'hand').rider=[-1,0,0];
 const r=read(x);near(r.chains.foot.jointTracking,[-2,-2]);near(r.chains.foot.trunkTracking,[2,2]);near(r.chains.foot.sum,[0,0]);
 for(const c of Object.values(r.chains)){near(c.sum,r.hipError);near(c.reconstructionResidual,[0,0]);}
});
