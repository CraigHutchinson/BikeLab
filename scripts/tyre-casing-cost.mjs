import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {createSweptCasing,RELAXED_MODEL} from '../dist/sealed-casing.js';
assert.ok(process.argv.length<=3,'Usage: node scripts/tyre-casing-cost.mjs [output-directory]');
const dir=process.argv[2]??'artifacts/casing-cost';await mkdir(dir,{recursive:true});
const paths=['dist/sealed-casing.js','dist/tyre-relaxation.js','dist/tyre-gas.js','dist/wheel-ring.js','scripts/tyre-casing-cost.mjs','docs/evidence/contact-relaxation-receiving.json','docs/evidence/contact-relaxation-report.json.gz.b64'];
const hash=b=>createHash('sha256').update(b).digest('hex'),hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(p))]))),sourcesSha256=await hashes();
const raw=gunzipSync(Buffer.from((await readFile(paths.at(-1),'utf8')).trim(),'base64')),archived=JSON.parse(raw),receiving=JSON.parse(await readFile(paths.at(-2),'utf8')),arms=[];
assert.equal(hash(raw),receiving.reportSha256);assert.ok(receiving.fineMesh.allLocallyAdmissible&&receiving.fineMesh.comparisonFailures===0&&receiving.fineMesh.returnFailures===0);
for(const nodes of [128,256,512]){
 const start=performance.now(),cases=[];
 for(const c of archived.cases.filter(c=>c.model===RELAXED_MODEL&&c.nodes===nodes)){
  const m=createSweptCasing(c.configuration,c.model),angle=c.phase*2*Math.PI/nodes,cos=Math.cos(angle),sin=Math.sin(angle);
  for(const state of c.states){const q=Float64Array.from(state.coordinates);if(angle)for(let i=0;i<q.length;i+=2){const x=q[i],z=q[i+1];q[i]=cos*x+sin*z;q[i+1]=-sin*x+cos*z;}
   const s=m.evaluate(q);assert.equal(s.potential,state.state.potential);cases.push({m,q});
  }
 }
 assert.equal(cases.length,42);arms.push({nodes,cases,configurationMs:performance.now()-start,samples:[]});
}
function batch(arm,calls,offset){let checksum=0;const start=process.hrtime.bigint();for(let i=0;i<calls;i++){const c=arm.cases[(i+offset)%arm.cases.length],s=c.m.evaluate(c.q);checksum+=s.potential+s.forces[i%s.forces.length];}const elapsedMs=Number(process.hrtime.bigint()-start)/1e6;assert.ok(Number.isFinite(checksum));return {elapsedMs,checksum};}
const warmupCalls=252,callsPerRound=252,rounds=15;
for(const arm of arms)arm.warmup=batch(arm,warmupCalls,0);
const cpuStart=process.cpuUsage(),wallStart=performance.now();
for(let round=0;round<rounds;round++)for(let k=0;k<arms.length;k++){const index=round%2?(round+arms.length-1-k)%arms.length:(round+k)%arms.length,arm=arms[index];arm.samples.push({round,order:k,...batch(arm,callsPerRound,round)});}
const cpu=process.cpuUsage(cpuStart),wallMs=performance.now()-wallStart;
const qtile=(xs,p)=>{const x=[...xs].sort((a,b)=>a-b);return x[Math.ceil(p*(x.length-1))];};
const results=arms.map(a=>{const us=a.samples.map(s=>1000*s.elapsedMs/callsPerRound);return {nodes:a.nodes,states:a.cases.length,configurationMs:a.configurationMs,warmup:a.warmup,samples:a.samples,medianUs:qtile(us,.5),p95BatchMeanUs:qtile(us,.95),minBatchMeanUs:Math.min(...us),maxBatchMeanUs:Math.max(...us),sampledFineGate:receiving.fineMesh.nodes.includes(a.nodes)};});
assert.deepEqual(await hashes(),sourcesSha256);
const report={scope:'Descriptive local force-kernel cost only. Fixed saved states, no native contact/integration/rendering or stable-timestep/real-time admission. Batch-mean tail is not per-call worst-case latency.',environment:{node:process.version,platform:process.platform,architecture:process.arch,cpu:os.cpus()[0].model,logicalProcessors:os.cpus().length},protocol:{warmupCalls,callsPerRound,rounds,statesPerArm:42,pressures:[120000,160000,200000],phases:[0,.5],loweringMm:[0,1,2,4,2,1,0],order:'rotated and reversed alternating rounds',contention:'Caller must coordinate other work; this script does not establish an uncontended host.'},cpuMs:{user:cpu.user/1000,system:cpu.system/1000},wallMs,sourcesSha256,results};await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(results.map(({nodes,medianUs,p95BatchMeanUs,sampledFineGate})=>({nodes,medianUs,p95BatchMeanUs,sampledFineGate})),null,2));
