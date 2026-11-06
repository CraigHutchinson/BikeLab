// Prescribed compression diagnostic only; not an inflated free casing.
// Force and pressure share one volume law. See docs/TYRE_PRESSURE_KERNEL.md.
export const MODEL='bikelab-prescribed-strip-pressure-0.1';
import {polytropicState as gas,PressureDomainError} from './tyre-gas.mjs';
export {PressureDomainError} from './tyre-gas.mjs';
const plain=x=>x!==null&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype;
const finite=(x,lo,hi,name)=>{if(!Number.isFinite(x)||x<lo||x>hi)throw TypeError(name+' outside diagnostic range');};
const exactKeys=(x,keys,name)=>{if(!plain(x)||Reflect.ownKeys(x).length!==keys.length||Reflect.ownKeys(x).some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value')||!Object.getOwnPropertyDescriptor(x,k).enumerable))throw TypeError('Invalid '+name+' fields');};

// Circular-segment area. The small-angle series avoids cancellation near zero.
export function circularSegment(radius,compression){
 finite(radius,.005,.1,'sectionRadius');
 if(!Number.isFinite(compression)||compression<0||compression>radius)throw new PressureDomainError('compression-domain','Require 0 <= compression <= section radius');
 const t=2*Math.asin(Math.sqrt(compression/(2*radius))),t2=t*t;
 const area=radius*radius*(t<.02?t*t2*(2/3+t2*(-2/15+t2*(4/315+t2*(-2/2835+t2*4/155925)))):t-Math.sin(t)*Math.cos(t));
 const x=compression/radius,root=Math.sqrt(x*(2-x)),halfWidth=radius*root;
 if(compression>0&&area===0)throw new PressureDomainError('compression-resolution','Compression volume is below numeric resolution');
 return {area,width:2*halfWidth,widthDerivative:compression===0?null:2*(1-x)/root};
}


export function createPressureChamber(input){
 const keys=['referenceVolume','ambientPressure','initialGaugePressure','exponent','minVolumeFraction','sectionRadius','arcLengths','provenance'];
 exactKeys(input,keys,'configuration');
 finite(input.referenceVolume,1e-6,.1,'referenceVolume');
 finite(input.ambientPressure,1e4,2e5,'ambientPressure');
 finite(input.initialGaugePressure,0,2e6,'initialGaugePressure');
 finite(input.exponent,1,1.4,'exponent');
 finite(input.minVolumeFraction,.05,.99,'minVolumeFraction');
 finite(input.sectionRadius,.005,.1,'sectionRadius');
 if(!Array.isArray(input.arcLengths)||input.arcLengths.length<1||input.arcLengths.length>4096)throw TypeError('Invalid arcLengths');
 let totalArc=0;for(const ds of input.arcLengths){finite(ds,1e-6,1,'arcLength');totalArc+=ds;}if(totalArc>10)throw TypeError('Arc length exceeds diagnostic envelope');
 exactKeys(input.provenance,['kind','reference'],'provenance');
 if(!['illustrative','declared','measured'].includes(input.provenance.kind)||typeof input.provenance.reference!=='string'||!input.provenance.reference.trim()||input.provenance.reference.length>2000)throw TypeError('Explicit provenance is required');
 const config={...input,arcLengths:[...input.arcLengths],provenance:{...input.provenance}};
 return Object.freeze({
  configuration(){return {...config,arcLengths:[...config.arcLengths],provenance:{...config.provenance}};},
  evaluate(compression){
   if(!(Array.isArray(compression)||compression instanceof Float64Array)||compression.length!==config.arcLengths.length)throw TypeError('Compression must match arcLengths');
   const nodes=new Array(compression.length);let loss=0;
   for(let i=0;i<nodes.length;i++){
    const g=circularSegment(config.sectionRadius,compression[i]),ds=config.arcLengths[i],volumeLoss=ds*g.area,effectiveArea=ds*g.width;
    if(compression[i]>0&&volumeLoss===0)throw new PressureDomainError('volume-resolution','Weighted strip volume is below numeric resolution');
    loss+=volumeLoss;nodes[i]={compression:compression[i],arcLength:ds,width:g.width,volumeLoss,effectiveArea,volumeGradient:-effectiveArea,areaDerivative:g.widthDerivative===null?null:ds*g.widthDerivative};
   }
   const state=gas(config,loss);
   for(const node of nodes){
    node.resistingForce=state.gaugePressure*node.effectiveArea;
    node.generalizedForce=-node.resistingForce; // inward compression is positive
    node.areaStiffness=node.areaDerivative===null?(state.gaugePressure===0?0:null):state.gaugePressure*node.areaDerivative;
   }
   // Tangent of resisting force = coupling*S*S^T + diag(areaStiffness).
   // Rank-one representation keeps storage and evaluation O(nodes).
   return {model:MODEL,...state,nodes,tangentDefined:nodes.every(n=>n.areaStiffness!==null)};
  }
 });
}
