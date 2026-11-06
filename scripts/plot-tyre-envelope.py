"""Display every saved envelope attempt; no filtering of failed cases."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
source=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/tyre-envelope/summary.json')
r=json.loads(source.read_text(encoding='utf-8'));plt.rcParams['svg.hashsalt']=r['model']
fig,axes=plt.subplots(1,3,figsize=(14,4.5),layout='constrained')
for geometry in ['compact','reference','wide']:
 rows=[(i,c) for i,c in enumerate(r['rows']) if c['geometry']==geometry]
 axes[0].scatter([i for i,c in rows],[c['methods']['analytic-banded']['metrics']['maxForce'] for i,c in rows],s=12,label=geometry)
 for i,c in rows:
  if not c['accepted']:axes[0].plot(i,c['methods']['analytic-banded']['metrics']['maxForce'],'rx',markersize=7)
 axes[1].scatter([i for i,c in rows],[c['methods']['analytic-banded']['minHoopResultant'] for i,c in rows],s=12,label=geometry)
axes[0].axhline(1e-5,color='gray',linestyle=':');axes[0].set(yscale='log',xlabel='Grid case index',ylabel='Maximum free force (N)',title=f"{r['accepted']}/{r['cases']} cases accepted; red = rejected")
axes[1].axhline(0,color='gray',linestyle=':');axes[1].set(xlabel='Grid case index',ylabel='Minimum hoop resultant (N/m)',title='Negative = compression, not accepted')
pairs=[(i,p['difference']) for i,p in enumerate(r['pairs']) if p['difference'] is not None]
axes[2].scatter([i for i,v in pairs],[max(v,1e-20) for i,v in pairs],s=12)
axes[2].axhline(2e-9,color='gray',linestyle=':');axes[2].set(yscale='log',xlabel='Rest/asymmetric pair index',ylabel='Coordinate disagreement (m)',title='Alternate starts, converged pairs')
axes[0].legend(fontsize=8)
for ax in axes:ax.grid(alpha=.2)
fig.suptitle('Illustrative constant-pressure equilibrium grid · no physical calibration',fontsize=12)
fig.savefig(source.parent/'envelope.png',dpi=150)
svg=source.parent/'envelope.svg';fig.savefig(svg,metadata={'Date':None});svg.write_bytes(('\n'.join(line.rstrip() for line in svg.read_text(encoding='utf-8').splitlines())+'\n').encode('utf-8'))
