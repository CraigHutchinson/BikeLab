import {geometryFor,shockLength} from './linkage.js';
import {validateChassis} from './bike-chassis.js';
// Shared physical tree. Spatial wheels replace, rather than add to, lumped axle mass.
export function bikeAssembly(p,spatial=null,articulated=null){
 if(articulated)return bikeChassisAssembly(p,spatial,articulated.chassis,articulated.parts.sites+articulated.parts.body);
 // Compatibility path: keep the historical fixed/guided mass partition and
 // exact arithmetic. These combined masses are not a riderless-bike fallback.
 const g=geometryFor(p),compliant=p.rider==='compliant',frameMass=compliant?p.mass-p.riderMass:p.mass;
 const frameInertia=g.frameInertia*frameMass/p.mass,riderInertia=g.frameInertia*p.riderMass/p.mass;
 const frameInertial=`<inertial pos="0 0 0" mass="${frameMass}" diaginertia="${frameInertia} ${frameInertia} ${frameInertia}"/>`;
 const rider=compliant?`<body name="rider"><joint name="riderSlide" type="slide" axis="0 0 1" springref="0" stiffness="${p.riderStiffness}" damping="${p.riderDamping}"/><inertial pos="0 0 0" mass="${p.riderMass}" diaginertia="${riderInertia} ${riderInertia} ${riderInertia}"/></body>`:'';
 return assemblyTree(p,spatial,g,frameInertial,rider);
}

// Internal native-tree builder. p is validated geometry/suspension input;
// spatial/frameContents are trusted generated fragments. No rider is implied.
export function bikeChassisAssembly(p,spatial,chassis,frameContents=''){
 for(const key of ['mass','com','inertia']){
  const d=chassis&&Object.getOwnPropertyDescriptor(chassis,key);
  if(!d?.enumerable||!Object.hasOwn(d,'value')||d.value===undefined)throw Error('Explicit chassis requires '+key+'.');
 }
 if(!['full','hardtail'].includes(p.bike))throw Error('Unsupported chassis bike kind.');
 if(typeof frameContents!=='string')throw Error('Frame contents must be generated native text.');
 const c=validateChassis(chassis),g=geometryFor(p);
 const frameInertial=`<inertial pos="${c.com[0]} 0 ${c.com[1]}" mass="${c.mass}" diaginertia="${c.inertia.join(' ')}"/>`;
 return assemblyTree(p,spatial,g,frameInertial,frameContents);
}

function assemblyTree(p,spatial,g,frameInertial,rider){
 const rearMass=spatial?.rearMass??g.rearMass,rearI=spatial?.rearInertia??.13;
 const rear=p.bike==='full'?`<body name="rear" pos="${g.pivotX} 0 ${g.pivotZ}"><joint name="swing" type="hinge" axis="0 1 0"/><inertial pos="${g.armX} 0 ${g.armZ}" mass="${rearMass}" diaginertia="${rearI} ${rearI} ${rearI}"/><site name="shockArm" pos="${g.shockArmX} 0 ${g.shockArmZ}"/>${spatial?.rear??''}</body>`:`<body name="rear" pos="${g.rearX} 0 ${g.axleZ}"><inertial pos="0 0 0" mass="${rearMass}" diaginertia="${rearI} ${rearI} ${rearI}"/>${spatial?.rear??''}</body>`;
 const frontMass=spatial?.frontMass??g.wheelMass,frontI=spatial?.frontInertia??.1;
 return {body:`<body name="frame" pos="0 0 ${g.frameHeight}">${spatial?'<joint name="travel" type="slide" axis="1 0 0"/>':''}<joint name="heave" type="slide" axis="0 0 1"/><joint name="pitch" type="hinge" axis="0 1 0"/>${frameInertial}<site name="shockFrame" pos="${g.shockFrameX} 0 ${g.shockFrameZ}"/><body name="front" pos="${g.frontX} 0 ${g.axleZ}"><joint name="fork" type="slide" axis="${-Math.cos(g.headAngle)} 0 ${Math.sin(g.headAngle)}" stiffness="${p.forkStiffness}" damping="${p.forkDamping}"/><inertial pos="0 0 0" mass="${frontMass}" diaginertia="${frontI} ${frontI} ${frontI}"/>${spatial?.front??''}</body>${rear}${rider}</body>`,tendon:p.bike==='full'?`<tendon><spatial name="shock" stiffness="${p.shockStiffness}" damping="${p.shockDamping}" springlength="${shockLength(0,g)}"><site site="shockFrame"/><site site="shockArm"/></spatial></tendon>`:''};
}
