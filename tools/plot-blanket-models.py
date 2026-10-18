"""Plot public aggregate held-out-player model errors, never player trajectories."""
from pathlib import Path
import os
import sys
import json

ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'local-data/big-data-bowl/expanded/matplotlib-cache'))
try:
    import matplotlib
except ImportError:
    sys.path.insert(0,str(ROOT/'local-data/big-data-bowl/plot-deps'))
    import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

data=json.loads((ROOT/'_data/blanket_expanded.json').read_text(encoding='utf-8'))
models=data['models']
labels=[m['drill'].replace(' / ','/')+' · '+m['feature'].replace('_',' ') for m in models]
estimate=np.array([m['mae_improvement'] for m in models])
lower=np.array([m['improvement_95'][0] for m in models])
upper=np.array([m['improvement_95'][1] for m in models])
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'svg.hashsalt':'blanket-v4'})
fig,ax=plt.subplots(figsize=(10,6),layout='constrained')
fig.patch.set_facecolor('#f4f5ee');ax.set_facecolor('#f4f5ee')
y=np.arange(len(models))
ax.errorbar(estimate,y,xerr=[estimate-lower,upper-estimate],fmt='o',color='#245b49',capsize=4,lw=1.6,markersize=5)
ax.axvline(0,color='#6a7169',ls='--',lw=1)
ax.set_yticks(y,labels);ax.invert_yaxis();ax.grid(axis='x',alpha=.2)
ax.set_xlabel('Reduction in held-out-player MAE (yards): positive favors the added feature',labelpad=12)
ax.set_title('Do drill features improve the context baseline?',loc='left',fontweight='bold',pad=37,fontsize=15)
ax.text(0,1.04,'26 CBs · 9 exploratory comparisons · bars resample held-out error differences',transform=ax.transAxes,fontsize=10,color='#52665e')
for split in [2.5,5.5]:ax.axhline(split,color='#d9dfd1',lw=1)
destination=ROOT/'assets/images/blanket'
destination.mkdir(parents=True,exist_ok=True)
for ext in ['png','svg']:
    target=destination/f'held-out-models.{ext}'
    fig.savefig(target,dpi=160,metadata={'Date':None} if ext=='svg' else {})
    if ext=='svg':
        target.write_text('\n'.join(line.rstrip() for line in target.read_text(encoding='utf-8').splitlines())+'\n',encoding='utf-8')
plt.close(fig)
print(destination/'held-out-models.png')
