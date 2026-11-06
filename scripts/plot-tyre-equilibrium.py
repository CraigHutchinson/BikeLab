"""Plot saved fixed-bead results without solving again."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
source=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/tyre-equilibrium/report.json')
r=json.loads(source.read_text());assert r['model']=='bikelab-fixed-bead-equilibrium-0.1'
plt.rcParams['svg.hashsalt']=r['model']
fig,axes=plt.subplots(1,3,figsize=(13,4.5),layout='constrained')
selected=[c for c in r['cases'] if c['segments']==32]
rest=selected[0]['configuration']['restPoints']
axes[0].plot([p[0]*1000 for p in rest],[p[1]*1000 for p in rest],'--',color='gray',label='Stress-free reference')
for c in selected:
    p=c['result']['points'];label=f"{c['configuration']['gaugePressure']/1000:g} kPa"
    line,=axes[0].plot([q[0]*1000 for q in p],[q[1]*1000 for q in p],label=label)
    values=[h['maxForcePerArea'] for h in c['result']['history']]+[c['result']['metrics']['maxForcePerArea']]
    axes[1].semilogy(range(len(values)),values,'.-',color=line.get_color(),label=label)
for pressure in [80000,160000,240000]:
    rows=[c for c in r['cases'] if c['configuration']['gaugePressure']==pressure]
    axes[2].plot([c['segments'] for c in rows],[c['result']['state']['volume']*1e6 for c in rows],'.-',label=f'{pressure/1000:g} kPa')
axes[0].set(xlabel='Axial x (mm)',ylabel='Radial height (mm)',title='32 segments: solved meridian');axes[0].set_aspect('equal')
axes[1].axhline(r['budgets']['forcePerArea'],color='gray',linestyle=':',label='Area-normalized gate')
axes[1].set(xlabel='Accepted iteration',ylabel='Max residual / reference area (Pa)',title='Pressure continuation');axes[1].grid(alpha=.2)
axes[2].set(xlabel='Meridian segments',ylabel='Volume (cm³)',title='Mesh study, no calibration claim');axes[2].grid(alpha=.2)
axes[0].legend(fontsize=8);axes[1].legend(fontsize=8)
fig.suptitle('Illustrative fixed-bead axisymmetric equilibrium · no loaded tyre integration',fontsize=12)
fig.savefig(source.parent/'equilibrium.png',dpi=160)
svg=source.parent/'equilibrium.svg';fig.savefig(svg,metadata={'Date':None});svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
