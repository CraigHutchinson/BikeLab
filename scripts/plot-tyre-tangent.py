"""Plot saved equal-tolerance solver comparisons; no rerun during plotting."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from statistics import median
source=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/tyre-tangent/report.json')
r=json.loads(source.read_text());assert r['model']=='bikelab-analytic-tangent-0.1'
plt.rcParams['svg.hashsalt']=r['model']
fig,axes=plt.subplots(1,3,figsize=(13,4.3),layout='constrained')
for method,label in [('finite-difference','Dense finite differences'),('analytic-banded','Analytic banded')]:
    rows=[c for c in r['cases'] if c['configuration']['gaugePressure']==160000]
    axes[0].plot([c['segments'] for c in rows],[median(c['timings'][method]) for c in rows],'.-',label=label)
for pressure in [80000,160000,240000]:
    rows=[c for c in r['cases'] if c['configuration']['gaugePressure']==pressure]
    axes[1].semilogy([c['segments'] for c in rows],[max(1e-20,c['maxCoordinateDifference']) for c in rows],'.-',label=f'{pressure/1000:g} kPa')
rows=[c for c in r['cases'] if c['configuration']['gaugePressure']==160000]
for method in ['dense','banded']:
    axes[2].plot([c['segments'] for c in rows],[c['tangentEntries'][method] for c in rows],'.-',label=method)
axes[0].set(xlabel='Segments',ylabel='Median complete solve (ms)',title='160 kPa · six rotated warm samples')
axes[1].axhline(2e-9,color='gray',linestyle=':',label='Coordinate comparison budget')
axes[1].set(xlabel='Segments',ylabel='Maximum coordinate difference (m)',title='Same force convergence gates')
axes[2].set(xlabel='Segments',ylabel='Stored floating-point entries',title='Tangent storage only')
for ax in axes:ax.legend(fontsize=8);ax.grid(alpha=.2)
fig.suptitle('Constant-pressure offline solver · illustrative material · no runtime integration',fontsize=12)
fig.savefig(source.parent/'tangent.png',dpi=150)
svg=source.parent/'tangent.svg';fig.savefig(svg,metadata={'Date':None});svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
