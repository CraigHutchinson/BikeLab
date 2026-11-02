"""Optional scientific consumer for the loaded RK4 study (Matplotlib)."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

directory = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/casing-loaded-long')
report = json.loads((directory / 'report.json').read_text())
plane = report.get('contactGeometry') == 'plane'
plt.rcParams.update({'svg.fonttype': 'none', 'svg.hashsalt': 'bikelab-loaded-rk4', 'font.size': 10})
figure, axes = plt.subplots(1, 2, figsize=(13, 5), layout='constrained')
for start in range(0, len(report['cases']), 3):
    cases = report['cases'][start:start + 3]
    assert len(cases) == 3 and all(c['status'] == 'completed' for c in cases)
    label = cases[0]['file'].removesuffix('-0.json')
    axes[0].loglog([c['diagnostic']['dt'] * 1e6 for c in cases],
                   [c['summary']['maxResidual'] for c in cases], marker='o', label=label)
axes[0].axhline(report['loadedBudgets']['residual'], color='black', linestyle=':', label='Candidate budget')
axes[0].set(xlabel='RK4 timestep (µs)', ylabel='Maximum |E − E₀ + D − W| (J)', title='Flat vertex contact: work closure at roundoff' if plane else 'Smaller work residual does not qualify the trajectory')
axes[0].legend(fontsize=7, loc='upper right' if plane else 'lower right')
keys = list(report['loadedBudgets'])
for index, fraction in enumerate([1, .1]):
    comparisons = [r for r in report['refinement'] if r['budgetFraction'] == fraction]
    values = [max(r['maxima'][key] / (fraction * report['loadedBudgets'][key]) for r in comparisons) for key in keys]
    axes[1].bar(np.arange(len(keys)) + (index - .5) * .35, values, width=.35,
                label='Candidate halving / budget' if index == 0 else 'Finer halving / 0.1 budget')
axes[1].set_yscale('log')
axes[1].set_xticks(np.arange(len(keys)), ['Position', 'Velocity', 'Force', 'Impulse', 'Loss', 'Work', 'Residual'], rotation=30)
axes[1].axhline(1, color='black', linestyle=':')
axes[1].set(ylabel='Worst discrepancy / declared budget (ratio)', title='All 16 matched-time refinement comparisons pass' if plane else 'Every matched-time refinement comparison fails')
axes[1].legend(fontsize=8)
for ax in axes:
    ax.grid(alpha=.2)
figure.suptitle(('Flat vertex contact' if plane else 'Mesh element contact') + ' · loaded RK4, 20 ms: full/hardtail × front/rear × imported/zero')
figure.savefig(directory / 'diagnostic.png', dpi=150)
target = directory / 'diagnostic.svg'
figure.savefig(target, metadata={'Date': None})
target.write_text('\n'.join(line.rstrip() for line in target.read_text().splitlines()) + '\n')
