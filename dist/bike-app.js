import {DEFAULTS,GEOMETRY as g,validate,rigRecord,setupFromRecord} from './bike-rig.js';
import {Calculation} from './calculation.js';
const $=id=>document.getElementById(id),form=$('setup');
let run=null,index=0,playing=false,last=0,elapsed=0,frameRequest=0;
const controls=['play','reset','step','scrub','save'];
function stop(){playing=false;$('play').textContent='Play';cancelAnimationFrame(frameRequest);}
function invalidate(status='SETUP CHANGED'){stop();run=null;index=0;controls.forEach(id=>$(id).disabled=true);$('status').textContent=status;$('termination').textContent='';draw();}
function updateFields(){form.elements.shockStiffness.disabled=form.elements.shockDamping.disabled=form.elements.bike.value==='hardtail';form.elements.delay.disabled=form.elements.input.value!=='travelling';}
const calculation=new Calculation({
  createWorker:()=>new Worker(new URL('./bike-worker.js',import.meta.url),{type:'module'}),
  onBusy:busy=>{$('cancel').disabled=!busy;},
  onError:message=>{invalidate('SETUP REJECTED');$('error').textContent=message;},
  onResult:(result,ms)=>{run=result;index=0;controls.forEach(id=>$(id).disabled=false);$('scrub').max=run.signals.time.length-1;
    $('status').textContent=run.status==='complete'?'READY':'TRAVEL LIMIT';
    $('assembly').textContent=(run.params.bike==='full'?'Single-pivot full suspension':'Hardtail')+' · '+run.dofs+' coordinates';
    $('compute').textContent=`${Math.round(ms)} ms offline calculation`;
    $('termination').textContent=run.termination?`${run.termination.reason} at trial ${run.termination.trialTime.toFixed(6)} s. Replay ends at last valid ${run.termination.lastValidTime.toFixed(6)} s; no end-stop impact simulated.`:'';
    $('evidence').textContent=`${run.engine}. Initial front / rear loads ${run.initial.frontForce.toFixed(1)} / ${run.initial.rearForce.toFixed(1)} N. Peak integration-step load ${run.summary.peakForce.toFixed(1)} N. Maximum energy/work residual ${run.summary.maxResidual.toFixed(4)} J. Support work ${run.summary.work.toFixed(3)} J; dissipation ${run.summary.loss.toFixed(3)} J.`;
    draw();
  }
});
function params(){const p={...DEFAULTS};for(const key of Object.keys(p))if(form.elements[key]){const value=form.elements[key].value;if(!value.trim())throw new Error('Missing setup value: '+key);p[key]=['bike','input'].includes(key)?value:Number(value);}return validate(p);}
function submit(){invalidate('CALCULATING');$('error').textContent='';const ticket=calculation.begin();try{calculation.launch(ticket,{params:params()});}catch(e){calculation.fail(ticket,e.message);}}
form.addEventListener('submit',e=>{e.preventDefault();submit();});
form.addEventListener('input',()=>{calculation.cancel();invalidate();updateFields();});
$('cancel').onclick=()=>{calculation.cancel();invalidate('CANCELLED');$('error').textContent='Calculation cancelled. Change setup or calculate again.';};
$('reset').onclick=()=>{stop();index=0;draw();};
$('step').onclick=()=>{stop();index=Math.min(index+1,run.signals.time.length-1);draw();};
$('scrub').oninput=()=>{stop();index=Number($('scrub').value);draw();};
function animate(now){if(!playing||!run)return;elapsed+=(now-last)/1000*Number($('speed').value);last=now;
  while(index<run.signals.time.length-1&&run.signals.time[index+1]<=elapsed)index++;
  draw();if(index===run.signals.time.length-1)stop();else frameRequest=requestAnimationFrame(animate);
}
$('play').onclick=()=>{if(playing){stop();return;}if(index===run.signals.time.length-1)index=0;elapsed=run.signals.time[index];last=performance.now();playing=true;$('play').textContent='Pause';frameRequest=requestAnimationFrame(animate);};
$('save').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(rigRecord(run))],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='bikelab-'+run.params.bike+'-rig.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('load').onchange=async()=>{const file=$('load').files[0];if(!file)return;invalidate('LOADING');const ticket=calculation.begin();
  try{if(file.size>4_000_000)throw new Error('Run file exceeds 4 MB.');const record=JSON.parse(await file.text());if(ticket!==calculation.generation)return;
    const p=setupFromRecord(record);
    // The UI exposes all setup parameters except the fixed recording cadence.
    if(p.sampleDt!==DEFAULTS.sampleDt)throw new Error('This viewer requires a 5 ms recording interval.');
    for(const [key,value] of Object.entries(p))if(form.elements[key])form.elements[key].value=String(value);
    updateFields();$('error').textContent='';calculation.launch(ticket,{params:p});
  }catch(e){calculation.fail(ticket,e.message);}finally{$('load').value='';}
};
function context(id){const canvas=$(id),w=canvas.clientWidth,h=canvas.clientHeight;if(w<1||h<1)return null;const d=devicePixelRatio;
  if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);}const c=canvas.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);return {c,w,h};}
function scene(){const ctx=context('rig');if(!ctx)return;const {c,w,h}=ctx;c.font='11px system-ui';c.fillStyle='#9aabb7';if(!run){c.fillText('Calculate a setup to inspect the coupled bicycle.',18,30);return;}
  const s=run.signals,k=index,scale=Math.min(w/2.1,h/1.45),ox=w*.45,oy=h*.86;
  const point=(x,z)=>[ox+x*scale,oy-z*scale];
  const local=(x,z)=>point(Math.cos(s.pitch[k])*x+Math.sin(s.pitch[k])*z,s.heave[k]-Math.sin(s.pitch[k])*x+Math.cos(s.pitch[k])*z);
  function line(a,b,color,width=3){c.beginPath();c.moveTo(...a);c.lineTo(...b);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  const front=point(s.frontX[k],s.frontZ[k]),rear=point(s.rearX[k],s.rearZ[k]);
  for(const [x,z,base,force,color] of [[s.frontX[k],s.frontZ[k],s.frontBase[k],s.frontForce[k],'#70e2ce'],[s.rearX[k],s.rearZ[k],s.rearBase[k],s.rearForce[k],'#f2b373']]){
    const center=point(x,z);c.beginPath();c.arc(...center,g.radius*scale,0,2*Math.PI);c.strokeStyle=color;c.lineWidth=4;c.stroke();
    line(point(x-.38,base),point(x+.38,base),'#728b98',5);c.fillStyle=color;c.fillText(force.toFixed(0)+' N',point(x-.13,base-.09)[0],point(x,base-.09)[1]);
    line(center,point(x,z+.08),color,2);
  }
  const bb=local(-.12,-.15),seat=local(-.23,.18),head=local(g.frontX-.55*Math.cos(g.headAngle),g.axleZ+.55*Math.sin(g.headAngle)),pivot=local(0,g.pivotZ);
  line(bb,seat,'#e5edf2',5);line(seat,head,'#e5edf2',5);line(head,bb,'#e5edf2',5);line(bb,pivot,'#e5edf2',5);
  line(head,front,'#70e2ce',6);line(pivot,rear,'#f2b373',5);
  if(run.params.bike==='hardtail')line(seat,rear,'#f2b373',4);
  else {const a=s.rearAngle[k],x=Math.cos(a)*g.shockArmX+Math.sin(a)*g.shockArmZ,z=g.pivotZ-Math.sin(a)*g.shockArmX+Math.cos(a)*g.shockArmZ;line(pivot,local(x,z),'#f2b373',3);line(local(x,z),rear,'#f2b373',2);line(seat,local(g.shockFrameX,g.shockFrameZ),'#e5edf2',3);line(local(g.shockFrameX,g.shockFrameZ),local(x,z),'#c2a3ff',7);}
  const com=local(0,0);c.beginPath();c.arc(...com,8,0,Math.PI*2);c.fillStyle='#c2a3ff';c.fill();
  c.fillStyle='#9aabb7';c.fillText('Fixed rider + frame COM',16,22);c.fillText('Two prescribed flat platens',16,h-10);
}
function plot(id,keys,factor){const ctx=context(id);if(!ctx||!run)return;const {c,w,h}=ctx,s=run.signals,n=s.time.length;
  let hi=1;for(const key of keys)for(const v of s[key])hi=Math.max(hi,v*factor);hi*=1.1;
  const x=t=>36+(w-46)*t/run.params.duration,y=v=>h-22-(h-35)*v/hi;
  c.font='10px system-ui';c.fillStyle='#9aabb7';c.fillText(hi.toFixed(0),0,14);c.fillText('0',16,h-21);c.fillText(run.params.duration+' s',w-25,h-3);
  keys.forEach((key,j)=>{c.beginPath();for(let i=0;i<n;i++){const px=x(s.time[i]),py=y(s[key][i]*factor);if(i===0)c.moveTo(px,py);else c.lineTo(px,py);}c.strokeStyle=j?'#f2b373':'#70e2ce';c.lineWidth=1.5;c.stroke();});
  c.beginPath();c.moveTo(x(s.time[index]),8);c.lineTo(x(s.time[index]),h-22);c.strokeStyle='#e5edf2';c.lineWidth=1;c.stroke();
}
function draw(){scene();for(const id of ['loads','travel'])if(!run)context(id);if(!run){for(const id of ['pitch','fork','shock'])$(id).textContent='—';$('time').textContent='0.000 s';$('scrub').value=0;$('compute').textContent='';$('evidence').textContent='Calculate the current setup to create an experiment record.';return;}
  const s=run.signals;$('scrub').value=index;$('time').textContent=s.time[index].toFixed(3)+' s';$('pitch').textContent=(s.pitch[index]*180/Math.PI).toFixed(2)+'°';$('fork').textContent=(s.fork[index]*1000).toFixed(1)+' mm';$('shock').textContent=run.params.bike==='full'?(s.shock[index]*1000).toFixed(1)+' mm':'Rigid';
  plot('loads',['frontForce','rearForce'],1);plot('travel',['fork','shock'],1000);
}
const resize=new ResizeObserver(draw);for(const id of ['rig','loads','travel'])resize.observe($(id));
window.addEventListener('pagehide',()=>{stop();if(!$('cancel').disabled){calculation.cancel();invalidate('CANCELLED');}resize.disconnect();});
window.addEventListener('pageshow',()=>{for(const id of ['rig','loads','travel'])resize.observe($(id));draw();});
updateFields();submit();
