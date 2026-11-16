import json,gzip,base64
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
p=Path('artifacts/casing-resolution');r=json.loads((p/'summary.json').read_text())
fig,ax=plt.subplots(figsize=(8,5),layout='constrained')
for n in [32,64,128]:
 cs=[c for c in r['cases'] if c['nodes']==n]
 ax.plot([c['segments'] for c in cs],[c['states'][-1]['reaction'] for c in cs],'o-',label=f'{n} circumferential stations')
ax.set(xlabel='Transverse section segments (same shape freedoms)',ylabel='Reaction / N',title='Endpoint casing: 1.6 bar, 2 mm lowering\nUncalibrated; loaded admission still fails',xticks=[8,16,32]);ax.legend();ax.grid(alpha=.2)
plt.rcParams['svg.hashsalt']='bikelab-casing-resolution';fig.savefig(p/'resolution.png',dpi=140);fig.savefig(p/'resolution.svg',metadata={'Date':None})
svg=p/'resolution.svg';svg.write_bytes(('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n').encode())
for ext in ['json','svg']:
 source=p/('summary.json' if ext=='json' else 'resolution.svg');Path('docs/evidence/casing-resolution.'+ext).write_bytes(source.read_bytes())
Path('docs/evidence/casing-resolution-report.json.gz.b64').write_text(base64.b64encode(gzip.compress((p/'report.json').read_bytes(),mtime=0)).decode()+'\n')
for c in r['cases']:
 s=c['states'][-1];print(c['nodes'],c['segments'],round(s['reaction'],3),len(s['contacts']),s['compression'])
print('Comparisons:',[(a,sum(not c['passed'] for c in r['comparisons'] if c['axis']==a)) for a in ['nodes','segments']])
