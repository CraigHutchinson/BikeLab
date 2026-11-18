import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
r=json.loads(Path('artifacts/mass-frequency/report.json').read_text(encoding='utf-8'));plt.rcParams['svg.hashsalt']='bikelab-mass-frequency';fig,axs=plt.subplots(1,2,figsize=(12,4.8),layout='constrained');cs=[c for c in r['cases'] if c['pressure']==160000 and .001<c['deflection']<.003]
for name,label in [('half-all-mass','Half all mass/inertia'),('nominal','Nominal'),('double-all-mass','Double all mass/inertia')]:
 rows=[next(a for a in c['rows'] if a['name']==name) for c in cs];axs[0].plot([c['nodes'] for c in cs],[1e6*a['estimatedInflatedOscillatorScaleSeconds'] for a in rows],'o-',label=label)
axs[0].set(xlabel='Circumferential stations',ylabel='Frozen oscillator scale / microseconds',xticks=[128,256,512],title='1.6 bar, 2 mm lowering\nNot an admitted native timestep');axs[0].legend(fontsize=8)
for name,label in [('nominal','Nominal'),('light-hub','1 kg hub'),('low-spin-inertia','Lower hub spin inertia')]:
 rows=[next(a for a in c['rows'] if a['name']==name) for c in cs];axs[1].plot([c['nodes'] for c in cs],[100*(a['lambdaBound']/a['fixedHubLambdaBound']-1) for a in rows],'o-',label=label)
axs[1].set(xlabel='Circumferential stations',ylabel='Coupled operator norm above fixed-hub norm / %',xticks=[128,256,512],title='Hub recoil and spin affect the bound\nNorm comparison, not exact eigenfrequencies');axs[1].legend(fontsize=8)
for ax in axs:ax.grid(alpha=.2)
fig.suptitle('Configured mass + internal casing tangent · excludes damping/contact/nonlinear stepping')
p=Path('artifacts/mass-frequency');fig.savefig(p/'frequency.png',dpi=145);fig.savefig(p/'frequency.svg',metadata={'Date':None});svg=p/'frequency.svg';svg.write_bytes(('\n'.join(s.rstrip() for s in svg.read_text(encoding='utf-8').splitlines())+'\n').encode())
Path('docs/evidence/mass-frequency.json').write_bytes((p/'report.json').read_bytes());Path('docs/evidence/mass-frequency.svg').write_bytes(svg.read_bytes())
