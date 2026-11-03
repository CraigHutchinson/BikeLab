"""Scientific consumer of hash-verified loaded contact records; no integration."""
import hashlib
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

directory = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/casing-contact-loaded-20ms')
report = json.loads((directory / 'report.json').read_text())
assert report['state'] == 'completed' and report['receiving']['coverage']
records = []
for case in report['cases']:
    raw = (directory / case['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == case['sha256']
    record = json.loads(raw)
    assert record['summary'] == case['summary'] and record['status'] == 'completed'
    records.append(record)
plt.rcParams.update({'svg.fonttype': 'none', 'svg.hashsalt': 'bikelab-loaded-contact', 'font.size': 10})
figure, axes = plt.subplots(3, 2, figsize=(13, 13), layout='constrained')
selected = list(zip(report['cases'][2::3], records[2::3]))
for case, record in selected:
    frames = record['frames']
    time = [f['time'] * 1000 for f in frames]
    style = '--' if record['input']['rates'] == 'zero' else '-'
    axes[0, 0].plot(time, [(f['hub'][1] - frames[0]['hub'][1]) * 1000 for f in frames],
                    linestyle=style, label=case['name'])
    axes[2, 0].step(time, [f['contacts'] for f in frames], where='post', linestyle=style)
axes[0, 0].set(xlabel='Time (ms)', ylabel='Hub rise (mm)', title='Loaded releases: finest step, eight inputs')
axes[0, 0].legend(fontsize=7)
frames = records[2]['frames']
time = [f['time'] * 1000 for f in frames]
axes[0, 1].plot(time, [f['verticalForce'] for f in frames], label='Ground force on complete wheel')
axes[0, 1].plot(time, [f['hubReaction'][1] for f in frames], label='Casing force on hub')
axes[0, 1].set(xlabel='Time (ms)', ylabel='Upward force (N)', title='Full-front imported: distinct physical loads')
axes[0, 1].legend(fontsize=8)
budgets = records[0]['budgets']['refinement']
for index, fraction in enumerate([1, .1]):
    subset = [r for r in report['refinement'] if r['budgetFraction'] == fraction]
    values = [max(r['maxima'][k] / (fraction * budgets[k]) for r in subset) for k in budgets]
    axes[1, 0].bar(np.arange(len(budgets)) + (index - .5) * .35, values, width=.35,
                   label='Candidate halving / budget' if index == 0 else 'Finer halving / 0.1 budget')
axes[1, 0].set_yscale('log')
axes[1, 0].set_xticks(np.arange(len(budgets)), ['Position', 'Velocity', 'Force', 'Impulse', 'Loss', 'Work', 'Residual'], rotation=30)
axes[1, 0].axhline(1, color='black', linestyle=':')
passed = sum(r['withinBudgets'] for r in report['refinement'])
axes[1, 0].set(ylabel='Worst discrepancy / declared budget', title=f'{passed}/16 refinement comparisons meet original budgets')
axes[1, 0].legend(fontsize=8)
for index, step in enumerate([1.953125, .9765625, .48828125]):
    values = [r['summary']['stepping']['acceptedSubsteps'] - r['summary']['steps'] for r in records[index::3]]
    axes[1, 1].bar(np.arange(8) + (index - 1) * .25, values, width=.25, label=f'{step:g} µs')
axes[1, 1].set_xticks(np.arange(8), [c['name'].replace('-imported', '\nimported').replace('-zero', '\nzero') for c, _ in selected], rotation=40, fontsize=8)
axes[1, 1].set(ylabel='Extra accepted substeps', title='Bounded refinement work (cap 4,096 per run)')
axes[1, 1].legend(fontsize=8)
axes[2, 0].set(xlabel='Time (ms)', ylabel='Detected contacts', title='Saved endpoints every 0.125 ms; no cycle-count claim', yticks=range(7))
keys = ['balance', 'normalForce', 'referenceAcceleration', 'regularizer']
values = [max(r['summary']['maxIndependent'][k] / r['budgets']['independent'][k] for r in records) for k in keys]
values += [max(r['summary']['maxMomentumError'] / r['budgets']['independent']['momentum'] for r in records),
           max(r['summary']['maxResidual'] / r['budgets']['refinement']['residual'] for r in records)]
axes[2, 1].bar(np.arange(len(values)), values)
axes[2, 1].set_yscale('log')
axes[2, 1].set_xticks(np.arange(len(values)), ['Newton\nbalance', 'Normal\nforce', 'Reference\nacceleration', 'Regularizer', 'Momentum', 'Work\nbalance'], rotation=25)
axes[2, 1].axhline(1, color='black', linestyle=':')
axes[2, 1].set(ylabel='Worst independent discrepancy / SI budget', title='All cases, observed stages and accepted endpoints')
for ax in axes.flat:
    ax.grid(alpha=.2, axis='y')
figure.suptitle(f'Bounded contact policy · {report["duration"] * 1000:g} ms loaded releases · translating, nonspinning wheel')
figure.savefig(directory / 'diagnostic.png', dpi=150)
target = directory / 'diagnostic.svg'
figure.savefig(target, metadata={'Date': None})
target.write_text('\n'.join(line.rstrip() for line in target.read_text().splitlines()) + '\n')
