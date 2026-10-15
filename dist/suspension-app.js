import { DEFAULTS, PRESETS, element, serialize, sameScenario } from './suspension.js';
import { MAX_RECORD_BYTES } from './physics.js';
import { Calculation } from './calculation.js';
import { FIELD_SCALES, setupFromFields, frameAt } from './suspension-ui-model.js';

const $ = id => document.getElementById(id), form = $('setup');
const cyan = '#70e2ce', orange = '#f2b373', violet = '#c2a3ff', white = '#e5edf2';
let run, analytical = null, pinned = null, frame = 0, clock = 0, previous = 0, playing = false;
let dirty = false, busy = false, failure = '';
const cache = new Map(), plots = new Map();
const calculation = new Calculation({ onBusy: value => { busy = value; controls(); }, onResult: install,
  onError: message => { failure = message; $('error').textContent = message; draw(); } });

function fill(p) {
  for (const [key, scale] of Object.entries(FIELD_SCALES)) form.elements[key].value = p[key] * scale;
  form.elements.profile.value = p.profile;
}
function stop() { playing = false; $('play').textContent = 'Run'; }
function controls() {
  for (const el of form.elements) el.disabled = busy;
  for (const id of ['play','reset','step','pin','save','scrub','speed','referenceSetup']) $(id).disabled = busy || dirty || !run;
  // An immediate travel limit contains one inspectable sample but cannot play forward.
  if (run?.signals.time.length === 1) for (const id of ['play','step','scrub']) $(id).disabled = true;
  for (const id of ['load','forkPreset','shockPreset']) $(id).disabled = busy;
  $('cancel').disabled = !busy; $('discard').disabled = busy || !dirty || !run;
  $('clear').disabled = busy || !pinned;
  $('status').textContent = busy ? 'CALCULATING' : failure ? 'SETUP REJECTED' : dirty ? 'UNAPPLIED SETUP'
    : !run ? 'NO RUN' : playing ? 'PLAYING' : run.status === 'travel-limit' ? 'TRAVEL LIMIT'
    : frame === run.signals.time.length - 1 ? 'COMPLETE' : frame ? 'PAUSED' : 'READY';
}
function edited() { stop(); dirty = true; failure = ''; $('error').textContent = ''; draw(); }
function beginJob() {
  stop(); failure = ''; $('error').textContent = '';
  const ticket = calculation.begin(); draw(); return ticket;
}
function calculate(p) { calculation.launch(beginJob(), { station: 'suspension', params: p }); }
function install(result, milliseconds, reference) {
  analytical = reference;
  run = result; Object.freeze(run.params); frame = 0; clock = 0; dirty = false; failure = '';
  fill(run.params); stop();
  $('scrub').max = run.signals.time.length - 1;
  $('step').textContent = 'Step sample (' + run.params.sampleDt * 1000 + ' ms)';
  $('compute').textContent = milliseconds.toFixed(1) + ' ms solve';
  $('solverInfo').textContent = 'RK4: ' + run.params.dt * 1000 + ' ms; recording: ' + run.params.sampleDt * 1000
    + ' ms. Trial stages and endpoints must stay within stroke. Final valid endpoint is retained even off the recording grid.';
  $('error').textContent = ''; $('warnings').textContent = run.warnings.join(' ');
  $('window').textContent = '0–' + run.metrics.endTime.toFixed(3) + ' s OF ' + run.params.duration + ' s';
  const t = run.termination;
  $('termination').textContent = t ? t.type + ': attempted step ' + t.lastValidTime.toFixed(6) + '–'
    + t.attemptedTime.toFixed(6) + ' s left stroke. No impact or later motion is predicted.' : '';
  const m = run.metrics;
  $('metrics').replaceChildren();
  for (const [label, text] of [['Static sag', (1000*m.equilibriumCompression).toFixed(2)+' mm'],
    ['Peak compression', (1000*m.peakCompression).toFixed(2)+' mm'], ['Peak axial force', m.peakForce.toFixed(1)+' N'],
    ['Energy residual', m.maxResidual.toExponential(2)+' J']]) {
    const div=document.createElement('div'), small=document.createElement('small'), strong=document.createElement('strong');
    small.textContent=label; strong.textContent=text; div.append(small,strong); $('metrics').append(div);
  }
  referenceSummary(); comparison(); draw();
}
function referenceSummary() {
  const a = analytical;
  $('referenceResult').textContent = !a || a.status === 'unavailable' ? 'UNAVAILABLE FOR THIS SETUP'
    : a.status === 'pass' ? 'WITHIN NUMERICAL LIMITS' : 'EXCEEDS NUMERICAL LIMITS';
  $('referenceReason').textContent = a?.status === 'unavailable' ? a.reason
    : 'Independent closed form at ' + a.sampleCount + ' recorded times, 0–' + a.endTime + ' s. Limits: 0.001 mm, 0.0001 m/s, 0.1 N. Refine the integration step to compare accuracy.';
  $('referenceErrors').replaceChildren();
  if (a?.errors) for (const [key, label, scale, unit] of [['compression','Compression',1000,'mm'],
    ['compressionVelocity','Compression velocity',1,'m/s'],['force','Axial force',1,'N']]) {
    const cell = document.createElement('div'), title = document.createElement('small'), value = document.createElement('strong'), rms = document.createElement('small');
    title.textContent = label + ' · max error'; value.textContent = (a.errors[key].maxAbsolute * scale).toExponential(3) + ' ' + unit;
    rms.textContent = 'RMS ' + (a.errors[key].rms * scale).toExponential(3) + ' ' + unit;
    cell.append(title, value, rms); $('referenceErrors').append(cell);
  }
  for (const el of document.querySelectorAll('.referenceLegend')) el.hidden = !a?.signals;
}
function comparison() {
  const compatible = pinned && run && sameScenario(run.params, pinned.params);
  for (const el of document.querySelectorAll('.legend .violet')) el.hidden = !compatible;
  $('comparison').textContent = !pinned ? 'Pin a setup, then change spring, preload or damping under the same forcing and initial compression.'
    : !compatible ? 'Different forcing, initial state or solver settings. Reference hidden until these match.'
    : 'Pinned: '+pinned.params.stiffness/1000+' kN/m · '+pinned.params.preload+' N preload · damping '
      +pinned.params.compressionDamping+'/'+pinned.params.reboundDamping+' N·s/m. Traces end at each run’s last valid time.';
  rebuildPlots();
}
function rebuildPlots() {
  cache.clear(); plots.clear(); if (!run) return;
  const s=run.signals, p=run.params, ref=pinned&&sameScenario(p,pinned.params)?pinned:null;
  const motion=[{x:s.time,y:s.compression,scale:1000,color:cyan},
    {x:[0,run.metrics.endTime],y:[run.metrics.equilibriumCompression,run.metrics.equilibriumCompression],scale:1000,color:orange}];
  const loads=[{x:s.time,y:s.force,scale:1,color:cyan},{x:s.time,y:s.springForce,scale:1,color:orange}];
  if (analytical?.signals) {
    motion.push({x:analytical.signals.time,y:analytical.signals.compression,scale:1000,color:white});
    loads.push({x:analytical.signals.time,y:analytical.signals.force,scale:1,color:white});
  }
  if(ref) {
    motion.push({x:ref.signals.time,y:ref.signals.compression,scale:1000,color:violet});
    loads.push({x:ref.signals.time,y:ref.signals.force,scale:1,color:violet});
  }
  plots.set('motion',{series:motion,xmin:0,xmax:p.duration,time:true});
  plots.set('loads',{series:loads,xmin:0,xmax:p.duration,time:true});
  const q=new Float64Array(101), spring=new Float64Array(101), u=new Float64Array(101), damper=new Float64Array(101), out=new Float64Array(5);
  let speed=1; for(const v of s.compressionVelocity) speed=Math.max(speed,Math.abs(v));
  for(let i=0;i<=100;i++) {
    q[i]=p.travel*(i/100); element(p,q[i],0,out); spring[i]=out[0]; q[i]*=1000;
    u[i]=-speed+2*speed*i/100; element(p,0,u[i],out); damper[i]=out[1];
  }
  plots.set('springCurve',{series:[{x:q,y:spring,scale:1,color:cyan}],xmin:0,xmax:p.travel*1000});
  plots.set('damperCurve',{series:[{x:u,y:damper,scale:1,color:cyan}],xmin:-speed,xmax:speed});
}
function canvas(id) {
  const el=$(id), w=Math.max(1,el.clientWidth), h=Math.max(1,el.clientHeight), dpr=devicePixelRatio||1;
  if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)) {el.width=Math.round(w*dpr);el.height=Math.round(h*dpr);}
  const c=el.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,w,h); return {c,w,h,dpr};
}
function line(c,x1,y1,x2,y2,color,width=1) { c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke(); }
function rig() {
  const {c,w,h}=canvas('rig'), p=run.params, s=run.signals, q=s.compression[frame], b=s.base[frame];
  const scale=(h-140)/(p.travel+2*p.amplitude), x=w*.5;
  const top=40+p.amplitude*scale+(q-b)*scale, base=h-32-(p.amplitude+b)*scale;
  c.font='10px system-ui'; c.fillStyle='#9aabb7'; c.fillText('GUIDED CARRIAGE',14,20);
  for(const gx of [x-58,x+58]) line(c,gx,32,gx,h-42,'#49606c',2);
  c.fillStyle='#22343f';c.fillRect(x-68,top-12,136,24);c.strokeStyle='#9bb5c3';c.strokeRect(x-68,top-12,136,24);
  c.fillStyle='#e5edf2';c.textAlign='center';c.fillText(p.mass+' kg',x,top+4);
  const a=top+12,z=base-8,sx=x-28,dx=x+28;
  c.beginPath();c.moveTo(sx,a);c.lineTo(sx,a+8);
  for(let i=0;i<12;i++) c.lineTo(sx+(i%2?10:-10),a+12+(z-a-24)*i/11);
  c.lineTo(sx,z);c.lineTo(sx,base);c.strokeStyle=cyan;c.lineWidth=2;c.stroke();
  line(c,dx,a,dx,(a+z)/2,orange,3); c.strokeStyle=orange;c.lineWidth=2;c.strokeRect(dx-12,(a+z)/2-5,24,(z-a)/2);
  line(c,dx,z-5,dx,base,orange,2);
  line(c,18,base,w-18,base,'#9aabb7',4);
  c.fillStyle=orange;c.fillText('PRESCRIBED BASE',x,h-8);
  const gaugeX=w-28, gy=48, gh=h-105;
  line(c,gaugeX,gy,gaugeX,gy+gh,'#49606c',5);
  line(c,gaugeX-7,gy+gh*q/p.travel,gaugeX+7,gy+gh*q/p.travel,cyan,3);
  c.textAlign='right';c.fillStyle='#9aabb7';c.fillText('0',gaugeX-10,gy+3);c.fillText((p.travel*1000).toFixed(0)+' mm',gaugeX-10,gy+gh+14);
  c.textAlign='left';
}
function plot(id) {
  const {c,w,h,dpr}=canvas(id), data=plots.get(id);
  let item=cache.get(id);
  if(!item || item.w!==w || item.h!==h || item.dpr!==dpr) {
    let lo=0,hi=1;
    for(const v of data.series) for(const value of v.y) {lo=Math.min(lo,value*v.scale);hi=Math.max(hi,value*v.scale);}
    const pad=(hi-lo)*.1; lo-=pad;hi+=pad;
    const px=x=>48+(w-60)*(x-data.xmin)/(data.xmax-data.xmin), py=y=>h-26-(h-40)*(y-lo)/(hi-lo);
    c.font='9px system-ui';c.fillStyle='#9aabb7';c.textAlign='right';
    for(let i=0;i<4;i++){const y=lo+(hi-lo)*i/3;line(c,48,py(y),w-12,py(y),'#293841');c.fillText(y.toFixed(0),42,py(y)+3);}
    c.textAlign='center';
    for(let i=0;i<5;i++){const x=data.xmin+(data.xmax-data.xmin)*i/4;c.fillText(x.toFixed(data.xmax<1?3:1),px(x),h-7);}
    for(const v of data.series) {
      c.strokeStyle=v.color;c.fillStyle=v.color;c.lineWidth=1.6;c.setLineDash(v.color===violet?[4,3]:v.color===white?[2,4]:[]);c.beginPath();
      for(let i=0;i<v.y.length;i++){if(i)c.lineTo(px(v.x[i]),py(v.y[i]*v.scale));else c.moveTo(px(v.x[i]),py(v.y[i]*v.scale));}c.stroke();
      if(v.y.length===1){c.beginPath();c.arc(px(v.x[0]),py(v.y[0]*v.scale),3,0,2*Math.PI);c.fill();}
    }
    c.setLineDash([]);
    const image=document.createElement('canvas');image.width=c.canvas.width;image.height=c.canvas.height;image.getContext('2d').drawImage(c.canvas,0,0);
    item={image,w,h,dpr,px,py};cache.set(id,item);
  } else c.drawImage(item.image,0,0,w,h);
  if(data.time) line(c,item.px(run.signals.time[frame]),12,item.px(run.signals.time[frame]),h-26,'#e5edf2');
  else {
    const s=run.signals,x=id==='springCurve'?s.compression[frame]*1000:s.compressionVelocity[frame],y=id==='springCurve'?s.springForce[frame]:s.damperForce[frame];
    c.fillStyle=orange;c.beginPath();c.arc(item.px(x),item.py(y),4,0,2*Math.PI);c.fill();
  }
}
function draw() {
  controls(); if(!run) return;
  rig(); for(const id of plots.keys()) plot(id);
  $('force').textContent=run.signals.force[frame].toFixed(1)+' N';
  $('compression').textContent=(run.signals.compression[frame]*1000).toFixed(2)+' mm';
  $('time').textContent=run.signals.time[frame].toFixed(4)+' s'; $('scrub').value=frame;
}
form.addEventListener('input',edited);
form.addEventListener('submit',event=>{
  event.preventDefault();if(busy)return;
  try{calculate(setupFromFields(Object.fromEntries(new FormData(form)),run?.params??DEFAULTS));}
  catch(error){failure=error.message;$('error').textContent=error.message;draw();}
});
for(const key of ['fork','shock']) $(key+'Preset').onclick=()=>{fill(PRESETS[key]);edited();};
$('referenceSetup').onclick=()=>{if(!run||busy||dirty)return;calculate({...run.params,profile:'flat',reboundDamping:run.params.compressionDamping});};
$('discard').onclick=()=>{fill(run.params);dirty=false;failure='';$('error').textContent='';draw();};
$('cancel').onclick=()=>{calculation.cancel();$('error').textContent='Calculation cancelled; previous run retained.';draw();};
$('play').onclick=()=>{
  if(!run||busy||dirty)return;
  if(frame===run.signals.time.length-1){clock=0;frame=0;}
  playing=!playing;previous=performance.now();$('play').textContent=playing?'Pause':'Run';draw();
};
$('reset').onclick=()=>{stop();frame=0;clock=0;draw();};
$('step').onclick=()=>{stop();frame=Math.min(frame+1,run.signals.time.length-1);clock=run.signals.time[frame];draw();};
$('scrub').oninput=()=>{stop();frame=Number($('scrub').value);clock=run.signals.time[frame];draw();};
$('pin').onclick=()=>{pinned=run;comparison();draw();};
$('clear').onclick=()=>{pinned=null;comparison();draw();};
$('save').onclick=()=>{
  try {
    const url=URL.createObjectURL(new Blob([serialize(run)],{type:'application/json'})),link=document.createElement('a');
    link.href=url;link.download='bikelab-suspension-run.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  } catch(error){$('error').textContent=error.message;}
};
$('load').onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file||busy)return;
  const ticket=beginJob();
  try {if(file.size>MAX_RECORD_BYTES)throw new Error('Run file exceeds 64 MiB.');
    const text=await file.text();calculation.launch(ticket,{station:'suspension',text});
  } catch(error){calculation.fail(ticket,error.message);}
};
function animate(now) {
  if(playing&&run){clock=Math.min(run.metrics.endTime,clock+Math.max(0,now-previous)/1000*Number($('speed').value));
    frame=frameAt(run.signals.time,clock);if(clock>=run.metrics.endTime)stop();draw();}
  previous=now;requestAnimationFrame(animate);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();draw();}});
window.addEventListener('resize',()=>{cache.clear();draw();});
fill(DEFAULTS);calculate(DEFAULTS);requestAnimationFrame(animate);
