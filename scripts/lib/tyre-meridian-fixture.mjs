import {sectionGeometry} from './tyre-inflation.mjs';
export function circularMeridian(height,segments=16){
 if(!Number.isInteger(segments)||segments<4||segments>256)throw RangeError('Invalid fixture resolution');
 const b=.015,g=sectionGeometry(.311,b,height);
 return Array.from({length:segments+1},(_,i)=>{
  if(i===0)return [b,0];if(i===segments)return [-b,0];
  const a=-g.phi+(Math.PI+2*g.phi)*i/segments;
  return [g.radius*Math.cos(a),g.centreHeight+g.radius*Math.sin(a)];
 });
}
export function meridianFixture(segments=16){return {rimRadius:.311,restPoints:circularMeridian(.05,segments),meridionalRigidity:200000,hoopRigidity:100000,couplingRigidity:20000,gaugePressure:160000,provenance:'Illustrative orthotropic axisymmetric material and circular reference; no measured casing'};}
