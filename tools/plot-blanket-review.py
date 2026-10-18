"""Render the private tracking review; no frame data is copied to the public site."""
from pathlib import Path
import json
import sys
import os

ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'local-data/big-data-bowl/expanded/matplotlib-cache'))
try:
    import matplotlib
except ImportError:
    sys.path.insert(0,str(ROOT/'local-data/big-data-bowl/plot-deps'))
    import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pandas as pd

OUT=ROOT/'local-data/big-data-bowl/expanded'
panels=json.loads((OUT/'review-panels.json').read_text())
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False})
for offset in range(0,len(panels),6):
    subset=panels[offset:offset+6]
    fig,axes=plt.subplots(len(subset),2,figsize=(13,3.0*len(subset)),squeeze=False,layout='constrained')
    fig.suptitle('Private tracking consistency review — inferred assignments, not film verified',fontsize=14)
    for row,p in enumerate(subset):
        f=pd.DataFrame(p['frames']);a,b=axes[row]
        for side,color,label in [('cb','#087f70','CB'),('wr','#af6b00','Receiver')]:
            a.plot(f['x_'+side],f['y_'+side],color=color,label=label,lw=2)
            a.scatter(f['x_'+side].iloc[0],f['y_'+side].iloc[0],color=color,s=35,marker='o')
            a.scatter(f['x_'+side].iloc[-1],f['y_'+side].iloc[-1],color=color,s=40,marker='x')
        a.set_aspect('equal',adjustable='datalim');a.grid(alpha=.2);a.legend(fontsize=8,loc='best')
        a.set_title(f"{p['review_id']} · {p['game_id']} / {p['play_id']} · {p['route']}",fontsize=10)
        a.set_xlabel('Field x (assumed yards)');a.set_ylabel('Field y (assumed yards)')
        b.plot(f.seconds,f.distance,color='#087f70',lw=2)
        b.axhline(1,color='#af6b00',ls='--',label='1-yard threshold')
        b.axhline(p['mean'],color='#777',ls=':',label='Time average')
        b.set_ylim(bottom=0);b.set_xlabel('Seconds after snap');b.set_ylabel('Separation (assumed yards)');b.grid(alpha=.2)
        b.set_title(f"Mean {p['mean']:.2f} · Blanket {p['blanket']} · runners {p['observed_runners']} · reciprocal {p['mutual']}",fontsize=10)
    destination=OUT/f'review-sheet-{offset//6+1}.png'
    fig.savefig(destination,dpi=130)
    plt.close(fig)
    print(destination)
