// Finite frictionless pelvis sphere against a frame-mounted pad. Explicit pair
// bypasses parent filtering without enabling collisions with tyres or terrain.
export const SADDLE_DEFAULTS=Object.freeze({padCenter:Object.freeze([-.15,.14]),halfSize:Object.freeze([.12,.08,.02]),pelvisRadius:.08,contactTime:.01,impedance:.95,maxPenetration:.01});
export function validateSaddle(input) {
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))throw Error('Saddle must be an object.');
 for(const k of Reflect.ownKeys(input))if(!Object.hasOwn(SADDLE_DEFAULTS,k))throw Error('Unknown saddle field: '+String(k));
 const p={...SADDLE_DEFAULTS,...input};
 for(const [key,n,lo,hi] of [['padCenter',2,-.5,.5],['halfSize',3,.005,.3]]){if(!Array.isArray(p[key])||p[key].length!==n||p[key].some(x=>!Number.isFinite(x)||x<lo||x>hi))throw Error('Invalid saddle '+key);p[key]=Object.freeze([...p[key]]);}
 for(const [key,lo,hi] of [['pelvisRadius',.02,.15],['contactTime',.002,.03],['impedance',.5,.999],['maxPenetration',.0001,.02]])if(!Number.isFinite(p[key])||p[key]<lo||p[key]>hi)throw Error('Invalid saddle '+key);
 return Object.freeze(p);
}
export function saddleParts(s) {
 return {pelvis:`<geom name="rider_pelvis" type="sphere" size="${s.pelvisRadius}" mass="0" contype="0" conaffinity="0"/>`,pad:`<geom name="rider_saddle" type="box" pos="${s.padCenter[0]} 0 ${s.padCenter[1]}" size="${s.halfSize.join(' ')}" mass="0" contype="0" conaffinity="0"/>`,pair:`<contact><pair geom1="rider_saddle" geom2="rider_pelvis" condim="1" friction="0 0 0 0 0" solref="${s.contactTime} 1" solimp="${s.impedance} ${s.impedance} .001 .5 2"/></contact>`};
}
export function createSaddleObserver(mj,model,data,s) {
 const id=(kind,name)=>mj.mj_name2id(model,mj.mjtObj[kind].value,name),pad=id('mjOBJ_GEOM','rider_saddle'),pelvis=id('mjOBJ_GEOM','rider_pelvis');
 if(pad<0||pelvis<0)throw Error('Missing saddle collision geometry.');
 const rider=model.geom_bodyid[pelvis],bike=model.geom_bodyid[pad],buffer=new mj.DoubleBuffer(6),velocity=new mj.DoubleBuffer(6),rows=new Uint8Array(8192);
 const out={force:new Float64Array(3),point:new Float64Array(3),normal:new Float64Array(3),pelvis:new Float64Array(3),pad:new Float64Array(3),padRotation:new Float64Array(9),gap:0,normalForce:0,power:0,riderPower:0,bikePower:0,pairPower:0,supported:false,contactCount:0,issue:null};
 function pointPower(body,sign){mj.mj_objectVelocity(model,data,mj.mjtObj.mjOBJ_BODY.value,body,velocity,0);const v=velocity.GetView(),x=out.point[0]-data.xipos[3*body],y=out.point[1]-data.xipos[3*body+1],z=out.point[2]-data.xipos[3*body+2];return sign*(out.force[0]*(v[3]+v[1]*z-v[2]*y)+out.force[1]*(v[4]+v[2]*x-v[0]*z)+out.force[2]*(v[5]+v[0]*y-v[1]*x));}
 return {out,rows,observe(){
  rows.fill(0);out.force.fill(0);out.point.fill(0);out.normal.fill(0);out.normalForce=out.power=out.riderPower=out.bikePower=out.pairPower=out.contactCount=0;out.supported=false;out.issue=null;
  for(let k=0;k<3;k++){out.pelvis[k]=data.geom_xpos[3*pelvis+k];out.pad[k]=data.geom_xpos[3*pad+k];}out.padRotation.set(data.geom_xmat.subarray(9*pad,9*pad+9));
  const R=out.padRotation;out.gap=(out.pelvis[0]-out.pad[0])*R[2]+(out.pelvis[1]-out.pad[1])*R[5]+(out.pelvis[2]-out.pad[2])*R[8]-s.halfSize[2]-s.pelvisRadius;
  if(data.nefc>rows.length)return out.issue='saddle-row-capacity';
  const list=data.contact;
  try{for(let i=0;i<list.size();i++){const c=list.get(i);try{
   const side=c.geom[0]===pelvis&&c.geom[1]===pad?0:c.geom[1]===pelvis&&c.geom[0]===pad?1:-1;
   if(side<0){if(c.flex[0]<0&&c.flex[1]<0)throw Error('Unsupported rigid contact pair.');continue;}
   out.contactCount++;if(out.contactCount>1)return out.issue='saddle-contact-count';
   if(c.dim!==1)throw Error('Saddle contact must be frictionless.');
   const sign=side?1:-1;
   for(let k=0;k<3;k++){out.normal[k]=sign*c.frame[k];out.point[k]=c.pos[k];}
   if(out.normal[0]*R[2]+out.normal[1]*R[5]+out.normal[2]*R[8]<.95)return out.issue='saddle-side-contact';
   if(c.dist < -s.maxPenetration)return out.issue='saddle-penetration-limit';
   if(c.efc_address<0)continue;
   const row=c.efc_address;if(row>=data.nefc||data.efc_type[row]!==mj.mjtConstraint.mjCNSTR_CONTACT_FRICTIONLESS.value||data.efc_id[row]!==i)throw Error('Invalid saddle constraint row.');rows[row]=1;
   mj.mj_contactForce(model,data,i,buffer);const N=buffer.GetView()[0];
   if(!Number.isFinite(N)||N<0)return out.issue='nonfinite-saddle-force';
   out.normalForce=N;out.supported=N>1e-8;for(let k=0;k<3;k++)out.force[k]=out.normal[k]*N;
   out.power=N*data.efc_vel[row];out.riderPower=pointPower(rider,1);out.bikePower=pointPower(bike,-1);out.pairPower=out.riderPower+out.bikePower;
  }finally{c.delete();}}}finally{list.delete();}
  if(!Number.isFinite(out.gap)||!Number.isFinite(out.power)||!Number.isFinite(out.pairPower)||!out.force.every(Number.isFinite))return out.issue='nonfinite-saddle-state';
  return null;
 },delete(){velocity.delete();buffer.delete();}};
}
export function createSaddleFrame() {
 return {force:new Float64Array(3),point:new Float64Array(3),normal:new Float64Array(3),pelvis:new Float64Array(3),pad:new Float64Array(3),padRotation:new Float64Array(9),gap:0,normalForce:0,power:0,riderPower:0,bikePower:0,pairPower:0,supported:false,contactCount:0,issue:null,work:0};
}
const vectorFields=['force','point','normal','pelvis','pad','padRotation'],scalarFields=['gap','normalForce','power','riderPower','bikePower','pairPower','supported','contactCount','issue'];
export function storeSaddle(observer,work,out) {
 const o=observer.out;
 for(const key of vectorFields)out[key].set(o[key]);
 for(const key of scalarFields)out[key]=o[key];
 out.work=work;
}
export function materializeSaddle(f) {
 return {...f,...Object.fromEntries(['force','point','normal','pelvis','pad','padRotation'].map(k=>[k,Array.from(f[k])]))};
}
