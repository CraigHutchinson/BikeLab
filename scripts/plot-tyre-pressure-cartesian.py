"""Render saved geometry and force vectors, without rerunning the physics."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

source = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/tyre-pressure-cartesian/report.json')
r = json.loads(source.read_text())
assert r['state']['model'] == 'bikelab-radial-strip-map-0.1'
plt.rcParams['svg.hashsalt'] = 'bikelab-radial-strip-map-0.1'
fig, (ax, bars) = plt.subplots(1, 2, figsize=(11, 5), layout='constrained')
points = [r['hub']] + r['positions']
forces = [r['state']['hubForce']] + r['state']['nodeForces']
names = ['Hub', 'Strip 0', 'Strip 1', 'Strip 2']
for p, f, label in zip(points, forces, names):
    ax.scatter(*p, color='#286b98')
    ax.annotate(label, p, xytext=(5, 7), textcoords='offset points')
    ax.quiver(*p, *f, angles='xy', scale_units='xy', scale=1000, color='#b65525')
for p in r['positions']:
    ax.plot([r['hub'][0], p[0]], [r['hub'][1], p[1]], color='gray', alpha=.4)
ax.set(xlabel='World x (m)', ylabel='World z (m)', title='Current radial directions and hub reaction', xlim=(-.3, .8), ylim=(-.6, .6))
ax.set_aspect('equal')
ax.text(.03, .02, 'Arrow scale: 100 N = 0.1 m', transform=ax.transAxes, fontsize=9)
x = range(len(points))
bars.bar([i-.18 for i in x], [f[0] for f in forces], width=.36, label='Fx')
bars.bar([i+.18 for i in x], [f[1] for f in forces], width=.36, label='Fz')
bars.set(xticks=list(x), xticklabels=names, ylabel='Force (N)', title='Equal and opposite total force')
bars.axhline(0, color='gray', linewidth=.6)
bars.legend()
fig.suptitle('Illustrative radial strip mapping · no casing prestress or insert', fontsize=12)
fig.savefig(source.parent / 'geometry.png', dpi=160)
svg = source.parent / 'geometry.svg'
fig.savefig(svg, metadata={'Date': None})
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines()) + '\n')
