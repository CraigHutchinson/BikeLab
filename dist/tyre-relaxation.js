// Restricted axis-aligned relaxation of the endpoint quadratic energy.
// See docs/TYRE_CONTACT_RELAXATION.md for derivation and constitutive limits.
// Output: energy/area, Nm_a, Nm_b, Nh, meridional slacks a/b, shared hoop slack.
export function relaxEndpointInto(Cm,Ch,Cc,ea,eb,eh,out){
 const na=Cm*ea+Cc*eh,nb=Cm*eb+Cc*eh,nh=Cc*(ea+eb)/2+Ch*eh;
 if(na>=0&&nb>=0&&nh>=0){out[0]=(Cm*(ea*ea+eb*eb)/2+Cc*(ea+eb)*eh+Ch*eh*eh)/2;out[1]=na;out[2]=nb;out[3]=nh;out[4]=out[5]=out[6]=0;return out;}
 let best=Infinity;
 // Enumerate the eight KKT active sets; no iterative material solve or penalty.
 // Roundoff bounds only admit algebraically identical boundary representations.
 const strainRoundoff=32*Number.EPSILON*(1+Math.max(Math.abs(ea),Math.abs(eb),Math.abs(eh))),stressRoundoff=strainRoundoff*(Cm+Ch+2*Math.abs(Cc));
 for(let mask=0;mask<8;mask++){
  const a=mask&1,b=mask&2,h=mask&4,k=Number(!!a)+Number(!!b);
  const y=h?-(Cc*((a?0:ea)+(b?0:eb))/2)/(Ch-k*Cc*Cc/(2*Cm)):eh;
  const x=a?-Cc*y/Cm:ea,z=b?-Cc*y/Cm:eb;
  const sa=x-ea,sb=z-eb,t=y-eh,nma=a?0:Cm*x+Cc*y,nmb=b?0:Cm*z+Cc*y,nhoop=h?0:Cc*(x+z)/2+Ch*y;
  if(sa < -strainRoundoff||sb < -strainRoundoff||t < -strainRoundoff||nma < -stressRoundoff||nmb < -stressRoundoff||nhoop < -stressRoundoff)continue;
  const energy=(Cm*(x*x+z*z)/2+Cc*(x+z)*y+Ch*y*y)/2;
  if(energy<best){best=energy;out[0]=energy;out[1]=Math.max(0,nma);out[2]=Math.max(0,nmb);out[3]=Math.max(0,nhoop);out[4]=Math.max(0,sa);out[5]=Math.max(0,sb);out[6]=Math.max(0,t);}
 }
 if(!Number.isFinite(best))throw RangeError('No finite relaxed endpoint active set');return out;
}
