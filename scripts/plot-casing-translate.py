"""Scientific consumer of saved translating-hub records; no physics execution."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

directory = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/casing-translate')
report = json.loads((directory / 'report.json').read_text())
plt.rcParams.update({'svg.fonttype': 'none', 'svg.hashsalt': 'bikelab-translating-hub', 'font.size': 10})
has_normal_oracle = all(c.get('normalOracle') for c in report['cases'])
figure, axes = plt.subplots(3 if has_normal_oracle else 2, 2,
                            figsize=(13, 13 if has_normal_oracle else 9), layout='constrained')
selected = []
for start in range(0, len(report['cases']), 3):
    case = report['cases'][start + 2]
    record = json.loads((directory / case['file']).read_text())
    assert record['status'] == 'completed'
    selected.append(record)
    frames = record['frames']
    axes[0, 0].plot([f['time'] * 1000 for f in frames],
                    [(f['hub'][1] - frames[0]['hub'][1]) * 1000 for f in frames],
                    linestyle='--' if record['input']['rates'] == 'zero' else '-',
                    label=case['file'].removesuffix('-2.json'))
axes[0, 0].set(xlabel='Time (ms)', ylabel='Hub rise (mm)', title='Released hub: 1.5 kg hub plus 1 kg casing')
axes[0, 0].legend(fontsize=7)
first = selected[0]
frames = first['frames']
time = [f['time'] * 1000 for f in frames]
axes[0, 1].plot(time, [f['verticalForce'] for f in frames], label='Ground resultant on complete wheel')
axes[0, 1].plot(time, [f['hubReaction'][1] for f in frames], label='Casing force on hub')
axes[0, 1].set(xlabel='Time (ms)', ylabel='Upward force (N)', title='Full-front imported: distinct physical loads')
axes[0, 1].legend(fontsize=8)
budgets = first['budgets']['refinement']
keys = list(budgets)
for index, fraction in enumerate([1, .1]):
    comparisons = [r for r in report['refinement'] if r['budgetFraction'] == fraction]
    values = [max(r['maxima'][k] / (fraction * budgets[k]) for r in comparisons) for k in keys]
    axes[1, 0].bar(np.arange(len(keys)) + (index - .5) * .35, values, width=.35,
                   label='Candidate halving / budget' if index == 0 else 'Finer halving / 0.1 budget')
axes[1, 0].set_yscale('log')
axes[1, 0].set_xticks(np.arange(len(keys)), ['Position', 'Velocity', 'Force', 'Impulse', 'Loss', 'Work', 'Residual'], rotation=30)
axes[1, 0].axhline(1, color='black', linestyle=':')
passed = sum(r['withinBudgets'] for r in report['refinement'])
axes[1, 0].set(ylabel='Worst discrepancy / declared budget', title=f'{passed}/{len(report["refinement"])} refinement comparisons meet budgets')
axes[1, 0].legend(fontsize=8)
for index, kind in enumerate(['fixed', 'translating']):
    row = first['compiled'][kind]['rows'][0]
    values = [row['diagonalApproximation'], row['regularizer']]
    bars = axes[1, 1].bar(np.arange(2) + (index - .5) * .35, values, width=.35, label=kind.capitalize() + ' hub')
    axes[1, 1].bar_label(bars, fmt='%.6g', padding=3, fontsize=8)
axes[1, 1].set_yscale('log')
axes[1, 1].set_xticks(np.arange(2), ['Approximate diagonal A', 'Regularizer R'])
axes[1, 1].set(ylabel='Compiled coefficient (1/kg)', title='Same contact settings, different compiled regularization')
axes[1, 1].legend(fontsize=8)
axes[1, 1].set_ylim(.2, 200)
if has_normal_oracle:
    for record in selected:
        frames = record['frames']
        axes[2, 0].step([f['time'] * 1000 for f in frames], [f['contacts'] for f in frames],
                        where='post', linestyle='--' if record['input']['rates'] == 'zero' else '-')
    axes[2, 0].set(xlabel='Time (ms)', ylabel='Detected contacts',
                   title='All eight inputs: separation in saved 0.125 ms frames', yticks=range(7))
    names = ['normalForce', 'referenceAcceleration', 'regularizer']
    values = [max(c['summary']['maxIndependent'][k] / c['budgets']['independent'][k]
                  for c in report['cases']) for k in names]
    bars = axes[2, 1].bar(range(3), values)
    axes[2, 1].bar_label(bars, fmt='%.3g', padding=3)
    axes[2, 1].set_yscale('log')
    axes[2, 1].set_xticks(range(3), ['Force / 1e-7 N', 'Reference / 1e-7 m/s²', 'Regularizer / 1e-12 kg⁻¹'])
    axes[2, 1].axhline(1, color='black', linestyle=':')
    axes[2, 1].set(ylabel='Worst independent discrepancy / budget',
                   title='Normal law: all cases, stages and accepted endpoints', ylim=(1e-6, 3))
for ax in axes.flat:
    ax.grid(alpha=.2, axis='y')
figure.suptitle(f'Translating, nonspinning hub · {report["duration"] * 1000:g} ms · flat native vertex contact')
figure.savefig(directory / 'diagnostic.png', dpi=150)
target = directory / 'diagnostic.svg'
figure.savefig(target, metadata={'Date': None})
target.write_text('\n'.join(line.rstrip() for line in target.read_text().splitlines()) + '\n')
