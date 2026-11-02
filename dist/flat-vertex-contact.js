// Explicitly versioned flat-only contact representation. It changes the native
// contact rows; never substitute it silently into legacy element-contact models.
export const FLAT_VERTEX_CONTACT='bikelab-flat-vertex-contact-0.1';
export function flatVertexGround(wheel,profile){
 if(!Array.isArray(profile?.points)||profile.points.length<2||!profile.points.every((p,i,a)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[1]===a[0][1]&&(!i||p[0]>a[i-1][0])))throw Error('Vertex-plane contact requires a finite flat profile.');
 if(!Number.isFinite(wheel?.contactTime)||wheel.contactTime<.0005||wheel.contactTime>.005||!Number.isFinite(wheel.contactImpedance)||wheel.contactImpedance<.95||wheel.contactImpedance>.999)throw Error('Unsupported vertex-plane contact parameters.');
 const z=profile.points[0][1],t=wheel.contactTime,d=wheel.contactImpedance;
 return {assets:'',geoms:`<geom name="ground1" type="plane" pos="0 0 ${z}" size="0 0 .1" condim="1" friction="0 0 0" solref="${t} 1" solimp="${d} ${d} .001"/>`};
}

// Model topology supplies only fixed, upward planes and noninterpolated casing
// vertices. Geometry/profile guards elsewhere retain the finite authored domain.
export function checkFlatVertexContacts(mj,m,d,flex,vertices){
 const contacts=d.contact;let count=0;
 try{for(let i=0;i<contacts.size();i++){const c=contacts.get(i);try{
  const side=c.flex[0]===flex?0:c.flex[1]===flex?1:-1;
  if(side<0||c.flex[1-side]>=0||c.elem[side]!==-1||c.vert[side]<0||c.vert[side]>=vertices||c.dim!==1)throw Error('Unsupported vertex-plane contact identity.');
  const geom=c.geom[1-side],sign=side?1:-1;
  if(!Number.isFinite(c.frame[0])||!Number.isFinite(c.frame[1])||!Number.isFinite(c.frame[2])||geom<0||m.geom_type[geom]!==mj.mjtGeom.mjGEOM_PLANE.value||Math.abs(c.frame[0])>1e-12||Math.abs(c.frame[1])>1e-12||Math.abs(sign*c.frame[2]-1)>1e-12)throw Error('Unsupported vertex-plane normal.');
  const gap=d.flexvert_xpos[3*(m.flex_vertadr[flex]+c.vert[side])+2]-m.flex_radius[flex]-d.geom_xpos[3*geom+2];
  if(!Number.isFinite(gap)||!Number.isFinite(c.dist)||Math.abs(c.dist-gap)>1e-10)throw Error('Vertex-plane gap mismatch.');
  if(c.efc_address>=0){const row=c.efc_address;if(d.efc_type[row]!==mj.mjtConstraint.mjCNSTR_CONTACT_FRICTIONLESS.value||!Number.isFinite(d.efc_force[row])||d.efc_force[row]<0)throw Error('Unsupported vertex-plane force.');}
  count++;
 }finally{c.delete();}}}finally{contacts.delete();}
 return count;
}
