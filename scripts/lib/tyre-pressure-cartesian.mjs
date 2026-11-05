// Offline prescribed radial-strip diagnostic, not a production casing law.
import {createPressureChamber,PressureDomainError} from './tyre-pressure.mjs';
export const MODEL='bikelab-radial-strip-map-0.1';
function point(p){
 if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))throw TypeError('Expected finite [x,z] coordinates in metres');
}
export function createRadialPressureDiagnostic(configuration,referenceRadii){
 const chamber=createPressureChamber(configuration),count=chamber.configuration().arcLengths.length;
 if(!Array.isArray(referenceRadii)||referenceRadii.length!==count||!referenceRadii.every(r=>Number.isFinite(r)&&r>configuration.sectionRadius&&r<=1))throw TypeError('Reference radii must match strips and exceed section radius');
 const radii=[...referenceRadii];
 return Object.freeze({evaluate(hub,positions){
  point(hub);
  if(!Array.isArray(positions)||positions.length!==count)throw TypeError('Positions must match strips');
  const directions=[],compression=[];
  for(let i=0;i<count;i++){
   point(positions[i]);
   const x=positions[i][0]-hub[0],z=positions[i][1]-hub[1],r=Math.hypot(x,z);
   if(!Number.isFinite(r)||r===0)throw new PressureDomainError('radial-domain','Collapsed or nonfinite hub-relative radius');
   compression.push(radii[i]-r);directions.push([x/r,z/r]);
  }
  // delta=R-|q-h|, so -dU/dq=+F e and -dU/dh=-sum(F e).
  // Use the CURRENT direction; a fixed reference direction violates this map.
  const state=chamber.evaluate(compression),hubForce=[0,0];
  const nodeForces=state.nodes.map((n,i)=>directions[i].map((e,j)=>{
   const f=n.resistingForce*e;hubForce[j]-=f;return f;
  }));
  if(!hubForce.every(Number.isFinite))throw new PressureDomainError('nonfinite-result','Nonfinite hub reaction');
  return {model:MODEL,pressure:state,compression,nodeForces,hubForce};
 }});
}
