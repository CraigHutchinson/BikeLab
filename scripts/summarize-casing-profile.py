import json,hashlib,sys
from pathlib import Path
folder=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/casing-cost/profile')
p=max(folder.glob('*.cpuprofile'),key=lambda p:p.stat().st_mtime);raw=p.read_bytes();r=json.loads(raw);nodes={n['id']:n for n in r['nodes']};buckets={};prefix=Path.cwd().as_uri()+'/'
for ident,dt in zip(r['samples'],r['timeDeltas']):
 f=nodes[ident]['callFrame'];url=f['url'];url=url[len(prefix):] if url.lower().startswith(prefix.lower()) else url.split('/')[-1];key=(url,f['functionName'],f['lineNumber']+1);buckets[key]=buckets.get(key,0)+dt
total=sum(r['timeDeltas']);rows=[{'source':key[0],'function':key[1],'line':key[2],'sampledMs':value/1000,'percent':100*value/total} for key,value in sorted(buckets.items(),key=lambda x:-x[1])]
report={'scope':'Whole benchmark-process CPU profile, including startup/warmup. Sampling attribution, not exact per-function timing or an optimization speedup. Unprofiled timings are separate.','profileSha256':hashlib.sha256(raw).hexdigest(),'totalSampledMs':total/1000,'rows':rows}
(folder.parent/'profile-summary.json').write_bytes((json.dumps(report,indent=2)+'\n').encode());print(json.dumps(rows[:6],indent=2))
