// Two-eye single-pivot geometry, SI. No constitutive or constant-leverage model.
const BASE=Object.freeze({radius:.36,frameHeight:.65,headAngle:65*Math.PI/180,frontX:.70,axleZ:-.29,rearX:-.45,
  forkTravel:.16,rearAngleMax:.4,wheelMass:3,rearMass:4,frameInertia:8});
export const REFERENCE_GEOMETRY=Object.freeze({pivotX:0,pivotZ:-.15,shockFrameX:-.08,shockFrameZ:.15,shockArmX:-.20,shockArmZ:-.03,shockTravel:.065});
export const ANNOTATION=Object.freeze({width:2670,height:1558,pivot:Object.freeze([.434,.618]),armEye:Object.freeze([.408,.463]),frameEye:Object.freeze([.507,.439]),eyeLength:.210,stroke:.055});
const a=ANNOTATION,dx=(a.frameEye[0]-a.armEye[0])*a.width,dz=(a.armEye[1]-a.frameEye[1])*a.height,scale=a.eyeLength/Math.hypot(dx,dz);
// Pivot position relative to BB is an illustrative estimate, not digitized truth.
export const PHOTO_GEOMETRY=Object.freeze({pivotX:.040,pivotZ:-.235,
  shockArmX:(a.armEye[0]-a.pivot[0])*a.width*scale,shockArmZ:(a.pivot[1]-a.armEye[1])*a.height*scale,
  shockFrameX:.040+(a.frameEye[0]-a.pivot[0])*a.width*scale,shockFrameZ:-.235+(a.pivot[1]-a.frameEye[1])*a.height*scale,shockTravel:a.stroke});
export const GEOMETRY_KEYS=Object.freeze(Object.keys(REFERENCE_GEOMETRY));
export function geometryFor(p=PHOTO_GEOMETRY){
  const fields=Object.fromEntries(GEOMETRY_KEYS.map(k=>[k,p[k]]));
  return Object.freeze({...BASE,...fields,armX:BASE.rearX-p.pivotX,
    // Retain the original encoded offset exactly for historical replay.
    armZ:p.pivotZ===-.15?-.14:BASE.axleZ-p.pivotZ});
}
export const GEOMETRY=geometryFor();
export function geometryLabel(p){
  const matches=preset=>GEOMETRY_KEYS.every(k=>p[k]===preset[k]);
  return matches(PHOTO_GEOMETRY)?'Annotated layout · estimated geometry':matches(REFERENCE_GEOMETRY)?'Original reference geometry':'Custom geometry · uncalibrated';
}
export function shockLength(angle,g=GEOMETRY){
  const c=Math.cos(angle),s=Math.sin(angle);
  return Math.hypot(g.pivotX+c*g.shockArmX+s*g.shockArmZ-g.shockFrameX,g.pivotZ-s*g.shockArmX+c*g.shockArmZ-g.shockFrameZ);
}
export function shockCompressionJacobian(angle,g=GEOMETRY){
  const c=Math.cos(angle),s=Math.sin(angle),x=g.pivotX+c*g.shockArmX+s*g.shockArmZ-g.shockFrameX,z=g.pivotZ-s*g.shockArmX+c*g.shockArmZ-g.shockFrameZ;
  return -(x*(-s*g.shockArmX+c*g.shockArmZ)+z*(-c*g.shockArmX-s*g.shockArmZ))/Math.hypot(x,z);
}
export function rearRise(angle,g=GEOMETRY){return -Math.sin(angle)*g.armX+(Math.cos(angle)-1)*g.armZ;}
export function verticalMotionRatio(angle,g=GEOMETRY){return (-Math.cos(angle)*g.armX-Math.sin(angle)*g.armZ)/shockCompressionJacobian(angle,g);}
function minTrig(A,B,end){
  const points=[0,end],root=Math.atan2(A,B);
  for(let k=-2;k<=2;k++){const t=root+k*Math.PI;if(t>0&&t<end)points.push(t);}
  return Math.min(...points.map(t=>A*Math.sin(t)+B*Math.cos(t)));
}
export function validateGeometry(p){
  const ranges={pivotX:[-.1,.2],pivotZ:[-.35,-.08],shockFrameX:[-.3,.4],shockFrameZ:[-.3,.35],shockArmX:[-.35,.2],shockArmZ:[-.15,.35],shockTravel:[.03,.09]};
  for(const [k,[lo,hi]] of Object.entries(ranges))if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi)throw Error(`${k} must be between ${lo} and ${hi} (m).`);
  const g=geometryFor(p),dx=g.shockFrameX-g.pivotX,dz=g.shockFrameZ-g.pivotZ;
  // j numerator = A sin(theta)+B cos(theta). Check all analytic extrema,
  // not a pose sampling grid that could miss a toggle between samples.
  const A=-dx*g.shockArmX-dz*g.shockArmZ,B=dx*g.shockArmZ-dz*g.shockArmX;
  if(minTrig(A,B,g.rearAngleMax)<1e-4)throw Error('Geometry crosses a toggle or reverses shock compression.');
  if(shockLength(g.rearAngleMax,g)<.05)throw Error('Shock eyes approach coincidence within the angle domain.');
  if(shockLength(0,g)-shockLength(g.rearAngleMax,g)<g.shockTravel)throw Error('Shock stroke is unreachable within the supported angle domain.');
  if(2*p.shockBufferWidth>=g.shockTravel)throw Error('Shock buffer zones overlap.');
}
export function strokeAngle(g=GEOMETRY){let lo=0,hi=g.rearAngleMax;const length=shockLength(0,g);for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(length-shockLength(mid,g)<g.shockTravel)lo=mid;else hi=mid;}return (lo+hi)/2;}
export function linkageDiagnostics(run){
  const g=run.geometry,s=run.signals,full=run.params.bike==='full',theta=s.rearAngle[0],j=full?shockCompressionJacobian(theta,g):null;
  const curve=[],end=full?strokeAngle(g):0;if(full)for(let i=0;i<=80;i++){const angle=end*i/80,compression=shockLength(0,g)-shockLength(angle,g);curve.push({angle,compression,rise:rearRise(angle,g),jacobian:shockCompressionJacobian(angle,g),ratio:verticalMotionRatio(angle,g)});}
  return {label:geometryLabel(run.params),frontLoad:run.initial.frontForce,rearLoad:run.initial.rearForce,
    frontShare:run.initial.frontForce/(run.initial.frontForce+run.initial.rearForce),forkSag:s.fork[0],forkSagFraction:s.fork[0]/g.forkTravel,
    shockSag:full?s.shock[0]:null,shockSagFraction:full?s.shock[0]/g.shockTravel:null,eyeLength:full?shockLength(0,g):null,
    rearRise:full?rearRise(theta,g):null,rearTravel:full?rearRise(strokeAngle(g),g):null,jacobian:j,verticalRatio:full?verticalMotionRatio(theta,g):null,curve};
}
