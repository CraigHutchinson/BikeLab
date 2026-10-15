import { DEFAULTS, validate } from './solver-config.js';
import { G } from './physics.js';
import { Calculation } from './calculation.js';
const $=id=>document.getElementById(id), form=$('setup');
let run=null, index=0, busy=false, dirty=false, playing=false, lastFrame=0, replayTime=0;
function controls() {
  const ready=!!run&&!busy&&!dirty;
  for(const id of ['play','step','reset','scrub','save'])$(id).disabled=!ready;
  $('cancel').disabled=!busy;
  form.querySelector('button[type="submit"]').disabled=busy;
  for(const id of ['release','equilibrium'])$(id).disabled=busy;
}
function stop() { playing=false;$('play').textContent='Play'; }
function edits() {
  job.cancel();stop();dirty=true;$('status').textContent='UNAPPLIED EDITS';
  $('verdict').textContent='Previous result retained below. Apply the edited setup to compare it.';controls();
}
function populate(p) { for(const key of Object.keys(DEFAULTS))form.elements[key].value=p[key]; }
function read() { return validate(Object.fromEntries(Object.keys(DEFAULTS).map(key=>[key,form.elements[key].value.trim()?Number(form.elements[key].value):NaN]))); }
function reject(message) { stop();dirty=true;$('status').textContent='SETUP REJECTED';$('error').textContent=message;controls(); }
const job=new Calculation({createWorker:()=>new Worker(new URL('./solver-worker.js',import.meta.url),{type:'module'}),
  onBusy:value=>{busy=value;controls();},onError:reject,onResult:value=>{
    run=value;dirty=false;index=0;replayTime=0;stop();$('scrub').max=run.sampleCount-1;$('scrub').value=0;
    $('error').textContent='';$('status').textContent=run.status==='pass'?'WITHIN TRIAL LIMITS':'EXCEEDS TRIAL LIMITS';
    $('verdict').textContent=run.termination || (run.status==='pass'?'All implemented gates pass for this setup.':'One or more implemented gates failed. The original limits remain unchanged.');
    const rows=$('errors');rows.replaceChildren();
    for(const [key,label,scale,unit] of [['compression','Compression',1e6,'µm'],['compressionVelocity','Velocity',1e3,'mm/s'],['force','Reconstructed force',1,'N']]) {
      const e=run.errors[key],row=document.createElement('tr');
      for(const text of [label,(e.maxAbsolute*scale).toPrecision(4)+' '+unit,(e.rms*scale).toPrecision(4)+' '+unit,(e.limit*scale).toPrecision(3)+' '+unit]) {
        const cell=document.createElement('td');cell.textContent=text;row.append(cell);
      }
      if(e.maxAbsolute>e.limit)row.className='exceeds';rows.append(row);
    }
    $('closure').textContent=(run.closure.maxTranslation*1e6).toPrecision(3)+' µm / '+(run.closure.maxRotation*1e6).toPrecision(3)+' µrad';
    $('restart').textContent=run.checks.restart?'Exact in this run':'DIVERGED / INCOMPLETE';
    $('trialDetails').textContent='Rapier '+run.engine.bindingVersion+' · core '+run.engine.coreVersion+' · '+run.engine.precision+' · '+run.completedTicks+' steps · '+run.sampleCount+' samples. Snapshot at '+run.restart.time.toFixed(3)+' s; '+run.restart.comparedSteps+' subsequent states compared.';
    controls();draw();
  }});
function apply() {
  stop();
  try { const p=read();dirty=true;$('error').textContent='';$('status').textContent='CALCULATING';$('verdict').textContent='Calculating a new trial; previous metrics below are retained.';job.launch(job.begin(),{params:p}); }
  catch(error) { reject(error.message); }
}
form.addEventListener('input',edits);form.addEventListener('submit',event=>{event.preventDefault();apply();});
$('cancel').onclick=()=>{job.cancel();reject('Calculation cancelled. Restore the applied setup or run again.');};
$('discard').onclick=()=>{job.cancel();populate(run?.params??DEFAULTS);apply();};
$('release').onclick=()=>{populate(DEFAULTS);apply();};
$('equilibrium').onclick=()=>{populate({...DEFAULTS,tiltDegrees:0,initialCompression:(DEFAULTS.mass*G-DEFAULTS.preload)/DEFAULTS.stiffness});apply();};
$('play').onclick=()=>{playing=!playing;if(playing&&index===run.sampleCount-1){index=0;replayTime=0;}lastFrame=0;$('play').textContent=playing?'Pause':'Play';};
function seek(next) { index=next;replayTime=run.signals.time[index];$('scrub').value=index;draw(); }
$('step').onclick=()=>{stop();seek(Math.min(index+1,run.sampleCount-1));};
$('reset').onclick=()=>{stop();seek(0);};
$('scrub').oninput=()=>{stop();seek(Number($('scrub').value));};
$('save').onclick=()=>{
  const report={...run,signals:Object.fromEntries(Object.entries(run.signals).map(([k,v])=>[k,Array.from(v)]))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='bikelab-solver-trial.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function canvas(id) {
  const c=$(id),w=c.clientWidth,h=c.clientHeight;if(w<80||h<80)return null;
  const dpr=devicePixelRatio||1;c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);const ctx=c.getContext('2d');ctx.scale(dpr,dpr);return {ctx,w,h};
}
function drawRig() {
  const box=canvas('rig');if(!box)return;const {ctx:c,w,h}=box,p=run.params,s=run.signals;
  const angle=p.tiltDegrees*Math.PI/180,dx=Math.sin(angle),dz=-Math.cos(angle);
  const scale=Math.min((h-90)/p.travel,(w-100)/p.travel),ox=w/2-dx*p.travel*scale/2,oy=35;
  const point=(x,z)=>[ox+x*scale,oy-z*scale];
  c.strokeStyle='#42545e';c.lineWidth=8;c.beginPath();c.moveTo(...point(0,0));c.lineTo(...point(dx*p.travel,dz*p.travel));c.stroke();
  c.fillStyle='#70838d';c.fillRect(ox-28,oy-7,56,10);
  const [x,y]=point(s.x[index],s.z[index]),[rx,ry]=point(dx*s.referenceCompression[index],dz*s.referenceCompression[index]);
  c.strokeStyle='#e5edf2';c.lineWidth=2;c.setLineDash([3,4]);c.strokeRect(rx-24,ry-14,48,28);c.setLineDash([]);
  c.fillStyle='#12343d';c.fillRect(x-20,y-10,40,20);c.strokeStyle='#6ee7e0';c.strokeRect(x-20,y-10,40,20);
  c.fillStyle='#a6b8c2';c.font='11px system-ui';c.fillText('FIXED SUPPORT',15,20);c.fillText('q = '+(s.compression[index]*1000).toFixed(2)+' mm',15,h-20);
  if(p.transverseForce!==0) {
    const sign=Math.sign(p.transverseForce),ax=Math.cos(angle)*sign,ay=-Math.sin(angle)*sign,ex=x+ax*55,ey=y+ay*55;
    c.strokeStyle='#ffb36b';c.lineWidth=2;c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.moveTo(ex-ax*8-ay*4,ey-ay*8+ax*4);c.lineTo(ex,ey);c.lineTo(ex-ax*8+ay*4,ey-ay*8-ax*4);c.stroke();
  }
}
function plot(id,error=false) {
  const box=canvas(id);if(!box)return;const {ctx:c,w,h}=box,s=run.signals,n=run.sampleCount;
  const value=(i,ref)=>error?(s.compression[i]-s.referenceCompression[i])*1e6:(ref?s.referenceCompression[i]:s.compression[i])*1000;
  let lo=0,hi=0;for(let i=0;i<n;i++){lo=Math.min(lo,value(i,false),error?0:value(i,true));hi=Math.max(hi,value(i,false),error?0:value(i,true));}
  if(hi-lo<1e-6){lo-=.5;hi+=.5;}const padding=(hi-lo)*.1;lo-=padding;hi+=padding;
  const x=i=>48+i*(w-60)/Math.max(1,n-1),y=v=>16+(hi-v)*(h-43)/(hi-lo);
  c.font='10px system-ui';c.strokeStyle='#293b46';c.fillStyle='#9eb2be';
  for(let j=0;j<3;j++){const v=lo+(hi-lo)*j/2;c.beginPath();c.moveTo(48,y(v));c.lineTo(w-12,y(v));c.stroke();c.fillText(v.toFixed(Math.abs(hi-lo)<1?3:1),1,y(v)+3);}
  for(const ref of error?[false]:[false,true]) {
    c.strokeStyle=error?'#ffb36b':ref?'#e5edf2':'#6ee7e0';c.setLineDash(ref?[3,4]:[]);c.lineWidth=1.6;c.beginPath();
    for(let i=0;i<n;i++){if(i)c.lineTo(x(i),y(value(i,ref)));else c.moveTo(x(i),y(value(i,ref)));}c.stroke();
  }
  c.setLineDash([]);c.strokeStyle='#8c9aa3';c.beginPath();c.moveTo(x(index),12);c.lineTo(x(index),h-25);c.stroke();
  c.fillStyle='#9eb2be';c.fillText('0 s',48,h-6);c.fillText(s.time[n-1].toFixed(2)+' s',w-50,h-6);
}
function draw() {
  if(!run)return;drawRig();plot('motionPlot');plot('errorPlot',true);
  $('compression').textContent=(run.signals.compression[index]*1000).toFixed(3)+' mm';
  $('time').textContent=run.signals.time[index].toFixed(3)+' s';
  $('positionError').textContent=((run.signals.compression[index]-run.signals.referenceCompression[index])*1e6).toFixed(2)+' µm';
}
function frame(now) {
  if(playing&&run&&!dirty&&!busy){if(lastFrame)replayTime+=Math.min(now-lastFrame,100)*.00025;lastFrame=now;
    index=Math.min(run.sampleCount-1,Math.floor(replayTime/run.effectiveSampleDt));$('scrub').value=index;draw();if(index===run.sampleCount-1)stop();}
  requestAnimationFrame(frame);
}
const observer=new ResizeObserver(draw);for(const id of ['rig','motionPlot','errorPlot'])observer.observe($(id));
window.addEventListener('pagehide',()=>{const interrupted=busy;job.cancel();stop();observer.disconnect();if(interrupted)reject('Calculation cancelled during navigation. Run again.');});
window.addEventListener('pageshow',()=>{for(const id of ['rig','motionPlot','errorPlot'])observer.observe($(id));draw();});
populate(DEFAULTS);apply();requestAnimationFrame(frame);
