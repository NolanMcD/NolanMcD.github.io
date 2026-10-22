"""Render public aggregate measurement audits; never export individual tracking."""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / 'local-data/big-data-bowl/expanded/matplotlib-cache'))
try:
    import matplotlib
except ImportError:
    sys.path.insert(0, str(ROOT / 'local-data/big-data-bowl/plot-deps'))
    import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

data = json.loads((ROOT / '_data/blanket_validation.json').read_text(encoding='utf-8'))
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10,
                     'axes.spines.top': False, 'axes.spines.right': False, 'svg.hashsalt': 'blanket-validation-v1'})
destination = ROOT / 'assets/images/blanket'
destination.mkdir(parents=True, exist_ok=True)


def save(fig, name):
    for ext in ['png', 'svg']:
        target = destination / f'{name}.{ext}'
        fig.savefig(target, dpi=160, metadata={'Date': None} if ext == 'svg' else {})
        if ext == 'svg':
            target.write_text('\n'.join(line.rstrip() for line in target.read_text(encoding='utf-8').splitlines()) + '\n', encoding='utf-8')
    plt.close(fig)


fig, ax = plt.subplots(figsize=(10, 6.5), layout='constrained')
fig.patch.set_facecolor('#f4f5ee')
rows, labels = [], []
for drill in data['phases']['drills']:
    variants = [v for v in drill['variants'] if v['setting'] != 'Elapsed-time reference']
    for feature in ['turn_speed', 'braking_loss', 'reacceleration']:
        rows.append([v['player_rank_correlations'][feature] for v in variants])
        labels.append(drill['drill'].replace(' / ', '/') + ' | ' + feature.replace('_', ' '))
matrix = np.asarray([[np.nan if v is None else v for v in row] for row in rows])
im = ax.imshow(matrix, vmin=-1, vmax=1, cmap='BrBG', aspect='auto')
ax.set_yticks(range(len(labels)), labels)
ax.set_xticks(range(7), ['No\nsmoothing', '5-frame\nsmoothing', '0.2 s\nheading', '0.6 s\nheading', '0.4 s\nflanks', '0.8 s\nflanks', 'x/y-derived\nheading'], fontsize=9)
for i, row in enumerate(matrix):
    for j, v in enumerate(row):
        ax.text(j, i, 'N/A' if np.isnan(v) else f'{v:.2f}', ha='center', va='center',
                color='white' if abs(v) > .65 else '#172d27', fontsize=10)
for split in [2.5, 5.5]:
    ax.axhline(split, color='white', lw=2)
ax.set_title('How much do movement-feature rankings depend on the detector?', loc='left', fontweight='bold', pad=30, fontsize=13)
fig.suptitle('Spearman correlation with published player-median features; 60 CBs per drill\nSensitivity and geometric agreement are not independent phase validation.', fontsize=10, color='#52665e')
fig.colorbar(im, ax=ax, shrink=.7, label='Player-rank correlation')
save(fig, 'phase-sensitivity')

fig, axes = plt.subplots(1, 2, figsize=(10, 5), layout='constrained', gridspec_kw={'width_ratios': [1, 1.3]})
fig.patch.set_facecolor('#f4f5ee')
ax = axes[0]
matrix = np.array([c['reps'] for c in data['application']['cells']]).reshape(2, 2)
ax.imshow(matrix, cmap='Greens', vmin=0, vmax=max(matrix.ravel()))
ax.set_xticks([0, 1], ['<1 yard', '>=1 yard'])
ax.set_yticks([0, 1], ['<1 yard', '>=1 yard'])
ax.set_xlabel('Separation at throw')
ax.set_ylabel('Average snap-to-throw separation')
ax.set_title('Two measurements, different questions', fontsize=11, pad=15)
for i in range(2):
    for j in range(2):
        ax.text(j, i, str(matrix[i, j]), ha='center', va='center', fontsize=22, fontweight='bold',
                color='white' if matrix[i, j] > 300 else '#172d27')
ax = axes[1]
strata = data['application']['cushion_strata']
x = np.arange(3)
for offset, field, label, color in [(-.18, 'average_tight', 'Average <1 yard', '#245b49'), (.18, 'throw_tight', 'Throw <1 yard', '#a66a16')]:
    rates = [100 * s[field] / s['reps'] for s in strata]
    bars = ax.bar(x + offset, rates, .34, label=label, color=color)
    ax.bar_label(bars, labels=[f"{s[field]}/{s['reps']}" for s in strata], fontsize=8, padding=3)
ax.set_xticks(x, ['<2 yd', '2 to <3 yd', '3 to 5 yd'])
ax.set_xlabel('Starting cushion')
ax.set_ylabel('Share of measured pairs (%)')
ax.set_ylim(0, 55)
ax.set_title('Starting alignment changes interpretation', fontsize=11, pad=15)
ax.legend(loc='upper right', fontsize=8)
fig.suptitle(f"{data['screened_reps']} inferred pairs | Descriptive only; assignments remain unverified", fontsize=11)
save(fig, 'coverage-context')
print(destination / 'phase-sensitivity.png')
print(destination / 'coverage-context.png')
