// R0a: immutable synthetic source -> finite swept request -> owned layer arrays.
// Geometry delivery only. All coordinates are terrain-local metres, x/y/z up.
export const FORMAT='bikelab-terrain-request-0.2',LEGACY_FORMAT='bikelab-terrain-request-0.1';
export const GRID=Object.freeze({spacing:.02,tileCells:40,nx:400,ny:160,x0:0,y0:-1.6,zMin:-.2,zMax:.2});
const LEGACY_LIMITS=Object.freeze({columns:4096,spans:12288,tiles:32,pending:8,requests:4});
export const LIMITS=Object.freeze({...LEGACY_LIMITS,prefetchQueued:8,prefetchActive:1});
export const ENVELOPE=Object.freeze({radius:.36,width:.06,margin:.02,behind:.10});
export const MATERIALS=Object.freeze(['air','soil (synthetic)','rock (synthetic)']);
const TILE_BYTES=40*40*(7*8+5);
const finite=(v,name)=>{if(!Number.isFinite(v))throw Error('Nonfinite '+name);return v;};
const freeze=Object.freeze;
function pose(p){if(!p||p.length!==3)throw Error('Pose must be [x,y,yaw]');return freeze(p.map((v,i)=>finite(v,'pose '+i)));}
export function envelopeCorners(p,e=ENVELOPE){
  const [x,y,a]=pose(p),c=Math.cos(a),s=Math.sin(a),l=e.radius+e.margin,w=e.width/2+e.margin;
  return [[-l,-w],[l,-w],[l,w],[-l,w]].map(([u,v])=>[x+c*u-s*v,y+s*u+c*v]);
}
export function sweptBox(a,b,e=ENVELOPE){
  a=pose(a);b=pose(b);
  for(const k of ['radius','width','margin','behind'])if(!Number.isFinite(e[k])||e[k]<0||e[k]>2)throw Error('Invalid envelope '+k);
  if(!e.radius||!e.width)throw Error('Empty envelope');
  // Linear translation is inside the endpoint hull. Rotation differs from
  // the nearest endpoint by <= R*|delta yaw|/2 at every intermediate time.
  const pad=Math.hypot(e.radius+e.margin,e.width/2+e.margin)*Math.abs(b[2]-a[2])/2;
  const points=[...envelopeCorners(a,e),...envelopeCorners(b,e)];
  const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy);
  if(d)for(const p of [...points])points.push([p[0]-e.behind*dx/d,p[1]-e.behind*dy/d]);
  else for(const p of [...points])points.push([p[0]-e.behind*Math.cos(a[2]),p[1]-e.behind*Math.sin(a[2])]);
  return freeze([Math.min(...points.map(p=>p[0]))-pad,Math.max(...points.map(p=>p[0]))+pad,Math.min(...points.map(p=>p[1]))-pad,Math.max(...points.map(p=>p[1]))+pad]);
}
export function fixtureColumn(kind,x,y){
  if(!['plane','ramp','layered','hole'].includes(kind))throw Error('Unknown fixture');
  finite(x,'x');finite(y,'y');
  if(kind==='plane')return {top:0,normal:[0,0,1],spans:[[0,-.2,2]]};
  if(kind==='ramp'){const z=.01*x+.02*y,n=Math.hypot(.01,.02,1);return {top:z,normal:[-.01/n,-.02/n,1/n],spans:[[z,-.2,2]]};}
  const main=x>=5.8&&x<6.4&&y>=-.1&&y<.1,side=x>=4.8&&x<5.4&&y>=.12&&y<.14;
  const crown=side?.07:main?(x<6?-.03:.05):null;
  const spans=crown===null?[[.02,-.2,1]]:crown<.02?[[.02,crown,1],[crown,-.2,2]]:[[crown,-.2,2]];
  return {top:spans[0][0],normal:[0,0,1],spans};
}
function cuboid(id,x0,x1,y0,y1,z0,z1){
  const v=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
  return freeze({id,bounds:freeze([x0,x1,y0,y1,z0,z1]),vertices:freeze(v.map(freeze)),faces:freeze([
    {indices:[0,4,7,3],normal:[-1,0,0]},{indices:[1,2,6,5],normal:[1,0,0]},
    {indices:[0,1,5,4],normal:[0,-1,0]},{indices:[3,7,6,2],normal:[0,1,0]},
    {indices:[0,3,2,1],normal:[0,0,-1]},{indices:[4,5,6,7],normal:[0,0,1]}
  ].map(f=>freeze({indices:freeze(f.indices),normal:freeze(f.normal)}))),material:2});
}
// One extruded boundary preserves the buried support and raised portion. The step's
// left face is exact x=6, z=[-.03,.05], not a smoothed height interpolation.
function steppedRock(){
  const p=[[5.8,-.2],[6.4,-.2],[6.4,.05],[6,.05],[6,-.03],[5.8,-.03]],n=p.length;
  const vertices=[...p.map(([x,z])=>freeze([x,-.1,z])),...p.map(([x,z])=>freeze([x,.1,z]))];
  const faces=[{indices:[0,1,2,3,4,5],normal:[0,-1,0]},{indices:[6,11,10,9,8,7],normal:[0,1,0]}];
  for(let i=0;i<n;i++){const j=(i+1)%n,dx=p[j][0]-p[i][0],dz=p[j][1]-p[i][1],l=Math.hypot(dx,dz);faces.push({indices:[i,i+n,j+n,j],normal:[dz/l||0,0,-dx/l||0]});}
  return freeze({id:'stepped-rock',bounds:freeze([5.8,6.4,-.1,.1,-.2,.05]),vertices:freeze(vertices),faces:freeze(faces.map(f=>freeze({indices:freeze(f.indices),normal:freeze(f.normal)}))),material:2});
}
const FEATURES=freeze([steppedRock(),cuboid('off-centre-edge',4.8,5.4,.12,.14,-.2,.07)]);
const overlaps=(a,b)=>a[0]<=b[1]&&a[1]>=b[0]&&a[2]<=b[3]&&a[3]>=b[2];
function cells(box){
  const g=GRID;
  if(box[0]<g.x0||box[1]>8||box[2]<g.y0||box[3]>1.6)return {status:'outside-domain',ids:[]};
  // Closed box includes both incident cells at an exact grid boundary.
  const loX=Math.max(0,Math.ceil((box[0]-g.x0)/g.spacing)-1),hiX=Math.min(g.nx-1,Math.floor((box[1]-g.x0)/g.spacing));
  const loY=Math.max(0,Math.ceil((box[2]-g.y0)/g.spacing)-1),hiY=Math.min(g.ny-1,Math.floor((box[3]-g.y0)/g.spacing));
  if((hiX-loX+1)*(hiY-loY+1)>LIMITS.columns)return {status:'unsupported',reason:'column budget',ids:[]};
  const ids=[];for(let y=loY;y<=hiY;y++)for(let x=loX;x<=hiX;x++)ids.push(y*g.nx+x);
  return {status:'complete',ids};
}
function location(id){const x=id%GRID.nx,y=Math.floor(id/GRID.nx);return {key:Math.floor(x/40)+','+Math.floor(y/40),index:(y%40)*40+x%40,x,y};}
function buildTile(kind,key){
  const [tx,ty]=key.split(',').map(Number),values=new Float64Array(1600*7),materials=new Uint8Array(4800),count=new Uint8Array(1600),valid=new Uint8Array(1600);
  for(let i=0;i<1600;i++){
    const ix=tx*40+i%40,iy=ty*40+Math.floor(i/40),x=(ix+.5)*.02,y=-1.6+(iy+.5)*.02,c=fixtureColumn(kind,x,y);
    values.set([c.top,...c.normal,...c.spans.map(s=>s[1]),...Array(3-c.spans.length).fill(0)],7*i);
    count[i]=c.spans.length;valid[i]=kind==='hole'&&ix===305&&iy===80?0:1;
    c.spans.forEach((s,j)=>materials[3*i+j]=s[2]);
  }
  return {values,materials,count,valid,bytes:values.byteLength+materials.byteLength+count.byteLength+valid.byteLength};
}
export function makeRequest({format=FORMAT,generation=0,wheel='front',sequence=0,a,b,optional=[],depth=[-.2,.2],fixture='layered'}){
  if(![FORMAT,LEGACY_FORMAT].includes(format))throw Error('Invalid request format');
  if(!Number.isSafeInteger(generation)||generation<0||!Number.isSafeInteger(sequence)||sequence<0||!['front','rear'].includes(wheel))throw Error('Invalid request identity');
  if(!['plane','ramp','layered','hole'].includes(fixture))throw Error('Unknown fixture');
  if(!Array.isArray(depth)||depth.length!==2||!depth.every(Number.isFinite)||depth[0]>=depth[1])throw Error('Invalid depth');
  if(!Array.isArray(optional)||optional.length>8)throw Error('Optional route budget');
  return freeze({format,generation,wheel,sequence,source:fixture+'/1',fixture,snapshot:0,envelope:'fixed-1',a:pose(a),b:pose(b),box:sweptBox(a,b),optional:freeze(optional.map(pair=>{if(!Array.isArray(pair)||pair.length!==2)throw Error('Invalid optional segment');return freeze(pair.map(pose));})),depth:freeze([...depth])});
}
export class TerrainCache {
  #tiles=new Map(); #pending=new Map(); #latest=new Map(); #cancelled=new Set(); #active=0; #generation=0;
  #optional=new Map(); #scheduled=false; #prefetchActive=0;
  #prefetchStats={completed:0,failed:0,discarded:0};
  constructor({fixture='layered',delay=()=>Promise.resolve(),tileLimit=LIMITS.tiles}={}){
    fixtureColumn(fixture,0,0);if(!Number.isInteger(tileLimit)||tileLimit<1||tileLimit>LIMITS.tiles)throw Error('Invalid tile limit');
    Object.defineProperties(this,{fixture:{value:fixture,enumerable:true},delay:{value:delay},tileLimit:{value:tileLimit,enumerable:true}});this.stats={hits:0,misses:0,loads:0,evictions:0};
  }
  get generation(){return this.#generation;}
  reset(){this.#generation++;this.#latest.clear();this.#cancelled.clear();this.#pruneOptional();}
  cancel(wheel){this.#cancelled.add(wheel);this.#pruneOptional();}
  get resident(){return [...this.#tiles.keys()].sort();}
  get bytes(){return this.#tiles.size*TILE_BYTES;}
  get prefetch(){return {queued:this.#optional.size,active:this.#prefetchActive,...this.#prefetchStats};}
  #current(q){return q.generation===this.#generation&&!this.#cancelled.has(q.wheel)&&q.sequence===this.#latest.get(q.wheel);}
  #pruneOptional(){for(const [key,q] of this.#optional)if(!this.#current(q)){this.#optional.delete(key);this.#prefetchStats.discarded++;}}
  #schedulePrefetch(){
    if(this.#scheduled||!this.#optional.size)return;
    this.#scheduled=true;queueMicrotask(()=>{
      this.#scheduled=false;this.#pruneOptional();
      if(this.#prefetchActive||this.#pending.size>=LIMITS.pending||!this.#optional.size)return;
      const [key,q]=this.#optional.entries().next().value;this.#optional.delete(key);this.#prefetchActive=1;
      this.#tile(key,q).then(()=>{this.#prefetchStats.completed++;},()=>{this.#prefetchStats.failed++;}).finally(()=>{
        this.#prefetchActive=0;this.#schedulePrefetch();
      });
    });
  }
  #queueOptional(keys,q){
    this.#pruneOptional();
    for(const key of keys){
      if(this.#tiles.has(key))continue;
      const pending=this.#pending.get(key);
      if(pending){if(!pending.required)pending.optional=q;continue;}
      if(this.#optional.has(key)||this.#optional.size<LIMITS.prefetchQueued)this.#optional.set(key,q);
      else this.#prefetchStats.discarded++;
    }
    this.#schedulePrefetch();
  }
  #store(key,t,optional){
    if(this.#tiles.size>=this.tileLimit){
      const prefetched=[...this.#tiles].find(([,entry])=>entry.optional);
      // Speculation may replace only speculation, never demand-resident data.
      if(optional&&!prefetched){this.#prefetchStats.discarded++;return;}
      this.#tiles.delete(prefetched?prefetched[0]:this.#tiles.keys().next().value);this.stats.evictions++;
    }
    this.#tiles.set(key,{tile:t,optional});
  }
  async #tile(key,optional=null){
    if(this.#tiles.has(key)){this.stats.hits++;const entry=this.#tiles.get(key);if(!optional)entry.optional=false;this.#tiles.delete(key);this.#tiles.set(key,entry);return entry.tile;}
    if(this.#pending.has(key)){this.stats.hits++;const entry=this.#pending.get(key);if(!optional)entry.required=true;return entry.promise;}
    if(this.#pending.size>=LIMITS.pending)throw Error('pending tile budget');
    this.stats.misses++;
    const entry={required:!optional,optional,promise:null};
    const p=Promise.resolve().then(()=>this.delay(key)).then(()=>{
      const t=buildTile(this.fixture,key);
      if(entry.required||this.#current(entry.optional))this.#store(key,t,!entry.required);
      else this.#prefetchStats.discarded++;
      this.stats.loads++;return t;
    }).finally(()=>{this.#pending.delete(key);this.#schedulePrefetch();});
    entry.promise=p;this.#pending.set(key,entry);return p;
  }
  async request(q){
    // Only requests authored by the bounded constructor are accepted; recompute
    // coverage from poses to prevent a forged box from certifying less terrain.
    let canonical;try{canonical=makeRequest(q);}catch(error){return {status:'unsupported',reason:error.message};}
    if(q.format!==canonical.format||q.source!==canonical.source||q.snapshot!==0||q.envelope!=='fixed-1')return {status:'unsupported',reason:'source/state/layout revision'};
    q=canonical;
    const identity={generation:q.generation,wheel:q.wheel,sequence:q.sequence,source:q.source,snapshot:q.snapshot};
    const result=(status,extra={})=>({status,identity,...extra});
    if(q.source!==this.fixture+'/1')return result('unsupported',{reason:'source revision'});
    if(q.generation!==this.generation||q.sequence<=(this.#latest.get(q.wheel)??-1))return result('cancelled',{reason:'stale request'});
    if(this.#active>=LIMITS.requests)return result('pending',{reason:'request budget'});
    this.#latest.set(q.wheel,q.sequence);this.#cancelled.delete(q.wheel);
    this.#pruneOptional();
    if(q.depth[0]<GRID.zMin||q.depth[1]>GRID.zMax)return result('unsupported',{reason:'unknown depth'});
    const region=cells(q.box);if(region.status!=='complete')return result(region.status,{reason:region.reason});
    const keys=[...new Set(region.ids.map(id=>location(id).key))];
    if(keys.length>this.tileLimit||keys.length>LIMITS.pending)return result('pending',{reason:'mandatory tile budget'});
    const stale=()=>this.#cancelled.has(q.wheel)||q.generation!==this.generation||q.sequence!==this.#latest.get(q.wheel);
    this.#active++;
    try{
      // Local references retain immutable tiles through extraction even on eviction.
      const tiles=new Map(await Promise.all(keys.map(async key=>[key,await this.#tile(key)])));
      if(stale())return result('cancelled',{reason:'superseded or reset'});
      const missing=region.ids.filter(id=>{const l=location(id);return !tiles.get(l.key).valid[l.index];});
      if(missing.length)return result('partial',{missing,reason:'unknown source cells'});
      const n=region.ids.length,x=new Float64Array(n),y=new Float64Array(n),top=new Float64Array(n),normal=new Float64Array(3*n),offset=new Uint32Array(n+1);
      let m=0;for(let j=0;j<n;j++){const l=location(region.ids[j]);offset[j]=m;m+=tiles.get(l.key).count[l.index];}offset[n]=m;
      if(m>LIMITS.spans)return result('unsupported',{reason:'span budget'});
      const upper=new Float64Array(m),lower=new Float64Array(m),material=new Uint8Array(m);
      for(let j=0;j<n;j++){
        const l=location(region.ids[j]),t=tiles.get(l.key),v=7*l.index;x[j]=(l.x+.5)*.02;y[j]=-1.6+(l.y+.5)*.02;top[j]=t.values[v];normal.set(t.values.subarray(v+1,v+4),3*j);
        for(let k=0;k<t.count[l.index];k++){const s=offset[j]+k;upper[s]=k?t.values[v+3+k]:top[j];lower[s]=t.values[v+4+k];material[s]=t.materials[3*l.index+k];}
      }
      const features=['layered','hole'].includes(this.fixture)?FEATURES.filter(f=>overlaps(f.bounds,q.box)):[];
      // Clipping describes the requested geometry/budget, not later I/O success.
      let optionalClipped=false;
      const optionalKeys=new Set();for(const pair of q.optional){const c=cells(sweptBox(...pair));if(c.status!=='complete'){optionalClipped=true;continue;}for(const id of c.ids)optionalKeys.add(location(id).key);}
      const optionalBudget=Math.max(0,this.tileLimit-keys.length);
      const wanted=[...optionalKeys].filter(k=>!keys.includes(k));if(wanted.length>optionalBudget)optionalClipped=true;
      if(q.format===LEGACY_FORMAT){
        for(const key of wanted.slice(0,optionalBudget)){if(stale())break;try{await this.#tile(key);}catch{optionalClipped=true;}}
      }else this.#queueOptional(wanted.slice(0,optionalBudget),q);
      if(stale())return result('cancelled',{reason:'superseded or reset'});
      return result('complete',{request:q,ids:new Uint32Array(region.ids),x,y,top,normal,offset,upper,lower,material,features,optionalClipped,tiles:keys,spacing:.02,knownDepth:[GRID.zMin,GRID.zMax],ownership:'owned copies; no cache aliases'});
    }catch(error){return result(stale()?'cancelled':error.message==='pending tile budget'?'pending':'failed',{reason:error.message});}
    finally{this.#active--;}
  }
}
export const TRACKS=freeze(['straight','left','right','reverse','steer','missing']);
export function track(name){
  if(!TRACKS.includes(name))throw Error('Unknown track');
  const p=[];for(let i=0;i<=24;i++){const u=i/24,x=4.8+1.6*u;
    p.push(name==='reverse'?[6.4-1.6*u,0,0]:name==='steer'?[6,0,(u-.5)*1.2]:name==='left'||name==='right'?[x,(name==='left'?1:-1)*.6*u*u,(name==='left'?1:-1)*.7*u]:[x,0,0]);}
  return p;
}
export function serializable(value){return JSON.parse(JSON.stringify(value,(_k,v)=>ArrayBuffer.isView(v)?Array.from(v):v));}
export async function replay(name='straight',{format=FORMAT,delay,onWait=()=>{},onFrame=()=>{},cancelled=()=>false}={}){
  if(![FORMAT,LEGACY_FORMAT].includes(format))throw Error('Unsupported terrain record');
  const poses=track(name),cache=new TerrainCache({fixture:name==='missing'?'hole':'layered',delay}),frames=[];
  try{
  for(let i=0;i<poses.length-1;i++){
    if(cancelled())break;
    const q=makeRequest({format,generation:cache.generation,sequence:i,a:poses[i],b:poses[i+1],fixture:cache.fixture,optional:i+5<poses.length?[[poses[i+1],poses[i+5]]]:[]});
    onWait(i);const response=await cache.request(q);if(cancelled())break;
    const frame=serializable({tick:i,time:i*.05,request:q,accepted:response.status==='complete',response,cache:{...cache.stats,bytes:cache.bytes,resident:cache.resident,...(format===FORMAT?{prefetch:cache.prefetch}:{})}});frames.push(frame);onFrame(frame);
    if(!frame.accepted)break;
  }
  return {format,track:name,dt:.05,source:'synthetic analytic v1; static epoch 0',grid:GRID,envelope:ENVELOPE,limits:format===LEGACY_FORMAT?LEGACY_LIMITS:LIMITS,frames};
  }finally{cache.cancel('front');cache.cancel('rear');}
}
// Geometry is compared in metres/radians against the 1e-12 numerical budget.
// Discrete identities, masks, offsets, counts, statuses and structure stay exact.
const FLOAT_FIELDS=new Set(['x','y','top','normal','upper','lower','a','b','box','optional','vertices','bounds','time','dt','spacing','depth','knownDepth','radius','width','margin','behind']);
function validateCacheObservation(cache){
  const exactKeys=(value,keys)=>value&&typeof value==='object'&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
  const count=n=>Number.isSafeInteger(n)&&n>=0;
  if(!exactKeys(cache,['hits','misses','loads','evictions','bytes','resident','prefetch'])||
    !['hits','misses','loads','evictions'].every(k=>count(cache[k]))||
    !Array.isArray(cache.resident)||cache.resident.length>LIMITS.tiles||
    new Set(cache.resident).size!==cache.resident.length||!cache.resident.every(k=>typeof k==='string'&&/^[0-9],[0-3]$/.test(k))||
    cache.bytes!==cache.resident.length*TILE_BYTES||
    !exactKeys(cache.prefetch,['queued','active','completed','failed','discarded'])||
    !Object.values(cache.prefetch).every(count)||cache.prefetch.queued>LIMITS.prefetchQueued||cache.prefetch.active>LIMITS.prefetchActive)
    throw Error('Invalid cache observation');
}
export function compareReplay(actual,expected){
  const asynchronous=actual?.format===FORMAT&&expected?.format===FORMAT;
  let maxDifference=0,numbers=0;
  function walk(a,b,path='',field=''){
    if(asynchronous&&/^\/frames\/\d+\/cache$/.test(path)){validateCacheObservation(a);validateCacheObservation(b);return;}
    if(typeof b==='number'){
      if(typeof a!=='number'||!Number.isFinite(a))throw Error('Invalid number at '+path);
      const difference=Math.abs(a-b);numbers++;
      if(FLOAT_FIELDS.has(field)){maxDifference=Math.max(maxDifference,difference);if(difference>1e-12)throw Error('Record differs at '+path);}
      else if(a!==b)throw Error('Record identity/count differs at '+path);
      return;
    }
    if(b===null||typeof b!=='object'){if(a!==b)throw Error('Record differs at '+path);return;}
    if(!a||typeof a!=='object'||Array.isArray(a)!==Array.isArray(b))throw Error('Record shape differs at '+path);
    const keys=Object.keys(b);if(keys.length!==Object.keys(a).length||keys.some(k=>!Object.hasOwn(a,k)))throw Error('Record fields differ at '+path);
    for(const k of keys)walk(a[k],b[k],path+'/'+k,Array.isArray(b)?field:k);
  }
  walk(actual,expected);return {maxDifference,numbers,geometryTolerance:1e-12,discreteFieldsExact:true,cacheObservationsCompared:!asynchronous};
}
export async function verifyReplay(record){
  if(!record||![FORMAT,LEGACY_FORMAT].includes(record.format)||!TRACKS.includes(record.track))throw Error('Unsupported terrain record');
  const expected=await replay(record.track,{format:record.format});compareReplay(record,expected);
  return record.format===FORMAT?serializable(record):expected;
}
