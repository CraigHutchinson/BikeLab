import json,gzip,base64
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
p=Path('artifacts/contact-relaxation');r=json.loads((p/'summary.json').read_text(encoding='utf-8'));plt.rcParams['svg.hashsalt']='bikelab-contact-relaxation'
fig,axs=plt.subplots(2,2,figsize=(12,9),layout='constrained')
for model,style in [('endpoint','--'),('relaxed','-')]:
 for phase,marker in [(0,'o'),(.5,'s')]:
  cs=[c for c in r['cases'] if model in c['model'] and c['pressure']==160000 and c['phase']==phase]
  ss=[(c,next((s for s in c['states'] if abs(s['deflection']-.002)<1e-9),None)) for c in cs];ss=[(c,s) for c,s in ss if s]
  axs[0,0].plot([c['nodes'] for c,s in ss],[s['reaction'] for c,s in ss],style+marker,label=f'{model}, phase {phase}')
for pressure,color in [(120000,'#3577bd'),(160000,'#b66c13'),(200000,'#673ab7')]:
 cs=[c for c in r['cases'] if 'relaxed' in c['model'] and c['nodes']==512 and c['pressure']==pressure and c['phase']==0]
 for c in cs:
  ss=c['states'];axs[0,1].plot([s['deflection']*1000 for s in ss],[s['reaction'] for s in ss],'o-',color=color,label=f'{pressure/100000:g} bar')
  axs[1,0].plot([s['deflection']*1000 for s in ss],[(s['pressure']-pressure)/1000 for s in ss],'o-',color=color,label=f'{pressure/100000:g} bar')
for c in r['cases']:
 if 'relaxed' not in c['model'] or c['pressure']!=160000 or c['nodes']!=512:continue
 s=next(s for s in c['states'] if abs(s['deflection']-.002)<1e-9)
 axs[1,1].plot([a['x']*1000 for a in s['contacts']],[a['reaction'] for a in s['contacts']],'o-',label=f'phase {c["phase"]}')
axs[0,0].set(xlabel='Circumferential stations',ylabel='Reaction / N',title='1.6 bar, 2 mm: material and contact-phase controls',xscale='log',xticks=[32,64,128,256,512]);axs[0,0].set_xticklabels(['32','64','128','256','512'])
axs[0,1].set(xlabel='Hub lowering / mm',ylabel='Reaction / N',title='512 stations: load and unload paths')
axs[1,0].set(xlabel='Hub lowering / mm',ylabel='Gauge-pressure increase / kPa',title='Sealed volume drives pressure')
axs[1,1].set(xlabel='Plane-frame crown position / mm',ylabel='Vertex reaction / N',title='1.6 bar, 2 mm: discrete contact reactions')
for ax in axs.flat:ax.grid(alpha=.2);ax.legend(fontsize=8)
fig.suptitle('Restricted axis-aligned relaxed casing · uncalibrated · no native/trail promotion')
fig.savefig(p/'contact.png',dpi=145);fig.savefig(p/'contact.svg',metadata={'Date':None});svg=p/'contact.svg';svg.write_bytes(('\n'.join(s.rstrip() for s in svg.read_text(encoding='utf-8').splitlines())+'\n').encode())
for source,target in [('summary.json','contact-relaxation.json'),('contact.svg','contact-relaxation.svg')]:Path('docs/evidence',target).write_bytes((p/source).read_bytes())
Path('docs/evidence/contact-relaxation-report.json.gz.b64').write_bytes((base64.b64encode(gzip.compress((p/'report.json').read_bytes(),mtime=0)).decode()+'\n').encode())
print(json.dumps(r['receiving']))
