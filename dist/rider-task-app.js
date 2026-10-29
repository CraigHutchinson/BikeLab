import {compileRiderTask} from './rider-task.js';
import {constructPosture} from './rider-posture.js';
import {drawRiderPose} from './rider-pose-view.js';
const $=id=>document.getElementById(id);
const fields=['taskHipX','taskHipZ','taskPitch','taskTicks'].map($);
let report=null;
function invalidate(message){report=null;$('taskResult').hidden=true;$('saveTask').disabled=true;$('taskStatus').textContent=message;}
function draw(){
  if(!report)return;
  const frame=report.frames[Number($('taskScrub').value)],base=report.spec.passive.posture;
  drawRiderPose($('taskView'),constructPosture(base),constructPosture({...base,hip:frame.hip,trunkPitch:frame.trunkPitch}));
  $('taskTime').textContent=`Tick ${frame.tick} / ${report.spec.ticks} · ${frame.time.toFixed(2)} s target time`;
  $('taskHip').textContent=frame.hip.map(n=>n.toFixed(4)).join(' / ')+' m';
  $('taskCom').textContent=frame.com.map(n=>n.toFixed(4)).join(' / ')+' m';
  $('taskAngles').replaceChildren();
  report.jointOrder.forEach((name,i)=>{
    const row=document.createElement('tr');
    for(const value of [name,frame.jointAngles[i].toFixed(4),frame.relativeAngles[i].toFixed(4)]){
      const cell=document.createElement(row.children.length?'td':'th');if(!row.children.length)cell.scope='row';cell.textContent=value;row.append(cell);
    }
    $('taskAngles').append(row);
  });
}
function preview(){
  invalidate('Checking sampled targets');
  try{
    const [x,z,trunkPitch,ticks]=fields.map(field=>field.value.trim()?Number(field.value):NaN);
    report=compileRiderTask({goal:{hip:[x,z],trunkPitch},ticks,tickSeconds:.01});
    $('taskScrub').max=ticks;$('taskScrub').value=0;draw();
    $('taskResult').hidden=false;$('saveTask').disabled=false;
    $('taskStatus').textContent=`${report.frames.length} sampled targets admitted · dynamics not simulated`;
  }catch(error){invalidate(error.message);}
}
for(const field of fields)field.oninput=()=>invalidate('Unapplied task edits');
$('previewTask').onclick=preview;$('taskScrub').oninput=draw;
$('saveTask').onclick=()=>{
  if(!report)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(report.spec,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='bikelab-rider-task.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
preview();
