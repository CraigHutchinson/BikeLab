"""Plot saved RK4 parity evidence; accepts a JSON or lossless gzip report."""
import base64
import gzip
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

source = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/spinning-rk4-stage/report.json')
destination = Path(sys.argv[2] if len(sys.argv) > 2 else source.parent)
destination.mkdir(parents=True, exist_ok=True)
raw = source.read_bytes()
if source.suffix == '.base64':
    raw = gzip.decompress(base64.decodebytes(raw))
elif source.suffix == '.gz':
    raw = gzip.decompress(raw)
report = json.loads(raw)
assert report['model'] == 'bikelab-scalar-spinning-rk4-stage-0.1'
assert len(report['samples']) == 36 and len(report['ballistic']) == 6
plt.rcParams.update({'font.size': 10, 'svg.hashsalt': 'bikelab-scalar-spinning-rk4-stage-0.1'})
fig, axes = plt.subplots(1, 2, figsize=(12, 4.8), layout='constrained')
for omega, color in [(-10, '#2b6f99'), (0, '#367e49'), (10, '#b45b25')]:
    case = next(s for s in report['samples'] if s['name'] == 'loaded-shear' and s['angle'] == .1 and s['omega'] == omega)
    axes[0].plot([(s['time']-case['input']['time'])*1e6 for s in case['steps']],
                 [s['stages'][3]['verticalForce'] for s in case['steps']],
                 '.-', color=color, label=f'{omega:+} rad/s')
axes[0].set(title='Native-target stages retain the original response', xlabel='Elapsed time (µs)', ylabel='Fourth-stage total normal force (N)')
axes[0].legend(title='Initial hub spin', fontsize=9)
axes[0].text(.97, .95, '576 steps · all native parity errors = 0\non this runtime', ha='right', va='top', transform=axes[0].transAxes, fontsize=9)

names = ['loaded-common', 'loaded-shear', 'loaded-deformed', 'unloading', 'separated-closing', 'excluded-closing']
labels = ['Common', 'Shear', 'Two contacts', 'Unloading', 'Absent', 'Excluded']
values = []
for name in names:
    case = next(s for s in report['samples'] if s['name'] == name and s['angle'] == .1 and s['omega'] == 10)
    values.append(max(abs(a-b) for j, (a, b) in enumerate(zip(case['final']['qacc'], case['endpoint']['qacc'])) if j != 2))
assert all(v > 0 for v in values)
axes[1].bar(labels, values, color='#6f5b9a')
axes[1].set(yscale='log', ylim=(1e-15, 1e-3), title='Stage-four and endpoint acceleration differ', xlabel='Initial contact regime', ylabel='Maximum linear coordinate difference (m/s²)')
axes[1].tick_params(axis='x', labelrotation=25)
axes[1].text(.5, .94, 'Different state evaluations; not a parity error\nInitial angle 0.1 rad, spin +10 rad/s', ha='center', va='top', transform=axes[1].transAxes, fontsize=9)
for ax in axes:
    ax.grid(axis='y', alpha=.2)
fig.suptitle('Restricted scalar RK4 · native targets · 31.25 µs parity controls', fontsize=13)
fig.savefig(destination / 'spinning-rk4-stage.svg', metadata={'Date': None})
fig.savefig(destination / 'spinning-rk4-stage.png', dpi=160)
