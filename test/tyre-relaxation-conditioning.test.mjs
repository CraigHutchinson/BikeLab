import test from 'node:test';import assert from 'node:assert/strict';
import {createSweptCasing,ENDPOINT_MODEL,RELAXED_MODEL} from '../dist/sealed-casing.js';
import {preset} from '../dist/moving-wheel.js';
test('relaxed candidate rejects unresolved material conditioning without changing parent admission',()=>{
 const base=preset('sealed').casing;
 for(const sign of [-1,1]){const c={...base,couplingRigidity:sign*Math.sqrt(base.meridionalRigidity*base.hoopRigidity)*(1-1e-12)};assert.throws(()=>createSweptCasing(c,RELAXED_MODEL),/conditioning/);}
 assert.throws(()=>createSweptCasing({...base,meridionalRigidity:1e-200,couplingRigidity:0},RELAXED_MODEL),/conditioning/);
 for(const couplingRigidity of [-80000,0,80000]){const c={...base,couplingRigidity};assert.doesNotThrow(()=>createSweptCasing(c,RELAXED_MODEL));assert.doesNotThrow(()=>createSweptCasing(c,ENDPOINT_MODEL));}
});
