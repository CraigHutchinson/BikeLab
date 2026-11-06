import test from 'node:test';
import assert from 'node:assert/strict';
import {envelopeCases,compareEnvelopeCase} from '../scripts/lib/tyre-envelope.mjs';
import {createMeridianDiagnostic} from '../scripts/lib/tyre-meridian.mjs';
test('coverage grid owns all inputs and admits every asymmetric start with fixed beads',()=>{
 const rows=envelopeCases();assert.equal(rows.length,108);assert.equal(new Set(rows.map(r=>r.id)).size,108);
 for(const r of rows){createMeridianDiagnostic(r.configuration).evaluate(r.initial);assert.deepEqual(r.initial[0],r.configuration.restPoints[0]);assert.deepEqual(r.initial.at(-1),r.configuration.restPoints.at(-1));}
 rows[0].initial[1][0]=999;assert.notEqual(rows[0].configuration.restPoints[1][0],999);assert.notEqual(envelopeCases()[0].initial[1][0],999);
});
test('convergence and constrained stability do not hide compressive-resultant rejection',()=>{
 const rows=envelopeCases().filter(r=>(r.geometry==='compact'&&r.material==='negative-coupling'||r.geometry==='wide'&&r.material==='hoop-dominant')&&r.configuration.gaugePressure===160000&&r.segments===16);
 assert.equal(rows.length,4);for(const c of rows){
  const r=compareEnvelopeCase(c);assert.ok(Object.values(r.results).every(s=>s.converged));assert.ok(r.coordinateDifference<=2e-9);
  assert.equal(r.stability.classification,'positive-with-refinement-margin');
  if(c.material==='negative-coupling'){assert.equal(r.accepted,false);assert.deepEqual(r.rejections,['compressive-resultants']);assert.ok(r.results['analytic-banded'].state.strains.some(s=>s.hoopStressResultant<0));}
  else {assert.ok(r.accepted,c.id);assert.deepEqual(r.rejections,[]);}
 }
});
test('comparison preserves an explicit nonconverged control instead of claiming parity',()=>{
 const c=envelopeCases().find(r=>r.geometry==='wide'&&r.material==='negative-coupling'&&r.start==='rest');
 c.configuration={...c.configuration,gaugePressure:1000000,meridionalRigidity:1000,hoopRigidity:600,couplingRigidity:0};
 const r=compareEnvelopeCase(c);assert.equal(r.accepted,false);assert.equal(r.coordinateDifference,null);assert.equal(r.results['analytic-banded'].converged,false);assert.ok(r.rejections.includes('nonconverged'));
});
