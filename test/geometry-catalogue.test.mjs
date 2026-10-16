import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOGUE,REFERENCE_FIELDS,referenceRows} from '../dist/geometry-catalogue.js';

test('manufacturer records preserve SI, source groups, missing coordinates and separate settings',()=>{
  const ids=new Set(),sources=new Set(CATALOGUE.sources.map(s=>s.id));
  assert.deepEqual(CATALOGUE.units,{length:'m',angle:'rad'});
  for(const r of CATALOGUE.records){
    assert.ok(!ids.has(r.id));ids.add(r.id);
    for(const id of r.sourceIds)assert.ok(sources.has(id));
    for(const [group,key,,unit] of REFERENCE_FIELDS){
      assert.ok(Object.hasOwn(r[group],key));assert.ok(r.sourceIds.includes(r.fieldSources[group]));
      const v=r[group][key];assert.ok(v===null||(Number.isFinite(v)&&v>0&&v<(unit==='°'?Math.PI:2)),r.id+' '+key);
    }
    assert.equal(r.simulationPreset,null);
    assert.deepEqual(r.mechanism,{pivotCoordinates:null,shockEyeCoordinates:null,linkLengths:null});
    assert.equal(referenceRows(r).length,REFERENCE_FIELDS.length);
  }
  const record=id=>CATALOGUE.records.find(r=>r.id===id);
  const low=record('santa-cruz-hightower3-2023-m-low'),high=record('santa-cruz-hightower3-2023-m-high');
  assert.equal(low.frame.chainstay,null);assert.equal(low.frame.rearCentre,.435);
  assert.equal(low.frame.bbDrop,.034);assert.equal(high.frame.bbDrop,.031);
  assert.equal(record('orange-five-2020-m').frame.bbDrop,.025);
  const transition=record('transition-sentinel-carbon-2022-md-150');
  assert.equal(transition.suspension.shockStroke,.0625);assert.equal(transition.suspension.rearTravel,.15);
  assert.equal(transition.hardware.upperShock.type,'trunnion');
  assert.equal(referenceRows(transition).find(r=>r.label==='Head tube').display,'Not sourced');
});
