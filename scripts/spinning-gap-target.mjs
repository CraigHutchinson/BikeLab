// Diagnostic-only target intervention. No stepping or production callback changes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {getRuntime,geometryLimits} from '../dist/moving-wheel.js';
import {checkFlatVertexContacts} from '../dist/flat-vertex-contact.js';
import {nativeWarnings} from '../dist/casing-rk4-observer.js';
import {spinningGapXML,inverseMass,BUDGETS,BUDGET_UNITS} from './spinning-gap.mjs';

export const MODEL='bikelab-prescribed-physical-gap-target-0.1';
const hash=x=>createHash('sha256').update(x).digest('hex');
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const rotate=(a,[x,z])=>[Math.cos(a)*x+Math.sin(a)*z,-Math.sin(a)*x+Math.cos(a)*z];
const difference=(a,b)=>{assert.equal(a.length,b.length);return Math.max(0,...a.map((x,i)=>Math.abs(x-b[i])));};
const physical=(J,qacc,c)=>J.map((pair,i)=>pair.map((row,k)=>dot(row,qacc)+c[i][k]));
const baselineURL=new URL('../docs/evidence/spinning-gap.json',import.meta.url);
const CHECKS=['velocity','force','torque','acceleration','angularAcceleration','jacobian','jacobianLength','regularizer','power'];
const snapshot=d=>Object.fromEntries(['qpos','qvel','act','qfrc_smooth','qacc_smooth','qfrc_bias','qfrc_passive','qfrc_applied','xfrc_applied','flexvert_xpos','efc_J','efc_R','efc_diagA','efc_pos','efc_vel','efc_margin','efc_type','efc_id'].map(k=>[k,Array.from(d[k])]).concat([['time',d.time],['nefc',d.nefc],['ncon',d.ncon]]));
function contactIdentity(d){
 const list=d.contact,rows=[];
 try{for(let k=0;k<list.size();k++){const c=list.get(k);try{const side=c.flex[0]===0?0:1;rows.push({node:c.vert[side],row:c.efc_address,exclude:c.exclude,gap:c.dist,margin:c.includemargin,normal:Array.from(c.frame.slice(0,3))});}finally{c.delete();}}}finally{list.delete();}
 return rows;
}

// Derive the intervention from current compiled kinematics, independently of
// the authored-state oracle below. A positive normal is world +z in this probe.
function corrections(m,d,hub,contacts){
 const omega=d.qvel[2],R=d.xmat,rx=R[9*hub+6],rz=R[9*hub+8],z=d.xpos[3*hub+2],out=new Array(d.nefc).fill(0);
 for(const c of contacts)if(c.row>=0){const u=3+2*c.node,v=u+1;out[c.row]=2*omega*(rx*d.qvel[v]-rz*d.qvel[u])-omega**2*(d.flexvert_xpos[3*c.node+2]-z);}
 return out;
}

export async function targetSweep(onProgress){
 assert.ok(onProgress===undefined||typeof onProgress==='function');
 const bytes=await readFile(baselineURL),baseline=JSON.parse(bytes),mj=await getRuntime();
 assert.equal(baseline.model,'bikelab-prescribed-spinning-gap-0.1');assert.equal(baseline.samples.length,36);assert.equal(mj.mj_versionString(),baseline.nativeVersion);
 for(const [p,h] of Object.entries(baseline.sourcesSha256))assert.equal(hash(await readFile(new URL('../'+p,import.meta.url))),h,'Baseline source changed: '+p);
 assert.equal(typeof mj.mj_fwdConstraint,'function','Required native constraint API unavailable');assert.equal(typeof mj.mj_referenceConstraint,'function','Required native reference API unavailable');
 const p=baseline.parameters.wheel,mass=baseline.parameters.nodeMass,J0=baseline.parameters.J0,nv=3+2*p.nodes,totalMass=p.hubMass+p.tyreMass;
 const inputs=baseline.samples.map(s=>({name:s.name,angle:s.angle,omega:s.omega,excluded:Boolean(s.input.excluded),q:[...s.q],v:[...s.v],hubPosition:[...s.hubPosition],hubVelocity:[...s.hubVelocity],nodeVelocity:[...s.nodeVelocity],worldOffsets:structuredClone(s.worldOffsets),origin:s.name}));
 // Nonzero contact power is a separate receiving control; preserve all original
 // 36 states and label these 12 additional velocity variants explicitly.
 for(const source of inputs.filter(s=>s.name==='loaded-shear'))for(const [name,vz] of [['loaded-closing',-.02],['loaded-opening',.02]]){
  const s=structuredClone(source);s.name=name;s.nodeVelocity[1]=vz;const delta=rotate(-s.angle,[0,vz]);
  for(let i=0;i<p.nodes;i++){s.v[3+2*i]+=delta[0];s.v[4+2*i]+=delta[1];}inputs.push(s);
 }
 const models=[],samples=[],maxima=Object.fromEntries(CHECKS.map(k=>[k,0]));
 let solves=0;
 for(const excluded of [false,true]){
  const xml=spinningGapXML(excluded);assert.equal(xml,baseline.models.find(m=>m.excluded===excluded).xml);models.push({excluded,xml,xmlSha256:hash(xml)});const m=mj.MjModel.from_xml_string(xml);let d,velocity,full;
  try{
   d=new mj.MjData(m);velocity=new mj.DoubleBuffer(6);full=new mj.DoubleBuffer(nv*nv);assert.equal(m.nv,nv);assert.equal(m.nq,nv);assert.equal(m.opt.integrator,mj.mjtIntegrator.mjINT_RK4.value);
   const capture=()=>{mj.mj_fullM(m,d,full);return {...snapshot(d),massMatrix:Array.from(full.GetView())};};
   const hub=mj.mj_name2id(m,mj.mjtObj.mjOBJ_BODY.value,'hub'),originalFlags=m.opt.disableflags,warmBit=mj.mjtDisableBit.mjDSBL_WARMSTART.value;
   for(const input of inputs.filter(s=>s.excluded===excluded)){
    const {q,v,angle,omega,worldOffsets}=input,b=worldOffsets.map(r=>rotate(-angle,r)),J=[],convective=[],bias=new Array(nv).fill(0);bias[1]=totalMass*p.gravity;
    for(let i=0;i<p.nodes;i++){
     const t=[b[i][1],-b[i][0]],rt=rotate(angle,t),u=3+2*i,rate=[v[u],v[u+1]],c=rotate(angle,[2*omega*rate[1]-omega**2*b[i][0],-2*omega*rate[0]-omega**2*b[i][1]]);convective.push(c);
     const ex=rotate(angle,[1,0]),ez=rotate(angle,[0,1]),x=new Array(nv).fill(0),z=new Array(nv).fill(0);x[0]=z[1]=1;x[2]=rt[0];z[2]=rt[1];x[u]=ex[0];x[u+1]=ez[0];z[u]=ex[1];z[u+1]=ez[1];J.push([x,z]);
     bias[0]+=mass*c[0];bias[1]+=mass*c[1];const local=rotate(-angle,[c[0],c[1]+p.gravity]).map(x=>mass*x);bias[u]=local[0];bias[u+1]=local[1];bias[2]+=dot(t,local);
    }
    const errors=Object.fromEntries(CHECKS.map(k=>[k,0])),check=(key,error)=>{assert.ok(CHECKS.includes(key)&&Number.isFinite(error),key);errors[key]=Math.max(errors[key],Math.abs(error));assert.ok(Math.abs(error)<=BUDGETS[key],input.name+' '+angle+' '+omega+' '+key+': '+error);};
    function initialize(){m.opt.disableflags=originalFlags;mj.mj_resetData(m,d);d.qpos.set(q);d.qvel.set(v);mj.mj_forward(m,d);checkFlatVertexContacts(mj,m,d,0,p.nodes);assert.deepEqual(nativeWarnings(d),[]);}
    initialize();const immutable=capture(),contacts=contactIdentity(d),nativeTargets=Array.from(d.efc_aref),c=corrections(m,d,hub,contacts),targets=nativeTargets.map((a,i)=>a-c[i]);
    assert.equal(contacts.filter(c=>c.row>=0).length,d.nefc);assert.equal(new Set(contacts.map(c=>c.node)).size,contacts.length);
    const limits=geometryLimits(p,{points:[[-2,0],[2,0]]},input.hubPosition,d.flexvert_xpos,null,{});assert.equal(limits.reason,null);
    for(let i=0;i<p.nodes;i++){assert.ok(Math.hypot(q[3+2*i],q[4+2*i])<=p.maxDisplacement);assert.ok(Math.abs(d.flexedge_length[i]/m.flexedge_length0[i]-1)<=p.maxStrain);}
    for(let i=0;i<p.nodes;i++){mj.mj_objectVelocity(m,d,mj.mjtObj.mjOBJ_BODY.value,m.flex_vertbodyid[i],velocity,0);check('velocity',difference([velocity.GetView()[3],velocity.GetView()[5]],input.nodeVelocity));}
    for(let j=0;j<nv;j++)check(j===2?'torque':'force',d.qfrc_bias[j]-bias[j]);
    for(const row of contacts)if(row.row>=0){check('acceleration',c[row.row]-convective[row.node][1]);for(let j=0;j<nv;j++)check(j===2?'jacobianLength':'jacobian',d.efc_J[row.row*nv+j]-J[row.node][1][j]);}
    const predictedForces=policy=>contacts.filter(c=>c.row>=0).map(c=>{const gap=input.hubPosition[1]+worldOffsets[c.node][1]-p.skin,aref=-2*input.nodeVelocity[1]/(p.contactImpedance*p.contactTime)-gap/(p.contactImpedance*p.contactTime**2),r=2/(3*mass)*(1-p.contactImpedance)/p.contactImpedance;return {node:c.node,row:c.row,aref,r,force:Math.max(0,(aref+p.gravity+(policy==='native'?convective[c.node][1]:0))/(1/mass+r))};});
    function inspect(policy){
     assert.deepEqual(capture(),immutable,'Intervention changed state, geometry, smooth dynamics or row coefficients');assert.deepEqual(contactIdentity(d),contacts,'Contact identity changed');assert.deepEqual(nativeWarnings(d),[]);assert.ok(Array.from(d.solver_niter).every(x=>x<m.opt.iterations));
     const expected=predictedForces(policy),force=new Array(p.nodes).fill(0),rows=[];let groundPower=0;
     for(const e of expected){const n=d.efc_force[e.row],cz=convective[e.node][1],gapAcceleration=dot(J[e.node][1],Array.from(d.qacc))+cz,physicalResidual=gapAcceleration+e.r*n-e.aref;
      check('force',n-e.force);check('regularizer',d.efc_R[e.row]-e.r);check('acceleration',d.efc_aref[e.row]-(policy==='native'?nativeTargets[e.row]:targets[e.row]));check('acceleration',d.efc_b[e.row]-(-p.gravity-cz-d.efc_aref[e.row]));check('acceleration',gapAcceleration-(-p.gravity+n/mass));assert.ok(Number.isFinite(n)&&n>=0);
      const slack=physicalResidual-(policy==='native'?cz:0);if(n>0)check('acceleration',slack);else assert.ok(slack>=-BUDGETS.acceleration,'Unilateral inequality');
      force[e.node]=n;groundPower+=n*input.nodeVelocity[1];rows.push({...e,nativeForce:n,coordinateTarget:d.efc_aref[e.row],convective:cz,physicalAcceleration:gapAcceleration,physicalResidual,slack});
     }
     if(input.name.startsWith('loaded-')){assert.equal(d.nefc,input.name==='loaded-deformed'?2:1);assert.equal(force.filter(x=>x>0).length,d.nefc);}
     else if(input.name==='unloading'){assert.equal(d.nefc,1);assert.ok(force.every(f=>f===0));}
     else{assert.equal(d.nefc,0);assert.equal(d.ncon,excluded?1:0);assert.ok(force.every(f=>f===0));}
     const generalized=new Array(nv).fill(0);for(let i=0;i<p.nodes;i++)for(let j=0;j<nv;j++)generalized[j]+=J[i][1][j]*force[i];
     const expectedAcc=inverseMass(generalized.map((f,j)=>f-bias[j]),b,mass,p.hubMass,J0,angle),qacc=Array.from(d.qacc),world=physical(J,qacc,convective);
     for(let j=0;j<nv;j++){check(j===2?'torque':'force',d.qfrc_constraint[j]-generalized[j]);check(j===2?'angularAcceleration':'acceleration',qacc[j]-expectedAcc[j]);}
     for(let i=0;i<p.nodes;i++){check('acceleration',world[i][0]);check('acceleration',world[i][1]+p.gravity-force[i]/mass);}
     check('power',dot(Array.from(d.qfrc_constraint),v)-groundPower);
     return {policy,rows,qacc,worldAcceleration:world,generalizedForce:Array.from(d.qfrc_constraint),contactPower:groundPower};
    }
    const native=inspect('native'),warmResults=[];let corrected;
    for(const warm of ['zero','baseline','corrected','unrelated','disabled']){
     initialize();assert.deepEqual(capture(),immutable);if(warm==='disabled')m.opt.disableflags=originalFlags|warmBit;
     const seed=warm==='baseline'?native.qacc:warm==='corrected'?corrected.qacc:warm==='unrelated'?Array.from({length:nv},(_,j)=>((j%5)-2)*.25):new Array(nv).fill(0);
     const order=warm==='corrected'?['native','physical','native','physical','physical']:['physical','physical','native','physical','native'],differences={force:0,torque:0,acceleration:0,angularAcceleration:0};
     for(const policy of order){
      d.qacc_warmstart.set(seed);d.efc_aref.set(policy==='native'?nativeTargets:targets);mj.mj_fwdConstraint(m,d);solves++;
      const result=inspect(policy);if(policy==='physical'&&!corrected)corrected=result;
      const reference=policy==='native'?native:corrected;
      for(let j=0;j<nv;j++){const key=j===2?'angularAcceleration':'acceleration',delta=result.qacc[j]-reference.qacc[j];check(key,delta);differences[key]=Math.max(differences[key],Math.abs(delta));}
      for(let j=0;j<nv;j++){const key=j===2?'torque':'force',delta=result.generalizedForce[j]-reference.generalizedForce[j];check(key,delta);differences[key]=Math.max(differences[key],Math.abs(delta));}
     }
     warmResults.push({warm,order,differences});
    }
    m.opt.disableflags=originalFlags;
    // Rebuilding references must reproduce the native target. This demonstrates
    // why a one-time intervention cannot silently modify native RK4 stages.
    mj.mj_referenceConstraint(m,d);assert.deepEqual(Array.from(d.efc_aref),nativeTargets);mj.mj_fwdConstraint(m,d);solves++;inspect('native');
    for(const [key,value] of Object.entries(errors))maxima[key]=Math.max(maxima[key],value);
    samples.push({input,contacts,nativeTargets,correctedTargets:targets,native,corrected,warmResults,limits,errors,referenceRebuildRestoresNative:true});onProgress?.(samples.length,48);
   }
  }finally{full?.delete();velocity?.delete();d?.delete();m.delete();}
 }
 assert.equal(samples.length,48);assert.equal(solves,48*26);
 // Independent acceptance of matched-state invariance, beyond each row equation.
 let matchedForce=0,matchedAcceleration=0;
 for(const sample of samples){const reference=samples.find(s=>s.input.name===sample.input.name&&s.input.angle===0&&s.input.omega===0);assert.deepEqual(sample.input.worldOffsets,reference.input.worldOffsets);assert.deepEqual(sample.input.nodeVelocity,reference.input.nodeVelocity);
  const byVertex=s=>s.corrected.rows.map(r=>[r.node,r.nativeForce]).sort((a,b)=>a[0]-b[0]),a=byVertex(sample),b=byVertex(reference);assert.deepEqual(a.map(r=>r[0]),b.map(r=>r[0]));
  const force=difference(a.map(r=>r[1]),b.map(r=>r[1])),acc=difference(sample.corrected.worldAcceleration.flat(),reference.corrected.worldAcceleration.flat());assert.ok(force<=BUDGETS.force);assert.ok(acc<=BUDGETS.acceleration);matchedForce=Math.max(matchedForce,force);matchedAcceleration=Math.max(matchedAcceleration,acc);
 }
 assert.ok(samples.filter(s=>s.input.name==='loaded-closing').every(s=>s.corrected.contactPower<-.1));assert.ok(samples.filter(s=>s.input.name==='loaded-opening').every(s=>s.corrected.contactPower>.1));
 return {model:MODEL,nativeVersion:mj.mj_versionString(),baseline:{model:baseline.model,reportSha256:hash(bytes),sourcesSha256:baseline.sourcesSha256},scope:'Prescribed-state native target intervention only; seed/order controls re-seed every solve and do not establish evolving warm-start ownership. No integration, production law, browser receiving or physical calibration.',parameters:baseline.parameters,budgets:Object.fromEntries(CHECKS.map(k=>[k,BUDGETS[k]])),budgetUnits:Object.fromEntries(CHECKS.map(k=>[k,BUDGET_UNITS[k]])),api:{mj_fwdConstraint:typeof mj.mj_fwdConstraint,mj_referenceConstraint:typeof mj.mj_referenceConstraint,callbackSetters:Object.keys(mj).filter(k=>/mjcb|setControl|setPassive/i.test(k))},models,samples,summary:{states:samples.length,constraintResolves:solves,matchedForce,matchedAcceleration,maxima}};
}

async function main(){
 assert.ok(process.argv.length<=3,'Usage: node scripts/spinning-gap-target.mjs [output-directory]');const dir=resolve(process.argv[2]??'artifacts/spinning-gap-target');await mkdir(dir,{recursive:true});
 const paths=['scripts/spinning-gap-target.mjs','scripts/spinning-gap.mjs','docs/evidence/spinning-gap.json','dist/moving-wheel.js','dist/flat-vertex-contact.js','dist/casing-rk4-observer.js','dist/vendor/mujoco-3.16.0/mujoco.js','dist/vendor/mujoco-3.16.0/mujoco.wasm'];
 const sourceHashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))]))),sourcesSha256=await sourceHashes(),report=await targetSweep((n,total)=>console.log('target control',n+'/'+total));assert.deepEqual(await sourceHashes(),sourcesSha256,'Sources changed');
 await writeFile(join(dir,'report.json'),JSON.stringify({...report,sourcesSha256},null,2)+'\n');console.log(JSON.stringify(report.summary,null,2));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
