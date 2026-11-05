"""Plot saved candidate errors; no physics is rerun."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

source = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/tyre-candidate-screen/report.json')
r = json.loads(source.read_text())
assert r['model'] == 'bikelab-scalar-tyre-candidate-screen-0.1'
plt.rcParams['svg.hashsalt'] = r['model']
fig, axes = plt.subplots(1, 2, figsize=(11, 4.5), layout='constrained')
labels = {'linearAtAnchor': 'Linear, anchored at 10%', 'threeHalvesAtAnchor': '3/2 power, anchored at 10%', 'derivedSmallLoad': 'Derived small-load limit'}
for ax, name in zip(axes, ['illustrative-mtb', 'illustrative-narrow']):
    rows = [x for x in r['rows'] if x['name'] == name and x['configuration']['gaugePressure'] == 160000]
    for key, label in labels.items():
        ax.plot([100*x['fraction'] for x in rows], [100*x['relativeErrors'][key] for x in rows], marker='.', label=label)
    ax.axhline(0, color='gray', linewidth=.6)
    ax.axvline(10, color='gray', linewidth=.6, linestyle=':')
    ax.set(title=name, xlabel='Deflection / unloaded section height (%)', ylabel='Load error versus rim-stress reference (%)')
    ax.grid(alpha=.2)
handles, names = axes[0].get_legend_handles_labels()
fig.legend(handles, names, loc='outside lower center', ncol=3)
fig.suptitle('Illustrative scalar screen · no casing equilibrium or calibration', fontsize=12)
fig.savefig(source.parent / 'comparison.png', dpi=160)
svg = source.parent / 'comparison.svg'
fig.savefig(svg, metadata={'Date': None})
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines()) + '\n')
