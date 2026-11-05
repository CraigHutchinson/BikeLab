// Offline constant-pressure membrane reference; no production force law changes.
// Renart & Roura-Grabulosa (2019), doi:10.1119/1.5086008, Eqs.7-16/20.
// See docs/TYRE_STATIC_REFERENCE.md for source inconsistencies and admission.
export const MODEL='bikelab-constant-pressure-membrane-reference-0.1';
export const BUDGETS=Object.freeze({geometry:2e-13,angle:1e-13,quadratureRelative:1e-7,forceAbsolute:1e-8,asymptoteRelative:2e-4});
export class StaticReferenceDomainError extends RangeError {
 constructor(code,message){super(message);this.name='StaticReferenceDomainError';this.code=code;}
}
const require=(ok,message)=>{if(!ok)throw TypeError(message);};
const number=(value,low,high,name)=>require(Number.isFinite(value)&&value>=low&&value<=high,name+' outside reference range');
const fields=(value,keys)=>{
 require(value&&Object.getPrototypeOf(value)===Object.prototype,'Expected plain configuration');
 require(Reflect.ownKeys(value).length===keys.length&&Reflect.ownKeys(value).every(k=>typeof k==='string'&&keys.includes(k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value')&&Object.getOwnPropertyDescriptor(value,k).enumerable),'Unknown, missing or accessor configuration field');
};
const shape=phi=>{const s=Math.sin(phi),c=Math.cos(phi),N=Math.PI+2*phi-2*c;return {s,c,N};};

export function createStaticReference(input){
 fields(input,['rimRadius','rimWidth','sectionRadius','gaugePressure','provenance']);
 number(input.rimRadius,.15,.45,'rimRadius');number(input.rimWidth,.005,.08,'rimWidth');number(input.sectionRadius,.005,.05,'sectionRadius');number(input.gaugePressure,10000,1e6,'gaugePressure');
 require(input.rimWidth<2*input.sectionRadius,'Rim width must be below the section diameter');
 fields(input.provenance,['kind','reference']);require(['illustrative','source-derived','measured'].includes(input.provenance.kind)&&typeof input.provenance.reference==='string'&&input.provenance.reference.trim().length>0&&input.provenance.reference.length<=2000,'Explicit provenance required');
 const config={...input,provenance:{...input.provenance}},L=config.rimRadius,w=config.rimWidth,r0=config.sectionRadius,P=config.gaugePressure;
 const phi0=Math.acos(w/(2*r0)),initial=shape(phi0),H0=r0*(1+initial.s),R=L+r0*initial.s,Re=L+H0,C=w+r0*(Math.PI+2*phi0),B=C-2*w;
 // Independent dimensions are L,w,r0. Never accept a conflicting extra R.
 const Hprime=B*(initial.c*initial.N-2*(1+initial.s)**2)/initial.N**2;
 const Wprime=4*B*(1+initial.s)*initial.c/initial.N**2+2*B*initial.s/initial.N;
 const widthSlope=-Wprime/Hprime,footprintCoefficient=4/3*P*widthSlope*Math.sqrt(2*Re);
 const geometry={rimRadius:L,rimWidth:w,sectionRadius:r0,phi0,majorRadius:R,outerRadius:Re,height:H0,contourLength:C,thinRatio:r0/R,maxDeflection:.5*H0,widthSlope,smallLoadFootprintCoefficient:footprintCoefficient,smallLoadStressCoefficient:L/Re*footprintCoefficient,stressToFootprintRatio:L/Re};
 function section(compression,angleTolerance=BUDGETS.angle){
  number(angleTolerance,2e-15,1e-8,'angleTolerance');
  if(!Number.isFinite(compression)||compression<0||compression>geometry.maxDeflection)throw new StaticReferenceDomainError('compression-domain','Require 0 <= compression <= half the unloaded section height');
  if(compression>0&&compression<=2*r0*angleTolerance)throw new StaticReferenceDomainError('compression-resolution','Positive compression is unresolved by the requested root accuracy');
  const target=H0-compression;
  let phi=phi0,iterations=0,bracket=0;
  if(compression>0){
   let lo=phi0,hi=Math.PI;
   // H(phi)=B*(1+sin(phi))/N is strictly decreasing on the admitted branch.
   if(B/(3*Math.PI+2)>target)throw new StaticReferenceDomainError('section-geometry','Root lies outside the simple sidewall branch');
   while(hi-lo>angleTolerance&&iterations<64){const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;const s=shape(mid);if(B*(1+s.s)/s.N>target)lo=mid;else hi=mid;iterations++;}
   bracket=hi-lo;phi=(lo+hi)/2;
   if(bracket>angleTolerance)throw new StaticReferenceDomainError('root-resolution','Section root did not converge');
  }
  const s=shape(phi),radius=compression===0?r0:B/s.N,height=radius*(1+s.s),width=compression===0?0:w-2*radius*s.c;
  const heightResidual=height-target,contourResidual=w+2*radius*(phi+Math.PI/2)+width-C;
  if(phi>Math.PI||width<0||height<=0||Math.abs(heightResidual)>Math.max(BUDGETS.geometry,2*r0*angleTolerance)||Math.abs(contourResidual)>BUDGETS.geometry)throw new StaticReferenceDomainError('section-geometry','Unsupported section geometry');
  // Right sidewall centre=(width/2,radius), angle[-pi/2,phi]. For phi<=pi
  // its minimum transverse coordinate is min(width/2,w/2), and z>=0.
  return {compression,phi,radius,height,footprintWidth:width,heightResidual,contourResidual,rootBracket:bracket,iterations};
 }
 function solve(deflection,options={}){
  require(options&&Object.getPrototypeOf(options)===Object.prototype&&Reflect.ownKeys(options).every(k=>typeof k==='string'&&['panels','angleTolerance','recordSections'].includes(k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(options,k),'value')&&Object.getOwnPropertyDescriptor(options,k).enumerable),'Unknown numerical option');
  const {panels=128,angleTolerance=BUDGETS.angle,recordSections=false}=options;
  require([16,32,64,128,256,512,1024,2048,4096].includes(panels),'Unsupported even quadrature panels');require(typeof recordSections==='boolean','recordSections must be boolean');
  const centre=section(deflection,angleTolerance),thetaC=2*Math.asin(Math.sqrt(deflection/(2*Re))),sections=[];
  if(deflection===0)return {deflection,thetaC,halfContactLength:0,stressLoad:0,footprintArea:0,footprintLoad:0,centre,panels,angleTolerance,rootIterations:0,maxHeightResidual:0,maxContourResidual:0,maxRootBracket:0,sections};
  let stressIntegral=0,areaIntegral=0,rootIterations=0,maxHeightResidual=0,maxContourResidual=0,maxRootBracket=0;
  for(let i=0;i<=panels;i++){
   const theta=thetaC*i/panels,cos=Math.cos(theta),local=i===panels?0:(deflection-Re*2*Math.sin(theta/2)**2)/cos;
   let s;try{s=i===0?centre:section(local,angleTolerance);}catch(error){
    if(error instanceof StaticReferenceDomainError){error.context={deflection,panels,index:i,theta,localCompression:local,angleTolerance};error.message+=' at footprint quadrature index '+i+'/'+panels;}throw error;
   }
   const weight=i===0||i===panels?1:i%2?4:2;
   const difference=i===panels?0:r0*initial.c-s.radius*Math.cos(s.phi);
   stressIntegral+=weight*difference*cos;areaIntegral+=weight*s.footprintWidth*cos;
   rootIterations+=s.iterations;maxHeightResidual=Math.max(maxHeightResidual,Math.abs(s.heightResidual));maxContourResidual=Math.max(maxContourResidual,Math.abs(s.contourResidual));maxRootBracket=Math.max(maxRootBracket,s.rootBracket);
   if(recordSections)sections.push({theta,longitudinal:Re*Math.sin(theta),...s});
  }
  stressIntegral*=thetaC/(3*panels);areaIntegral*=thetaC/(3*panels);
  const footprintArea=2*Re*areaIntegral,stressLoad=4*L*P*stressIntegral,footprintLoad=P*footprintArea;
  if(![stressLoad,footprintArea,footprintLoad].every(x=>Number.isFinite(x)&&x>=0))throw new StaticReferenceDomainError('nonfinite-result','Invalid load or footprint');
  return {deflection,thetaC,halfContactLength:Re*Math.sin(thetaC),stressLoad,footprintArea,footprintLoad,centre,panels,angleTolerance,rootIterations,maxHeightResidual,maxContourResidual,maxRootBracket,sections};
 }
 return Object.freeze({configuration:()=>({...config,provenance:{...config.provenance}}),geometry:()=>({...geometry}),section,solve});
}

// Preserve the printed Figure4 tuple; this is a consistency audit, not a fit.
export function publishedGeometryAudit(){
 const printed={rimRadius:.2825,rimWidth:.01904,sectionRadius:.0158,majorRadius:.2968,gaugePressure:600000};
 const derivedMajorRadius=printed.rimRadius+Math.sqrt(printed.sectionRadius**2-(printed.rimWidth/2)**2);
 return {source:'Renart and Roura-Grabulosa 2019, Figure4 caption',printed,derivedMajorRadius,majorRadiusResidual:printed.majorRadius-derivedMajorRadius,exactFigureReproductionAvailable:false,disposition:'Retain rim radius, rim width and section radius as a labelled reconstruction; derive major radius. No silent parameter repair or experimental calibration.'};
}
