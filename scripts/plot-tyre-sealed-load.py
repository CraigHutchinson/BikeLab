"""Render accepted and rejected static results without hiding mesh dependence."""
import json,sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
p=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/sealed-load/summary.json')
r=json.loads(p.read_text(encoding='utf-8'));plt.rcParams['svg.hashsalt']=r['model']
fig,axs=plt.subplots(2,3,figsize=(14,8),layout='constrained')
colors={32:'#3577bd',64:'#b66c13',128:'#673ab7'}
for j,pressure in enumerate([120000,160000,200000]):
 for case in r['cases']:
  if case['pressure']!=pressure:continue
  states=case['states'][:5];x=[s['deflection']*1000 for s in states];style='-' if case['segments']==8 else '--';color=colors[case['nodes']]
  axs[0,j].plot(x,[s['reaction'] for s in states],style,color=color,label=f"{case['nodes']} stations / {case['segments']} section")
  axs[1,j].plot(x,[(s['pressure']-pressure)/1000 for s in states],style,color=color)
  rejected=[s for s in states if not s['locallyAdmissible']]
  axs[0,j].scatter([s['deflection']*1000 for s in rejected],[s['reaction'] for s in rejected],marker='x',color='red',s=35,zorder=5)
 axs[0,j].set(title=f'{pressure/100000:.1f} bar reference',ylabel='Diagnostic reaction / N',xlabel='Hub lowering / mm')
 axs[1,j].set(ylabel='Gauge-pressure increase / kPa',xlabel='Hub lowering / mm')
 axs[0,j].legend(fontsize=7)
 for i in [0,1]:axs[i,j].grid(alpha=.2)
fig.suptitle('Uncalibrated swept casing: loaded mesh refinement FAILS\nRed crosses: compression or stability rejection; curves are mathematical diagnostics, not admitted tyre behaviour',fontsize=12)
fig.savefig(p.parent/'load.png',dpi=140);fig.savefig(p.parent/'load.svg',metadata={'Date':None});s=p.parent/'load.svg';s.write_bytes(('\n'.join(x.rstrip() for x in s.read_text(encoding='utf-8').splitlines())+'\n').encode())
