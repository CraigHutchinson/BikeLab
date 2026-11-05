"""Plot saved pressure, area and compounded force; no physics is rerun."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

source = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/tyre-pressure/report.json')
report = json.loads(source.read_text())
assert report['model'] == 'bikelab-prescribed-strip-pressure-0.1'
plt.rcParams.update({'font.size': 10, 'svg.hashsalt': 'bikelab-strip-pressure-0.1'})
fig, axes = plt.subplots(1, 3, figsize=(13, 4.4), layout='constrained')
for index, (curve, color) in enumerate(zip(report['curves'], ['#286b98', '#387f51', '#b65525'])):
    samples = curve['samples']
    initial = curve['configuration']['initialGaugePressure']
    depth = [s['compression'][0]*1000 for s in samples]
    area = [sum(n['effectiveArea'] for n in s['state']['nodes']) for s in samples]
    force = [sum(n['resistingForce'] for n in s['state']['nodes']) for s in samples]
    axes[0].plot(depth, [s['state']['gaugePressure']/1000 for s in samples], color=color, label=f'{initial/1000:g} kPa')
    if index == 1:
        axes[1].plot(depth, [a*10000 for a in area], color=color)
    axes[2].plot(depth, force, color=color)
    axes[2].plot(depth, [initial*a for a in area], '--', color=color, alpha=.65)
axes[0].set(title='Sealed chamber pressure', ylabel='Gauge pressure (kPa)')
handles, labels = axes[0].get_legend_handles_labels()
fig.legend(handles, labels, title='Initial gauge pressure', loc='outside lower center', ncol=3)
axes[1].set(title='Changing effective area', ylabel='Effective area (cm²)')
axes[2].set(title='Combined force', ylabel='Resisting force (N)')
axes[2].text(.03, .95, 'Solid: pressure × area\nDashed: initial pressure × area', va='top', transform=axes[2].transAxes, fontsize=9)
for ax in axes:
    ax.set_xlabel('Prescribed uniform compression (mm)')
    ax.grid(alpha=.2)
fig.suptitle('Illustrative strip chamber · geometry and gas pressure compound', fontsize=13)
fig.savefig(source.parent / 'tyre-pressure.svg', metadata={'Date': None})
fig.savefig(source.parent / 'tyre-pressure.png', dpi=160)

svg = source.parent / 'tyre-pressure.svg'
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines()) + '\n')
