import test from 'node:test';
import assert from 'node:assert/strict';
import {flatVertexGround,checkFlatVertexContacts} from '../dist/flat-vertex-contact.js';
import {gapXML} from '../scripts/contact-gap.mjs';
import {getRuntime} from '../dist/moving-wheel.js';

test('flat contact construction preserves height/coefficients and rejects nonflat or ambiguous profiles',()=>{
 const w={contactTime:.001,contactImpedance:.99},profile={points:[[-3,.25],[5,.25]]},ground=flatVertexGround(w,profile);assert.equal(ground.assets,'');assert.match(ground.geoms,/pos="0 0 0.25"/);assert.match(ground.geoms,/solref="0.001 1"/);assert.match(ground.geoms,/condim="1"/);
 for(const points of [[[-3,0],[5,.01]],[[-3,0],[-3,0]],[[-3,0],[5,NaN]],[[5,0],[-3,0]],[]])assert.throws(()=>flatVertexGround(w,{points}));assert.throws(()=>flatVertexGround({...w,contactTime:0},profile));
});

test('flat contact guard receives exact native vertex rows and refuses mesh elements or tilted planes',async()=>{
 const mj=await getRuntime();for(const kind of ['plane','mesh','tilted']){
  const xml=kind==='tilted'?gapXML('plane').replace('type="plane"','type="plane" euler="1 0 0"'):gapXML(kind),m=mj.MjModel.from_xml_string(xml);let d;
  try{d=new mj.MjData(m);mj.mj_forward(m,d);if(kind==='plane'){assert.equal(checkFlatVertexContacts(mj,m,d,0,2),2);d.geom_xpos[2]=NaN;assert.throws(()=>checkFlatVertexContacts(mj,m,d,0,2),/gap mismatch/);mj.mj_forward(m,d);d.qpos[1]=d.qpos[3]=1;mj.mj_forward(m,d);assert.equal(checkFlatVertexContacts(mj,m,d,0,2),0);}else assert.throws(()=>checkFlatVertexContacts(mj,m,d,0,2),/vertex-plane/);}finally{d?.delete();m.delete();}
 }
});
