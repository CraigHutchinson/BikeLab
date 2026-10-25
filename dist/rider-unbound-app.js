import {unboundExample} from './rider-unbound.js';

// Own this finite probe only. Trail playback/scenario and the pose preview are
// separate consumers; neither supplies a moving-bike state to this experiment.
const $ = id => document.getElementById(id);
let worker, revision = 0, accepted = null;
function stop() {revision++;worker?.terminate();worker = null;$('cancelUnbound').disabled = true;$('unboundPanel').setAttribute('aria-busy','false');}
function invalidate(message) {
  stop();accepted = null;$('unboundResult').hidden = true;$('saveUnbound').disabled = true;
  $('unboundStatus').textContent = message;$('unboundProgress').hidden = true;
}
function element(name, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg',name);
  for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,value);
  if (text !== undefined) node.textContent = text;$('unboundView').append(node);
}
function draw(record) {
  const frames = record.frames, first = frames[0], last = frames.at(-1);
  const points = frames.flatMap(f => f.segments.flatMap(s => [s.proximal,s.distal])).concat(frames.map(f => f.com));
  const xs = points.map(p => p[0]), zs = points.map(p => p[2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const scale = Math.min(285/Math.max(.1,maxX-minX),255/Math.max(.1,maxZ-minZ));
  const xy = p => [180+(p[0]-(minX+maxX)/2)*scale,170-(p[2]-(minZ+maxZ)/2)*scale];
  $('unboundView').replaceChildren();element('title',{},'Authored unbound rider: initial and last accepted skeleton, with recorded COM trajectory');
  for (const [f,color,dash] of [[first,'#899ba7','5 4'],[last,'#f2b373','none']]) for (const s of f.segments) {
    const [x1,y1] = xy(s.proximal), [x2,y2] = xy(s.distal);
    element('line',{x1,y1,x2,y2,stroke:color,'stroke-width':dash==='none'?4:2,'stroke-dasharray':dash,'stroke-linecap':'round'});
  }
  element('polyline',{points:frames.map(f=>xy(f.com).join(',')).join(' '),fill:'none',stroke:'#70e2ce','stroke-width':2});
  for(const f of frames) {const [cx,cy]=xy(f.com);element('circle',{cx,cy,r:3,fill:'#70e2ce'});}
  element('text',{x:12,y:20,fill:'#9aabb7','font-size':11},'x →  z ↑ · world · equal scale');
  element('line',{x1:12,y1:325,x2:12+.2*scale,y2:325,stroke:'#9aabb7'});
  element('text',{x:18+.2*scale,y:329,fill:'#9aabb7','font-size':11},'0.2 m');
}
function progress(p) {
  if (!['preparing','integrating','finalizing'].includes(p.phase) || !Number.isSafeInteger(p.totalSteps) || p.totalSteps<1 || !Number.isSafeInteger(p.acceptedSteps) || p.acceptedSteps<0 || p.acceptedSteps>p.totalSteps || !Number.isFinite(p.dt) || p.dt<=0) throw Error('Invalid unbound progress.');
  $('unboundProgress').hidden = false;
  if(p.phase==='preparing') $('unboundProgress').removeAttribute('value');else $('unboundProgress').value=p.acceptedSteps/p.totalSteps;
  $('unboundStatus').textContent = p.phase==='preparing' ? 'Preparing unbound rider…' : 'Calculating · '+p.acceptedSteps+' / '+p.totalSteps+' accepted steps · '+(p.acceptedSteps*p.dt).toFixed(5)+' s';
}
function render(record) {
  accepted = record;$('saveUnbound').disabled = false;
  const last = record.frames.at(-1), s=record.summary;
  $('unboundStatus').textContent = record.status==='completed' ? 'Complete · 0.02000 s authored free flight' : record.status==='terminated' ? 'Stopped at '+record.termination.time.toFixed(5)+' s · '+record.termination.reason+' · last accepted state retained' : 'Initial state rejected · '+record.termination.reason+' · no pose admitted';
  $('unboundProgress').hidden=false;$('unboundProgress').value=s.steps/Math.round(record.duration/record.spec.dt);
  $('unboundResult').hidden=!last;if(!last)return;
  draw(record);
  $('unboundTime').textContent=last.time.toFixed(5)+' s · '+s.steps+' accepted steps';
  $('unboundCOM').textContent=[0,2].map(k=>last.com[k].toFixed(5)).join(' / ')+' m';
  $('unboundEnergy').textContent=last.energyResidual.toExponential(3)+' J';
  $('unboundLoss').textContent=last.dampingLoss.toExponential(3)+' J';
  $('unboundLinear').textContent=[0,2].map(k=>last.momentumResidual[k].toExponential(3)).join(' / ')+' N s';
  $('unboundAngular').textContent=last.angularMomentumResidual[1].toExponential(3)+' N m s';
}
function calculate() {
  invalidate('Preparing unbound rider…');const ticket=revision;
  $('unboundPanel').setAttribute('aria-busy','true');$('cancelUnbound').disabled=false;
  $('unboundProgress').hidden=false;$('unboundProgress').removeAttribute('value');
  const fail=message=>{if(ticket!==revision)return;invalidate('Calculation failed · '+message);};
  try {
    const input=unboundExample($('unboundExample').value);input.dt=Number($('unboundDt').value);
    worker=new Worker(new URL('./rider-unbound-worker.js',import.meta.url),{type:'module'});
    worker.onerror=()=>fail('Unbound rider worker failed. Calculate again to retry.');
    worker.onmessage=event=>{
      if(ticket!==revision)return;
      if(event.data.error){fail(event.data.error);return;}
      try {
        if(event.data.progress){progress(event.data.progress);return;}
        stop();render(event.data.result);
      } catch(error) {invalidate('Calculation failed · '+error.message);}
    };
    worker.postMessage(input);
  } catch(error) {fail(error.message);}
}
$('calculateUnbound').onclick=calculate;
$('cancelUnbound').onclick=()=>invalidate('Cancelled · no new probe record retained');
for(const id of ['unboundExample','unboundDt'])$(id).onchange=()=>invalidate('Unapplied probe edits · calculate to inspect this launch');
$('saveUnbound').onclick=()=>{
  if(!accepted)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(accepted,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='bikelab-rider-unbound.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('pagehide',()=>{if(worker)invalidate('Cancelled · page left during calculation');});
invalidate('Select a launch and calculate the 0.02 s probe');
