// A bounded report: count every difference, retain only first/max examples.
// Match the strict record comparator's array and object-key ordering contract.
export function replayDifference(actual,expected,tolerance=1e-9){
 if(!Number.isFinite(tolerance)||tolerance<0)throw Error('Invalid comparison tolerance.');
 const describe=v=>v&&typeof v==='object'?{type:Array.isArray(v)?'array':'object',length:Array.isArray(v)?v.length:Object.keys(v).length,keys:Object.keys(v).slice(0,16)}:typeof v==='string'?v.slice(0,256):v;
 const out={tolerance,numericLeaves:0,differingNumbers:0,outsideBudget:0,structuralDifferences:0,firstExact:null,firstOutsideBudget:null,firstStructural:null,maxAbsolute:null,maxNormalized:null};
 const visit=(a,b,path)=>{
  if(typeof a==='number'&&typeof b==='number'&&Number.isFinite(a)&&Number.isFinite(b)){
   out.numericLeaves++;const absolute=Math.abs(a-b),normalized=absolute/Math.max(1,Math.abs(b));
   const leaf={path,actual:a,expected:b,absolute,normalized};
   if(a!==b){out.differingNumbers++;out.firstExact??=leaf;}
   if(normalized>tolerance){out.outsideBudget++;out.firstOutsideBudget??=leaf;}
   if(!out.maxAbsolute||absolute>out.maxAbsolute.absolute)out.maxAbsolute=leaf;
   if(!out.maxNormalized||normalized>out.maxNormalized.normalized)out.maxNormalized=leaf;
  }else if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
   const ak=Object.keys(a),bk=Object.keys(b);
   if((Array.isArray(a)&&a.length!==b.length)||ak.length!==bk.length||ak.some((k,i)=>k!==bk[i])){
    out.structuralDifferences++;out.firstStructural??={path,actualLength:Array.isArray(a)?a.length:ak.length,expectedLength:Array.isArray(b)?b.length:bk.length,actualKeys:ak.slice(0,16),expectedKeys:bk.slice(0,16)};return;
   }
   for(const k of bk)visit(a[k],b[k],path+'.'+k);
  }else if(a!==b||typeof a==='number'){
   out.structuralDifferences++;out.firstStructural??={path,actual:describe(a),expected:describe(b)};
  }
 };
 visit(actual,expected,'record');return out;
}
