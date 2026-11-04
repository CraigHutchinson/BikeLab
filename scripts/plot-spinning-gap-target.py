"""Plot saved native/physical target controls without running the solver."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

directory = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/spinning-gap-target')
report = json.loads((directory / 'report.json').read_text())
assert report['model'] == 'bikelab-prescribed-physical-gap-target-0.1'
assert len(report['samples']) == 48
plt.rcParams.update({'font.size': 10, 'svg.hashsalt': 'bikelab-physical-gap-target-0.1'})
fig, axes = plt.subplots(1, 2, figsize=(11, 4.7), layout='constrained')
for name, label, color in [('loaded-common', 'Common translation', '#2b6f99'), ('loaded-shear', 'Relative horizontal velocity', '#bd5c27')]:
    cases = sorted((s for s in report['samples'] if s['input']['name'] == name and s['input']['angle'] == 0), key=lambda s: s['input']['omega'])
    omega = [s['input']['omega'] for s in cases]
    axes[0].plot(omega, [s['native']['rows'][0]['nativeForce'] for s in cases], 'o--', color=color, label=label+' · native')
    axes[0].plot(omega, [s['corrected']['rows'][0]['nativeForce'] for s in cases], 'x-', color=color, markersize=8, label=label+' · physical target')
    axes[1].plot(omega, [s['native']['rows'][0]['physicalResidual'] for s in cases], 'o--', color=color)
    axes[1].plot(omega, [s['corrected']['rows'][0]['physicalResidual'] for s in cases], 'x-', color=color, markersize=8)
axes[0].set(title='Normal response becomes spin-invariant', xlabel='Hub spin (rad/s)', ylabel='Normal force (N)', ylim=(11.5, 13.5))
axes[0].legend(fontsize=8, loc='upper center')
axes[1].set(title='Physical acceleration reference is satisfied', xlabel='Hub spin (rad/s)', ylabel='Physical-law residual (m/s²)', ylim=(-43, 8))
axes[1].text(.5, .1, 'Dashed / circles: native target\nSolid / crosses: physical target\nLines connect sampled states', ha='center', transform=axes[1].transAxes, fontsize=9, bbox={'facecolor':'white','edgecolor':'none','alpha':.95})
for ax in axes:
    ax.set_xticks([-10, 0, 10])
    ax.grid(alpha=.2)
fig.suptitle('Prescribed target intervention · 48 states · 1,248 native re-solves', fontsize=13)
fig.savefig(directory / 'spinning-gap-target.svg', metadata={'Date': None})
fig.savefig(directory / 'spinning-gap-target.png', dpi=160)
