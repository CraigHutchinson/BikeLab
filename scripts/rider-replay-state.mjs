// Read-only setup snapshot for cross-runtime diagnosis, not a record format.
import {validate,modelXML,run} from '../dist/trail-bike.js';
import {compileRiderTargets} from '../dist/rider-targets.js';
import {compilePassiveRider} from '../dist/rider-passive.js';
import {getRuntime} from '../dist/moving-wheel.js';

export async function inspectRiderReplay(input){
 const a=validate(input);
 if(!a.riderTargets)throw Error('Diagnostic requires a timed rider target scenario.');
 const passive=compilePassiveRider(a.articulated.passive);
 const targets=compileRiderTargets(a.riderTargets,a.articulated.passive,Math.round(a.motion.duration/a.motion.dt));
 const xml=modelXML(input),mj=await getRuntime();let model;
 const native={};
 try{
  model=mj.MjModel.from_xml_string(xml);
  for(const name of ['qpos0','body_pos','body_quat','body_mass','body_inertia','jnt_pos','jnt_axis','jnt_stiffness','qpos_spring','dof_damping','eq_data','tendon_lengthspring']){
   native[name]=Array.from(model[name]);
  }
 }finally{model?.delete();}
 return {xml,initialAngles:passive.laws.map(l=>l.angle0),targets:targets.commands,native,record:await run(input)};
}
