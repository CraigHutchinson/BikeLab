import {REFERENCE_GEOMETRY,PHOTO_GEOMETRY,geometryFor} from '../dist/linkage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {rigLandmarks,FRAME_DRAWING as f} from '../dist/bike-geometry.js';
import {GEOMETRY as g,modelXML,validate,getRuntime} from '../dist/bike-rig.js';

test('frame drawing places BB below the axle datum with a plausible rear centre and finite head tube',()=>{
  const p=rigLandmarks({bike:'hardtail',pitch:0,heave:g.frameHeight,fork:0,rearAngle:0});
  assert.ok(Math.abs(p.bb[1]-(g.radius-.025))<1e-12);
  assert.ok(Math.abs(p.rear[1]-p.bb[1]-.025)<1e-12);
  assert.ok(Math.abs(Math.hypot(p.rear[0]-p.bb[0],p.rear[1]-p.bb[1])-Math.hypot(.45,.025))<1e-12);
  assert.ok(Math.abs(Math.hypot(p.headTop[0]-p.headBottom[0],p.headTop[1]-p.headBottom[1])-f.headTubeLength)<1e-12);
});

test('rendered suspension landmarks match native axle and shock attachment coordinates across poses',async()=>{
  const mj=await getRuntime();
  for(const bike of ['hardtail','full'])for(const setup of [REFERENCE_GEOMETRY,PHOTO_GEOMETRY,{...PHOTO_GEOMETRY,pivotX:.045}]) {
    const geometry=geometryFor(setup);
    const m=mj.MjModel.from_xml_string(modelXML(validate({bike,...setup}))),d=new mj.MjData(m);
    try {
      for(const [pitch,fork,rearAngle] of [[0,0,0],[.12,.08,.2],[-.15,.14,.35]]) {
        d.qpos[0]=-.03;d.qpos[1]=pitch;d.qpos[2]=fork;if(bike==='full')d.qpos[3]=rearAngle;mj.mj_forward(m,d);
        const p=rigLandmarks({geometry,bike,pitch,heave:g.frameHeight-.03,fork,rearAngle});
        for(const name of ['front','rear']){const id=mj.mj_name2id(m,mj.mjtObj.mjOBJ_BODY.value,name);assert.ok(Math.abs(p[name][0]-d.xipos[id*3])<1e-12);assert.ok(Math.abs(p[name][1]-d.xipos[id*3+2])<1e-12);}
        if(bike==='full')for(const name of ['shockFrame','shockArm']){const id=mj.mj_name2id(m,mj.mjtObj.mjOBJ_SITE.value,name);assert.ok(Math.abs(p[name][0]-d.site_xpos[id*3])<1e-12);assert.ok(Math.abs(p[name][1]-d.site_xpos[id*3+2])<1e-12);}
      }
    } finally {d.delete();m.delete();}
  }
});
