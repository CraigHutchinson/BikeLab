"""Inspect prescribed contact-gap/Jacobian consistency (optional Matplotlib)."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

directory = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/contact-gap')
report = json.loads((directory / 'report.json').read_text())
mesh = [s for s in report['samples'] if s['kind'] == 'mesh']
plane = [s for s in report['samples'] if s['kind'] == 'plane']
plt.rcParams.update({'svg.fonttype': 'none', 'svg.hashsalt': 'bikelab-contact-gap', 'font.size': 10})
fig, axes = plt.subplots(1, 2, figsize=(12, 4.6), layout='constrained')
delta = [s['delta'] * 1e6 for s in mesh]
axes[0].plot(delta, [s['contacts'][0]['rowVelocity'] for s in mesh], 'o-', label='Native mesh row velocity')
axes[0].plot(delta, [s['contacts'][0]['exactGapDerivative'] if s['delta'] else np.nan for s in mesh], 's--', label='Actual capsule gap derivative')
verified = [s for s in mesh if abs(s['delta']) >= 1e-6]
axes[0].scatter([s['delta'] * 1e6 for s in verified], [s['finiteDifference'] for s in verified], marker='x', s=70, color='black', label='Native gap finite difference (resolved offsets)')
axes[0].set(ylabel='Gap rate / constraint velocity (m/s)', title='Mesh row differs by ≈32.5% with an accurate normal')
axes[0].legend(fontsize=8)
for vertex in [0, 1]:
    axes[1].plot(delta, [s['contacts'][vertex]['rowVelocity'] for s in plane], 'o-', label='Plane vertex ' + str(vertex) + ': exact gap rate')
axes[1].set(ylabel='Vertex gap rate (m/s)', title='Plane changes to two vertex-normal rows')
axes[1].legend(fontsize=8)
for ax in axes:
    ax.set_xscale('symlog', linthresh=.001)
    ax.set_xlabel('Endpoint height difference z₁ − z₀ (µm)')
    ax.grid(alpha=.25)
fig.suptitle('Prescribed 40 mm capsule, 8 mm radius: endpoints move at +0.01 / −0.01 m/s')
fig.savefig(directory / 'diagnostic.png', dpi=150)
target = directory / 'diagnostic.svg'
fig.savefig(target, metadata={'Date': None})
target.write_text('\n'.join(line.rstrip() for line in target.read_text().splitlines()) + '\n')
