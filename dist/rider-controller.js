// Runtime estimate, not inverse dynamics or a human strength model.
import {SEGMENTS} from './rider-posture.js';
import {EFFORT_DESCENDANTS,createEffortGeometry,createEffortSolution,solveEffortBalance} from './rider-effort-balance.js';
export const CONTROL_FORMAT='bikelab-rider-estimate-feedback-0.1';
export const CONTROL_MODEL='bikelab-trail-bike-controller-0.1';
export function createControlFrame(){return {estimate:new Float64Array(4),kp:new Float64Array(4),kd:new Float64Array(4),inertia:new Float64Array(4),proportional:new Float64Array(4),damping:new Float64Array(4),handEstimate:new Float64Array(2),footEstimate:new Float64Array(2),contactMask:0,estimateStatus:'unobserved'};}

// Current native contact geometry is available before force evaluation. This
// qualifies a two-wheel contact estimate, not solved support or static equilibrium.
export function wheelContactMask(data,front,rear){
 let mask=0;const list=data.contact;
 try{for(let i=0;i<list.size();i++){const c=list.get(i);try{
  const flex=c.flex,side=flex[0]>=0?0:1;
  if(c.dist<=0&&flex[1-side]<0){if(flex[side]===front)mask|=1;else if(flex[side]===rear)mask|=2;}
 }finally{c.delete();}}}finally{list.delete();}
 return mask;
}

// No persistent control history: repeated evaluation and rejected-step restore
// depend only on configuration, targets and the current native mechanical state.
export function createRiderController(mj,model,laws,passive,response){
 const id=(kind,name)=>{const value=mj.mj_name2id(model,mj.mjtObj[kind].value,name);if(value<0)throw Error('Missing controller binding: '+name);return value;};
 const bodies=SEGMENTS.map(name=>id('mjOBJ_BODY','rider_'+name)),joints=passive.laws.map(l=>id('mjOBJ_JOINT',l.nativeName)),sites=['hand','foot'].map(name=>id('mjOBJ_SITE','rider_'+name));
 const g=createEffortGeometry(),solution=createEffortSolution(),frame=createControlFrame(),omega=2*Math.PI*response.frequencyHz;
 for(let i=0;i<5;i++)g.mass[i]=model.body_mass[bodies[i]];
 for(let i=0;i<4;i++)g.limits[i]=laws[i].drive.maxTorque;
 return {frame,evaluate(data,q){
  const com=data.xipos,anchors=data.xanchor,points=data.site_xpos,gravity=model.opt.gravity;
  g.gravity[0]=gravity[0];g.gravity[1]=gravity[2];
  for(let i=0;i<5;i++){g.com[2*i]=com[3*bodies[i]];g.com[2*i+1]=com[3*bodies[i]+2];}
  for(let i=0;i<2;i++){g.anchors[2*i]=points[3*sites[i]];g.anchors[2*i+1]=points[3*sites[i]+2];}
  for(let i=0;i<4;i++){
   const x=anchors[3*joints[i]],z=anchors[3*joints[i]+2],p=passive.laws[i];g.joints[2*i]=x;g.joints[2*i+1]=z;
   // Native springs remain in the model; subtract their contribution once.
   // Do not cancel native damping with the static feedforward estimate.
   g.passive[i]=-p.stiffness*(p.angle0+q[i]-p.restAngle);
   let inertia=0;for(const j of EFFORT_DESCENDANTS[i])inertia+=model.body_inertia[3*bodies[j]+1]+g.mass[j]*((g.com[2*j]-x)**2+(g.com[2*j+1]-z)**2);
   frame.inertia[i]=inertia;frame.kp[i]=inertia*omega*omega;frame.kd[i]=2*response.dampingRatio*inertia*omega;
  }
  frame.estimate.fill(0);frame.handEstimate.fill(0);frame.footEstimate.fill(0);
  if(response.compensation==='off')frame.estimateStatus='disabled';
  else if(frame.contactMask!==3)frame.estimateStatus='requires-two-wheel-contact';
  else if(solveEffortBalance(g,solution)){
   frame.estimateStatus='two-wheel-contact-estimate';frame.estimate.set(solution.active);frame.handEstimate.set(solution.hand);frame.footEstimate.set(solution.foot);
  }else frame.estimateStatus=solution.status;
  return frame;
 }};
}
