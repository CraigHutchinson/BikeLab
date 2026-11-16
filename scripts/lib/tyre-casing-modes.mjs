// Offline local-strain receiving, independent of force accumulation.
import {createSweptCasing,MODEL} from '../../dist/sealed-casing.js';
export function inspectCasingStrains(configuration,points){
 const c=configuration,m=createSweptCasing(c),N=c.nodes,H=Math.max(...c.section.map(p=>p[1])),L=c.rimRadius,radial=[],lengths=[],cells=[];
 m.evaluate(points);
 for(let i=0;i<N;i++){
  const ex=m.directions[2*i],ez=m.directions[2*i+1],r=Math.hypot(points[2*i]-L*ex,points[2*i+1]-L*ez);
  radial.push(points[2*i]*ex+points[2*i+1]*ez-m.reference.radius);
  lengths.push(c.section.slice(1).map(([x,z],j)=>Math.hypot(x-c.section[j][0],(z-c.section[j][1])*r/H)));
 }
 let missingEnergy=0,hiddenCompressionCells=0,minEndpointResultant=Infinity;
 for(let i=0;i<N;i++)for(let j=0;j<c.section.length-1;j++){
  const k=(i+1)%N,[x,z]=c.section[j],[xx,zz]=c.section[j+1],l0=Math.hypot(xx-x,zz-z),R=L+(z+zz)/2,alpha=(z+zz)/(2*H),ea=lengths[i][j]/l0-1,eb=lengths[k][j]/l0-1;
  const mid=(node,axis)=>(1-alpha)*L*m.directions[2*node+axis]+alpha*points[2*node+axis];
  const eh=Math.hypot(mid(k,0)-mid(i,0),mid(k,1)-mid(i,1))/(2*R*Math.sin(Math.PI/N))-1,A=2*Math.PI/N*R*l0,Nma=c.meridionalRigidity*ea+c.couplingRigidity*eh,Nmb=c.meridionalRigidity*eb+c.couplingRigidity*eh,Nh=c.couplingRigidity*(ea+eb)/2+c.hoopRigidity*eh;
  const difference=A*c.meridionalRigidity*(ea-eb)**2/8;missingEnergy+=difference;minEndpointResultant=Math.min(minEndpointResultant,Nma,Nmb);
  if((Nma<0||Nmb<0)&&(Nma+Nmb)/2>=0&&Nh>=0)hiddenCompressionCells++;
  cells.push({station:i,segment:j,ea,eb,eh,Nma,Nmb,Nh,missingEnergy:difference});
 }
 return {radialDisplacement:radial,alternatingRadialAmplitude:radial.reduce((s,v,i)=>s+(i%2?-v:v),0)/N,missingEnergy,hiddenCompressionCells,minEndpointResultant,cells};
}
export function alternatingCurvature(configuration,discretization=MODEL,amplitude=1e-6){
 if(!Number.isFinite(amplitude)||amplitude<1e-8||amplitude>1e-4)throw RangeError('Unsupported directional difference amplitude');
 const m=createSweptCasing(configuration,discretization),direction=Float64Array.from(m.directions,(v,i)=>v*(Math.floor(i/2)%2?-1:1)),a=Float64Array.from(m.initial,(v,i)=>v+amplitude*direction[i]),b=Float64Array.from(m.initial,(v,i)=>v-amplitude*direction[i]);
 const plus=Float64Array.from(m.evaluate(a).forces),minus=m.evaluate(b).forces;let curvature=0;
 for(let i=0;i<direction.length;i++)curvature-=direction[i]*(plus[i]-minus[i])/(2*amplitude);
 return curvature/configuration.nodes;
}
