import test from 'node:test';
import assert from 'node:assert/strict';
import {run,preset,articulatedPreset} from '../dist/trail-bike.js';
import {getRuntime} from '../dist/moving-wheel.js';

test('connected observations refresh native views after actual memory growth during integration',async()=>{
 const mj=await getRuntime();
 for(const articulated of [false,true]){
  const a=articulated?articulatedPreset('full'):preset('flat','hardtail');a.motion={...a.motion,duration:.02};
  const expected=await run(a),forward=mj.mj_forward;let grew=false,oldView;
  mj.mj_forward=(m,d)=>{
   forward(m,d);
   if(!grew&&d.time>.005){
    grew=true;oldView=d.qvel;const oldBuffer=oldView.buffer,bytes=oldBuffer.byteLength;
    const growth=new mj.DoubleBuffer(Math.ceil(bytes/8)+1024);
    try{
     assert.notEqual(d.qvel.buffer,oldBuffer);assert.ok(d.qvel.buffer.byteLength>bytes);
     assert.equal(oldBuffer.byteLength,0,'old aliases must actually be detached');
    }finally{growth.delete();}
   }
  };
  let actual;try{actual=await run(a);}finally{mj.mj_forward=forward;}
  assert.ok(grew);assert.equal(oldView.length,0);assert.deepEqual(actual,expected);
 }
});
