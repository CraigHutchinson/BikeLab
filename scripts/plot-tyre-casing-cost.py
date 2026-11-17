import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
r=json.loads(Path('artifacts/casing-cost/report.json').read_text(encoding='utf-8'));p=json.loads(Path('artifacts/casing-cost/profile-summary.json').read_text(encoding='utf-8'));plt.rcParams['svg.hashsalt']='bikelab-casing-cost';fig,axs=plt.subplots(1,2,figsize=(12,4.8),layout='constrained')
for c in r['results']:
 ys=[1000*s['elapsedMs']/r['protocol']['callsPerRound'] for s in c['samples']];color='#227b65' if c['sampledFineGate'] else '#ae5e34';axs[0].scatter([c['nodes']]*len(ys),ys,color=color,alpha=.5);axs[0].plot([c['nodes']-14,c['nodes']+14],[c['medianUs']]*2,color=color,lw=3)
axs[0].set(xlabel='Circumferential stations',ylabel='Batch mean per force evaluation / microseconds',xticks=[128,256,512],title='15 rotated/reversed measurement rounds\nBrown: coarse accuracy failures; green: sampled fine gate')
rows=p['rows'][:5];axs[1].barh([x['function'] or '(runtime)' for x in rows],[x['percent'] for x in rows],color='#426a8a');axs[1].invert_yaxis();axs[1].set(xlabel='Share of sampled process time / %',title='Separate CPU profile, including startup/warmup\nAttribution is not exact function timing')
for ax in axs:ax.grid(axis='x',alpha=.2)
fig.suptitle('Local force-kernel reference only · no native-step or real-time admission')
out=Path('artifacts/casing-cost');fig.savefig(out/'cost.png',dpi=145);fig.savefig(out/'cost.svg',metadata={'Date':None});svg=out/'cost.svg';svg.write_bytes(('\n'.join(x.rstrip() for x in svg.read_text(encoding='utf-8').splitlines())+'\n').encode())
for source,target in [('report.json','casing-cost.json'),('profile-summary.json','casing-cost-profile.json'),('cost.svg','casing-cost.svg')]:Path('docs/evidence',target).write_bytes((out/source).read_bytes())
