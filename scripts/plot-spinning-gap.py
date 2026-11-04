"""Plot saved prescribed-state evidence; this never runs or changes the physics."""
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

directory = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/spinning-gap')
report = json.loads((directory / 'report.json').read_text())
assert report['model'] == 'bikelab-prescribed-spinning-gap-0.1'
assert len(report['samples']) == 36
plt.rcParams.update({'font.size': 10, 'svg.hashsalt': 'bikelab-spinning-gap-0.1'})
fig, axes = plt.subplots(1, 3, figsize=(14, 4.6), layout='constrained')
geometry, forces, residual = axes
sample = next(s for s in report['samples'] if s['name'] == 'loaded-common' and s['angle'] == 0 and s['omega'] == 0)
points = [[p[0]+sample['hubPosition'][0], p[1]+sample['hubPosition'][1]] for p in sample['worldOffsets']]
loop = points + points[:1]
geometry.plot([p[0] for p in loop], [p[1] for p in loop], '.-', color='#2b6f99', lw=1)
geometry.scatter(*sample['hubPosition'], color='#e08e27', s=45, label='Hub')
geometry.scatter(*points[0], color='#ae3d3d', s=45, label='Contact vertex')
geometry.axhline(0, color='#333333', lw=1)
geometry.set(xlabel='World x (m)', ylabel='World z (m)', title='Same world geometry and velocity')
geometry.set_aspect('equal')
geometry.legend(loc='upper right', fontsize=8)

for name, label, color in [('loaded-common', 'Common translation', '#2b6f99'), ('loaded-shear', 'Nodes move +0.2 m/s relative to hub', '#bd5c27')]:
    samples = sorted((s for s in report['samples'] if s['name'] == name and s['angle'] == 0), key=lambda s: s['omega'])
    rows = [s['rows'][0] for s in samples]
    omega = [s['omega'] for s in samples]
    forces.plot(omega, [r['nativeForce'] for r in rows], 'o-', color=color, label=label)
    residual.plot(omega, [r['physicalLawResidual'] for r in rows], 'o-', color=color, label=label)
    residual.plot(omega, [r['convective'] for r in rows], 'x--', color='#333333', lw=1, markersize=8)
forces.set(xlabel='Hub spin (rad/s)', ylabel='Native normal force (N)', title='Force changes with prescribed spin', ylim=(11.5, 13.2))
forces.legend(loc='upper right', fontsize=8)
residual.axhline(0, color='#777777', lw=.7)
residual.set(xlabel='Hub spin (rad/s)', ylabel='Physical law residual (m/s²)', title='Residual matches convective acceleration')
residual.text(.5, .08, 'Crosses: independent convective term\n'+r'Residual: $\ddot{g}+rN-a_{\mathrm{ref}}$', transform=residual.transAxes, ha='center', fontsize=8, bbox={'facecolor':'white','edgecolor':'none','alpha':.9})
for ax in [forces, residual]:
    ax.set_xticks([-10, 0, 10])
    ax.grid(alpha=.2)
fig.suptitle('Spinning-contact isolation · 32 nodes · zero casing stiffness and damping', fontsize=14)
fig.savefig(directory / 'spinning-gap.svg', metadata={'Date': None})
fig.savefig(directory / 'spinning-gap.png', dpi=160)
