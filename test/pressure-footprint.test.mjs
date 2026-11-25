import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInput,configuration,readRecord,record,LOWERINGS} from '../dist/pressure-footprint.js';
import {meridianFixture} from '../scripts/lib/tyre-meridian-fixture.mjs';
test('static consumer admits only the received pressure grid and fixed illustrative geometry',()=>{
 for(const pressure of [120000,160000,200000]){assert.deepEqual(validateInput({pressure}),{pressure});const c=configuration({pressure});assert.deepEqual(c.section,meridianFixture(8).restPoints);assert.equal(c.nodes,256);}
 for(const input of [null,{},[],{pressure:160001},{pressure:NaN},{pressure:160000,terrain:'rock'},{pressure:160000,lowering:.1},{pressure:160000,nodes:128}])assert.throws(()=>validateInput(input));
 assert.deepEqual(LOWERINGS,[0,.001,.002,.004,.002,.001,0]);
});
test('saved static records select rerun input, never reinterpret legacy or trust output',()=>{
 const r=record({pressure:160000},Array(7).fill({reaction:'untrusted'}));assert.deepEqual(readRecord(r),{pressure:160000});
 for(const v of [{...r,model:'legacy-footprint'}, {...r,input:{pressure:160000,insert:true}}, {...r,states:[]}])assert.throws(()=>readRecord(v));
});
