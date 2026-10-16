import {GEOMETRY as g} from './bike-rig.js';

// Display frame, in SI. Body/joint/shock locations always come from the physical fixture.
// BB drop is a reference-informed illustration, not an Orange production-bike preset.
export const FRAME_DRAWING=Object.freeze({bbX:0,bbDrop:.025,seatTubeLength:.43,
  seatAngle:74*Math.PI/180,axleToCrown:.55,headTubeLength:.11});
export function rigLandmarks({bike,pitch,heave,fork,rearAngle}) {
  const f=FRAME_DRAWING,c=Math.cos(pitch),s=Math.sin(pitch);
  const world=(x,z)=>[c*x+s*z,heave-s*x+c*z];
  const bbZ=g.axleZ-f.bbDrop;
  const headX=g.frontX-f.axleToCrown*Math.cos(g.headAngle),headZ=g.axleZ+f.axleToCrown*Math.sin(g.headAngle);
  const arm=(x,z)=>world(Math.cos(rearAngle)*x+Math.sin(rearAngle)*z,g.pivotZ-Math.sin(rearAngle)*x+Math.cos(rearAngle)*z);
  return {bb:world(f.bbX,bbZ),seat:world(f.bbX-f.seatTubeLength*Math.cos(f.seatAngle),bbZ+f.seatTubeLength*Math.sin(f.seatAngle)),
    headBottom:world(headX,headZ),headTop:world(headX-f.headTubeLength*Math.cos(g.headAngle),headZ+f.headTubeLength*Math.sin(g.headAngle)),
    front:world(g.frontX-fork*Math.cos(g.headAngle),g.axleZ+fork*Math.sin(g.headAngle)),
    rear:bike==='full'?arm(g.rearX,g.armZ):world(g.rearX,g.axleZ),
    pivot:world(0,g.pivotZ),shockFrame:world(g.shockFrameX,g.shockFrameZ),shockArm:arm(g.shockArmX,g.shockArmZ)};
}
