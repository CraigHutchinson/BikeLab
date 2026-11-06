// Offline deterministic coverage grid. These are illustrative, not product calibration.
import {circularMeridian} from './tyre-meridian-fixture.mjs';
import {solveMeridianEquilibrium,inspectEquilibriumTangent} from './tyre-equilibrium.mjs';
export function envelopeCases(){
 const geometries=[{name:'compact',rimRadius:.2,halfWidth:.01,height:.035},{name:'reference',rimRadius:.311,halfWidth:.015,height:.05},{name:'wide',rimRadius:.36,halfWidth:.025,height:.065}];
 const materials=[{name:'negative-coupling',meridionalRigidity:100000,hoopRigidity:60000,couplingRigidity:-15000},{name:'reference',meridionalRigidity:200000,hoopRigidity:100000,couplingRigidity:20000},{name:'hoop-dominant',meridionalRigidity:150000,hoopRigidity:240000,couplingRigidity:0}];
 const rows=[];
 for(const geometry of geometries)for(const material of materials)for(const segments of [16,32])for(const gaugePressure of [40000,160000,320000])for(const start of ['rest','asymmetric']){
  const {name:materialName,...rigidities}=material,restPoints=circularMeridian(geometry.height,segments,geometry);
  const configuration={rimRadius:geometry.rimRadius,restPoints,...rigidities,gaugePressure,provenance:'Illustrative geometry/material coverage grid; no measured tyre calibration'};
  const initial=restPoints.map(([x,z],i)=>start==='rest'?[x,z]:[x+.005*z,z*(1+.005*Math.sin(Math.PI*i/segments))]);
  rows.push({id:`${geometry.name}/${materialName}/${segments}/${gaugePressure}/${start}`,geometry:geometry.name,material:materialName,segments,start,configuration,initial});
 }
 return rows;
}
export function compareEnvelopeCase(c){
 const results={};for(const tangent of ['finite-difference','analytic-banded'])results[tangent]=solveMeridianEquilibrium(c.configuration,c.initial,{tangent});
 const a=results['analytic-banded'],d=results['finite-difference'];
 const coordinateDifference=a.converged&&d.converged?Math.max(...a.points.flatMap((p,i)=>p.map((v,k)=>Math.abs(v-d.points[i][k])))):null;
 const stability=a.converged?inspectEquilibriumTangent(c.configuration,a.points):null;
 const rejections=[];
 if(!a.converged||!d.converged)rejections.push('nonconverged');
 if(coordinateDifference!==null&&coordinateDifference>2e-9)rejections.push('coordinate-disagreement');
 if(a.state.compressiveSegments||d.state.compressiveSegments)rejections.push('compressive-resultants');
 if(stability?.classification!=='positive-with-refinement-margin')rejections.push('stability-indeterminate');
 return {...c,results,coordinateDifference,stability,accepted:rejections.length===0,rejections};
}
