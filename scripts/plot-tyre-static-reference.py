"""Render saved static membrane reference; no solver execution in plotting."""
import json
import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

source = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/tyre-static-reference/report.json')
report = json.loads(source.read_text())
assert report['model'] == 'bikelab-constant-pressure-membrane-reference-0.1'
plt.rcParams.update({'font.size': 10, 'svg.hashsalt': report['model']})
fig, axes = plt.subplots(1, 3, figsize=(14, 5), layout='constrained')
colors = ['#286b98', '#387f51', '#b65525']
for curve, color in zip(report['curves'][:3], colors):
    x = [s['deflection']*1000 for s in curve['samples']]
    axes[0].plot(x, [s['stressLoad'] for s in curve['samples']], color=color, label=f"{curve['parameters']['gaugePressure']/1000:g} kPa")
    axes[0].plot(x, [s['footprintLoad'] for s in curve['samples']], '--', color=color)
axes[0].set(title='Two approximate load estimates', xlabel='Hub deflection (mm)', ylabel='Load (N)')
axes[0].legend(loc='upper left', fontsize=9, title='Constant gauge pressure')
axes[0].text(.97, .04, 'Solid: rim stress\nDashed: pressure × footprint', transform=axes[0].transAxes, ha='right', va='bottom', fontsize=9)
g = report['curves'][1]['geometry']
sections = [report['curves'][1]['samples'][0]['centre']] + [p['state']['centre'] for p in report['profiles']]
for s, color in zip(sections, ['#666666']+colors):
    angle = np.linspace(-np.pi/2, s['phi'], 200)
    x = s['footprintWidth']/2+s['radius']*np.cos(angle)
    z = s['radius']*(1+np.sin(angle))
    axes[1].plot(x*1000, z*1000, color=color, label=f"{s['compression']*1000:.2f} mm")
    axes[1].plot(-x*1000, z*1000, color=color)
    axes[1].plot(np.array([-1, 1])*g['rimWidth']*500, [s['height']*1000]*2, '--', color=color, lw=.8)
    axes[1].plot(np.array([-1, 1])*s['footprintWidth']*500, [0, 0], color=color)
axes[1].axhline(0, color='#555555', lw=.7)
axes[1].set(title='Centre cross sections', xlabel='Transverse position (mm)', ylabel='Height above plane (mm)', aspect='equal')
axes[1].legend(title='Compression', fontsize=8, loc='upper center', bbox_to_anchor=(.5, -.2), ncol=2)
for profile, color in zip(report['profiles'], colors):
    s = profile['state']
    half = s['sections']
    x = [-v['longitudinal']*1000 for v in half[:0:-1]]+[v['longitudinal']*1000 for v in half]
    y = [v['footprintWidth']*500 for v in half[:0:-1]]+[v['footprintWidth']*500 for v in half]
    axes[2].plot(x, y, color=color, label=f"{s['deflection']*1000:.2f} mm")
    axes[2].plot(x, [-v for v in y], color=color)
axes[2].set(title='Growing footprint', xlabel='Longitudinal position (mm)', ylabel='Transverse position (mm)', aspect='equal')
axes[2].legend(title='Hub deflection', fontsize=8, loc='upper center', bbox_to_anchor=(.5, -.85), ncol=2)
for ax in axes:
    ax.grid(alpha=.2)
fig.suptitle('Independent membrane reference · illustrative MTB geometry · no calibration claim', fontsize=13)
fig.savefig(source.parent / 'tyre-static-reference.svg', metadata={'Date': None})
fig.savefig(source.parent / 'tyre-static-reference.png', dpi=170)
