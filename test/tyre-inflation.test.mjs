import test from 'node:test';
import assert from 'node:assert/strict';
import {sectionGeometry,createInflationDiagnostic} from '../scripts/lib/tyre-inflation.mjs';
const config=()=>({rimRadius:.311,rimWidth:.03,restHeight:.05,maxHeight:.075,meridionalRigidity:200000,gaugePressure:160000,provenance:'Illustrative meridional-only material; no calibration'});
const near=(a,b,tol)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${a} != ${b}`);
test('axisymmetric volume agrees with independent disk integration and differentiated geometry',()=>{
 for(const H of [.02,.05,.07]){
  const L=.311,b=.015,g=sectionGeometry(L,b,H),n=16384,dz=H/n;let volume=0;
  // Midpoint quadrature in radial height, independent of centroid formula.
  for(let i=0;i<n;i++){const z=(i+.5)*dz,width=2*Math.sqrt(Math.max(0,g.radius**2-(z-g.centreHeight)**2));volume+=2*Math.PI*(L+z)*width*dz;}
  near(volume,g.volume,2e-9);
  const h=1e-7,plus=sectionGeometry(L,b,H+h),minus=sectionGeometry(L,b,H-h);
  near((plus.volume-minus.volume)/(2*h),g.volumeGradient,1e-9);
  near((plus.contour-minus.contour)/(2*h),g.contourGradient,1e-9);
 }
});
test('inflation generalized force is negative derivative of the complete potential',()=>{
 const m=createInflationDiagnostic(config());
 for(const H of [.051,.06,.074]){const h=1e-7,s=m.evaluate(H);near(-(m.evaluate(H+h).potential-m.evaluate(H-h).potential)/(2*h),s.residual,2e-5);}
});
test('pressure sweep has nonzero balanced prestress and stable scalar equilibria',()=>{
 let previous=.05;
 for(const pressure of [80000,160000,240000]){
  const m=createInflationDiagnostic({...config(),gaugePressure:pressure}),r=m.solve(),s=r.state,h=1e-6;
  assert.ok(s.height>previous);previous=s.height;assert.ok(s.pressureForce>0&&s.materialForce<0);near(s.residual,0,2e-6);
  assert.ok(m.evaluate(s.height-h).potential>s.potential);assert.ok(m.evaluate(s.height+h).potential>s.potential);
  assert.ok((m.evaluate(s.height-h).residual-m.evaluate(s.height+h).residual)/(2*h)>0);
 }
});
test('stress-free zero pressure and unsupported inflation fail explicitly',()=>{
 const m=createInflationDiagnostic({...config(),gaugePressure:0});near(m.solve().state.height,.05,0);near(m.solve().state.residual,0,0);
 assert.throws(()=>createInflationDiagnostic({...config(),meridionalRigidity:0}));
 assert.throws(()=>createInflationDiagnostic({...config(),maxHeight:.050001}).solve());
 assert.throws(()=>m.evaluate(.049));assert.throws(()=>m.evaluate(NaN));
 const c=config(),owned=createInflationDiagnostic(c);c.gaugePressure=0;assert.equal(owned.configuration().gaugePressure,160000);
});
