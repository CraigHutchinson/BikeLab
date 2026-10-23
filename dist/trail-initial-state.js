// Fresh-run scalar state, not a continuation checkpoint. All derived native state
// and application ledgers are rebuilt by the receiving production run.
export const STATE_FORMAT = 'bikelab-trail-state-0.1';
export const STATE_MODEL = 'bikelab-trail-bike-articulated-0.2';
export const RUN_MOTION = Object.freeze({gravity:9.80665, duration:.1, dt:.00003125, sampleDt:.005});
export const NATIVE_BUILD = '5d5d89ddd0857a6518c628fa502d42f99d6dd67ca240182f1068cd30a45465ac:e05ac96db7f45bd46e76fed6e3469bf9204329e093344d742a18bca2cc0e230e';
const nativeBuild=NATIVE_BUILD;
const scalarLimit = type => type==='slide'?10:100;
function object(value, keys, label) {
 if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw Error(label+' must be an object.');
 for (const key of Reflect.ownKeys(value)) if (!keys.includes(key)) throw Error('Unknown '+label+' field: '+String(key));
}
export function validateInitialization(value) {
 object(value,['mode','state'],'initialization');
 if(value.mode==='launch') {if(Object.hasOwn(value,'state'))throw Error('Launch cannot contain a supplied state.');return Object.freeze({mode:'launch'});}
 if(value.mode!=='state')throw Error('Unsupported initialization mode.');
 const s=value.state;object(s,['format','identity','joints'],'state');
 if(s.format!==STATE_FORMAT || !/^[a-f0-9]{64}$/.test(s.identity))throw Error('Unsupported state format or identity.');
 if(!Array.isArray(s.joints)||!s.joints.length||s.joints.length>1024)throw Error('State needs a complete scalar joint list.');
 const names=new Set(),joints=s.joints.map(j=>{
  object(j,['name','type','position','velocity'],'state joint');
  if(typeof j.name!=='string'||!j.name.length||j.name.length>100||names.has(j.name))throw Error('Invalid or duplicate state joint name.');names.add(j.name);
  if(!['slide','hinge'].includes(j.type))throw Error('Only scalar slide and hinge states are supported.');
  // Engineering admission bounds in metres/radians and m/s/rad/s; no angle wrapping.
  const qmax=scalarLimit(j.type), vmax=scalarLimit(j.type);
  if(!Number.isFinite(j.position)||Math.abs(j.position)>qmax||!Number.isFinite(j.velocity)||Math.abs(j.velocity)>vmax)throw Error('State coordinate or rate outside supported SI range.');
  return Object.freeze({name:j.name,type:j.type,position:j.position,velocity:j.velocity});
 }).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
 return Object.freeze({mode:'state',state:Object.freeze({format:STATE_FORMAT,identity:s.identity,joints:Object.freeze(joints)})});
}
// New format only. Quantize numeric XML attributes to 12 significant decimal
// digits before native compilation. Tiny spring-reference cancellation is zero.
// This is part of the model definition, not a replay comparison tolerance.
export function canonicalModelXML(xml) {
 return xml.replace(/([a-z_]+)="([^"]*)"/g,(whole,key,value)=>{
  if(!/^[+\-0-9.eE ]+$/.test(value)||!value.trim())return whole;
  return key+'="'+value.trim().split(/\s+/).map(token=>{
   let n=Number(token);if(!Number.isFinite(n))throw Error('Nonfinite native model attribute.');
   if(key==='springref'&&Math.abs(n)<1e-12)n=0;
   return String(Number(n.toPrecision(12)));
  }).join(' ')+'"';
 });
}
export async function stateIdentity(xml,scenario) {
 // dt and command/recording schedule are run controls. Physical geometry,
 // constitutive laws, gravity, admission limits and native build are bound.
 const physical={model:STATE_MODEL,nativeBuild,forceMapping:'native-shock-jacobian-0.1',xml:xml.replace(/timestep="[^"]*"/,'timestep="run-control"'),bike:scenario.bike,wheel:scenario.wheel,articulated:scenario.articulated,assembly:scenario.assembly};
 const bytes=new TextEncoder().encode(JSON.stringify(physical));
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
}
export function scalarLayout(mj,model) {
 if(model.nq!==model.nv||model.njnt!==model.nv||model.na||model.nu||model.nmocap||model.nplugin)throw Error('Unsupported native model state.');
 const names=new Set();return Array.from({length:model.njnt},(_,id)=>{
  const type=model.jnt_type[id]===mj.mjtJoint.mjJNT_SLIDE.value?'slide':model.jnt_type[id]===mj.mjtJoint.mjJNT_HINGE.value?'hinge':null;
  const name=mj.mj_id2name(model,mj.mjtObj.mjOBJ_JOINT.value,id);
  if(!type||!name||names.has(name))throw Error('Unsupported native scalar topology.');names.add(name);
  return {name,type,q:model.jnt_qposadr[id],v:model.jnt_dofadr[id]};
 });
}
export function applyState(state,identity,layout,data) {
 if(state.identity!==identity)throw Error('Supplied state physical identity does not match this model or native build.');
 const map=new Map(state.joints.map(j=>[j.name,j]));
 if(map.size!==layout.length)throw Error('Supplied state must cover every native scalar joint.');
 // Resolve the entire map before the first native write.
 const entries=layout.map(j=>{const s=map.get(j.name);if(!s||s.type!==j.type)throw Error('Missing or mismatched native state joint: '+j.name);return s;});
 for(let i=0;i<layout.length;i++){data.qpos[layout[i].q]=entries[i].position;data.qvel[layout[i].v]=entries[i].velocity;}
 data.qacc_warmstart.fill(0);data.time=0;
}
export function captureState(identity,layout,data) {
 return validateInitialization({mode:'state',state:{format:STATE_FORMAT,identity,joints:layout.map(j=>({name:j.name,type:j.type,position:data.qpos[j.q],velocity:data.qvel[j.v]}))}}).state;
}
// Every accepted new-format state must remain exportable. These are numerical
// admission limits, not component strength or injury thresholds.
export function scalarStateIssue(layout,data) {
 const q=data.qpos,v=data.qvel;
 for(const j of layout){
  const limit=scalarLimit(j.type);
  if(!Number.isFinite(q[j.q])||!Number.isFinite(v[j.v]))return 'nonfinite-state';
  if(Math.abs(q[j.q])>limit)return 'state-'+j.name+'-position-limit';
  if(Math.abs(v[j.v])>limit)return 'state-'+j.name+'-velocity-limit';
 }
 return null;
}
