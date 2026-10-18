// Geometry and declared service limits, not a blowout/fracture constitutive law.
import {validateProfile,probe} from './terrain.js';
import {validate as validateFootprint,footprintFixture,solveFootprint} from './footprint.js';
export const MODEL='bikelab-wheel-limits-0.1';
export const SOURCE=Object.freeze({title:'Schwalbe hookless guidance, pp. 1–2',url:'https://www.schwalbe.com/media/1f/82/33/1706602649/Hookless_Info_EN.pdf',accessed:'2026-10-18',scope:'Schwalbe TLE/TLR (2020 onward), ISO/ETRTO compliant tubeless hookless rims; service recommendations, not burst pressures.'});
export const PRESSURE_BANDS=Object.freeze([[18,24,550000],[25,29,500000],[30,34,450000],[35,39,400000],[40,44,350000],[45,54,300000],[55,64,250000],[65,74,200000],[75,84,150000]].map(Object.freeze));
export const ASSEMBLY_DEFAULTS=Object.freeze({tyreId:'',rimId:'',brand:'unknown',rimType:'unknown',construction:'unknown',tyreBsd:null,rimBsd:null,tyreWidth:null,rimInnerWidth:null,tyreTubelessApproved:null,rimTubelessApproved:null,standardCompliant:null,widthPairApproved:null,pairApproved:null,pressure:null,tyreMaxPressure:null,rimMaxPressure:null});
const NUMBERS=['tyreBsd','rimBsd','tyreWidth','rimInnerWidth','pressure','tyreMaxPressure','rimMaxPressure'];
const FLAGS=['tyreTubelessApproved','rimTubelessApproved','standardCompliant','widthPairApproved','pairApproved'];
function object(value,allowed,label){if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error(label+' must be an object.');for(const k of Object.keys(value))if(!allowed.includes(k))throw Error('Unknown '+label+' field: '+k);}
export function validateAssembly(input={}){
 object(input,[...Object.keys(ASSEMBLY_DEFAULTS),'sources'],'assembly');const a={...ASSEMBLY_DEFAULTS,...input,sources:structuredClone(input.sources??{})};
 for(const k of ['tyreId','rimId'])if(typeof a[k]!=='string'||a[k].length>160)throw Error(k+' must be text up to 160 characters.');
 for(const [k,choices] of [['brand',['unknown','schwalbe','other']],['rimType',['unknown','hooked','hookless']],['construction',['unknown','tle-tlr-2020-plus','other']]])if(!choices.includes(a[k]))throw Error('Unknown '+k+'.');
 for(const k of FLAGS)if(a[k]!==null&&typeof a[k]!=='boolean')throw Error(k+' must be true, false or null.');
 for(const k of NUMBERS)if(a[k]!==null){const lo=k==='pressure'?0:k.includes('Pressure')?1:.001,hi=k.includes('ressure')?2000000:k.includes('Bsd')?1:.2;if(!Number.isFinite(a[k])||a[k]<lo||a[k]>hi)throw Error(k+' outside supported SI range.');}
 if(a.tyreWidth!==null&&Math.abs(a.tyreWidth*1000-Math.round(a.tyreWidth*1000))>1e-8)throw Error('Tyre width must be the nominal whole-millimetre size, expressed in metres.');
 object(a.sources,Object.keys(ASSEMBLY_DEFAULTS),'sources');
 for(const [key,s] of Object.entries(a.sources)){object(s,['kind','reference'],'source');if(!['declared','illustrative','manufacturer','measured'].includes(s.kind)||typeof s.reference!=='string'||!s.reference.trim()||s.reference.length>1000)throw Error('Invalid source for '+key);}
 return a;
}
export function assessAssembly(input={},rimRadius){
 if(rimRadius!==undefined&&(!Number.isFinite(rimRadius)||rimRadius<.01))throw Error('Invalid outer rim radius.');
 const a=validateAssembly(input),issues=[],unknown=[],bounds=[];
 const issue=(code,detail)=>issues.push({code,detail}),missing=(code,detail)=>unknown.push({code,detail});
 for(const k of ['tyreId','rimId'])if(!a[k].trim())missing(k,'Exact component identity is missing.');
 for(const k of NUMBERS)if(a[k]===null)missing(k,'Required assembly/pressure evidence is missing.');
 if(a.rimType==='unknown')missing('rimType','Hooked/hookless construction is unknown.');
 if(a.tyreBsd!==null&&a.rimBsd!==null&&Math.abs(a.tyreBsd-a.rimBsd)>1e-9)issue('bead-seat-mismatch','Tyre and rim bead-seat diameters differ.');
 if(rimRadius!==undefined&&a.rimBsd!==null&&rimRadius<a.rimBsd/2)issue('rim-envelope-mismatch','The drawn outer rim radius is smaller than its declared bead-seat radius.');
 for(const k of FLAGS){if(a[k]===false)issue(k,'Declared assembly requirement is not satisfied.');else if(a[k]===null)missing(k,'Assembly approval is unverified.');}
 for(const k of ['tyreMaxPressure','rimMaxPressure'])if(a[k]!==null)bounds.push({owner:k,maximumPa:a[k],source:a.sources[k]??{kind:'declared',reference:'User-supplied value; not independently verified.'}});
 if(a.rimType==='hookless'&&a.brand==='schwalbe'){
  if(a.construction==='other')issue('hookless-tyre-construction','This Schwalbe construction is not declared TLE/TLR 2020 onward.');
  if(a.construction==='unknown')missing('construction','Schwalbe hookless construction/version is unverified.');
  if(a.tyreWidth!==null){const mm=Math.round(a.tyreWidth*1000),band=PRESSURE_BANDS.find(([lo,hi])=>mm>=lo&&mm<=hi);if(band)bounds.push({owner:'schwalbe-hookless-width-guidance',maximumPa:band[2],source:SOURCE});else missing('width-guidance','Nominal width is outside the sourced pressure table; no extrapolation.');}
 }
 if(a.pressure===0)issue('deflated-regime','Zero gauge pressure requires a supported deflated tyre model; continuation is unsupported.');
 const knownMaximumPa=bounds.length?Math.min(...bounds.map(b=>b.maximumPa)):null;
 if(a.pressure!==null&&knownMaximumPa!==null&&a.pressure>knownMaximumPa)issue('pressure-exceeded','Inflation exceeds the lowest known applicable service maximum. Blowout behaviour is unsupported.');
 const fieldSources={};for(const k of Object.keys(ASSEMBLY_DEFAULTS))fieldSources[k]=a.sources[k]??{kind:'declared',reference:a[k]===null||a[k]===''||a[k]==='unknown'?'Unknown; no evidence supplied.':'User declaration; not independently verified.'};
 return {status:issues.length?'incompatible':unknown.length?'unknown':'within-declared-limits',issues,unknown,bounds,knownMaximumPa,fieldSources,scope:'Tubeless assembly/service assessment only; no survival certification.',failureCriteria:{burstPressurePa:null,beadReleaseForceN:null,casingCutCriterion:null,rimYieldCriterion:null,rimFractureCriterion:null,spokeFractureCriterion:null,spokeFatigueCriterion:null,leakAreaLaw:null}};
}
function vec(v,label){if(!Array.isArray(v)||v.length!==2||!v.every(x=>Number.isFinite(x)&&Math.abs(x)<=1000))throw Error(label+' requires finite [x,z] metres within ±1000 m.');}
const TOL=1e-10;
// Roots of |start + t*delta - vertex|² = radius². q avoids cancellation.
function vertexRoots(x,z,dx,dz,r){const A=dx*dx+dz*dz;if(A===0)return [];const B=2*(x*dx+z*dz),C=x*x+z*z-r*r,D=B*B-4*A*C,scale=B*B+Math.abs(4*A*C);if(D< -32*Number.EPSILON*scale)return [];const root=Math.sqrt(Math.max(0,D)),q=-.5*(B+(B>=0?root:-root));return q===0?[-B/(2*A)]:[q/A,C/q];}
export function sweepRim(profile,start,delta,rimRadius,tyreRadius){
 validateProfile(profile);vec(start,'Start');vec(delta,'Displacement');if(Math.hypot(...delta)>2)throw Error('Approach displacement must not exceed 2 m.');
 if(!Number.isFinite(rimRadius)||!Number.isFinite(tyreRadius)||rimRadius<.01||tyreRadius>2||tyreRadius<rimRadius)throw Error('Invalid rim/tyre radii.');
 const points=profile.points,min=points[0][0]+tyreRadius,max=points.at(-1)[0]-tyreRadius,[cx,cz]=start,[dx,dz]=delta,initial=probe(profile,{center:start,radius:rimRadius});
 const at=t=>[cx+t*dx,cz+t*dz],result=(status,fraction,events)=>({status,fraction,center:at(fraction),distance:Math.hypot(dx,dz)*fraction,events,tolerances:{fraction:1e-10,initialGapM:1e-10,discriminantRelative:32*Number.EPSILON},initialClearance:initial.status==='available'?initial.gap:null,clearance:probe(profile,{center:at(fraction),radius:rimRadius})});
 if(cx<min||cx>max||initial.status!=='available')return result('invalid-start',0,['initial-domain-or-burial']);
 let boundary=Infinity,hit=Infinity;
 if(dx>0&&cx+dx>=max)boundary=(max-cx)/dx;if(dx<0&&cx+dx<=min)boundary=(min-cx)/dx;
 if(initial.gap<=TOL)return result(initial.gap< -TOL?'initial-rim-overlap':'rim-contact',0,boundary===0?['rim-contact','authored-domain-boundary']:['rim-contact']);
 function candidate(t){if(t>=-TOL&&t<=1+TOL)hit=Math.min(hit,Math.max(0,Math.min(1,t)));}
 for(const [x,z] of points)for(const t of vertexRoots(cx-x,cz-z,dx,dz,rimRadius))candidate(t);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],sx=b[0]-a[0],sz=b[1]-a[1],length=Math.hypot(sx,sz),nx=-sz/length,nz=sx/length,d0=(cx-a[0])*nx+(cz-a[1])*nz,dv=dx*nx+dz*nz;
  if(dv===0)continue;
  for(const sign of [-1,1]){const t=(sign*rimRadius-d0)/dv;if(t< -TOL||t>1+TOL)continue;const projection=((cx+t*dx-a[0])*sx+(cz+t*dz-a[1])*sz)/(length*length);if(projection>=0&&projection<=1)candidate(t);}
 }
 const fraction=Math.min(1,hit,boundary),events=[];if(Number.isFinite(hit)&&Math.abs(hit-fraction)<=TOL)events.push('rim-contact');if(Number.isFinite(boundary)&&Math.abs(boundary-fraction)<=TOL)events.push('authored-domain-boundary');
 return result(events.includes('rim-contact')?'rim-contact':events.length?'domain-boundary':'clear',fraction,events);
}
export function experiment(input={}){
 object(input,['params','profile','assembly','delta'],'experiment');const params=validateFootprint(input.params??{}),profile=structuredClone(validateProfile(input.profile??footprintFixture(params.fixture,params.terrainSegments))),assembly=validateAssembly(input.assembly??{}),delta=structuredClone(input.delta??[0,-.12]);vec(delta,'Displacement');if(Math.hypot(...delta)>2)throw Error('Approach displacement must not exceed 2 m.');
 const assessment=assessAssembly(assembly,params.rimRadius),base={model:MODEL,params,profile,assembly,delta,assessment};
 if(assessment.status==='incompatible')return {...base,status:'assembly-rejected',reason:'Declared assembly or pressure limit exceeded; no approach or static load prediction is admitted.'};
 const sweep=sweepRim(profile,[params.centerX,params.height],delta,params.rimRadius,params.radius),staticAtStart=solveFootprint(params,profile);
 return {...base,status:sweep.status,sweep,staticAtStart,scope:assessment.status==='unknown'?'Geometry inspection only; assembly evidence is incomplete.':'Within declared service limits only; impact/damage physics remains unsupported.'};
}
export function inputFromRecord(record){if(record?.model!==MODEL||!record.params||!record.assembly||!record.profile||!record.delta)throw Error('Incomplete or unsupported wheel-limit record.');for(const k of Object.keys(ASSEMBLY_DEFAULTS))if(!Object.hasOwn(record.assembly,k))throw Error('Incomplete saved assembly: '+k);for(const k of Object.keys(validateFootprint()))if(!Object.hasOwn(record.params,k))throw Error('Incomplete saved geometry: '+k);return {params:validateFootprint(record.params),profile:structuredClone(validateProfile(record.profile)),assembly:validateAssembly(record.assembly),delta:structuredClone(record.delta)};}
export function replay(record){return experiment(inputFromRecord(record));}
export function example(name='flat'){
 const params=validateFootprint(name==='edge'?{fixture:'step',centerX:-.4,height:.36}:name==='rounded'?{fixture:'rounded',centerX:-.4,height:.36}:{});
 if(!['flat','edge','rounded','domain','separated'].includes(name))throw Error('Unknown approach example.');
 return {params,profile:footprintFixture(params.fixture,params.terrainSegments),assembly:validateAssembly(),delta:name==='edge'||name==='rounded'?[.7,0]:name==='domain'?[1,0]:name==='separated'?[0,.1]:[0,-.12]};
}
export function illustrativeAssembly(){const a={...ASSEMBLY_DEFAULTS,tyreId:'Illustrative 60-584 TLE/TLR tyre — not a product',rimId:'Illustrative 584 × 30 hookless rim — not a product',brand:'schwalbe',rimType:'hookless',construction:'tle-tlr-2020-plus',tyreBsd:.584,rimBsd:.584,tyreWidth:.060,rimInnerWidth:.030,pressure:180000,tyreMaxPressure:350000,rimMaxPressure:300000,sources:{}};for(const k of FLAGS)a[k]=true;for(const k of Object.keys(ASSEMBLY_DEFAULTS))a.sources[k]={kind:'illustrative',reference:'Synthetic assembly declaration for limit-check demonstrations; not a production preset.'};return a;}
