import {readRecord} from './pressure-footprint.js';
const $=id=>document.getElementById(id);let worker=null,generation=0,current=null,timer=null;
function stop(){clearTimeout(timer);timer=null;generation++;worker?.terminate();worker=null;$('cancel').disabled=true;}
function clear(){current=null;$('cost').textContent='No completed cycle.';$('save').disabled=true;$('scrub').disabled=true;$('metrics').replaceChildren();$('position').textContent='No completed cycle.';for(const id of ['shape','curve']){const c=$(id);c.getContext('2d').clearRect(0,0,c.width,c.height);}}
function run(input){
 stop();clear();$('error').textContent='';$('status').textContent='CALCULATING 0/7';$('cost').textContent='Calculating all seven equilibria…';$('cancel').disabled=false;
 const id=generation,start=performance.now();try{worker=new Worker(new URL('./pressure-footprint-worker.js',import.meta.url),{type:'module'});}catch(e){fail(e.message);return;}
 function fail(message){if(id!==generation)return;stop();clear();$('status').textContent='REFUSED';$('error').textContent=message;}
 timer=setTimeout(()=>fail('Calculation exceeded the 60 second limit; no partial solution accepted.'),60000);
 worker.onerror=e=>fail(e.message);
 worker.onmessage=({data})=>{if(id!==generation||data.id!==id)return;if(data.type==='progress')$('status').textContent=`CALCULATING ${data.count}/7`;else if(data.type==='error')fail(data.message);else if(data.type==='complete'){current=data.record;stop();$('status').textContent='COMPLETED';$('cost').textContent=`Complete cycle: ${((performance.now()-start)/1000).toFixed(2)} s including worker startup and transfer.`;$('save').disabled=false;$('scrub').disabled=false;$('scrub').value=0;draw();}};
 worker.postMessage({id,input});
}
$('setup').onsubmit=e=>{e.preventDefault();run({pressure:Number($('pressure').value)});};
$('pressure').onchange=()=>{stop();clear();$('status').textContent='READY';$('cost').textContent='Setup changed; calculate a new cycle.';};
$('cancel').onclick=()=>{stop();clear();$('status').textContent='CANCELLED';$('cost').textContent='Calculation cancelled; no partial solution accepted.';};
$('scrub').oninput=draw;
$('save').onclick=()=>{if(!current)return;const u=URL.createObjectURL(new Blob([JSON.stringify(current,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='pressure-footprint.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
$('load').onchange=async()=>{const file=$('load').files[0];if(!file)return;stop();clear();const id=generation;try{if(file.size>1000000)throw Error('Record exceeds 1 MB limit.');const input=readRecord(JSON.parse(await file.text()));if(id!==generation)return;$('pressure').value=String(input.pressure);run(input);}catch(e){if(id!==generation)return;$('status').textContent='REFUSED';$('error').textContent=e.message;}finally{$('load').value='';}};
function draw(){
 if(!current)return;const index=Number($('scrub').value),s=current.states[index];$('position').textContent=`${index+1}/7 · ${s.branch} · ${(s.lowering*1000).toFixed(0)} mm prescribed lowering`;
 const values=[['REACTION',s.reaction.toFixed(2)+' N'],['GAUGE PRESSURE',(s.pressure/1e5).toFixed(4)+' bar'],['VOLUME',(s.volume*1000).toFixed(4)+' L'],['VERTEX SPAN',(s.footprint*1000).toFixed(2)+' mm'],['RIM CLEARANCE',(s.rimClearance*1000).toFixed(2)+' mm']];
 $('metrics').replaceChildren(...values.map(([k,v])=>{const d=document.createElement('div'),a=document.createElement('small'),b=document.createElement('strong');a.textContent=k;b.textContent=v;d.append(a,b);return d;}));
 const c=$('shape'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);const x=v=>450+v*3000,y=v=>350-(v+s.height)*3000;
 ctx.strokeStyle='#526779';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,350);ctx.lineTo(900,350);ctx.stroke();ctx.strokeStyle='#4edbd6';ctx.beginPath();for(let i=0;i<s.coordinates.length;i+=2){const px=x(s.coordinates[i]),py=y(s.coordinates[i+1]);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.stroke();ctx.fillStyle='#f5a462';for(const p of s.contacts){ctx.beginPath();ctx.arc(x(p.x),350,4,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#b6c4ce';ctx.font='16px sans-serif';ctx.fillText('Lower profile · orange dots: active contact vertices',24,28);
 const p=$('curve'),g=p.getContext('2d'),max=Math.max(1,...current.states.map(s=>s.reaction))*1.1,X=d=>70+d/.004*770,Y=f=>250-f/max*210;g.clearRect(0,0,p.width,p.height);g.strokeStyle='#526779';g.beginPath();g.moveTo(70,35);g.lineTo(70,250);g.lineTo(850,250);g.stroke();g.font='16px sans-serif';g.fillStyle='#b6c4ce';g.fillText('Reaction (N)',10,20);g.fillText('0',48,270);g.fillText('4 mm lowering',720,280);g.fillText(max.toFixed(0),12,45);
 for(const [a,b,color] of [[0,3,'#4edbd6'],[3,6,'#f5a462']]){g.strokeStyle=color;g.lineWidth=3;g.beginPath();for(let i=a;i<=b;i++){const z=current.states[i];if(i===a)g.moveTo(X(z.lowering),Y(z.reaction));else g.lineTo(X(z.lowering),Y(z.reaction));}g.stroke();}g.fillStyle='#ffffff';g.beginPath();g.arc(X(s.lowering),Y(s.reaction),6,0,Math.PI*2);g.fill();
}
