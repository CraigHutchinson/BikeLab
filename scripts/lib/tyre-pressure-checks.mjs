// Independent quadrature and finite differences for the prescribed chamber.
export const FIXTURE={referenceVolume:.007,ambientPressure:101325,initialGaugePressure:160000,exponent:1.2,minVolumeFraction:.5,sectionRadius:.03,arcLengths:[.02,.03,.04],provenance:{kind:'illustrative',reference:'Prescribed chamber control; no measured tyre'}};
const require=(ok,message)=>{if(!ok)throw Error(message);};
const near=(a,b,abs=1e-9,rel=0)=>require(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=abs+rel*Math.max(Math.abs(a),Math.abs(b)),a+' != '+b);
const simpson=(f,a,b,n=1024)=>{let s=f(a)+f(b);for(let i=1;i<n;i++)s+=(i%2?4:2)*f(a+(b-a)*i/n);return s*(b-a)/(3*n);};
const clone=x=>JSON.parse(JSON.stringify(x));
const expectThrow=(f,code)=>{let error;try{f();}catch(e){error=e;}require(error instanceof Error,'Expected rejection');if(code)require(error.code===code,'Wrong rejection code: '+error.code);};
export function pressureChecks(api){
 const {createPressureChamber,circularSegment}=api,configuration=()=>clone(FIXTURE);
 return [
  {name:'circular geometry matches independent quadrature, analytic limits and derivatives',run(){
   const a=.03;let maxAreaError=0,maxGradientError=0;
   for(const fraction of [0,1e-12,1e-6,.01,.2,.5,1]){
    const d=a*fraction,g=circularSegment(a,d),integral=simpson(t=>4*t*t*Math.sqrt(2*a-t*t),0,Math.sqrt(d));
    near(g.area,integral,1e-14);maxAreaError=Math.max(maxAreaError,Math.abs(g.area-integral));
    if(fraction>=.01&&fraction<1){const h=1e-8,gradient=(circularSegment(a,d+h).area-circularSegment(a,d-h).area)/(2*h);near(gradient,g.width,2e-10);maxGradientError=Math.max(maxGradientError,Math.abs(gradient-g.width));}
   }
   near(circularSegment(a,a).area,Math.PI*a*a/2,1e-17);near(circularSegment(a,a).width,2*a,1e-17);near(circularSegment(a,a).widthDerivative,0,0);
   require(circularSegment(a,0).widthDerivative===null,'Initial tangent is singular, not finite');
   return {maxAreaError,maxGradientError};
  }},
  {name:'absolute pressure and ambient work agree with independent integration including n near one',run(){
   const records=[];
   for(const exponent of [1,1+Number.EPSILON,1.00000001,1.2,1.4]){
    const config={...configuration(),exponent},r=createPressureChamber(config).evaluate([.005,.01,.02]),P0=config.ambientPressure+config.initialGaugePressure;
    const expected=P0*Math.pow(config.referenceVolume/r.volume,exponent);
    near(r.absolutePressure,expected,1e-8);near(r.gaugePressure,r.absolutePressure-config.ambientPressure,1e-10);
    const energy=simpson(x=>P0*Math.pow(config.referenceVolume/(config.referenceVolume-x),exponent)-config.ambientPressure,0,r.volumeLoss);
    near(r.energy,energy,1e-9);
    if(exponent===1)near(r.energy,-P0*config.referenceVolume*Math.log(r.volume/config.referenceVolume)-config.ambientPressure*r.volumeLoss,1e-9);
    records.push({exponent,pressure:r.absolutePressure,energy:r.energy,energyError:r.energy-energy});
   }return records;
  }},
  {name:'generalized force equals negative energy gradient and volume gradient has the correct sign',run(){
   const c=createPressureChamber(configuration()),q=[.005,.01,.02],r=c.evaluate(q),records=[];
   for(let i=0;i<q.length;i++){
    const h=1e-7,plus=[...q],minus=[...q];plus[i]+=h;minus[i]-=h;
    const p=c.evaluate(plus),m=c.evaluate(minus),gradient=(p.energy-m.energy)/(2*h),volumeGradient=(p.volumeLoss-m.volumeLoss)/(-2*h);
    near(gradient,-r.nodes[i].generalizedForce,2e-6);near(volumeGradient,r.nodes[i].volumeGradient,2e-12);
    require(r.nodes[i].generalizedForce<0,'Internal gas must resist positive compression');
    records.push({i,energyGradientError:gradient+r.nodes[i].generalizedForce,volumeGradientError:volumeGradient-r.nodes[i].volumeGradient});
   }return records;
  }},
  {name:'cross-node coupling and changing area both contribute to the tangent',run(){
   const c=createPressureChamber(configuration()),q=[.005,.01,.02],r=c.evaluate(q),matrix=[];
   for(let j=0;j<q.length;j++){
    const h=1e-7,plus=[...q],minus=[...q];plus[j]+=h;minus[j]-=h;const p=c.evaluate(plus),m=c.evaluate(minus),column=[];
    for(let i=0;i<q.length;i++){
     const fd=(p.nodes[i].resistingForce-m.nodes[i].resistingForce)/(2*h);
     const expected=r.coupling*r.nodes[i].effectiveArea*r.nodes[j].effectiveArea+(i===j?r.nodes[i].areaStiffness:0);
     near(fd,expected,5e-4);column.push({i,j,expected,finiteDifference:fd});
    }matrix.push(column);
   }
   for(let i=0;i<q.length;i++)for(let j=0;j<q.length;j++)near(matrix[i][j].finiteDifference,matrix[j][i].finiteDifference,2e-5);
   const other=c.evaluate([q[0],q[1]+.001,q[2]]);
   require(other.nodes[0].effectiveArea===r.nodes[0].effectiveArea&&other.nodes[0].resistingForce>r.nodes[0].resistingForce,'Another patch must raise force through shared pressure');
   return matrix;
  }},
  {name:'pressure and increasing effective area compound rather than being added independently',run(){
   const c=createPressureChamber(configuration()),a=c.evaluate([.005,.005,.005]),b=c.evaluate([.015,.015,.015]);
   const areaRatio=b.nodes[0].effectiveArea/a.nodes[0].effectiveArea,pressureRatio=b.gaugePressure/a.gaugePressure,forceRatio=b.nodes[0].resistingForce/a.nodes[0].resistingForce;
   near(forceRatio,pressureRatio*areaRatio,1e-14);require(forceRatio>areaRatio&&forceRatio>pressureRatio,'Compounded response missing');
   return {areaRatio,pressureRatio,forceRatio};
  }},
  {name:'compression and unloading close the work cycle without residual pressure or energy',run(){
   const config=configuration(),c=createPressureChamber(config),maximum=[.005,.01,.02],end=c.evaluate(maximum);
   const power=t=>{const r=c.evaluate(maximum.map(d=>d*t*t));return r.nodes.reduce((sum,node,i)=>sum+node.resistingForce*2*maximum[i]*t,0);};
   const loading=simpson(power,0,1),current=[...maximum];let unloading=0;
   // Return one strip at a time, along a different path through shared pressure.
   for(const i of [2,0,1]){unloading+=simpson(t=>{const q=[...current];q[i]=maximum[i]*(1-t)**2;return c.evaluate(q).nodes[i].resistingForce*(-2*maximum[i]*(1-t));},0,1);current[i]=0;}
   near(loading,end.energy,2e-8);near(loading+unloading,0,1e-10);
   const initial=c.evaluate([0,0,0]);near(initial.energy,0,0);near(initial.gaugePressure,config.initialGaugePressure,0);require(initial.nodes.every(n=>n.generalizedForce===0),'Residual force');
   return {loading,unloading,unloadingPath:[2,0,1],energy:end.energy,workError:loading-end.energy,closedLoopWork:loading+unloading};
  }},
  {name:'arc weighting preserves uniform response under nonuniform subdivision and repeated evaluation owns data',run(){
   const config=configuration(),one=createPressureChamber({...config,arcLengths:[.12]}),many=createPressureChamber({...config,arcLengths:[.02,.03,.07]});
   const a=one.evaluate([.012]),b=many.evaluate([.012,.012,.012]);near(a.volumeLoss,b.volumeLoss,1e-18);near(a.energy,b.energy,1e-12);near(a.nodes[0].resistingForce,b.nodes.reduce((s,n)=>s+n.resistingForce,0),1e-10);
   const serialized=JSON.stringify(b);require(JSON.stringify(many.evaluate([.012,.012,.012]))===serialized,'Repeat mismatch');
   b.nodes[0].resistingForce=999;const out=many.configuration();out.arcLengths[0]=999;out.provenance.kind='invalid';require(JSON.stringify(many.evaluate([.012,.012,.012]))===serialized,'Output aliases internal state');
   const owned=configuration(),c=createPressureChamber(owned),before=c.evaluate([.005,.01,.02]);owned.arcLengths[0]=999;owned.provenance.kind='invalid';require(JSON.stringify(c.evaluate([.005,.01,.02]))===JSON.stringify(before),'Input alias');
   const area=b.nodes.reduce((s,n)=>s+n.effectiveArea,0),aggregate=b.coupling*area*area+b.nodes.reduce((s,n)=>s+n.areaStiffness,0),single=a.coupling*a.nodes[0].effectiveArea**2+a.nodes[0].areaStiffness;near(single,aggregate,1e-8);
   return {volume:a.volume,energy:a.energy,force:a.nodes[0].resistingForce,tangent:single};
  }},
  {name:'tiny compression retains positive work and the isothermal limit is continuous',run(){
   const config=configuration(),q=[1e-14,1e-14,1e-14],a=createPressureChamber({...config,exponent:1}).evaluate(q),b=createPressureChamber({...config,exponent:1+Number.EPSILON}).evaluate(q);
   require(a.energy>0&&a.nodes.every(n=>n.resistingForce>0),'Tiny compression lost work');
   near(a.energy,b.energy,0,1e-12);near(a.volumeLoss,config.arcLengths.reduce((s,x)=>s+x,0)*4/3*Math.sqrt(2*config.sectionRadius)*Math.pow(q[0],1.5),0,1e-12);
   const ambient=createPressureChamber({...config,initialGaugePressure:0}).evaluate([0,0,0]);require(ambient.tangentDefined&&ambient.nodes.every(n=>n.areaStiffness===0),'Ambient-only unloaded force tangent');
   return {energy:a.energy,volumeLoss:a.volumeLoss,force:a.nodes[0].resistingForce};
  }},
  {name:'configuration, expansion, excessive compression and gas-volume collapse fail closed',run(){
   const config=configuration(),c=createPressureChamber(config);
   for(const bad of [{...config,pressure:1},{...config,exponent:.99},{...config,exponent:1.41},{...config,referenceVolume:NaN},{...config,arcLengths:[0]},{...config,provenance:{kind:'calibrated',reference:'not validated'}}])expectThrow(()=>createPressureChamber(bad));
   expectThrow(()=>c.evaluate([0,0]));expectThrow(()=>c.evaluate([NaN,0,0]),'compression-domain');expectThrow(()=>c.evaluate([-.001,0,0]),'compression-domain');expectThrow(()=>c.evaluate([.03001,0,0]),'compression-domain');
   expectThrow(()=>circularSegment(.03,Number.MIN_VALUE),'compression-resolution');
   const small=createPressureChamber({...config,referenceVolume:1e-6,arcLengths:[.12]});expectThrow(()=>small.evaluate([.03]),'volume-domain');
   const weighted=createPressureChamber({...config,arcLengths:[1e-6]});expectThrow(()=>weighted.evaluate([1e-212]),'volume-resolution');
   expectThrow(()=>createPressureChamber({...config,initialGaugePressure:0}).evaluate([1e-120,1e-120,1e-120]),'energy-resolution');
   expectThrow(()=>createPressureChamber({...config,[Symbol('hidden')]:1}));let getterCalls=0;const accessor={...config};Object.defineProperty(accessor,'referenceVolume',{get(){getterCalls++;return .007;}});expectThrow(()=>createPressureChamber(accessor));require(getterCalls===0,'Configuration accessor ran');
   const edge=c.evaluate([.03,.03,.03]);require(edge.tangentDefined&&edge.nodes.every(n=>n.areaStiffness===0),'Half-section boundary');
   return {rejections:16,halfSectionPressure:edge.gaugePressure};
  }}
 ];
}

export function pressureReport(api,onProgress){
 require(onProgress===undefined||typeof onProgress==='function','Invalid progress callback');
 const definitions=pressureChecks(api),checks=[],curves=[];let completed=0;const total=definitions.length+3*41;
 for(const c of definitions){checks.push({name:c.name,status:'pass',result:c.run()});onProgress?.(++completed,total);}
 for(const initialGaugePressure of [120000,160000,200000]){
  const configuration={...clone(FIXTURE),initialGaugePressure},chamber=api.createPressureChamber(configuration),samples=[];
  for(let i=0;i<=40;i++){
   const compression=configuration.arcLengths.map(()=>configuration.sectionRadius*i/40),state=chamber.evaluate(compression);
   samples.push({compression,state});onProgress?.(++completed,total);
  }curves.push({configuration,samples});
 }
 return {model:api.MODEL,scope:'Prescribed circular-strip compression, sealed fixed-mass polytropic mechanical path; no calibrated casing, prestress, insert, leakage, failure, 3D, dynamics or real-time receiving.',fixture:clone(FIXTURE),budgets:{area:{value:1e-14,unit:'m²'},geometryGradient:{value:2e-10,unit:'m'},energyGradient:{value:2e-6,unit:'N'},volumeGradient:{value:2e-12,unit:'m²'},tangent:{value:5e-4,unit:'N/m'},tangentSymmetry:{value:2e-5,unit:'N/m'},pressure:{value:1e-8,unit:'Pa'},integratedEnergy:{value:1e-9,unit:'J'},cycleWork:{value:2e-8,unit:'J'}},checks,curves};
}
