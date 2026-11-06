"""Plot the archived sealed gas and free-casing equilibrium controls."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
source=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/tyre-sealed/summary.json')
r=json.loads(source.read_text(encoding='utf-8'));plt.rcParams['svg.hashsalt']=r['model']
fig,axes=plt.subplots(1,3,figsize=(14,4.5),layout='constrained')
for c in r['curves']:
 x=[s['volume']/r['gasConfiguration']['referenceVolume'] for s in c['states']]
 axes[0].plot(x,[s['gaugePressure']/1000 for s in c['states']],label=f"n={c['exponent']}")
 axes[1].plot(x,[s['energy'] for s in c['states']],label=f"n={c['exponent']}")
for exponent in [1,1.4]:
 for pressure in [80000,160000,240000]:
  rows=[c for c in r['cases'] if c['exponent']==exponent and c['initialGaugePressure']==pressure]
  axes[2].plot([c['segments'] for c in rows],[c['results']['analytic-banded']['gas']['gaugePressure']/1000 for c in rows],'.-',label=f'{pressure/1000:g} kPa, n={exponent}')
axes[0].set(xlabel='V / gas reference volume',ylabel='Gauge pressure (kPa)',title='Compression and expansion')
axes[1].axhline(0,color='gray',linestyle=':');axes[1].set(xlabel='V / gas reference volume',ylabel='Mechanical potential (J)',title='Ambient work included; U(Vref)=0')
axes[2].set(xlabel='Meridian segments',ylabel='Final gauge pressure (kPa)',title='Free equilibrium: inventory specified at rest')
for ax in axes:ax.legend(fontsize=7);ax.grid(alpha=.2)
fig.suptitle('Sealed spatial casing · uncalibrated · no localized load or production integration',fontsize=12)
fig.savefig(source.parent/'sealed.png',dpi=150)
svg=source.parent/'sealed.svg';fig.savefig(svg,metadata={'Date':None});svg.write_bytes(('\n'.join(line.rstrip() for line in svg.read_text(encoding='utf-8').splitlines())+'\n').encode())
