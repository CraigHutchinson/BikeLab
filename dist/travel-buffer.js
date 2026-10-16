// Progressive compliant buffers inside a finite stroke. Inputs are validated by
// the owning model. Caller-owned output: generalized force, potential, loss
// power, positive top force, positive bottom force. No allocation per step.
export function travelBuffer(q,velocity,travel,width,stiffness,damping,out) {
  const top=Math.max(0,width-q),bottom=Math.max(0,q-(travel-width));
  const closingTop=Math.max(0,-velocity),closingBottom=Math.max(0,velocity);
  const topForce=stiffness*top*top/width+damping*closingTop*top/width;
  const bottomForce=stiffness*bottom*bottom/width+damping*closingBottom*bottom/width;
  out[0]=topForce-bottomForce;
  out[1]=stiffness*(top**3+bottom**3)/(3*width);
  out[2]=damping*(closingTop**2*top+closingBottom**2*bottom)/width;
  out[3]=topForce;out[4]=bottomForce;
}
