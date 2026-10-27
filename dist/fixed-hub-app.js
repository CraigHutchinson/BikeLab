import {MODEL,validate,fromTrailRecord,inputFromRecord} from './fixed-hub.js';
const $=id=>document.getElementById(id);let worker=null,ticket=0,result=null,previous=null,source=null,loadedInput=null;
function stop(){worker?.terminate();worker=null;$('cancel').disabled=true;$('calculate').disabled=false;}
function invalidate(){ticket++;stop();}
function launch(input,id){
 if(id!==ticket)return;worker=new Worker(new URL('./fixed-hub-worker.js',import.meta.url),{type:'module'});
 worker.onmessage=e=>{if(id!==ticket)return;const m=e.data;if(m.progress){$('status').textContent=m.progress.phase;$('progress').value=m.progress.total?m.progress.step/m.progress.total:0;return;}
  stop();if(m.error){$('status').textContent='Failed';$('error').textContent=m.error;return;}
  previous=result&&result.identity===m.result.identity&&JSON.stringify(result.input.source)===JSON.stringify(m.result.input.source)&&JSON.stringify(result.input.motion)===JSON.stringify(m.result.input.motion)?result:null;
  result=m.result;$('status').textContent=result.status;$('progress').value=1;$('save').disabled=false;$('scrub').disabled=false;$('scrub').max=result.frames.length-1;$('scrub').value=result.frames.length-1;
  $('receipt').textContent='Source '+result.input.source.bike.bike+' / '+result.input.wheel+' / '+result.input.velocityMode+'. Geometry transfer error '+result.summary.geometryError.toExponential(2)+' m; maximum force/moment balance residual '+result.summary.maxBalance.toExponential(2)+'. '+(result.termination?'Stopped: '+result.termination.reason:'All '+result.summary.steps+' steps accepted.');draw();
 };
 worker.onerror=e=>{if(id!==ticket)return;e.preventDefault();stop();$('status').textContent='Failed';$('error').textContent=e.message;};
 worker.postMessage(input);
}
async function calculate(){
 invalidate();const id=ticket;$('cancel').disabled=false;$('calculate').disabled=true;$('error').textContent='';$('status').textContent='Preparing';$('progress').value=0;
 try{
  if(!source){const response=await fetch('./fixed-hub-'+$('bike').value+'.json');if(!response.ok)throw Error('Unable to load preserved state.');const s=await response.json();if(id!==ticket)return;source=s;}
  const input=loadedInput?structuredClone(loadedInput):{format:MODEL,source,wheel:$('wheel').value,velocityMode:$('velocityMode').value,motion:{duration:.02,dt:Number($('dt').value),sampleDt:.000125}};
  input.wheel=$('wheel').value;input.velocityMode=$('velocityMode').value;input.motion.dt=Number($('dt').value);launch(validate(input),id);
 }catch(e){if(id===ticket){stop();$('status').textContent='Failed';$('error').textContent=e.message;}}
}
function canvas(id){const c=$(id),r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=Math.max(1,Math.round(r.width*d));c.height=Math.max(1,Math.round(r.height*d));const g=c.getContext('2d');g.setTransform(d,0,0,d,0,0);return {g,w:r.width,h:r.height};}
function draw(){
 if(!result)return;const f=result.frames[Number($('scrub').value)],{g,w,h}=canvas('rig'),cx=result.hub[0],cz=result.hub[1],scale=Math.min(w,h)/.92,X=x=>w/2+(x-cx)*scale,Z=z=>h/2-(z-cz)*scale;
 const line=(points,color,width=2)=>{g.strokeStyle=color;g.lineWidth=width;g.beginPath();points.forEach((p,i)=>i?g.lineTo(X(p[0]),Z(p[1])):g.moveTo(X(p[0]),Z(p[1])));g.stroke();};
 line([[cx-1,result.input.source.profile.points[0][1]],[cx+1,result.input.source.profile.points[0][1]]],'#71848c',3);
 line([...f.nodes,f.nodes[0]],'#56d5cd',4);g.strokeStyle='#71848c';g.beginPath();g.arc(X(cx),Z(cz),result.input.source.wheel.rimRadius*scale,0,Math.PI*2);g.stroke();
 for(const c of f.contacts){line([c.point,[c.point[0]+c.force[0]*.0003,c.point[1]+c.force[1]*.0003]],'#f2b373',3);g.fillStyle='#f2b373';g.beginPath();g.arc(X(c.point[0]),Z(c.point[1]),3,0,Math.PI*2);g.fill();}
 line([[cx-.025,cz],[cx+.025,cz]],'#e5edf2');line([[cx,cz-.025],[cx,cz+.025]],'#e5edf2');
 $('time').textContent=(f.time*1000).toFixed(2)+' ms';$('speed').textContent=f.motion.rmsSpeed.toFixed(5)+' m/s';$('residual').textContent=f.residual.toExponential(2)+' J';
 $('forces').textContent='On casing: ground '+f.ground[0].toFixed(2)+' / '+f.ground[1].toFixed(2)+' N; fixture '+f.fixture[0].toFixed(2)+' / '+f.fixture[1].toFixed(2)+' N. Fixture moment '+f.fixture[2].toFixed(3)+' N m about hub. Nodal minus displayed-contact moment '+f.contactMomentDifference.toExponential(2)+' N m.';
 $('ledger').textContent='Energy '+f.energy.toFixed(5)+' J · viscous loss '+f.dampingLoss.toExponential(3)+' J · signed contact work '+f.contactWork.toExponential(3)+' J · fixture work 0 J.';
 const plot=canvas('history'),pg=plot.g,series=previous?[previous,result]:[result],max=Math.max(1e-8,...series.flatMap(r=>r.frames.map(x=>x.motion.rmsSpeed))),end=result.input.motion.duration;
 pg.fillStyle='#8ea5af';pg.font='12px sans-serif';pg.fillText(max.toFixed(4)+' m/s',8,15);pg.fillText('0',8,plot.h-12);pg.fillText((end*1000).toFixed(0)+' ms',plot.w-46,plot.h-12);
 for(const r of series){pg.strokeStyle=r===result?'#56d5cd':'#f2b373';pg.lineWidth=2;pg.beginPath();r.frames.forEach((v,i)=>{const x=48+v.time/end*(plot.w-62),y=24+(1-v.motion.rmsSpeed/max)*(plot.h-50);i?pg.lineTo(x,y):pg.moveTo(x,y);});pg.stroke();}
}
$('calculate').onclick=calculate;$('scrub').oninput=draw;window.addEventListener('resize',draw);
$('cancel').onclick=()=>{invalidate();$('status').textContent='Cancelled';};
for(const id of ['bike','wheel','velocityMode','dt'])$(id).onchange=()=>{invalidate();$('status').textContent='Settings changed — calculate to apply';if(id==='bike'){source=null;loadedInput=null;$('sourceInfo').textContent='Preserved accepted late-window state from the 10-second posture hold.';}};
$('save').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'}));a.href=url;a.download='fixed-hub-'+result.input.source.bike.bike+'-'+result.input.wheel+'-'+result.input.velocityMode+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('load').onchange=async()=>{const file=$('load').files[0];if(!file)return;invalidate();const id=ticket;$('cancel').disabled=false;$('calculate').disabled=true;$('status').textContent='Reading record';$('error').textContent='';
 try{const record=JSON.parse(await file.text());if(id!==ticket)return;const input=record.model===MODEL?inputFromRecord(record):fromTrailRecord(record,$('wheel').value,$('velocityMode').value);loadedInput=input;source=input.source;$('bike').value=source.bike.bike;$('wheel').value=input.wheel;$('velocityMode').value=input.velocityMode;$('dt').value=String(input.motion.dt);$('sourceInfo').textContent='Loaded: '+file.name;launch(input,id);}catch(e){if(id===ticket){stop();$('status').textContent='Failed';$('error').textContent=e.message;}}
 $('load').value='';
};
calculate();

