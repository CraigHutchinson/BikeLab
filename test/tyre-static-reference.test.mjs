import test from 'node:test';
import assert from 'node:assert/strict';
import {createStaticReference,publishedGeometryAudit,BUDGETS} from '../scripts/lib/tyre-static-reference.mjs';
const config=()=>({rimRadius:.311,rimWidth:.03,sectionRadius:.03,gaugePressure:160000,provenance:{kind:'illustrative',reference:'Static membrane receiving control; no calibrated tyre'}});
const near=(a,b,absolute=2e-13,relative=0)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=absolute+relative*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const simpson=(f,a,b,n)=>{let sum=f(a)+f(b);for(let i=1;i<n;i++)sum+=(i%2?4:2)*f(a+(b-a)*i/n);return sum*(b-a)/(3*n);};

test('unloaded dimensions close and zero deflection has no artificial load or footprint',()=>{
 const m=createStaticReference(config()),g=m.geometry(),s=m.solve(0);
 near(g.majorRadius-g.rimRadius,Math.sqrt(g.sectionRadius**2-(g.rimWidth/2)**2));
 near(g.outerRadius,g.rimRadius+g.height);near(g.contourLength,g.rimWidth+g.sectionRadius*(Math.PI+2*Math.acos(g.rimWidth/(2*g.sectionRadius))));
 assert.equal(s.stressLoad,0);assert.equal(s.footprintArea,0);assert.equal(s.thetaC,0);assert.equal(s.centre.footprintWidth,0);assert.equal(s.rootIterations,0);
});

test('deformed sidewall arcs meet the rim and floor without crossing and preserve contour length',()=>{
 for(const rimWidth of [.01,.03,.055]){
  const m=createStaticReference({...config(),rimWidth}),g=m.geometry();
  for(const fraction of [0,.01,.2,.5]){
   const s=m.section(fraction*g.height),points=[],N=4096;
   for(let k=0;k<=N;k++){const angle=-Math.PI/2+(s.phi+Math.PI/2)*k/N,x=s.footprintWidth/2+s.radius*Math.cos(angle),z=s.radius*(1+Math.sin(angle));points.push([x,z]);assert.ok(x>=-BUDGETS.geometry&&z>=-BUDGETS.geometry);if(z>s.height+BUDGETS.geometry)assert.ok(x>=rimWidth/2-BUDGETS.geometry);}
   near(points[0][0],s.footprintWidth/2);near(points[0][1],0);near(points.at(-1)[0],rimWidth/2);near(points.at(-1)[1],g.height*(1-fraction));
   let arc=0;for(let i=1;i<points.length;i++)arc+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
   near(rimWidth+2*arc+s.footprintWidth,g.contourLength,2e-8);near(s.heightResidual,0);near(s.contourResidual,0);
  }
  if(rimWidth===.03)assert.ok(m.section(g.maxDeflection).phi>Math.PI/2,'A valid branch must extend past a semicircular sidewall');
 }
});

test('constant pressure and geometric scaling keep force, area and the two approximation estimates distinct',()=>{
 const p=config(),m=createStaticReference(p),g=m.geometry(),a=m.solve(.2*g.height,{panels:256});
 const b=createStaticReference({...p,gaugePressure:2*p.gaugePressure}).solve(.2*g.height,{panels:256});
 near(b.stressLoad,2*a.stressLoad,1e-10);near(b.footprintArea,a.footprintArea,0);assert.deepEqual(b.centre,a.centre);
 const scale=1.1,c=createStaticReference({...p,rimRadius:p.rimRadius*scale,rimWidth:p.rimWidth*scale,sectionRadius:p.sectionRadius*scale}).solve(.2*g.height*scale,{panels:256});
 near(c.stressLoad,scale**2*a.stressLoad,1e-9);near(c.footprintArea,scale**2*a.footprintArea,1e-14);
 near(a.stressLoad/a.footprintLoad,g.rimRadius/g.outerRadius,1e-13);assert.ok(a.footprintLoad>a.stressLoad);
});

test('footprint integration in longitudinal coordinates independently agrees with angular quadrature',()=>{
 const m=createStaticReference(config()),g=m.geometry();
 for(const fraction of [.01,.2,.5]){
  const d=fraction*g.height,s=m.solve(d,{panels:512}),length=Math.sqrt(2*g.outerRadius*d-d*d);
  const area=2*simpson(x=>{
   if(x===length)return 0;
   const ratio=x/g.outerRadius,cos=Math.sqrt(1-ratio*ratio),compression=(d-g.outerRadius*ratio*ratio/(1+cos))/cos;
   return m.section(compression).footprintWidth;
  },0,length,1024);
  near(s.halfContactLength,length);near(s.footprintArea,area,1e-13,1e-9);
  near(s.stressLoad,config().gaugePressure*area*g.rimRadius/g.outerRadius,1e-8,1e-9);
 }
});

test('root and quadrature refinement retain the declared geometry and load accuracy',()=>{
 const m=createStaticReference(config()),g=m.geometry();
 for(const fraction of [.01,.2,.5]){
  const d=fraction*g.height,fine=m.solve(d,{panels:512,angleTolerance:2e-15}),rows=[32,64,128,256].map(panels=>m.solve(d,{panels}));
  for(const row of rows){near(row.maxHeightResidual,0);near(row.maxContourResidual,0);assert.ok(row.maxRootBracket<=row.angleTolerance);}
  near(rows[2].stressLoad,fine.stressLoad,BUDGETS.forceAbsolute,BUDGETS.quadratureRelative);
  near(rows.at(-1).stressLoad,fine.stressLoad,BUDGETS.forceAbsolute,BUDGETS.quadratureRelative);
  assert.ok(Math.abs(rows.at(-1).stressLoad-fine.stressLoad)<Math.abs(rows[0].stressLoad-fine.stressLoad));
  const tight=m.solve(d,{panels:256,angleTolerance:2e-15});near(tight.stressLoad,rows.at(-1).stressLoad,BUDGETS.forceAbsolute);
 }
});

test('small-load limit follows the independently integrated parabolic footprint with exponent three halves',()=>{
 const m=createStaticReference(config()),g=m.geometry(),errors=[];
 // Independently differentiate the local root solution, then integrate the
 // normalized limiting footprint 1-u² over [-1,1] (integral 4/3).
 const h=1e-7*g.height,widthSlope=(m.section(2*h).footprintWidth-m.section(h).footprintWidth)/h;
 near(widthSlope,g.widthSlope,2e-6);
 for(const fraction of [1e-3,1e-4,1e-5]){
  const d=fraction*g.height,s=m.solve(d,{panels:256}),ratio=s.footprintLoad/d**1.5/g.smallLoadFootprintCoefficient;errors.push(Math.abs(ratio-1));
  near(s.stressLoad/d**1.5/g.smallLoadStressCoefficient,ratio,1e-8);
 }
 assert.ok(errors[2]<errors[1]&&errors[1]<errors[0]);assert.ok(errors[2]<=BUDGETS.asymptoteRelative);
});

test('reference admission, ownership and exact repeat reject unsupported geometry without silent repair',()=>{
 const p=config(),m=createStaticReference(p),g=m.geometry(),a=m.solve(.006,{recordSections:true});p.provenance.kind='changed';a.sections[0].height=999;
 assert.notEqual(m.solve(.006,{recordSections:true}).sections[0].height,999);assert.deepEqual(m.solve(.006),m.solve(.006));
 const returned=m.configuration();returned.rimWidth=999;assert.notEqual(m.configuration().rimWidth,999);
 for(const bad of [{...config(),majorRadius:.34},{...config(),rimWidth:.061},{...config(),gaugePressure:NaN},{...config(),provenance:{kind:'source-derived'}}])assert.throws(()=>createStaticReference(bad));
 for(const d of [-.001,NaN,Infinity,g.maxDeflection+1e-8,Number.MIN_VALUE])assert.throws(()=>m.solve(d));
 for(const options of [{panels:31},{angleTolerance:0},{recordSections:1},{pressure:1}])assert.throws(()=>m.solve(.006,options));
 const tiny=100*2*g.sectionRadius*BUDGETS.angle;assert.ok(m.solve(tiny,{panels:16}).stressLoad>0);
 assert.throws(()=>m.solve(tiny,{panels:4096}),error=>error.code==='compression-resolution'&&error.context.panels===4096&&error.context.index>0&&error.context.localCompression>0);
});

test('the inconsistent published Figure4 tuple stays explicit and is not an exact reproduction',()=>{
 const a=publishedGeometryAudit();near(a.printed.majorRadius,.2968,0);near(a.derivedMajorRadius,.2951099008719339);assert.ok(a.majorRadiusResidual>.0016);assert.equal(a.exactFigureReproductionAvailable,false);
});
