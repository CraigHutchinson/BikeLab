// Prescribed world-state isolation only: no integration or production model change.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {getRuntime,validate,wheelParts,geometryLimits} from '../dist/moving-wheel.js';
import {flatVertexGround,checkFlatVertexContacts} from '../dist/flat-vertex-contact.js';
import {nativeWarnings} from '../dist/casing-rk4-observer.js';

export const MODEL='bikelab-prescribed-spinning-gap-0.1';
export const BUDGETS=Object.freeze({position:1e-12,velocity:1e-11,angularVelocity:1e-11,mass:2e-12,massLength:2e-12,inertia:2e-12,force:1e-8,torque:1e-8,acceleration:1e-7,angularAcceleration:1e-7,jacobian:1e-12,jacobianLength:1e-12,regularizer:1e-12,power:1e-9,finiteDifference:1e-5});
export const BUDGET_UNITS=Object.freeze({position:'m',velocity:'m/s',angularVelocity:'rad/s',mass:'kg',massLength:'kg m',inertia:'kg m²',force:'N',torque:'N m',acceleration:'m/s²',angularAcceleration:'rad/s²',jacobian:'dimensionless',jacobianLength:'m',regularizer:'1/kg',power:'W',finiteDifference:'m/s²'});
const WHEEL=validate({nodes:32,dt:.0000078125,gravity:9.80665,contactTime:.0005});
const PROFILE=Object.freeze({points:[[-2,0],[2,0]]});
const CONFIGS=Object.freeze([
 {name:'loaded-common',gap:-.0001,relativeX:0,vz:0},
 {name:'loaded-shear',gap:-.0001,relativeX:.2,vz:0},
 {name:'loaded-deformed',gap:-.0001,relativeX:.2,vz:0,deformed:true},
 {name:'unloading',gap:-.0001,relativeX:.2,vz:1},
 {name:'separated-closing',gap:.001,relativeX:.2,vz:-1},
 {name:'excluded-closing',gap:.00001,relativeX:.2,vz:-1,excluded:true},
].map(Object.freeze));
const hash=x=>createHash('sha256').update(x).digest('hex');
const rotate=(angle,[x,z])=>[Math.cos(angle)*x+Math.sin(angle)*z,-Math.sin(angle)*x+Math.cos(angle)*z];
const spin=([x,z])=>[z,-x];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const maxDifference=(a,b)=>{assert.equal(a.length,b.length);return Math.max(0,...a.map((x,i)=>Math.abs(x-b[i])));};
const add=(a,b)=>a.map((x,i)=>x+b[i]);

export function spinningGapXML(excluded=false){
 assert.equal(typeof excluded,'boolean');
 const parts=wheelParts(WHEEL,'casing'),nodes=parts.nodes.replaceAll(/stiffness="[^"]*"/g,'stiffness="0"');
 const flex=parts.flex.replace(/<edge [^>]*\/>/,'<edge stiffness="0" damping="0"/>');
 let ground=flatVertexGround(WHEEL,PROFILE).geoms;
 if(excluded)ground=ground.replace('<geom ','<geom gap=".0002" ');
 return `<mujoco model="${MODEL}"><compiler angle="radian" fusestatic="false"/><option timestep=".000001953125" gravity="0 0 -${WHEEL.gravity}" jacobian="dense" integrator="RK4" solver="Newton" iterations="100" tolerance="1e-20"><flag autoreset="disable"/></option><worldbody>${ground}<body name="hub" pos=".125 0 ${WHEEL.radius}"><joint name="hub_x" type="slide" axis="1 0 0"/><joint name="hub_z" type="slide" axis="0 0 1"/><joint name="hub_spin" type="hinge" axis="0 1 0"/><inertial pos="0 0 0" mass="${WHEEL.hubMass}" diaginertia="${WHEEL.hubInertia} ${WHEEL.hubInertia} ${WHEEL.hubInertia}"/>${nodes}</body></worldbody><deformable>${flex}</deformable></mujoco>`;
}

// Inverse of the coupled kinetic-energy matrix; the hub slides are world-aligned.
export function inverseMass(force,b,mass,hubMass,J0,angle){
 assert.equal(force.length,3+2*b.length);
 const sum=[0,0];let moment=0;
 for(let i=0;i<b.length;i++){const q=force.slice(3+2*i,5+2*i);sum[0]+=q[0];sum[1]+=q[1];moment+=dot(spin(b[i]),q);}
 const world=rotate(angle,sum),A=[(force[0]-world[0])/hubMass,(force[1]-world[1])/hubMass],alpha=(force[2]-moment)/J0,local=rotate(-angle,A),out=[...A,alpha];
 for(let i=0;i<b.length;i++){const t=spin(b[i]);out.push(force[3+2*i]/mass-local[0]-alpha*t[0],force[4+2*i]/mass-local[1]-alpha*t[1]);}
 return out;
}

export async function spinningGapSweep(onProgress){
 assert.ok(onProgress===undefined||typeof onProgress==='function');
 const mj=await getRuntime(),parts=wheelParts(WHEEL,'casing'),rest=[...parts.nodes.matchAll(/<body name="casing_n\d+" pos="([^ ]+) 0 ([^"]+)"/g)].map(m=>[Number(m[1]),Number(m[2])]);
 assert.equal(rest.length,WHEEL.nodes);
 const mass=parts.reference.nodeMass,J0=WHEEL.hubInertia+WHEEL.nodes*parts.reference.nodeInertia,totalMass=WHEEL.hubMass+WHEEL.tyreMass,nv=3+2*WHEEL.nodes,models=[],samples=[],maxima=Object.fromEntries(Object.keys(BUDGETS).map(k=>[k,0]));
 for(const excluded of [false,true]){
  const xml=spinningGapXML(excluded),m=mj.MjModel.from_xml_string(xml);let d,fd,full,velocity;
  try{
   d=new mj.MjData(m);fd=new mj.MjData(m);full=new mj.DoubleBuffer(nv*nv);velocity=new mj.DoubleBuffer(6);
   assert.equal(m.nq,nv);assert.equal(m.nv,nv);assert.equal(m.neq,0);assert.equal(m.nu,0);assert.equal(m.nflex,1);assert.equal(m.nflexedge,WHEEL.nodes);
   assert.ok(m.jnt_stiffness.every(x=>x===0)&&m.dof_damping.every(x=>x===0)&&m.flex_edgestiffness.every(x=>x===0)&&m.flex_edgedamping.every(x=>x===0));
   assert.equal(m.opt.enableflags & mj.mjtEnableBit.mjENBL_DIAGEXACT.value,0);
   const hub=mj.mj_name2id(m,mj.mjtObj.mjOBJ_BODY.value,'hub'),bodies=rest.map((_,i)=>mj.mj_name2id(m,mj.mjtObj.mjOBJ_BODY.value,'casing_n'+i));
   assert.equal(m.body_jntnum[hub],3);assert.equal(m.body_parentid[hub],0);
   for(let j=0;j<nv;j++){assert.equal(m.jnt_qposadr[j],j);assert.equal(m.jnt_dofadr[j],j);assert.equal(m.jnt_type[j],j===2?mj.mjtJoint.mjJNT_HINGE.value:mj.mjtJoint.mjJNT_SLIDE.value);}
   for(const id of bodies){assert.equal(m.body_parentid[id],hub);assert.equal(m.body_mass[id],mass);assert.equal(m.body_inertia[3*id+1],parts.reference.nodeInertia);assert.notEqual(m.body_simple[id],2);}
   models.push({excluded,xml,xmlSha256:hash(xml),bodySimple:Array.from(m.body_simple),bodyInverseWeight:Array.from(m.body_invweight0)});
   for(const config of CONFIGS.filter(c=>Boolean(c.excluded)===excluded))for(const angle of [0,.1])for(const omega of [-10,0,10]){
    mj.mj_resetData(m,d);const worldOffsets=rest.map(p=>[...p]);
    if(config.deformed){worldOffsets[0][0]+=.003;worldOffsets[1][1]-=.0068;}
    const b=worldOffsets.map(p=>rotate(-angle,p)),t=b.map(spin),nodeVelocity=[.11+config.relativeX,config.vz],hubVelocity=[.11,0],relativeWorld=[config.relativeX,config.vz],w=rotate(-angle,relativeWorld);
    d.qpos[1]=config.gap;d.qpos[2]=angle;d.qvel[0]=hubVelocity[0];d.qvel[2]=omega;
    const convective=[];
    for(let i=0;i<rest.length;i++){
     d.qpos[3+2*i]=b[i][0]-rest[i][0];d.qpos[4+2*i]=b[i][1]-rest[i][1];
     const rate=[w[0]-omega*t[i][0],w[1]-omega*t[i][1]];d.qvel.set(rate,3+2*i);
     const sr=spin(rate);convective.push(rotate(angle,[2*omega*sr[0]-omega**2*b[i][0],2*omega*sr[1]-omega**2*b[i][1]]));
     assert.ok(Math.hypot(d.qpos[3+2*i],d.qpos[4+2*i])<=WHEEL.maxDisplacement);
    }
    mj.mj_forward(m,d);assert.deepEqual(nativeWarnings(d),[]);assert.ok(Array.from(d.solver_niter).every(n=>n<100));
    const hubPosition=[.125,WHEEL.radius+config.gap],limits=geometryLimits(WHEEL,PROFILE,hubPosition,d.flexvert_xpos,null,{});assert.equal(limits.reason,null);
    for(let e=0;e<m.nflexedge;e++)assert.ok(Math.abs(d.flexedge_length[e]/m.flexedge_length0[e]-1)<=WHEEL.maxStrain);
    checkFlatVertexContacts(mj,m,d,0,WHEEL.nodes);
    const errors=Object.fromEntries(Object.keys(BUDGETS).map(k=>[k,0])),check=(key,error)=>{assert.ok(Number.isFinite(error),key);errors[key]=Math.max(errors[key],Math.abs(error));};
    const J=rest.map((_,i)=>{const x=new Array(nv).fill(0),z=new Array(nv).fill(0),rt=rotate(angle,t[i]),ex=rotate(angle,[1,0]),ez=rotate(angle,[0,1]);x[0]=z[1]=1;x[2]=rt[0];z[2]=rt[1];x[3+2*i]=ex[0];x[4+2*i]=ez[0];z[3+2*i]=ex[1];z[4+2*i]=ez[1];return [x,z];});
    const M=Array.from({length:nv},()=>new Array(nv).fill(0));M[0][0]=M[1][1]=WHEEL.hubMass;M[2][2]=J0;
    for(const pair of J)for(let r=0;r<nv;r++)for(let c=0;c<nv;c++)M[r][c]+=mass*(pair[0][r]*pair[0][c]+pair[1][r]*pair[1][c]);
    mj.mj_fullM(m,d,full);const nativeM=full.GetView();
    for(let r=0;r<nv;r++)for(let c=0;c<nv;c++)check(r===2&&c===2?'inertia':r===2||c===2?'massLength':'mass',M[r][c]-nativeM[r*nv+c]);
    const arbitrary=Array.from({length:nv},(_,i)=>((i%7)-3)/7),inverse=inverseMass(arbitrary,b,mass,WHEEL.hubMass,J0,angle);
    for(let r=0;r<nv;r++)check(r===2?'torque':'force',dot(M[r],inverse)-arbitrary[r]);
    const bias=new Array(nv).fill(0);bias[1]=totalMass*WHEEL.gravity;
    for(let i=0;i<rest.length;i++){
     bias[0]+=mass*convective[i][0];bias[1]+=mass*convective[i][1];const local=rotate(-angle,[convective[i][0],convective[i][1]+WHEEL.gravity]).map(x=>mass*x);bias[3+2*i]=local[0];bias[4+2*i]=local[1];bias[2]+=dot(t[i],local);
     check('regularizer',m.body_invweight0[2*bodies[i]]-2/(3*mass));
     check('position',maxDifference([d.flexvert_xpos[3*i],d.flexvert_xpos[3*i+2]],add(hubPosition,worldOffsets[i])));
     mj.mj_objectVelocity(m,d,mj.mjtObj.mjOBJ_BODY.value,bodies[i],velocity,0);check('velocity',maxDifference([velocity.GetView()[3],velocity.GetView()[5]],nodeVelocity));check('angularVelocity',velocity.GetView()[1]-omega);
    }
    for(let j=0;j<nv;j++){check(j===2?'torque':'force',bias[j]-d.qfrc_bias[j]);assert.equal(d.qfrc_passive[j],0);assert.equal(d.qfrc_applied[j],0);}
    const smooth=inverseMass(bias.map(x=>-x),b,mass,WHEEL.hubMass,J0,angle),force=new Array(rest.length).fill(0),rows=[],contacts=d.contact;
    try{for(let k=0;k<contacts.size();k++){const c=contacts.get(k);try{
     const side=c.flex[0]===0?0:1,node=c.vert[side],row=c.efc_address;
     if(row<0){assert.notEqual(c.exclude,0);rows.push({node,row,exclude:c.exclude,gap:c.dist,force:0});continue;}
     assert.equal(c.exclude,0);assert.equal(d.efc_type[row],mj.mjtConstraint.mjCNSTR_CONTACT_FRICTIONLESS.value);
     const jac=Array.from(d.efc_J.slice(row*nv,(row+1)*nv)),gap=hubPosition[1]+worldOffsets[node][1]-WHEEL.skin,aref=-2*nodeVelocity[1]/(WHEEL.contactImpedance*WHEEL.contactTime)-gap/(WHEEL.contactImpedance*WHEEL.contactTime**2),regularizer=2/(3*mass)*(1-WHEEL.contactImpedance)/WHEEL.contactImpedance,corr=convective[node][1],predicted=Math.max(0,(aref+WHEEL.gravity+corr)/(1/mass+regularizer)),nativeForce=d.efc_force[row],physical=dot(J[node][1],Array.from(d.qacc))+corr;
     for(let j=0;j<nv;j++)check(j===2?'jacobianLength':'jacobian',jac[j]-J[node][1][j]);check('position',d.efc_pos[row]-gap);check('velocity',d.efc_vel[row]-nodeVelocity[1]);check('regularizer',d.efc_diagA[row]-2/(3*mass));check('regularizer',d.efc_R[row]-regularizer);check('acceleration',d.efc_aref[row]-aref);check('acceleration',d.efc_b[row]-(-WHEEL.gravity-corr-aref));check('force',nativeForce-predicted);
     check('acceleration',dot(J[node][1],Array.from(d.qacc_smooth))+WHEEL.gravity+corr);check('acceleration',physical-(-WHEEL.gravity+nativeForce/mass));
     const lawResidual=physical+regularizer*nativeForce-aref,complementarity=dot(jac,Array.from(d.qacc))+regularizer*nativeForce-aref;
     if(nativeForce>0){check('acceleration',lawResidual-corr);check('acceleration',complementarity);}else assert.ok(complementarity>=-BUDGETS.acceleration);
     force[node]=nativeForce;rows.push({node,row,exclude:0,gap,jacobian:jac,velocity:d.efc_vel[row],aref,regularizer,nativeAref:d.efc_aref[row],nativeRegularizer:d.efc_R[row],diagonalApproximation:d.efc_diagA[row],nativeB:d.efc_b[row],nativeForce,predictedForce:predicted,convective:corr,coordinateAcceleration:dot(jac,Array.from(d.qacc)),physicalAcceleration:physical,physicalLawResidual:lawResidual,complementarity});
    }finally{c.delete();}}}finally{contacts.delete();}
    assert.equal(rows.filter(r=>r.row>=0).length,d.nefc);
    assert.equal(new Set(rows.map(r=>r.node)).size,rows.length,'Duplicate contact vertex');
    if(config.name.startsWith('loaded-')){assert.equal(d.nefc,config.deformed?2:1);assert.ok(force.filter(f=>f>0).length===d.nefc);}
    else if(config.name==='unloading'){assert.equal(d.nefc,1);assert.ok(force.every(f=>f===0));}
    else {assert.equal(d.nefc,0);assert.equal(d.ncon,excluded?1:0);assert.ok(force.every(f=>f===0));}
    const generalized=new Array(nv).fill(0);for(let i=0;i<rest.length;i++)for(let j=0;j<nv;j++)generalized[j]+=J[i][1][j]*force[i];
    const acceleration=inverseMass(generalized.map((f,i)=>f-bias[i]),b,mass,WHEEL.hubMass,J0,angle);
    for(let j=0;j<nv;j++){check(j===2?'torque':'force',generalized[j]-d.qfrc_constraint[j]);check(j===2?'angularAcceleration':'acceleration',smooth[j]-d.qacc_smooth[j]);check(j===2?'angularAcceleration':'acceleration',acceleration[j]-d.qacc[j]);}
    for(let i=0;i<rest.length;i++){
     check('acceleration',dot(J[i][0],Array.from(d.qacc))+convective[i][0]);
     check('acceleration',dot(J[i][1],Array.from(d.qacc))+convective[i][1]+WHEEL.gravity-force[i]/mass);
     // A point force has diagonal exact mobility despite the coupled coordinates.
     const response=inverseMass(J[i][1],b,mass,WHEEL.hubMass,J0,angle);
     for(let j=0;j<rest.length;j++)check('regularizer',dot(J[j][1],response)-(i===j?1/mass:0));
    }
    const nodePower=force.reduce((s,f)=>s+f*nodeVelocity[1],0);check('power',dot(generalized,Array.from(d.qvel))-nodePower);
    // Central difference of native body-center velocity along q(t)=q+tv+a*t²/2.
    // This is prescribed kinematics, not a time integration or solver refinement.
    const q=Array.from(d.qpos),v=Array.from(d.qvel),acc=Array.from(d.qacc),finiteDifference=[],fdNodes=[...new Set([0,...rows.filter(r=>r.row>=0).map(r=>r.node)])];
    for(const h of [1e-5,5e-6]){
     const observed=[];
     for(const sign of [-1,1]){mj.mj_resetData(m,fd);for(let j=0;j<nv;j++){fd.qpos[j]=q[j]+sign*h*v[j]+.5*h*h*acc[j];fd.qvel[j]=v[j]+sign*h*acc[j];}mj.mj_forward(m,fd);assert.deepEqual(nativeWarnings(fd),[]);observed.push(fdNodes.map(node=>{mj.mj_objectVelocity(m,fd,mj.mjtObj.mjOBJ_BODY.value,bodies[node],velocity,0);return velocity.GetView()[5];}));}
     for(const [index,node] of fdNodes.entries()){const value=(observed[1][index]-observed[0][index])/(2*h),expected=dot(J[node][1],acc)+convective[node][1];check('finiteDifference',value-expected);finiteDifference.push({node,h,value,expected,error:value-expected});}
    }
    for(const [key,value] of Object.entries(errors)){assert.ok(value<=BUDGETS[key],config.name+' '+angle+' '+omega+' '+key+': '+value);maxima[key]=Math.max(maxima[key],value);}
    samples.push({name:config.name,angle,omega,input:config,hubPosition,hubVelocity,nodeVelocity,worldOffsets,q,v,bias,nativeBias:Array.from(d.qfrc_bias),coordinateAcceleration:acc,smoothCoordinateAcceleration:Array.from(d.qacc_smooth),worldConvective:convective,rows,nativeContacts:d.ncon,nativeRows:d.nefc,limits,errors,finiteDifference});onProgress?.(samples.length,36);
   }
  }finally{velocity?.delete();full?.delete();fd?.delete();d?.delete();m.delete();}
 }
 assert.equal(samples.length,36);
 return {model:MODEL,nativeVersion:mj.mj_versionString(),scope:'Zero-material prescribed-state isolation; no integration, production correction, stability, spin trajectory, material calibration or performance qualification.',parameters:{wheel:WHEEL,materialOverride:{foundation:0,extension:0,edgeViscosity:0},hubOrientationBasis:'world-aligned hub slides before the hinge',J0,nodeMass:mass},budgets:BUDGETS,budgetUnits:BUDGET_UNITS,models,samples,maxima};
}

async function main(){
 assert.ok(process.argv.length<=3,'Usage: node scripts/spinning-gap.mjs [output-directory]');const dir=resolve(process.argv[2]??'artifacts/spinning-gap');await mkdir(dir,{recursive:true});
 const sources=['scripts/spinning-gap.mjs','dist/moving-wheel.js','dist/flat-vertex-contact.js','dist/casing-rk4-observer.js','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm'];
 const sourceHashes=async()=>Object.fromEntries(await Promise.all(sources.map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))]))),sourcesSha256=await sourceHashes();
 const report=await spinningGapSweep((n,total)=>console.log('prescribed state',n+'/'+total));assert.deepEqual(await sourceHashes(),sourcesSha256,'Sources changed during probe');
 await writeFile(join(dir,'report.json'),JSON.stringify({...report,sourcesSha256},null,2)+'\n');console.log(JSON.stringify({model:MODEL,cases:report.samples.length,maxima:report.maxima},null,2));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
