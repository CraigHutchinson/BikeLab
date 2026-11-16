import json,sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
p=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/casing-modes/summary.json');r=json.loads(p.read_text(encoding='utf-8'));plt.rcParams['svg.hashsalt']='bikelab-casing-modes'
fig,axs=plt.subplots(1,3,figsize=(15,4.8),layout='constrained');colors={32:'#3577bd',64:'#b66c13',128:'#673ab7'}
for c in r['cases']:
 if c['pressure']!=160000:continue
 endpoint='endpoint' in c['model'];style='--' if endpoint else '-';label=f"{c['nodes']} / {'endpoint' if endpoint else 'averaged'}";color=colors[c['nodes']];states=c['states'][:5]
 axs[0].plot([s['deflection']*1000 for s in states],[s['reaction'] for s in states],style,color=color,label=label)
 if c['nodes']==32:
  s=states[1];axs[1].plot(range(10),[x*1000 for x in s['radialDisplacement'][:10]],style+'o',color=color,label='endpoint' if endpoint else 'averaged')
 axs[2].scatter([c['nodes']],[c['alternatingCurvature'][0]],marker='s' if endpoint else 'o',facecolors=color if endpoint else 'none',edgecolors=color)
axs[0].set(xlabel='Hub lowering / mm',ylabel='Diagnostic reaction / N',title='1.6 bar: loaded refinement still fails');axs[0].legend(fontsize=7)
axs[1].set(xlabel='Station from lowest crown',ylabel='Radial displacement / mm',title='32 stations, 1 mm lowering');axs[1].legend();axs[1].axhline(0,color='gray',linewidth=.7)
axs[2].set(xlabel='Circumferential stations',ylabel='Directional stiffness / (N/m)',title='Alternating radial direction\nCircle: averaged; square: endpoint',yscale='log')
for ax in axs:ax.grid(alpha=.2)
fig.suptitle('Same material constants, different quadrature · uncalibrated candidate, NOT promoted',fontsize=12)
fig.savefig(p.parent/'modes.png',dpi=145);fig.savefig(p.parent/'modes.svg',metadata={'Date':None});s=p.parent/'modes.svg';s.write_bytes(('\n'.join(x.rstrip() for x in s.read_text(encoding='utf-8').splitlines())+'\n').encode())
