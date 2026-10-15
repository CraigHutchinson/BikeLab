import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, validate, simulate } from '../dist/physics.js';
import { FIELD_SCALES, setupFromFields, sceneBounds } from '../dist/ui-model.js';
const fields = p => ({...Object.fromEntries(Object.entries(FIELD_SCALES).map(([k,s])=>[k,String(p[k]*s)])),profile:p.profile});
test('editing imported setup retains hidden precision and all experiment settings',()=>{
  const p=validate({mass:45.123456789,radius:.37123456789,damping:437.5,duration:3,dt:.000125,sampleDt:.001,lift:.01234});
  const shown=fields(p);
  assert.deepEqual(setupFromFields(shown,p),p);
  shown.damping='800.5';
  assert.deepEqual(setupFromFields(shown,p),{...p,damping:800.5});
});
test('empty numeric fields cannot silently become zero',()=>{
  for(const key of Object.keys(FIELD_SCALES)){
    const shown=fields(DEFAULTS);shown[key]=' ';
    assert.throws(()=>setupFromFields(shown),/required/);
  }
});
test('scene bounds include the entire wheel and moving platen through high lift',()=>{
  const r=simulate({lift:.2,profile:'flat',duration:1}),b=sceneBounds(r);
  for(let i=0;i<r.signals.time.length;i++){
    assert.ok(r.signals.height[i]-r.params.radius>b.bottom);
    assert.ok(r.signals.height[i]+r.params.radius<b.top);
    assert.ok(r.signals.platen[i]>=b.bottom && r.signals.platen[i]<b.top);
  }
});
