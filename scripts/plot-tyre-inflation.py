"""Visualize saved inflation branches; no solver is rerun."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
source = Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/tyre-inflation/report.json')
r = json.loads(source.read_text())
assert r['model'] == 'bikelab-axisymmetric-inflation-0.1'
plt.rcParams['svg.hashsalt'] = r['model']
fig, axes = plt.subplots(1, 2, figsize=(11, 4.5), layout='constrained')
zoom_end = max(c['equilibrium']['state']['height'] for c in r['cases']) + .001
for case in r['cases']:
    s = [x for x in case['samples'] if x['height'] <= zoom_end]; e = case['equilibrium']['state']
    label = f"{case['configuration']['gaugePressure']/1000:g} kPa"
    line, = axes[0].plot([x['height']*1000 for x in s], [x['residual']/1000 for x in s], label=label)
    axes[0].scatter([e['height']*1000], [e['residual']/1000], color=line.get_color())
    axes[1].plot([x['height']*1000 for x in s], [x['potential'] for x in s], color=line.get_color(), label=label)
    axes[1].scatter([e['height']*1000], [e['potential']], color=line.get_color())
axes[0].set(ylabel='Generalized outward force (kN)', title='Pressure + material force')
axes[0].axhline(0, color='gray', linewidth=.6)
axes[1].set(ylabel='Total potential relative to rest (J)', title='Local minima along height only')
for ax in axes:
    ax.set_xlabel('Section height above rim (mm)'); ax.grid(alpha=.2)
axes[0].legend()
fig.suptitle('Illustrative local inflation branch · no full casing or rim-reaction solution', fontsize=12)
fig.savefig(source.parent/'inflation.png', dpi=160)
svg=source.parent/'inflation.svg'; fig.savefig(svg, metadata={'Date': None})
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
