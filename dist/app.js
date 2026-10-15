import { serialize, sameScenario, G, DEFAULTS, MAX_RECORD_BYTES } from './physics.js';
import { Calculation } from './calculation.js';
import { FIELD_SCALES, setupFromFields, sceneBounds } from './ui-model.js';

const $ = id => document.getElementById(id);
const form = $('setup'), cyan = '#70e2ce', orange = '#f2b373', violet = '#c2a3ff';
const plotCache = new Map();
let run, pinned = null, bounds, frame = 0, playing = false, clock = 0, previous = 0;
let dirty = false, busy = false, failure = '';
const calculation = new Calculation({
  onBusy: value => { busy = value; controls(); },
  onResult: install,
  onError: message => { failure = message; $('error').textContent = message; draw(); }
});

function params() {
  return setupFromFields(Object.fromEntries(new FormData(form)), run?.params ?? DEFAULTS);
}
function fill(p) {
  for (const [key, scale] of Object.entries(FIELD_SCALES)) form.elements[key].value = p[key] * scale;
  form.elements.profile.value = p.profile;
}
function stop() {
  playing = false;
  $('play').textContent = 'Run';
}
function controls() {
  for (const element of form.elements) element.disabled = busy;
  for (const id of ['play','reset','step','pin','save','scrub','speed'])
    $(id).disabled = busy || dirty || !run;
  $('load').disabled = busy;
  $('cancel').disabled = !busy;
  $('discard').disabled = busy || !dirty || !run;
  $('clear').disabled = busy || !pinned;
  $('status').textContent = busy ? 'CALCULATING' : failure ? 'SETUP REJECTED'
    : dirty ? 'UNAPPLIED SETUP' : !run ? 'NO RUN' : playing ? 'PLAYING'
    : frame === run.signals.time.length - 1 ? 'COMPLETE' : frame ? 'PAUSED' : 'READY';
}
function comparison() {
  plotCache.clear();
  const compatible = pinned && run && sameScenario(run.params, pinned.params);
  for (const el of document.querySelectorAll('.legend .violet')) el.hidden = !compatible;
  if (!pinned) $('comparison').textContent = 'Pin this setup, then change mass, stiffness or damping to compare the same input.';
  else if (!compatible) $('comparison').textContent = 'Different excitation or solver settings. Reference hidden; restore the same scenario to compare.';
  else $('comparison').textContent = 'Pinned: ' + pinned.params.mass + ' kg · ' + pinned.params.stiffness / 1000
    + ' kN/m · ' + pinned.params.damping + ' N·s/m. Purple traces show the same input.';
}
function install(result, milliseconds) {
  run = result;
  Object.freeze(run.params);
  bounds = sceneBounds(run);
  frame = 0; clock = 0; dirty = false; failure = '';
  fill(run.params); stop();
  $('step').textContent = 'Step ' + run.params.sampleDt * 1000 + ' ms';
  $('solverInfo').textContent = 'Integration: ' + run.params.dt * 1000 + ' ms; recorded samples: '
    + run.params.sampleDt * 1000 + ' ms. Load events use integration endpoints. Scene automatically fits the full run.';
  $('scrub').max = run.signals.time.length - 1;
  $('compute').textContent = milliseconds.toFixed(1) + ' ms solve';
  $('error').textContent = '';
  $('warnings').textContent = run.warnings.join(' ');
  const m = run.metrics;
  $('metrics').replaceChildren();
  for (const [name, value] of [
    ['Peak load', m.peakForce.toFixed(0) + ' N'],
    ['Peak compression', (m.peakCompression * 1000).toFixed(1) + ' mm'],
    ['Without load', m.unloadedTime.toFixed(3) + ' s'],
    ['Energy residual', m.maxResidual.toExponential(2) + ' J']
  ]) {
    const div = document.createElement('div'), label = document.createElement('small'), valueElement = document.createElement('strong');
    label.textContent = name; valueElement.textContent = value;
    div.append(label, valueElement); $('metrics').append(div);
  }
  $('eventSummary').textContent = run.events.length + ' load transitions; event resolution '
    + run.params.dt * 1000 + ' ms. Peak load and energy residual use every integration endpoint.';
  document.querySelector('.evidence h2 span').textContent = 'FULL ' + run.params.duration + ' SECONDS';
  comparison(); draw();
}
function beginJob() {
  stop(); failure = ''; $('error').textContent = '';
  const ticket = calculation.begin();
  draw();
  return ticket;
}
function calculate(p) {
  calculation.launch(beginJob(), { params: p });
}
function canvas(id) {
  const el=$(id), width=Math.max(1,el.clientWidth), height=Math.max(1,el.clientHeight), dpr=devicePixelRatio||1;
  if(el.width!==Math.round(width*dpr)||el.height!==Math.round(height*dpr)){el.width=Math.round(width*dpr);el.height=Math.round(height*dpr);}
  const c=el.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,width,height);
  return {c,w:width,h:height};
}
function line(c,x1,y1,x2,y2,color,width=1) { c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke(); }
function rig() {
  const {c,w,h}=canvas('rig'), p=run.params, s=run.signals;
  const scale=Math.min((h-70)/(bounds.top-bounds.bottom),w/(2*p.radius+1)), x=w*.5;
  const floor=h-28+bounds.bottom*scale, by=floor-s.platen[frame]*scale, y=floor-s.height[frame]*scale, r=p.radius*scale;
  c.font='10px system-ui';c.fillStyle='#839aa6';
  for(let yy=20;yy<h;yy+=30)line(c,0,yy,w,yy,'#1d3039');
  line(c,x-20,15,x-20,floor,'#49606c',3);line(c,x+20,15,x+20,floor,'#49606c',3);
  c.fillText('VERTICAL GUIDE',18,23);line(c,112,20,x-25,20,'#49606c');
  c.setLineDash([5,5]);c.strokeStyle='#81949e';c.lineWidth=1;c.beginPath();c.arc(x,y,r,0,2*Math.PI);c.stroke();c.setLineDash([]);
  c.save();c.beginPath();c.rect(0,0,w,Math.max(0,by));c.clip();
  c.strokeStyle='#374c57';c.lineWidth=Math.max(1,r*.08);c.beginPath();c.arc(x,y,r*.95,0,Math.PI*2);c.stroke();
  c.strokeStyle='#b4c6d0';c.lineWidth=2;c.beginPath();c.arc(x,y,r*.86,0,Math.PI*2);c.stroke();
  for(let a=0;a<12;a++){const angle=a*Math.PI/6;line(c,x,y,x+Math.cos(angle)*(r*.86),y+Math.sin(angle)*(r*.86),'#526c79');}
  c.restore();c.fillStyle='#22343f';c.fillRect(x-32,y-13,64,26);c.strokeStyle='#9bb5c3';c.strokeRect(x-32,y-13,64,26);c.fillStyle='#e2edf2';c.textAlign='center';c.fillText(p.mass+' kg',x,y+4);
  c.fillStyle='#314148';c.fillRect(20,by,w-40,12);line(c,20,by,w-20,by,orange,3);
  c.textAlign='left';c.fillStyle=orange;c.fillText('PROGRAMMABLE PLATEN',22,h-8);
  if(s.force[frame]>0){const len=Math.min(75,s.force[frame]/12+12);line(c,x+r+25,by,x+r+25,by-len,cyan,3);line(c,x+r+25,by-len,x+r+20,by-len+8,cyan,2);line(c,x+r+25,by-len,x+r+30,by-len+8,cyan,2);}
  c.fillStyle=s.force[frame]>0?cyan:orange;c.textAlign='right';c.fillText(s.force[frame]>0?'LOAD SUPPORTED':'NO NORMAL LOAD',w-18,23);
  c.textAlign='left';
}
function plot(id, forcePlot) {
  const {c,w,h}=canvas(id), s=run.signals, p=run.params, ref=pinned&&sameScenario(p,pinned.params)?pinned:null;
  const cached = plotCache.get(id);
  if (cached && cached.w === w && cached.h === h && cached.dpr === devicePixelRatio) {
    c.drawImage(cached.image, 0, 0, w, h);
    line(c,43+(w-53)*s.time[frame]/p.duration,13,43+(w-53)*s.time[frame]/p.duration,h-26,'#e5edf2');
    return;
  }
  const base=p.radius-p.mass*G/p.stiffness;
  const values=[{a:forcePlot?s.force:s.height,offset:forcePlot?0:base,scale:forcePlot?1:1000,color:cyan}];
  if(!forcePlot)values.push({a:s.platen,offset:0,scale:1000,color:orange});
  if(ref)values.push({a:forcePlot?ref.signals.force:ref.signals.height,offset:forcePlot?0:ref.params.radius-ref.params.mass*G/ref.params.stiffness,scale:forcePlot?1:1000,color:violet});
  let lo=0,hi=forcePlot?1:5;
  for(const v of values)for(let i=0;i<v.a.length;i++){const q=(v.a[i]-v.offset)*v.scale;lo=Math.min(lo,q);hi=Math.max(hi,q);}
  const pad=(hi-lo)*.12;lo-=pad;hi+=pad;
  const left=43,right=w-10,top=13,bottom=h-26,px=t=>left+(right-left)*t/p.duration,py=q=>bottom-(bottom-top)*(q-lo)/(hi-lo);
  c.font='9px system-ui';c.fillStyle='#91a5b1';c.textAlign='right';
  for(let i=0;i<4;i++){const q=lo+(hi-lo)*i/3;line(c,left,py(q),right,py(q),'#293841');c.fillText(q.toFixed(0),left-6,py(q)+3);}
  c.textAlign='center';for(let t=0;t<=p.duration+.0001;t+=p.duration/4)c.fillText(t.toFixed(p.duration<1?3:1)+'s',px(t),h-7);
  for(const v of values){c.beginPath();c.strokeStyle=v.color;c.lineWidth=1.6;if(v.color===violet)c.setLineDash([4,3]);for(let i=0;i<v.a.length;i++){const x=px(s.time[i]),y=py((v.a[i]-v.offset)*v.scale);if(i)c.lineTo(x,y);else c.moveTo(x,y);}c.stroke();c.setLineDash([]);}
  const image = document.createElement('canvas');
  image.width = c.canvas.width; image.height = c.canvas.height;
  image.getContext('2d').drawImage(c.canvas,0,0);
  plotCache.set(id, { image, w, h, dpr: devicePixelRatio });
  line(c,px(s.time[frame]),top,px(s.time[frame]),bottom,'#e5edf2',1);
}
function draw() {
  controls();
  if (!run) return;
  const renderStart = performance.now();
  rig(); plot('motion', false); plot('loads', true);
  $('force').textContent = run.signals.force[frame].toFixed(0) + ' N';
  $('compression').textContent = (run.signals.compression[frame] * 1000).toFixed(2) + ' mm';
  $('time').textContent = run.signals.time[frame].toFixed(3) + ' s';
  $('scrub').value = frame;
  $('rendercost').textContent = (performance.now() - renderStart).toFixed(1) + ' ms draw';
}
form.addEventListener('submit', event => {
  event.preventDefault();
  if (busy) return;
  try { calculate(params()); } catch (error) { failure = error.message; $('error').textContent = error.message; draw(); }
});
form.addEventListener('input', () => {
  stop(); dirty = true; failure = ''; $('error').textContent = ''; draw();
});
$('cancel').onclick = () => {
  calculation.cancel(); $('error').textContent = 'Calculation cancelled; previous run retained.'; draw();
};
$('discard').onclick = () => {
  fill(run.params); dirty = false; failure = ''; $('error').textContent = ''; draw();
};
$('play').onclick = () => {
  if (!run || busy || dirty) return;
  if (frame === run.signals.time.length - 1) { clock = 0; frame = 0; }
  playing = !playing; previous = performance.now();
  $('play').textContent = playing ? 'Pause' : 'Run'; draw();
};
$('reset').onclick = () => { stop(); clock = 0; frame = 0; draw(); };
$('step').onclick = () => {
  stop(); frame = Math.min(frame + 1, run.signals.time.length - 1);
  clock = run.signals.time[frame]; draw();
};
$('scrub').oninput = () => { stop(); frame = +$('scrub').value; clock = run.signals.time[frame]; draw(); };
$('pin').onclick = () => { pinned = run; comparison(); draw(); };
$('clear').onclick = () => { pinned = null; comparison(); draw(); };
$('save').onclick = () => {
  try {
    const url = URL.createObjectURL(new Blob([serialize(run)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'bikelab-wheel-run.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { $('error').textContent = error.message; }
};
$('load').onchange = async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file || busy) return;
  const ticket = beginJob();
  try {
    if (file.size > MAX_RECORD_BYTES) throw new Error('Run file exceeds 64 MiB.');
    const text = await file.text();
    calculation.launch(ticket, { text });
  } catch (error) { calculation.fail(ticket, error.message); }
};
function animate(now) {
  if (playing && run) {
    clock = Math.min(run.params.duration, clock + Math.max(0, now - previous) / 1000 * +$('speed').value);
    frame = Math.min(run.signals.time.length - 1, Math.floor(clock / run.params.sampleDt + 1e-8));
    if (clock >= run.params.duration) stop();
    draw();
  }
  previous = now;
  requestAnimationFrame(animate);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); draw(); } });
window.addEventListener('resize', () => { plotCache.clear(); draw(); });
fill(DEFAULTS);
calculate(params());
requestAnimationFrame(animate);
