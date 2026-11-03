"""Scientific consumer of saved contact traces and predeclared comparisons."""
import hashlib
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

directory = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/casing-entry-substeps')
report = json.loads((directory / 'report.json').read_text())
baseline = json.loads(Path('docs/evidence/casing-entry-baseline.json').read_text())
plt.rcParams.update({'svg.fonttype': 'none', 'svg.hashsalt': 'bikelab-contact-entry', 'font.size': 10})
figure, axes = plt.subplots(3, 2, figsize=(13, 12), layout='constrained')
for case in report['cases']:
    data = (directory / case['file']).read_bytes()
    assert hashlib.sha256(data).hexdigest() == case['sha256']
    record = json.loads(data)
    trace = record['contactTrace']
    raw = (directory / trace['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == trace['sha256']
    samples = np.frombuffer(raw, dtype='<f8').reshape(trace['rows'], len(trace['columns']))
    endpoints = samples[::5]
    time = endpoints[:, 0] * 1000
    label = f'{record["diagnostic"]["dt"] * 1e6:g} µs outer step'
    if case['name'] == 'drop':
        selected = (time >= .097) & (time <= .102)
        axes[0, 0].plot(time[selected] * 1000, endpoints[selected, 5] * 1e6, marker='.', label=label)
        axes[0, 1].plot(time[selected] * 1000, endpoints[selected, 4], marker='.', label=label)
    else:
        axes[1, 0].plot(time, endpoints[:, 5] * 1e6, label=label)
        axes[1, 1].plot(time, endpoints[:, 4], label=label)
analytic = next(c['analysis']['analyticEntry'] for c in report['cases'] if c['name'] == 'drop') * 1e6
for ax in axes[0]:
    ax.axvline(analytic, color='black', linestyle=':', label='Analytic first touch')
    ax.set_xlabel('Time (µs)')
    ax.legend(fontsize=7)
axes[0, 0].axhline(0, color='grey', linestyle=':')
axes[0, 0].set(ylabel='Minimum vertex-plane gap (µm)', title='First contact: accepted endpoints near analytic touch')
axes[0, 1].set(ylabel='Normal force (N)', title='Unchanged force discontinuity, locally resolved steps')
axes[1, 0].axhline(0, color='grey', linestyle=':')
axes[1, 0].set(xlabel='Time (ms)', ylabel='Minimum vertex-plane gap (µm)', title='Upward release: separation and recontact')
axes[1, 1].set(xlabel='Time (ms)', ylabel='Normal force (N)', title='Unloading is distinct from geometrical separation')
for ax in axes[1]:
    ax.legend(fontsize=7)
budgets = report['cases'][0]['budgets']['refinement']
keys = list(budgets)
groups = [('Fixed drop (failed)', baseline['refinement']),
          ('Substeps drop', [c for c in report['refinement'] if c['name'] == 'drop']),
          ('Substeps recontact', [c for c in report['refinement'] if c['name'] == 'recontact'])]
for index, (label, rows) in enumerate(groups):
    values = [max(r['maxima'][k] / (r['budgetFraction'] * budgets[k]) for r in rows) for k in keys]
    axes[2, 0].bar(np.arange(len(keys)) + (index - 1) * .25, values, width=.25, label=label)
axes[2, 0].set_yscale('log')
axes[2, 0].set_xticks(np.arange(len(keys)), ['Position', 'Velocity', 'Force', 'Impulse', 'Loss', 'Work', 'Residual'], rotation=30)
axes[2, 0].axhline(1, color='black', linestyle=':')
axes[2, 0].set(ylabel='Worst discrepancy / original halving budget', title='Original acceptance limits retained')
axes[2, 0].legend(fontsize=7)
counts = [c['summary']['stepping']['acceptedSubsteps'] - c['summary']['steps'] for c in report['cases']]
bars = axes[2, 1].bar(range(len(counts)), counts)
axes[2, 1].bar_label(bars, padding=3)
axes[2, 1].set_xticks(range(len(counts)), [c['file'].removesuffix('.json') for c in report['cases']], rotation=30)
axes[2, 1].set(ylabel='Additional accepted substeps', title='Bounded transition work (counts, not a timing benchmark)', ylim=(0, max(counts) * 1.3))
for ax in axes.flat:
    ax.grid(alpha=.2, axis='y')
figure.suptitle('Translating tyre contact entry and recontact · flat plane · 20 ms controls')
figure.savefig(directory / 'diagnostic.png', dpi=150)
target = directory / 'diagnostic.svg'
figure.savefig(target, metadata={'Date': None})
target.write_text('\n'.join(line.rstrip() for line in target.read_text().splitlines()) + '\n')
