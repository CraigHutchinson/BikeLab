import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runRig,rigRecord,validate,setupFromRecord,MODEL,DEFAULTS,G} from '../dist/bike-rig.js';
import {ANNOTATION,GEOMETRY_KEYS,GEOMETRY,PHOTO_GEOMETRY,REFERENCE_GEOMETRY,geometryFor,shockLength,shockCompressionJacobian,verticalMotionRatio,rearRise,strokeAngle,linkageDiagnostics} from '../dist/linkage.js';
const close=(a,b,tol=1e-12)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);

test('annotations set high arm eye and 210 mm short shock without moving axle/BB datums',()=>{
  const g=GEOMETRY;close(shockLength(0),.210);close(g.shockTravel,.055);
  close(g.pivotX,.04);close(g.pivotZ-(-.315),.08);assert.ok(g.shockArmZ>0);
  close(g.pivotX+g.armX,-.45);close(g.pivotZ+g.armZ,-.29);
  // Independent relative pixel ratios; uniform length conversion and inverted y.
  const pixelLength=Math.hypot(.099*2670,.024*1558),scale=.210/pixelLength;
  close(g.shockArmX,-.026*2670*scale);close(g.shockArmZ,.155*1558*scale);
  close(g.shockFrameX-g.pivotX,.073*2670*scale);close(g.shockFrameZ-g.pivotZ,.179*1558*scale);
  close((g.shockFrameZ-g.pivotZ-g.shockArmZ)/(g.shockFrameX-g.pivotX-g.shockArmX),.024*1558/(.099*2670));
  assert.ok(strokeAngle()<.3);close(shockLength(0)-shockLength(strokeAngle()),.055);
  assert.ok(rearRise(strokeAngle())>.13&&rearRise(strokeAngle())<.15);
});

test('continuous geometric derivatives and stroke endpoint remain consistent in reference/new/perturbed layouts',()=>{
  for(const setup of [REFERENCE_GEOMETRY,PHOTO_GEOMETRY,{...PHOTO_GEOMETRY,pivotX:.045,shockFrameZ:PHOTO_GEOMETRY.shockFrameZ+.005}]){
    const p=validate(setup),g=geometryFor(p),end=strokeAngle(g);
    for(let i=0;i<=80;i++){const angle=end*i/80,h=1e-6,j=shockCompressionJacobian(angle,g),fd=-(shockLength(angle+h,g)-shockLength(angle-h,g))/(2*h);
      close(j,fd,1e-9);assert.ok(j>0);close(verticalMotionRatio(angle,g)*j,(rearRise(angle+h,g)-rearRise(angle-h,g))/(2*h),1e-9);
    }
    close(shockLength(0,g)-shockLength(end,g),p.shockTravel);
  }
});

test('invalid geometry rejects missing/ambiguous coordinates, toggles and unreachable travel',()=>{
  for(const p of [{pivotX:NaN},{pivotZ:0},{shockTravel:.2},{shockArmZ:-.15},{shockFrameX:.04,shockFrameZ:-.235},{shockTravel:.09}])assert.throws(()=>validate(p));
  const missing={...DEFAULTS};delete missing.pivotX;assert.throws(()=>setupFromRecord({model:MODEL,params:missing}),/Incomplete/);
  assert.throws(()=>setupFromRecord({model:'bikelab-planar-rig-0.4',params:DEFAULTS}),/Unknown legacy/);
});

test('configuration diagnostics agree with independent static axle moment and suspension force balance',async()=>{
  for(const rider of ['fixed','compliant']){
    const r=await runRig({rider,duration:2}),d=linkageDiagnostics(r),g=r.geometry,s=r.signals,theta=s.rearAngle[0],pitch=s.pitch[0];
    const rearMoment=(r.initial.rearForce-g.rearMass*G)*(-Math.cos(theta+pitch)*g.armX-Math.sin(theta+pitch)*g.armZ);
    close(rearMoment,r.params.shockStiffness*s.shock[0]*shockCompressionJacobian(theta,g),.001);
    close(d.frontShare,r.initial.frontForce/((r.params.mass+7)*G),1e-6);close(d.shockSagFraction,s.shock[0]/.055);
    assert.equal(d.curve.length,81);close(d.curve.at(-1).compression,.055);assert.ok(d.verticalRatio>2&&d.verticalRatio<3);
    assert.equal(r.status,'complete');assert.ok(r.summary.maxResidual<.02);
  }
  const hardtail=await runRig({bike:'hardtail',duration:2});assert.equal(linkageDiagnostics(hardtail).shockSag,null);assert.deepEqual(linkageDiagnostics(hardtail).curve,[]);
});

test('v0.4 historical recordings preserve every channel and summary exactly in all four variants',async()=>{
  const baseline=JSON.parse(await readFile(new URL('../docs/evidence/iteration-11-legacy-baseline.json',import.meta.url),'utf8'));
  for(const old of baseline){const p=setupFromRecord(old);for(const key of GEOMETRY_KEYS)assert.equal(p[key],REFERENCE_GEOMETRY[key]);
    const r=await runRig(p),hash=createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(rigRecord(r).signals).filter(([k])=>!k.startsWith('guide')&&!k.startsWith('fixture')&&!k.startsWith('pivot')&&!['heaveVelocity','pitchVelocity','forkVelocity','rearAngularVelocity','riderBufferForce','riderLowerForce','riderUpperForce','riderBufferEnergy','riderBufferDissipation','riderTotalForce'].includes(k))))).digest('hex');assert.equal(hash,old.signalsHash);assert.deepEqual(Object.fromEntries(Object.keys(old.summary).map(k=>[k,r.summary[k]])),old.summary);
  }
});
