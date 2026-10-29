// Ordered geometric accounting only; no counterfactual dynamics or controller changes.
const finite=(v,label)=>{if(!Number.isFinite(v))throw Error('Invalid '+label);return v;};
const vector=(a,n,label)=>{if(!Array.isArray(a)||a.length!==n||!Array.from(a).every(Number.isFinite))throw Error('Invalid '+label);return a;};
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const step=(angle,length)=>[length*Math.sin(angle),length*Math.cos(angle)];
export function riderGeometryError(scenario,frame){
 const a=frame.active,p=scenario.articulated.passive.posture,target=scenario.riderTargets?.commands[a?.targetCommand];
 if(!target)throw Error('Geometry accounting needs a timed rider target.');
 const actual=vector(a.angles,4,'actual angles'),desired=vector(a.targetAngles,4,'target angles'),hip=vector(a.actualHip,2,'actual hip'),goal=vector(target.hip,2,'target hip');
 const trunk=finite(a.actualTrunkPitch,'trunk pitch'),goalTrunk=finite(target.trunkPitch,'target trunk'),pose=vector(frame.frame,3,'frame pose'),c=Math.cos(pose[2]),s=Math.sin(pose[2]);
 const rotate=v=>[c*v[0]-s*v[2],s*v[0]+c*v[2]];
 const local=v=>rotate([v[0]-pose[0],v[1],v[2]-pose[1]]);
 const lengths={};for(const name of ['trunk','thighs','shanksFeet','upperArms','forearmsHands']){lengths[name]=finite(p.segments[name]?.length,'segment length');if(lengths[name]<=0)throw Error('Invalid segment length.');}
 const offset=(name,q,t)=>name==='foot'?add(step(t+q[0],lengths.thighs),step(t+q[0]+q[1],lengths.shanksFeet)):
  add(step(t,lengths.trunk),add(step(t+q[2],lengths.upperArms),step(t+q[2]+q[3],lengths.forearmsHands)));
 const attachments=frame.articulated?.interfaces?.attachments;
 if(!Array.isArray(attachments)||attachments.length!==2)throw Error('Expected both retained attachments.');
 const chains={};
 for(const name of ['foot','hand']){
  const found=attachments.filter(x=>x.name===name);if(found.length!==1||found[0].active!==true)throw Error('Missing or inactive '+name+' attachment.');
  const attachment=found[0],bike=vector(attachment.bike,3,'bike anchor'),rider=vector(attachment.rider,3,'rider endpoint'),anchor=vector(p[name],2,'authored anchor');
  const atTarget=sub(anchor,offset(name,desired,goalTrunk)),atJoints=sub(anchor,offset(name,actual,goalTrunk)),atActual=sub(anchor,offset(name,actual,trunk));
  const terms={jointTracking:sub(atJoints,atTarget),trunkTracking:sub(atActual,atJoints),attachmentGap:rotate(sub(rider,bike)),anchorOffset:sub(local(bike),anchor),targetClosure:sub(atTarget,goal),reconstructionResidual:sub(hip,sub(local(rider),offset(name,actual,trunk)))};
  chains[name]={...terms,sum:Object.values(terms).reduce(add,[0,0])};
 }
 return {hipError:sub(hip,goal),chains};
}
