// Read-only observations of the existing planar ring. No force or state writes.
export const TYRE_MOTION = 'bikelab-tyre-motion-0.1';
export const TYRE_MOTION_MODEL = 'bikelab-trail-bike-tyre-motion-0.1';
export const TYRE_MOTION_SCOPE = 'Sampled hub-local casing coordinates, not world point speeds. Relative speed energy is a mode diagnostic, not an additive part of total kinetic energy. Foundation and edge storage use native coefficients; damping powers are nonnegative constitutive losses. Signed normal/tangent contact power includes soft-contact storage/release. No equilibrium or continuous-time peak certification.';

export function createTyreMotionFrame(){
 return {meanVelocity:new Float64Array(2),rmsSpeed:0,residualRmsSpeed:0,relativeSpeedEnergy:0,
  maxNodeSpeed:0,maxNodeSpeedIndex:0,maxNodeAcceleration:0,maxNodeAccelerationIndex:0,
  node0Position:new Float64Array(2),node0Velocity:new Float64Array(2),node0Acceleration:new Float64Array(2),
  edgeRmsSpeed:0,maxEdgeSpeed:0,maxEdgeSpeedIndex:0,foundationEnergy:0,edgeEnergy:0,
  foundationDampingPower:0,edgeDampingPower:0,contactCount:0,normalPower:0,tangentPower:0};
}
export function materializeTyreMotion(f){return {...f,meanVelocity:Array.from(f.meanVelocity),node0Position:Array.from(f.node0Position),node0Velocity:Array.from(f.node0Velocity),node0Acceleration:Array.from(f.node0Acceleration)};}

// Bind once; retain JS-owned scalar coefficients only, never native views.
export function createTyreMotion(model,wheel){
 const nodes=wheel.nodeJoints.map((axes,i)=>({mass:model.body_mass[wheel.bodies[i+1]],axes:axes.map(j=>({q:j.q,v:j.v,
  stiffness:model.jnt_stiffness[model.dof_jntid[j.v]],reference:model.qpos_spring[j.q],damping:model.dof_damping[j.v]}))}));
 const n=nodes.length,edge=wheel.edge,stiffness=model.flex_edgestiffness[wheel.flex],damping=model.flex_edgedamping[wheel.flex];
 const rest=Float64Array.from(model.flexedge_length0.subarray(edge,edge+n));
 return {record(data,out){
  // No native call while these borrowed views are live.
  const q=data.qpos,v=data.qvel,acc=data.qacc,length=data.flexedge_length,rate=data.flexedge_velocity;
  let vx=0,vz=0,squares=0,edgeSquares=0,relativeEnergy=0;
  out.foundationEnergy=0;out.edgeEnergy=0;out.foundationDampingPower=0;out.edgeDampingPower=0;
  out.maxNodeSpeed=0;out.maxNodeSpeedIndex=0;out.maxNodeAcceleration=0;out.maxNodeAccelerationIndex=0;
  out.maxEdgeSpeed=0;out.maxEdgeSpeedIndex=0;out.contactCount=0;out.normalPower=0;out.tangentPower=0;
  for(let i=0;i<n;i++){
   const node=nodes[i],u=node.axes[0],z=node.axes[1],speed2=v[u.v]**2+v[z.v]**2,speed=Math.sqrt(speed2),a=Math.hypot(acc[u.v],acc[z.v]);
   vx+=v[u.v];vz+=v[z.v];squares+=speed2;relativeEnergy+=.5*node.mass*speed2;
   if(speed>out.maxNodeSpeed){out.maxNodeSpeed=speed;out.maxNodeSpeedIndex=i;}
   if(a>out.maxNodeAcceleration){out.maxNodeAcceleration=a;out.maxNodeAccelerationIndex=i;}
   for(let k=0;k<2;k++){const j=node.axes[k];out.foundationEnergy+=.5*j.stiffness*(q[j.q]-j.reference)**2;out.foundationDampingPower+=j.damping*v[j.v]**2;
    if(i===0){out.node0Position[k]=q[j.q];out.node0Velocity[k]=v[j.v];out.node0Acceleration[k]=acc[j.v];}}
   const extension=length[edge+i]-rest[i],s=rate[edge+i];out.edgeEnergy+=.5*stiffness*extension**2;out.edgeDampingPower+=damping*s*s;edgeSquares+=s*s;
   if(Math.abs(s)>out.maxEdgeSpeed){out.maxEdgeSpeed=Math.abs(s);out.maxEdgeSpeedIndex=i;}
  }
  out.meanVelocity[0]=vx/n;out.meanVelocity[1]=vz/n;out.rmsSpeed=Math.sqrt(squares/n);out.relativeSpeedEnergy=relativeEnergy;
  // Two passes avoid cancellation for almost uniform ring motion.
  let residual=0;for(const node of nodes)residual+=(v[node.axes[0].v]-vx/n)**2+(v[node.axes[1].v]-vz/n)**2;
  out.residualRmsSpeed=Math.sqrt(residual/n);out.edgeRmsSpeed=Math.sqrt(edgeSquares/n);
 }};
}

// Fresh short probe from an accepted physical state; command history is not replayed.
export function tyreMotionProbe(record){
 if(!record?.scenario?.active||!record.finalState||!record.frames?.length)throw Error('Tyre motion probe requires an accepted active rider state.');
 const a=structuredClone(record.scenario),last=record.frames.at(-1);
 a.initialization={mode:'state',state:structuredClone(record.finalState)};
 a.motion={gravity:a.motion.gravity,duration:.02,dt:a.motion.dt,sampleDt:.000125};
 a.commands=[{...last.command,tick:0}];a.diagnostics=TYRE_MOTION;return a;
}
