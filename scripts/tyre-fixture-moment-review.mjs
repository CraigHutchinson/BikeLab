import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const [directory='artifacts/tyre-fixture',...extra]=process.argv.slice(2);
if(extra.length)throw Error('Usage: node scripts/tyre-fixture-moment-review.mjs [review-directory]');
const review=JSON.parse(await readFile(join(directory,'review.json'))),budget=1e-8,cases=[];
for(const c of review.cases){
 const raw=await readFile(join(directory,c.name+'.json'));
 if(createHash('sha256').update(raw).digest('hex')!==c.recordSha256)throw Error('Record hash mismatch: '+c.name);
 const record=JSON.parse(raw);let maxPredictionError=0,maxMomentDifference=0;
 for(const f of record.frames){let predicted=0;
  // Independent projected-plane reconstruction of the pinned engine's weights.
  for(const contact of f.contacts){
   const ids=contact.vertex>=0?[contact.vertex]:[contact.edge,(contact.edge+1)%f.nodes.length];
   const weights=ids.map(i=>1/Math.max(1e-15,Math.hypot(f.nodes[i][0]-contact.point[0],f.nodes[i][1]-contact.point[1]))),sum=weights.reduce((x,y)=>x+y);
   for(let k=0;k<ids.length;k++){const p=f.nodes[ids[k]];predicted+=weights[k]/sum*((p[1]-contact.point[1])*contact.force[0]-(p[0]-contact.point[0])*contact.force[1]);}
  }
  maxPredictionError=Math.max(maxPredictionError,Math.abs(f.contactMomentDifference-predicted));maxMomentDifference=Math.max(maxMomentDifference,Math.abs(f.contactMomentDifference));
 }
 cases.push({name:c.name,maxPredictionError,maxMomentDifference,passed:maxPredictionError<=budget});
}
console.log(JSON.stringify({format:'bikelab-fixed-hub-contact-moment-review-0.1',budget,units:'N m',scope:'Recorded contact/node geometry, inverse-distance prediction; projected planar coordinates and active contacts above1e-8 N. Does not modify forces or work.',cases},null,2));
if(cases.some(c=>!c.passed))process.exitCode=2;
