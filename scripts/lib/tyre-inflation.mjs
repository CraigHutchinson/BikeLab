// One axisymmetric degree of freedom; illustrative meridional material only.
// Not a full casing, loaded-contact law or nonaxisymmetric stability proof.
export const MODEL='bikelab-axisymmetric-inflation-0.1';
export function sectionGeometry(rimRadius,halfWidth,height){
 if(![rimRadius,halfWidth,height].every(Number.isFinite)||rimRadius<=0||halfWidth<=0||height<halfWidth)throw RangeError('Require positive rim and width, height >= half-width');
 const b=halfWidth,H=height,r=(H*H+b*b)/(2*H),c=(H*H-b*b)/(2*H),phi=Math.atan2(c,b),t=Math.PI/2+phi;
 const dr=.5*(1-b*b/(H*H)),dc=.5*(1+b*b/(H*H)),dp=dc*b/(r*r);
 const area=r*r*t+b*c,dArea=2*r*dr*t+r*r*dp+b*dc;
 const volume=2*Math.PI*((rimRadius+c)*area+2*b**3/3),volumeGradient=2*Math.PI*((rimRadius+c)*dArea+dc*area);
 const contour=2*r*t,contourGradient=2*dr*t+2*r*dp;
 if(![volume,volumeGradient,contour,contourGradient].every(Number.isFinite))throw RangeError('Geometry overflow');
 return {height,radius:r,centreHeight:c,phi,area,volume,volumeGradient,contour,contourGradient};
}
export function createInflationDiagnostic(input){
 const keys=['rimRadius','rimWidth','restHeight','maxHeight','meridionalRigidity','gaugePressure','provenance'];
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).length!==keys.length||Reflect.ownKeys(input).some(k=>!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(input,k),'value')))throw TypeError('Invalid configuration');
 const c={...input};
 for(const key of keys.filter(k=>k!=='provenance'))if(!Number.isFinite(c[key]))throw TypeError('Nonfinite '+key);
 if(c.rimRadius<.15||c.rimRadius>.45||c.rimWidth<.005||c.rimWidth>.08||c.restHeight<c.rimWidth/2||c.maxHeight<=c.restHeight||c.maxHeight>.15||c.meridionalRigidity<=0||c.meridionalRigidity>1e8||c.gaugePressure<0||c.gaugePressure>1e6)throw RangeError('Outside diagnostic envelope');
 if(typeof c.provenance!=='string'||!c.provenance.trim()||c.provenance.length>2000)throw TypeError('Explicit material/geometry provenance required');
 const rest=sectionGeometry(c.rimRadius,c.rimWidth/2,c.restHeight),factor=2*Math.PI*c.rimRadius*c.meridionalRigidity/rest.contour;
 function evaluate(height){
  if(!Number.isFinite(height)||height<c.restHeight||height>c.maxHeight)throw RangeError('Height outside declared inflation interval');
  const g=sectionGeometry(c.rimRadius,c.rimWidth/2,height),extension=g.contour-rest.contour;
  const materialEnergy=.5*factor*extension*extension,pressurePotential=-c.gaugePressure*(g.volume-rest.volume);
  const materialForce=-factor*extension*g.contourGradient,pressureForce=c.gaugePressure*g.volumeGradient;
  return {...g,materialEnergy,pressurePotential,potential:materialEnergy+pressurePotential,materialForce,pressureForce,residual:materialForce+pressureForce,meridionalStrain:extension/rest.contour};
 }
 function solve(){
  if(c.gaugePressure===0)return {state:evaluate(c.restHeight),iterations:0,bracketWidth:0,scope:'Zero-pressure stress-free state'};
  let lo=c.restHeight,hi=c.maxHeight;
  if(evaluate(hi).residual>=0)throw RangeError('No restoring bracket in declared interval');
  let iterations=0;
  while(hi-lo>1e-13&&iterations<64){const mid=(lo+hi)/2;if(evaluate(mid).residual>0)lo=mid;else hi=mid;iterations++;}
  if(hi-lo>1e-13)throw Error('Equilibrium bracket did not converge');
  return {state:evaluate((lo+hi)/2),iterations,bracketWidth:hi-lo,scope:'Stationary point only; independently check scalar stability'};
 }
 return Object.freeze({configuration:()=>({...c}),evaluate,solve});
}
