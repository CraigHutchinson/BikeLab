import { fixture, parseProfile, probe, MAX_PROFILE_BYTES } from './terrain.js';

const $ = id => document.getElementById(id), form = $('setup');
let profile = fixture(), result, dirty = false, revision = 0;
const fields = () => {
  const n = name => { const v=form.elements[name].value; return v.trim() ? Number(v) : NaN; };
  return {center:[n('x'),n('z')],radius:n('radius')};
};
function edits() { revision++; dirty=true; $('status').textContent='UNAPPLIED EDITS'; $('save').disabled=true; $('position').disabled=true; }
function reject(error) { edits(); $('status').textContent='INPUT REJECTED'; $('error').textContent=error.message; }
function apply(nextProfile = profile, nextSetup = fields()) {
  revision++;
  try {
    const next = probe(nextProfile,nextSetup);
    profile=next.profile; result=next; dirty=false;
    $('profileText').value=JSON.stringify(profile,null,2);
    for (const [key,value] of [['x',nextSetup.center[0]],['z',nextSetup.center[1]],['radius',nextSetup.radius]]) form.elements[key].value=value;
    $('error').textContent=''; $('save').disabled=false;
    const slider=$('position'), min=profile.points[0][0]+nextSetup.radius, max=profile.points.at(-1)[0]-nextSetup.radius;
    slider.disabled=min>=max; slider.min=min; slider.max=Math.max(min,max); slider.step='any'; slider.value=nextSetup.center[0];
    $('status').textContent=next.status==='available' ? next.gap<0 ? 'GEOMETRIC OVERLAP' : 'GEOMETRY READY' : 'UNAVAILABLE';
    $('gap').textContent=next.status==='available' ? (next.gap*1000).toFixed(2)+' mm' : '—';
    $('count').textContent=next.witnesses?.length??'—'; $('radius').textContent=(nextSetup.radius*1000).toFixed(1)+' mm';
    $('reason').textContent=next.reason ?? (next.gap<0 ? 'Prescribed circle overlaps the surface. This is not a physically simulated impact.' : 'Positive clearance is separation; zero is geometric contact.');
    $('source').textContent=profile.source.kind+': '+profile.source.description;
    const body=$('witnesses').tBodies[0]; body.replaceChildren();
    for (const w of next.witnesses??[]) {
      const row=body.insertRow();
      for (const value of [w.feature.kind+' '+w.feature.index,w.point.map(x=>x.toFixed(6)).join(' / '),w.normal.map(x=>x.toFixed(6)).join(' / ')]) row.insertCell().textContent=value;
    }
    draw(); return true;
  } catch(error) { reject(error); return false; }
}
function draw() {
  if(!result)return;
  const canvas=$('rig'), w=canvas.clientWidth, h=canvas.clientHeight, dpr=devicePixelRatio||1;
  // Navigation/visibility changes can report an empty or not-yet-laid-out box.
  // Wait for a drawable content box instead of producing a negative scale.
  if(w<=48||h<=58)return;
  canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
  const c=canvas.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  const [cx,cz]=result.setup.center,r=result.setup.radius,points=profile.points;
  let xmin=Math.min(points[0][0],cx-r),xmax=Math.max(points.at(-1)[0],cx+r),zmin=cz-r,zmax=cz+r;
  for(const [,z]of points){zmin=Math.min(zmin,z);zmax=Math.max(zmax,z);}
  const scale=Math.min((w-48)/(xmax-xmin),(h-58)/(zmax-zmin)),mx=(xmin+xmax)/2,mz=(zmin+zmax)/2;
  const x=v=>w/2+(v-mx)*scale,z=v=>h/2-(v-mz)*scale;
  c.strokeStyle='#49606c';c.lineWidth=3;c.beginPath();
  points.forEach((p,i)=>i?c.lineTo(x(p[0]),z(p[1])):c.moveTo(x(p[0]),z(p[1])));c.stroke();
  c.strokeStyle='#70e2ce';c.lineWidth=2;c.beginPath();c.arc(x(cx),z(cz),r*scale,0,2*Math.PI);c.stroke();
  c.fillStyle='#70e2ce';c.beginPath();c.arc(x(cx),z(cz),3,0,2*Math.PI);c.fill();
  for(const witness of result.witnesses??[]) {
    const [px,pz]=witness.point,[nx,nz]=witness.normal,a=x(px),b=z(pz);
    c.strokeStyle='#f2b373';c.fillStyle='#f2b373';c.lineWidth=1;c.setLineDash([4,4]);c.beginPath();c.moveTo(a,b);c.lineTo(x(cx),z(cz));c.stroke();c.setLineDash([]);
    const length=28,ex=a+nx*length,ey=b-nz*length;
    c.lineWidth=2;c.beginPath();c.moveTo(a,b);c.lineTo(ex,ey);c.moveTo(ex-6*nx-4*nz,ey+6*nz-4*nx);c.lineTo(ex,ey);c.lineTo(ex-6*nx+4*nz,ey+6*nz+4*nx);c.stroke();
    c.beginPath();c.arc(a,b,4,0,2*Math.PI);c.fill();
  }
  c.font='11px system-ui';c.fillStyle='#9aabb7';c.fillText('x →   z ↑',12,18);
  const bar=10**Math.floor(Math.log10((w/5)/scale));
  c.strokeStyle='#9aabb7';c.beginPath();c.moveTo(16,h-16);c.lineTo(16+bar*scale,h-16);c.stroke();c.fillText(bar.toPrecision(2)+' m',16,h-24);
}
form.oninput=edits; $('profileText').oninput=edits;
function applyInput() {
  try { const p=parseProfile($('profileText').value),changed=JSON.stringify(p)!==JSON.stringify(profile);
    if(apply(p)&&changed)$('fixture').value='custom';
  } catch(error){reject(error);}
}
form.onsubmit=event=>{event.preventDefault();applyInput();};
$('applyProfile').onclick=applyInput;
$('restoreProfile').onclick=()=>{apply(profile,result.setup);};
$('fixture').onchange=()=>{if($('fixture').value!=='custom')apply(fixture($('fixture').value),result.setup);};
$('position').oninput=()=>{if(!dirty)apply(profile,{...result.setup,center:[Number($('position').value),result.setup.center[1]]});};
$('load').onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  const ticket=++revision,setup=fields();
  try {
    if(file.size>MAX_PROFILE_BYTES)throw new Error('Profile exceeds 256 KiB.');
    const text=await file.text();if(ticket!==revision)return;
    if(apply(parseProfile(text),setup))$('fixture').value='custom';
  } catch(error){if(ticket===revision)reject(error);}
};
$('save').onclick=()=>{
  if(dirty)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download='bikelab-terrain-probe.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('resize',draw);
new ResizeObserver(draw).observe($('rig'));
apply();
