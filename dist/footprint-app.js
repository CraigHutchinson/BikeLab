import {DEFAULTS,validate,footprintFixture,setupFromRecord} from './footprint.js';
import {parseProfile} from './terrain.js';
const $=id=>document.getElementById(id),form=$('setup');
let result,params={...DEFAULTS},profile=footprintFixture('flat'),custom=false,resultCustom=false,draftFixture=DEFAULTS.fixture,worker,revision=0,dirty=false;
function stop(){revision++;worker?.terminate();worker=null;$('cancel').disabled=true;}
function edits(){stop();dirty=true;$('save').disabled=true;$('status').textContent='UNAPPLIED EDITS';}
function reject(error){edits();$('status').textContent='INPUT REJECTED';$('error').textContent=error.message;}
function fields(){const p={fixture:draftFixture};for(const k of Object.keys(DEFAULTS))if(k!=='fixture'){const v=form.elements[k].value;p[k]=v.trim()?Number(v):NaN;}return validate(p);}
function fill(p){for(const k of Object.keys(DEFAULTS))if(k!=='fixture')form.elements[k].value=p[k];}
function calculate(p,terrain,isCustom){
 stop();const ticket=revision;dirty=true;$('save').disabled=true;$('status').textContent='CALCULATING';$('error').textContent='';$('cancel').disabled=false;
 worker=new Worker(new URL('./footprint-worker.js',import.meta.url),{type:'module'});
 const fail=error=>{if(ticket===revision){stop();reject(error);}};
 worker.onerror=()=>fail(Error('Contact worker failed. Reapply the setup to retry.'));
 worker.onmessage=event=>{
  if(ticket!==revision)return;if(event.data.error){fail(Error(event.data.error));return;}
  result=event.data.result;params=result.params;draftFixture=params.fixture;profile=result.profile;custom=isCustom;resultCustom=isCustom;stop();dirty=false;
  fill(params);$('profileText').value=JSON.stringify(profile,null,2);$('save').disabled=false;render();
 };worker.postMessage({params:p,profile:terrain});
}
function render(){
 const s=result.summary;$('status').textContent=s?'SOLVED':'UNSUPPORTED';$('reason').textContent=result.reason??'Static ground reaction at the prescribed hub pose.';
 $('forces').textContent=s?`${s.forceX.toFixed(2)} / ${s.forceZ.toFixed(2)} N`:'—';$('moment').textContent=s?`${s.momentY.toFixed(4)} N m`:'—';$('count').textContent=s?s.activeNodes:'—';
 $('diagnostics').textContent=s?`Stored energy ${s.energy.toFixed(5)} J · maximum inward displacement ${(s.maxDeformation*1000).toFixed(3)} mm · contour intrusion ${(s.contourIntrusion*1000).toFixed(4)} / ${(s.contourTolerance*1000).toFixed(1)} mm · optimality residual ${s.residual.toExponential(2)} N · ${s.iterations} sweeps.`:result.contourIntrusion!==undefined?`Contour intrusion ${(result.contourIntrusion*1000).toFixed(3)} mm exceeds the ${(result.contourTolerance*1000).toFixed(1)} mm admission bound.`:'No load prediction is available in this regime.';
 $('source').textContent=(custom?'Custom profile · ':'Built-in profile · ')+profile.source.kind+': '+profile.source.description;
 $('contacts').replaceChildren();for(const c of result.contacts??[]){const row=$('contacts').insertRow();for(const text of [`${c.node} / ${c.feature}`,`${c.x.toFixed(6)} / ${c.z.toFixed(6)}`,`${c.nx.toFixed(5)} / ${c.nz.toFixed(5)}`,c.normalForce.toFixed(6)])row.insertCell().textContent=text;}
 draw();
}
function draw(){
 if(!result)return;const canvas=$('rig'),w=canvas.clientWidth,h=canvas.clientHeight,dpr=devicePixelRatio||1;if(w<60||h<60)return;
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
 const p=result.params,detail=$('view').value==='contact',points=result.profile.points,contacts=result.contacts??[];
 let xmin=p.centerX-p.radius-.04,xmax=p.centerX+p.radius+.04,zmin=Math.min(p.height-p.radius-.04,...points.filter(([x])=>x>=xmin&&x<=xmax).map(([,z])=>z)),zmax=p.height+p.radius+.04;
 if(detail){xmin=p.centerX-.24;xmax=p.centerX+.24;zmin=p.height-p.radius-.055;zmax=p.height-p.radius+.16;}
 const scale=Math.min((w-48)/(xmax-xmin),(h-64)/(zmax-zmin)),mx=(xmin+xmax)/2,mz=(zmin+zmax)/2,x=v=>w/2+(v-mx)*scale,z=v=>h/2-(v-mz)*scale;
 c.save();c.beginPath();c.rect(8,26,w-16,h-56);c.clip();
 c.beginPath();points.forEach((q,i)=>i?c.lineTo(x(q[0]),z(q[1])):c.moveTo(x(q[0]),z(q[1])));c.lineTo(x(points.at(-1)[0]),h+100);c.lineTo(x(points[0][0]),h+100);c.closePath();c.fillStyle='#26333d';c.fill();
 c.beginPath();points.forEach((q,i)=>i?c.lineTo(x(q[0]),z(q[1])):c.moveTo(x(q[0]),z(q[1])));c.strokeStyle='#83979d';c.lineWidth=2;c.stroke();
 const circle=(radius,color,dash)=>{c.setLineDash(dash);c.strokeStyle=color;c.lineWidth=1.5;c.beginPath();c.arc(x(p.centerX),z(p.height),radius*scale,0,2*Math.PI);c.stroke();c.setLineDash([]);};
 circle(p.radius,'#78909d',[4,4]);circle(p.rimRadius,'#c2a3ff',[]);
 if(result.outline){c.beginPath();result.outline.forEach((q,i)=>i?c.lineTo(x(q[0]),z(q[1])):c.moveTo(x(q[0]),z(q[1])));c.closePath();c.strokeStyle='#70e2ce';c.lineWidth=2.5;c.stroke();}
 function arrow(px,pz,dx,dz,color){const a=x(px),b=z(pz),length=Math.hypot(dx,dz);if(length<.01)return;const ex=a+dx,ey=b-dz,nx=dx/length,nz=dz/length,head=Math.min(5,length/3);c.strokeStyle=color;c.lineWidth=1.2;c.beginPath();c.moveTo(a,b);c.lineTo(ex,ey);c.moveTo(ex-head*nx-head*.6*nz,ey+head*nz-head*.6*nx);c.lineTo(ex,ey);c.lineTo(ex-head*nx+head*.6*nz,ey+head*nz+head*.6*nx);c.stroke();}
 const peak=Math.max(0,...contacts.map(q=>q.normalForce)),forceScale=peak?42/peak:0;
 for(const q of contacts){c.fillStyle='#f2b373';c.beginPath();c.arc(x(q.x),z(q.z),2,0,2*Math.PI);c.fill();arrow(q.x,q.z,q.forceX*forceScale,q.forceZ*forceScale,'#f2b373');}
 if(result.summary){const s=result.summary,length=Math.hypot(s.forceX,s.forceZ);if(length)arrow(p.centerX,p.height,65*s.forceX/length,65*s.forceZ/length,'#88b9ff');}
 c.restore();c.fillStyle='#9aabb7';c.font='11px system-ui';c.fillText('x →   z ↑  ·  equal geometry scale',12,17);c.fillText(peak?`42 px = ${peak.toFixed(2)} N local force`:'No active contact forces',12,h-12);
}
function apply(useEditor=false){try{const p=fields(),changed=custom||useEditor;calculate(p,changed?parseProfile($('profileText').value):footprintFixture(p.fixture,p.terrainSegments),changed);}catch(error){reject(error);}}
form.oninput=edits;
// Changing a built-in resolution regenerates that source unless profile text was edited.
let profileEdited=false;$('profileText').oninput=()=>{profileEdited=true;edits();};form.onsubmit=e=>{e.preventDefault();apply(profileEdited);};
$('applyProfile').onclick=()=>apply(true);$('view').onchange=draw;
$('cancel').onclick=()=>{edits();$('status').textContent='CANCELLED';};
$('restore').onclick=()=>{if(!result)return;stop();dirty=false;profileEdited=false;custom=resultCustom;draftFixture=result.params.fixture;fill(result.params);$('profileText').value=JSON.stringify(result.profile,null,2);$('error').textContent='';$('save').disabled=false;render();};
$('example').onchange=()=>{
 const name=$('example').value,p={...DEFAULTS};if(name==='rounded')Object.assign(p,{fixture:name,centerX:.1,height:.44});if(name==='step')Object.assign(p,{fixture:name,centerX:.1,height:.445});if(name==='bridge')Object.assign(p,{fixture:name,height:.383});if(name==='edge')Object.assign(p,{fixture:'step',centerX:-.2,height:.36});if(name==='rim')p.height=.29;
 profileEdited=false;custom=false;draftFixture=p.fixture;fill(p);calculate(p,footprintFixture(p.fixture,p.terrainSegments),false);
};
$('load').onchange=async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;edits();const ticket=revision;try{if(file.size>2*1024*1024)throw Error('Record exceeds 2 MiB.');const text=await file.text();if(ticket!==revision)return;const record=JSON.parse(text.replace(/^\uFEFF/,'')),p=setupFromRecord(record);if(!record.profile)throw Error('Record requires its authored profile.');profileEdited=false;calculate(p,record.profile,true);}catch(error){if(ticket===revision)reject(error);}};
$('save').onclick=()=>{if(dirty||!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='bikelab-footprint.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
new ResizeObserver(draw).observe($('rig'));window.addEventListener('resize',draw);window.addEventListener('pagehide',()=>{if(worker){edits();$('status').textContent='CANCELLED';}});fill(params);calculate(params,profile,false);
