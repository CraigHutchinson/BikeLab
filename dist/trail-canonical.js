import {NATIVE_BUILD,scalarLayout} from './trail-initial-state.js';

export const CANONICAL_MODEL='bikelab-trail-bike-0.5';
export const CANONICAL_NUMERICS='canonical-guided-0.1';

// Define the new launch once, before observation. Never quantize an evolving
// state, a supplied explicit state, or an exported result to hide disagreement.
export async function canonicalLaunch(mj,model,data,xml){
 const layout=scalarLayout(mj,model),q=data.qpos,v=data.qvel;
 const decimal=value=>{if(!Number.isFinite(value))throw Error('Nonfinite canonical launch.');return value===0?0:Number(value.toPrecision(12));};
 for(const j of layout){q[j.q]=decimal(q[j.q]);v[j.v]=decimal(v[j.v]);}
 data.qacc_warmstart.fill(0);data.time=0;
 const joints=layout.map(j=>({name:j.name,type:j.type,position:q[j.q],velocity:v[j.v]})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
 const bytes=new TextEncoder().encode(xml),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 return {policy:CANONICAL_NUMERICS,xmlSignificantDigits:12,launchSignificantDigits:12,nativeBuild:NATIVE_BUILD,xmlSha256:hash,
  forceMapping:'native-shock-jacobian-0.1',warmStart:'fresh-zero',time:0,
  joints};
}
