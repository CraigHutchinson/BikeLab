import './geometry-reference-app.js';
import {GEOMETRY_KEYS,PHOTO_GEOMETRY,REFERENCE_GEOMETRY,geometryLabel,linkageDiagnostics} from './linkage.js';
import {DEFAULTS,GEOMETRY as g,validate,rigRecord,setupFromRecord} from './bike-rig.js';
import {rigLandmarks} from './bike-geometry.js';
import {Calculation} from './calculation.js';
const $=id=>document.getElementById(id),form=$('setup');
let run=null,index=0,playing=false,last=0,elapsed=0,frameRequest=0,diagnostics=null;
const canvases=['rig','loads','travel','riderTravelPlot','riderForcePlot','bufferForcePlot','bufferEnergyPlot','shockBufferForcePlot','shockBufferEnergyPlot','linkagePlot'];
const controls=['play','reset','step','scrub','save'];
function stop(){playing=false;$('play').textContent='Play';cancelAnimationFrame(frameRequest);}
function invalidate(status='SETUP CHANGED'){stop();run=null;index=0;controls.forEach(id=>$(id).disabled=true);$('status').textContent=status;$('termination').textContent='';$('assembly').textContent='Coupled bicycle';draw();}
function updateFields(){for(const key of GEOMETRY_KEYS)form.elements[key].disabled=form.elements.bike.value==='hardtail';form.elements.shockBuffer.disabled=form.elements.bike.value==='hardtail';for(const key of ['shockBufferWidth','shockBufferStiffness','shockBufferDamping'])form.elements[key].disabled=form.elements.bike.value==='hardtail'||form.elements.shockBuffer.value==='none';for(const key of ['forkBufferWidth','forkBufferStiffness','forkBufferDamping'])form.elements[key].disabled=form.elements.forkBuffer.value==='none';form.elements.shockStiffness.disabled=form.elements.shockDamping.disabled=form.elements.bike.value==='hardtail';form.elements.delay.disabled=form.elements.input.value!=='travelling';for(const key of ['riderMass','riderStiffness','riderDamping','riderTravel'])form.elements[key].disabled=form.elements.rider.value==='fixed';}
const calculation=new Calculation({
  createWorker:()=>new Worker(new URL('./bike-worker.js',import.meta.url),{type:'module'}),
  onBusy:busy=>{$('cancel').disabled=!busy;},
  onError:message=>{invalidate('SETUP REJECTED');$('error').textContent=message;},
  onResult:(result,ms)=>{run=result;diagnostics=linkageDiagnostics(run);index=0;controls.forEach(id=>$(id).disabled=false);$('scrub').max=run.signals.time.length-1;
    $('status').textContent=run.status==='complete'?'READY':'TRAVEL LIMIT';
    $('assembly').textContent=(run.params.bike==='full'?'Single-pivot full suspension':'Hardtail')+' · '+run.dofs+' coordinates · '+(run.params.rider==='compliant'?'passive rider':'fixed rider');
    $('compute').textContent=`${Math.round(ms)} ms offline calculation`;
    $('termination').textContent=run.termination?`${run.termination.reason} at trial ${run.termination.trialTime.toFixed(6)} s. Replay ends at last valid ${run.termination.lastValidTime.toFixed(6)} s; ultimate domain exceeded; no rigid impact or damage continuation.`:'';
    $('evidence').textContent=`${run.engine}. Initial front / rear loads ${run.initial.frontForce.toFixed(1)} / ${run.initial.rearForce.toFixed(1)} N. Peak integration-step load ${run.summary.peakForce.toFixed(1)} N. Maximum energy/work residual ${run.summary.maxResidual.toFixed(4)} J. Support work ${run.summary.work.toFixed(3)} J; dissipation ${run.summary.loss.toFixed(3)} J (rider ${run.summary.riderLoss.toFixed(3)} J, fork buffers ${run.summary.bufferLoss.toFixed(3)} J, shock buffers ${run.summary.shockBufferLoss.toFixed(3)} J). Peak top / bottom buffer force ${run.summary.peakTopForce.toFixed(1)} / ${run.summary.peakBottomForce.toFixed(1)} N. Shock top / bottom ${run.summary.peakShockTopForce.toFixed(1)} / ${run.summary.peakShockBottomForce.toFixed(1)} N.`;
    draw();
  }
});
function params(){const p={...DEFAULTS};for(const key of Object.keys(p))if(form.elements[key]){const value=form.elements[key].value;if(!value.trim())throw new Error('Missing setup value: '+key);p[key]=['bike','input','rider','forkBuffer','shockBuffer'].includes(key)?value:Number(value);}return validate(p);}
function submit(){invalidate('CALCULATING');$('error').textContent='';const ticket=calculation.begin();try{calculation.launch(ticket,{params:params()});}catch(e){calculation.fail(ticket,e.message);}}
form.addEventListener('submit',e=>{e.preventDefault();submit();});
form.addEventListener('input',()=>{calculation.cancel();invalidate();updateFields();});
function bufferExample(stiffness){calculation.cancel();const p={...DEFAULTS,bike:'hardtail',forkBuffer:'progressive',forkStiffness:stiffness,forkDamping:200,amplitude:.08,bumpDuration:.2};for(const [key,value] of Object.entries(p))if(form.elements[key])form.elements[key].value=String(value);updateFields();submit();}
$('bufferExample').onclick=()=>bufferExample(9000);$('bottomBufferExample').onclick=()=>bufferExample(4000);
function shockExample(stiffness){calculation.cancel();const p={...DEFAULTS,bike:'full',forkBuffer:'progressive',shockBuffer:'progressive',shockStiffness:stiffness,shockDamping:900,...REFERENCE_GEOMETRY,input:'rear',amplitude:.08,bumpDuration:.2};for(const [key,value] of Object.entries(p))if(form.elements[key])form.elements[key].value=String(value);updateFields();submit();}
$('shockTopExample').onclick=()=>shockExample(70000);$('shockBottomExample').onclick=()=>shockExample(30000);
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
    for(const option of form.elements.dt.querySelectorAll('[data-imported]'))option.remove();
    if(!Array.from(form.elements.dt.options).some(option=>option.value===String(p.dt))){const option=new Option((p.dt*1000)+' ms',String(p.dt));option.dataset.imported='true';form.elements.dt.add(option);}
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
  const landmarks=rigLandmarks({geometry:run.geometry,bike:run.params.bike,pitch:s.pitch[k],heave:s.heave[k],fork:s.fork[k],rearAngle:s.rearAngle[k]});
  const {bb,seat,headBottom,headTop,pivot,shockFrame,shockArm}=Object.fromEntries(Object.entries(landmarks).map(([name,p])=>[name,point(...p)]));
  line(bb,seat,'#e5edf2',5);line(seat,headTop,'#e5edf2',5);line(headBottom,bb,'#e5edf2',5);line(headBottom,headTop,'#e5edf2',7);
  line(headBottom,front,Math.abs(s.forkBufferForce[k])>1e-6?'#f2b373':'#70e2ce',6);
  if(run.params.bike==='hardtail'){line(bb,rear,'#f2b373',5);line(seat,rear,'#f2b373',4);}
  else {
    line(bb,pivot,'#e5edf2',4);line(pivot,rear,'#f2b373',5);line(pivot,shockArm,'#f2b373',3);line(shockArm,rear,'#f2b373',3);
    // Frame eye is welded to the front frame; arm eye rotates with the actual swingarm.
    const vx=headBottom[0]-bb[0],vy=headBottom[1]-bb[1],t=Math.max(0,Math.min(1,((shockFrame[0]-bb[0])*vx+(shockFrame[1]-bb[1])*vy)/(vx*vx+vy*vy)));line([bb[0]+t*vx,bb[1]+t*vy],shockFrame,'#e5edf2',4);line(shockFrame,shockArm,Math.abs(s.shockBufferForce[k])>1e-6?'#f2b373':'#c2a3ff',7);
    c.fillStyle='#c2a3ff';c.fillText('Shock',(shockFrame[0]+shockArm[0])/2-12,(shockFrame[1]+shockArm[1])/2-10);c.fillStyle='#9aabb7';c.fillText('Pivot',pivot[0]+7,pivot[1]+10);
    for(const p of [pivot,shockFrame,shockArm]){c.beginPath();c.arc(...p,3,0,2*Math.PI);c.fillStyle='#e5edf2';c.fill();}
  }
  c.beginPath();c.arc(...bb,6,0,Math.PI*2);c.fillStyle='#10191f';c.fill();c.strokeStyle='#e5edf2';c.lineWidth=2;c.stroke();
  c.fillStyle='#e5edf2';c.fillText('BB',bb[0]+9,bb[1]+12);
  const com=local(0,0),passive=run.params.rider==='compliant';
  if(passive){
    line(local(0,-run.params.riderTravel),local(0,run.params.riderTravel),'#526a7c',2);
    for(const z of [-run.params.riderTravel,run.params.riderTravel])line(local(-.035,z),local(.035,z),'#c2a3ff',2);
    line(com,point(s.riderX[k],s.riderZ[k]),'#c2a3ff',5);
    c.beginPath();c.arc(...com,4,0,Math.PI*2);c.fillStyle='#e5edf2';c.fill();
  }
  c.beginPath();c.arc(...point(s.riderX[k],s.riderZ[k]),8,0,Math.PI*2);c.fillStyle='#c2a3ff';c.fill();
  c.fillStyle='#9aabb7';c.fillText(passive?'Passive rider COM · frame guide':'Fixed rider + frame COM',16,22);c.fillText('Two prescribed flat platens',16,h-10);
}
function plot(id,keys,factor){const ctx=context(id);if(!ctx||!run)return;const {c,w,h}=ctx,s=run.signals,n=s.time.length;
  if(id.startsWith('shockBuffer')&&(run.params.bike==='hardtail'||run.params.shockBuffer==='none')){c.font='11px system-ui';c.fillStyle='#9aabb7';c.fillText(run.params.bike==='hardtail'?'Hardtail has no shock.':'Enable shock buffers to resolve this channel.',8,28);return;}
  if(id.startsWith('buffer')&&run.params.forkBuffer==='none'){c.font='11px system-ui';c.fillStyle='#9aabb7';c.fillText('Enable fork buffers to resolve this channel.',8,28);return;}
  if(id.startsWith('rider')&&run.params.rider==='fixed'){c.font='11px system-ui';c.fillStyle='#9aabb7';c.fillText('Select passive rider to resolve this channel.',8,28);return;}
  let hi=1,lo=0;for(const key of keys)for(const v of s[key]){hi=Math.max(hi,v*factor);lo=Math.min(lo,v*factor);}hi*=1.1;lo*=1.1;
  const x=t=>36+(w-46)*t/run.params.duration,y=v=>h-22-(h-35)*(v-lo)/(hi-lo);
  c.font='10px system-ui';c.fillStyle='#9aabb7';c.fillText(hi.toFixed(0),0,14);c.fillText(lo.toFixed(0),0,h-21);c.fillText(run.params.duration+' s',w-25,h-3);
  keys.forEach((key,j)=>{c.beginPath();for(let i=0;i<n;i++){const px=x(s.time[i]),py=y(s[key][i]*factor);if(i===0)c.moveTo(px,py);else c.lineTo(px,py);}c.strokeStyle=id.startsWith('rider')?'#c2a3ff':j?'#f2b373':'#70e2ce';c.lineWidth=1.5;c.stroke();});
  c.beginPath();c.moveTo(x(s.time[index]),8);c.lineTo(x(s.time[index]),h-22);c.strokeStyle='#e5edf2';c.lineWidth=1;c.stroke();
}
function draw(){scene();drawConfiguration();for(const id of canvases.slice(1))if(!run)context(id);if(!run){for(const id of ['pitch','fork','shock','riderCompression','riderForce','bufferForce','bufferState','shockBufferForce','shockBufferState','shockMoment','shockTotal'])$(id).textContent='—';$('time').textContent='0.000 s';$('scrub').value=0;$('compute').textContent='';$('evidence').textContent='Calculate the current setup to create an experiment record.';return;}
  const s=run.signals;$('scrub').value=index;$('time').textContent=s.time[index].toFixed(3)+' s';$('pitch').textContent=(s.pitch[index]*180/Math.PI).toFixed(2)+'°';$('fork').textContent=(s.fork[index]*1000).toFixed(1)+' mm';$('shock').textContent=run.params.bike==='full'?(s.shock[index]*1000).toFixed(1)+' mm':'Rigid';
  $('riderCompression').textContent=run.params.rider==='compliant'?(s.riderCompression[index]*1000).toFixed(1)+' mm':'Fixed';
  $('riderForce').textContent=run.params.rider==='compliant'?s.riderForce[index].toFixed(1)+' N':'Not resolved';
  $('bufferForce').textContent=run.params.forkBuffer==='none'?'Disabled':s.forkBufferForce[index].toFixed(1)+' N';
  $('bufferState').textContent=run.params.forkBuffer==='none'?'No buffers':s.forkTopForce[index]>0?'Top-out':s.forkBottomForce[index]>0?'Bottom-out':'Free travel';
  $('shockBufferForce').textContent=run.params.bike==='hardtail'?'No shock':run.params.shockBuffer==='none'?'Disabled':s.shockBufferForce[index].toFixed(1)+' N';
  $('shockBufferState').textContent=run.params.bike==='hardtail'?'Rigid':run.params.shockBuffer==='none'?'No buffers':s.shockTopForce[index]>0?'Top-out':s.shockBottomForce[index]>0?'Bottom-out':'Free travel';
  $('shockMoment').textContent=run.params.bike==='hardtail'?'No shock':s.shockBufferMoment[index].toFixed(1)+' N·m';
  $('shockTotal').textContent=run.params.bike==='hardtail'?'No shock':s.shockTotalForce[index].toFixed(1)+' N';
  plot('shockBufferForcePlot',['shockBufferForce'],1);plot('shockBufferEnergyPlot',['shockBufferEnergy','shockBufferDissipation'],1);
  plot('bufferForcePlot',['forkBufferForce'],1);plot('bufferEnergyPlot',['forkBufferEnergy','forkBufferDissipation'],1);
  plot('riderTravelPlot',['riderCompression'],1000);plot('riderForcePlot',['riderForce'],1);
  plot('loads',['frontForce','rearForce'],1);plot('travel',['fork','shock'],1000);
}
const resize=new ResizeObserver(draw);for(const id of canvases)resize.observe($(id));
window.addEventListener('pagehide',()=>{stop();if(!$('cancel').disabled){calculation.cancel();invalidate('CANCELLED');}resize.disconnect();});
window.addEventListener('pageshow',()=>{for(const id of canvases)resize.observe($(id));draw();});
for(const key of GEOMETRY_KEYS)form.elements[key].value=String(DEFAULTS[key]);
updateFields();submit();

function drawConfiguration(){
  const ctx=context('linkagePlot');
  if(!run){$('geometryName').textContent='No calculated setup';$('configuration').textContent='Calculate to inspect sag, load split and linkage behaviour.';return;}
  const d=diagnostics;$('geometryName').textContent=d.label;
  $('configuration').textContent=`Settled front / rear load ${d.frontLoad.toFixed(1)} / ${d.rearLoad.toFixed(1)} N (${(100*d.frontShare).toFixed(1)}% front). Fork sag ${(1000*d.forkSag).toFixed(1)} mm (${(100*d.forkSagFraction).toFixed(1)}%). `+(d.shockSag===null?'Hardtail: rear geometry controls are dormant.':`Shock sag ${(1000*d.shockSag).toFixed(1)} mm (${(100*d.shockSagFraction).toFixed(1)}%). Eye length ${(1000*d.eyeLength).toFixed(1)} mm; stroke ${(1000*run.geometry.shockTravel).toFixed(1)} mm. Derived vertical rear travel ${(1000*d.rearTravel).toFixed(1)} mm. At sag: ds/dθ = ${d.jacobian.toFixed(4)} m/rad; vertical wheel/shock ratio = ${d.verticalRatio.toFixed(3)}.`);
  if(!ctx)return;const {c,w,h}=ctx;c.font='11px system-ui';c.fillStyle='#9aabb7';
  if(!d.curve.length){c.fillText('Rigid rear assembly · no shock linkage.',12,28);return;}
  const hi=Math.max(...d.curve.map(p=>p.ratio))*1.1,x=s=>38+(w-54)*s/run.geometry.shockTravel,y=r=>h-28-(h-48)*r/hi;
  c.fillText(hi.toFixed(2)+' ratio',4,15);c.fillText((run.geometry.shockTravel*1000).toFixed(0)+' mm shock',w-95,h-5);
  c.beginPath();d.curve.forEach((p,i)=>i?c.lineTo(x(p.compression),y(p.ratio)):c.moveTo(x(p.compression),y(p.ratio)));c.strokeStyle='#70e2ce';c.lineWidth=2;c.stroke();
  c.beginPath();c.moveTo(x(run.signals.shock[index]),20);c.lineTo(x(run.signals.shock[index]),h-25);c.strokeStyle='#c2a3ff';c.stroke();
}
function geometryPreset(p){calculation.cancel();for(const key of GEOMETRY_KEYS)form.elements[key].value=String(p[key]);updateFields();submit();}
$('annotatedGeometry').onclick=()=>geometryPreset(PHOTO_GEOMETRY);
$('referenceGeometry').onclick=()=>geometryPreset(REFERENCE_GEOMETRY);
