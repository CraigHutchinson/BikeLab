// Bounded static consumer: prescribed lowering, never a dynamic or calibrated tyre.
import {createSweptCasing,RELAXED_MODEL} from './sealed-casing.js';
import {solveSealedPlane} from './sealed-plane.js';
import {illustrativeSection} from './sealed-casing-example.js';
export const MODEL='bikelab-pressure-footprint-0.1';
export const LOWERINGS=Object.freeze([0,.001,.002,.004,.002,.001,0]);
export function validateInput(input){
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||Object.keys(input).length!==1||!Object.hasOwn(input,'pressure')||![120000,160000,200000].includes(input.pressure))throw RangeError('Unsupported setup: choose 1.2, 1.6 or 2.0 bar with the fixed illustrative section and flat plane.');
 return {pressure:input.pressure};
}
export function configuration(input){
 const {pressure}=validateInput(input);
 return {nodes:256,rimRadius:.311,section:illustrativeSection.map(p=>[...p]),meridionalRigidity:200000,hoopRigidity:100000,couplingRigidity:20000,gaugePressure:pressure,ambientPressure:101325,exponent:1.2,provenance:'Uncalibrated illustrative section; flat static pressure-footprint consumer'};
}
export function* solveFootprint(input){
 const c=configuration(input),m=createSweptCasing(c,RELAXED_MODEL);let q;
 for(const [index,lowering] of LOWERINGS.entries()){
  const t=performance.now(),s=solveSealedPlane(c,m.reference.radius-lowering,q,{casingModel:RELAXED_MODEL});
  if(!s.locallyAdmissible||s.rimClearance<=0)throw Error(`Unsupported equilibrium at ${lowering*1000} mm: ${s.admission}`);
  q=s.coordinates;
  yield {index,branch:index<=3?'load':'unload',lowering,elapsedMs:performance.now()-t,reaction:s.reaction,pressure:s.state.gaugePressure,volume:s.state.volume,potential:s.state.potential,maxStrain:s.state.maxStrain,footprint:s.activeVertexSpan,rimClearance:s.rimClearance,height:s.height,coordinates:s.coordinates,contacts:s.contacts,metrics:s.metrics,stability:s.stability,admission:s.admission};
 }
}
export function record(input,states){return {model:MODEL,input:validateInput(input),scope:'Uncalibrated fixed-section flat static reference; footprint is active-vertex span, not contact area.',states};}
// Imported outputs are never trusted or displayed: loading validates inputs and reruns.
export function readRecord(value){
 if(!value||value.model!==MODEL||!Array.isArray(value.states)||value.states.length!==7)throw RangeError('Unsupported pressure-footprint record. Legacy footprint files belong to their original station.');
 return validateInput(value.input);
}
