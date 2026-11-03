import {replay,verifyReplay,sweptBox,envelopeCorners,fixtureColumn,GRID} from './terrain-request.js';
const $=id=>document.getElementById(id);
let record=null,index=0,ticket=0,playing=false,raf=0,last=0,receiving=false;
function busy(value){receiving=value;$('calculate').disabled=$('load').disabled=value;}
function pause(){playing=false;cancelAnimationFrame(raf);$('play').textContent='Play';}
function controls(enabled){for(const id of ['play','reset','step','scrub','save'])$(id).disabled=!enabled;}
function context(id){const c=$(id),r=c.getBoundingClientRect();if(!r.width||!r.height)return null;const d=devicePixelRatio||1;c.width=Math.round(r.width*d);c.height=Math.round(r.height*d);const ctx=c.getContext('2d');ctx.scale(d,d);return {c:ctx,w:r.width,h:r.height};}
function top(frame){const ctx=context('rig');if(!ctx)return;const {c,w,h}=ctx,scale=Math.min((w-48)/3.2,(h-45)/2.2),px=x=>24+(x-4)*scale,py=y=>h/2-y*scale;
  c.font='11px system-ui';c.fillStyle='#9aabb7';c.fillText('x (m) →     y (m) ↑',14,18);
  const rect=(b,stroke,fill)=>{const x=px(b[0]),y=py(b[3]),rw=(b[1]-b[0])*scale,rh=(b[3]-b[2])*scale;if(fill){c.fillStyle=fill;c.fillRect(x,y,rw,rh);}c.strokeStyle=stroke;c.strokeRect(x,y,rw,rh);};
  if(!frame)return;
  for(const key of frame.cache.resident){const [x,y]=key.split(',').map(Number);rect([x*.8,(x+1)*.8,-1.6+y*.8,-1.6+(y+1)*.8],'#334550','#13232a');}
  const r=frame.response,q=r.request||frame.request;
  for(const b of [[5.8,6.4,-.1,.1],[4.8,5.4,.12,.14]])rect(b,'#f2b373','#71523c');
  if(q){for(const pair of q.optional)rect(sweptBox(...pair),'#c2a3ff','#c2a3ff16');rect(q.box,'#70e2ce','#70e2ce13');
    const points=envelopeCorners(q.a);c.beginPath();points.forEach((p,i)=>i?c.lineTo(px(p[0]),py(p[1])):c.moveTo(px(p[0]),py(p[1])));c.closePath();c.strokeStyle='#e5edf2';c.stroke();
    c.fillStyle='#70e2ce';for(let i=0;i<(r.x?.length||0);i++)c.fillRect(px(r.x[i])-1,py(r.y[i])-1,2,2);
  }
  for(const id of r.missing||[]){const x=(id%GRID.nx)*.02,y=-1.6+Math.floor(id/GRID.nx)*.02;rect([x,x+.02,y,y+.02],'#e86b7c','#e86b7c');}
  for(let x=4;x<=7;x+=.4){c.fillStyle='#9aabb7';c.fillText(x.toFixed(1),px(x),h-8);}
}
function cut(frame){const ctx=context('cut');if(!ctx)return;const {c,w,h}=ctx,cross=$('cutMode').value==='cross',row=Number($('row').value),q=frame?.response.request||frame?.request,xCut=q?.a[0]||6.02;
  const lo=cross?-.4:4.3,hi=cross?.8:6.9,px=x=>34+(x-lo)/(hi-lo)*(w-46),pz=z=>24+(.10-z)/.34*(h-48);
  $('cutLabel').textContent=cross?`x = ${xCut.toFixed(2)} m`:`y = ${row.toFixed(2)} m`;
  c.font='11px system-ui';for(const z of [.05,0,-.1,-.2]){c.fillStyle='#9aabb7';c.fillText(z.toFixed(2),0,pz(z));c.strokeStyle='#253440';c.beginPath();c.moveTo(34,pz(z));c.lineTo(w,pz(z));c.stroke();}
  // Source cells are shown as discrete columns; no interpolation across a face.
  for(let t=lo+.01;t<hi;t+=.02){const x=cross?xCut:t,y=cross?t:row,col=fixtureColumn(record?.track==='missing'?'hole':'layered',x,y);
    const ix=Math.floor(x/.02),iy=Math.floor((y+1.6)/.02),unknown=record?.track==='missing'&&ix===305&&iy===80;
    for(const [upper,lower,mat] of col.spans){c.fillStyle=unknown?'#e86b7c':mat===1?'#71543b':'#bd8555';c.fillRect(px(t-.01),pz(upper),Math.max(1,px(t+.01)-px(t-.01)),pz(lower)-pz(upper));}
  }
  const r=frame?.response;if(r?.x)for(let i=0;i<r.x.length;i++){if(Math.abs((cross?r.x[i]:r.y[i])-(cross?xCut:row))<.011){const t=cross?r.y[i]:r.x[i];c.strokeStyle='#70e2ce';c.beginPath();c.moveTo(px(t),pz(r.top[i])-7);c.lineTo(px(t),pz(r.top[i]));c.stroke();}}
  if(!cross&&Math.abs(row)<.1){const x=px(6),y=pz(.035);c.strokeStyle='#f2b373';c.beginPath();c.moveTo(x,y);c.lineTo(x-25,y);c.lineTo(x-19,y-4);c.moveTo(x-25,y);c.lineTo(x-19,y+4);c.stroke();}
  c.fillStyle='#9aabb7';c.fillText('Unknown below source depth',40,h-8);c.fillText(cross?'y (m) →':'x (m) →',w-75,15);
}
function draw(){const frame=record?.frames[index];top(frame);cut(frame);if(!frame){for(const id of ['time','counts','cache'])$(id).textContent='—';$('detail').textContent='Receive terrain to inspect accepted intervals.';return;}
  const r=frame.response;$('scrub').value=index;$('time').textContent=`${frame.time.toFixed(2)} s · ${frame.tick}`;
  $('counts').textContent=`${r.ids?.length||0} / ${r.lower?.length||0}`;$('cache').textContent=`${frame.cache.hits} / ${frame.cache.loads}`;
  $('detail').textContent=frame.accepted?`Accepted swept interval. ${frame.cache.bytes.toLocaleString()} source bytes; ${r.features.length} explicit features. ${r.optionalClipped?'Optional lookahead clipped. ':''}${frame.cache.prefetch?`Lookahead at delivery: ${frame.cache.prefetch.queued} queued, ${frame.cache.prefetch.active} loading; ${frame.cache.prefetch.failed} failed, ${frame.cache.prefetch.discarded} discarded.`:''}`:`Movement held: ${r.status} — ${r.reason}. Last accepted endpoint is unchanged.`;
}
async function calculate(){if(receiving)return;busy(true);pause();const id=++ticket;record=null;index=0;controls(false);$('cancel').disabled=false;$('error').textContent='';$('status').textContent='RECEIVING';draw();
  try{const ms=Number($('latency').value),name=$('track').value;const frames=[];record={track:name,frames};const value=await replay(name,{delay:()=>new Promise(resolve=>setTimeout(resolve,ms)),cancelled:()=>id!==ticket,onFrame:frame=>{if(id!==ticket)return;frames.push(frame);index=frames.length-1;$('scrub').max=index;draw();},onWait:i=>{if(id===ticket)$('status').textContent=`WAITING · interval ${i}`;}});
    if(id!==ticket)return;record=value;$('scrub').max=record.frames.length-1;controls(true);$('status').textContent=record.frames.at(-1).accepted?'READY':'MISSING DATA';index=record.frames.length-1;draw();
  }catch(e){if(id===ticket){$('status').textContent='FAILED';$('error').textContent=e.message;}}finally{busy(false);if(id===ticket)$('cancel').disabled=true;}}
$('calculate').onclick=calculate;
function cancel(){++ticket;pause();record=null;controls(false);$('cancel').disabled=true;$('status').textContent='CANCELLED';draw();}
$('cancel').onclick=cancel;$('track').onchange=()=>{cancel();$('status').textContent='SETUP CHANGED';};$('latency').onchange=()=>{cancel();$('status').textContent='SETUP CHANGED';};
$('cutMode').onchange=$('row').onchange=draw;$('scrub').oninput=()=>{pause();index=Number($('scrub').value);draw();};
$('reset').onclick=()=>{pause();index=0;draw();};$('step').onclick=()=>{pause();index=Math.min(index+1,record.frames.length-1);draw();};
function animate(now){if(!playing)return;if(now-last>=180){last=now;index++;if(index>=record.frames.length){index=record.frames.length-1;pause();}draw();}if(playing)raf=requestAnimationFrame(animate);}
$('play').onclick=()=>{if(playing){pause();return;}if(index===record.frames.length-1)index=0;playing=true;last=performance.now();$('play').textContent='Pause';raf=requestAnimationFrame(animate);};
$('save').onclick=()=>{const blob=new Blob([JSON.stringify(record)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='terrain-request-'+record.track+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('load').onchange=async()=>{const file=$('load').files[0];if(!file||receiving)return;busy(true);cancel();const id=ticket;$('error').textContent='';try{if(file.size>16*1024*1024)throw Error('Record exceeds 16 MiB');const value=await verifyReplay(JSON.parse(await file.text()));if(id!==ticket)return;record=value;index=0;$('track').value=record.track;$('scrub').max=record.frames.length-1;controls(true);$('status').textContent='VERIFIED';draw();}catch(e){if(id===ticket){$('status').textContent='REJECTED';$('error').textContent=e.message;}}finally{busy(false);$('load').value='';}};
new ResizeObserver(draw).observe($('rig'));new ResizeObserver(draw).observe($('cut'));
window.addEventListener('pagehide',()=>{pause();if(receiving)cancel();});window.addEventListener('pageshow',draw);
calculate();
