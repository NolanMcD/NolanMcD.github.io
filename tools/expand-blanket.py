"""Expanded, provisional combine-to-coverage study. Raw inputs stay private."""
import argparse
import hashlib
import importlib.util
import json
from collections import Counter
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'local-data/big-data-bowl/expanded'
OUT.mkdir(parents=True,exist_ok=True)
spec = importlib.util.spec_from_file_location('blanket',ROOT/'tools/analyze-blanket.py')
blanket = importlib.util.module_from_spec(spec)
spec.loader.exec_module(blanket)
DRILLS = {'W_DRILL':'W drill', 'BACK_PEDAL_AND_90_DEGREE_BREAK_TO_BALL':'90° backpedal / break',
          'BACK_PEDAL_AND_TRANSITION_45_DEGREE_REACTION':'45° backpedal / transition'}


def phase_features(frame):
    """Measure the largest moving heading change, requiring observed flanking data.

    This is an operational dominant-turn window, not a coach-annotated drill phase.
    Use a fixed 0.4-second circular heading difference and +/-0.6 second flanks.
    """
    f=frame.sort_values('time').drop_duplicates('time').copy()
    t=(pd.to_datetime(f.time)-pd.to_datetime(f.time.iloc[0])).dt.total_seconds().to_numpy()
    speed=f.s.rolling(3,center=True,min_periods=1).median().to_numpy()
    radians=np.deg2rad(f.dir.to_numpy())
    sin=pd.Series(np.sin(radians)).rolling(3,center=True,min_periods=1).mean()
    cos=pd.Series(np.cos(radians)).rolling(3,center=True,min_periods=1).mean()
    heading=np.arctan2(sin,cos).to_numpy()
    if len(f)<15 or not np.isfinite(np.column_stack([t,speed,heading])).all() or np.diff(t).max()>.201:
        return None
    swings=np.full(len(f),np.nan)
    for i in range(2,len(f)-2):
        if t[i]-t[0]>=.6 and t[-1]-t[i]>=.6 and speed[i]>=1:
            swings[i]=abs(np.arctan2(np.sin(heading[i+2]-heading[i-2]),np.cos(heading[i+2]-heading[i-2])))
    if not np.isfinite(swings).any() or np.nanmax(swings)<1e-6:return None
    i=int(np.nanargmax(swings))
    center=t[i]
    turn=np.flatnonzero((t>=center-.2-1e-6)&(t<=center+.2+1e-6))
    low=int(turn[np.argmin(speed[turn])])
    before=np.flatnonzero((t>=center-.6-1e-6)&(t<=t[low]-.1+1e-6))
    after=np.flatnonzero((t>=t[low]+.1-1e-6)&(t<=center+.6+1e-6))
    if len(before)==0 or len(after)==0:return None
    pre=int(before[np.argmax(speed[before])]); post=int(after[np.argmax(speed[after])])
    return {'turn_speed':float(speed[low]), 'braking_loss':float((speed[pre]-speed[low])/(t[low]-t[pre])),
            'reacceleration':float((speed[post]-speed[low])/(t[post]-t[low])),
            'heading_change_degrees':float(np.rad2deg(swings[i])), 'center_seconds':float(center),
            'duration':float(t[-1]),'turn_seconds':float(t[low]),'pre_seconds':float(t[pre]),'post_seconds':float(t[post])}


def drill_table(drill,cb_ids):
    selected=drill[drill.nfl_id.isin(cb_ids)&(drill.entity_type=='PLAYER')&drill.drill_name.isin(DRILLS)]
    attempts=[]; rejected=Counter()
    for (pid,name,event,attempt),f in selected.groupby(['nfl_id','drill_name','event_id','attempt']):
        features=phase_features(f)
        if features is None:rejected[name]+=1;continue
        attempts.append({'nfl_id':int(pid),'drill':name,'event_id':event,'attempt':int(attempt),**features})
    a=pd.DataFrame(attempts)
    a.to_csv(OUT/'drill-attempt-features.csv',index=False)
    features=['turn_speed','braking_loss','reacceleration','heading_change_degrees']
    players=a.groupby(['nfl_id','drill'],as_index=False)[features].median()
    return a,players,dict(rejected)


def ridge_predict(train_x,train_y,test_x,penalty=1.):
    # All imputation and scaling are learned inside the held-out-player fold.
    med=np.nanmedian(train_x,axis=0)
    med=np.where(np.isfinite(med),med,0.)
    x=np.where(np.isfinite(train_x),train_x,med)
    z=np.where(np.isfinite(test_x),test_x,med)
    mean=x.mean(axis=0);std=x.std(axis=0);std=np.where(std>1e-8,std,1.)
    design=np.column_stack([np.ones(len(x)),(x-mean)/std])
    target=np.column_stack([np.ones(len(z)),(z-mean)/std])
    regularizer=np.diag([0.]+[penalty]*x.shape[1])
    beta=np.linalg.solve(design.T@design+regularizer,design.T@train_y)
    return target@beta


def compare_model(players,feature):
    """One fixed extra drill feature, evaluated on entirely unseen CBs."""
    p=players[players.reps>=10].dropna(subset=[feature]).copy()
    if len(p)<12:return {'players':len(p),'status':'Too few players for this comparison'}
    baseline=['snap_cushion','forty','combine_height','combine_weight']
    y=p.mean_separation.to_numpy()
    predictions={name:[] for name in ['context','context_plus_drill']}
    errors=[]
    for i in range(len(p)):
        keep=np.arange(len(p))!=i
        for name,columns in [('context',baseline),('context_plus_drill',baseline+[feature])]:
            estimate=ridge_predict(p[columns].to_numpy()[keep],y[keep],p[columns].to_numpy()[[i]])[0]
            predictions[name].append(float(estimate))
        errors.append(abs(y[i]-predictions['context'][i])-abs(y[i]-predictions['context_plus_drill'][i]))
    improvement=np.asarray(errors)
    rng=np.random.default_rng(20271018)
    boot=np.array([rng.choice(improvement,size=len(improvement),replace=True).mean() for _ in range(2000)])
    result={'players':len(p),'status':'Exploratory leave-one-player-out comparison',
            'baseline_mae':float(np.mean(np.abs(y-predictions['context']))),
            'augmented_mae':float(np.mean(np.abs(y-predictions['context_plus_drill']))),
            'mae_improvement':float(improvement.mean()),'improvement_95':np.quantile(boot,[.025,.975]).tolist(),
            'players_missing_forty':int(p.forty.isna().sum())}
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publish',action='store_true')
    args=parser.parse_args()
    digest=hashlib.sha256()
    with (ROOT/'nfl-big-data-bowl-2027.zip').open('rb') as handle:
        for b in iter(lambda:handle.read(1024*1024),b''):digest.update(b)
    fingerprint=digest.hexdigest()
    with ZipFile(ROOT/'nfl-big-data-bowl-2027.zip') as archive:
        def read(name,**kwargs):return pd.read_csv(archive.open('nfl-big-data-bowl-2027/'+name),**kwargs)
        combine=read('combine_results.csv').merge(read('players.csv'),on=['nfl_id','draft_year'],validate='one_to_one')
        cb=combine[combine.nfl_position=='CB']
        pp=read('player_play.csv',low_memory=False)
        games=read('games.csv')
        regular=games.loc[games.season_type=='REG','game_id']
        eligible=pp[pp.nfl_id.isin(cb.nfl_id)&pp.game_id.isin(regular)&pp.lined_up_position.isin(['CB','SLOT_CB'])&
                    (pp.team_coverage_man_zone=='MAN_COVERAGE')&(pp.coverage_assignment=='MAN')&
                    (pp.play_nullified_by_penalty=='N')&pp.pass_result.isin(['C','I','IN'])].copy()
        eligible.to_csv(OUT/'candidate-reps.csv',index=False)
        print('Expanded candidates:',len(eligible),'players',eligible.nfl_id.nunique(),flush=True)
        keys=set(zip(eligible.game_id,eligible.play_id))
        cache=OUT/'tracking.pkl';manifest=OUT/'tracking-cache.json'
        signature={'input_sha256':fingerprint,'filter_version':1}
        if cache.exists() and manifest.exists() and json.loads(manifest.read_text())==signature:
            tracking=pd.read_pickle(cache)
        else:
            parts=[]
            for year in [2023,2024,2025]:
                print('Reading expanded tracking',year,flush=True)
                for chunk in read(f'game_tracking_{year}.csv',chunksize=350000):
                    mask=np.fromiter(((g,p) in keys for g,p in zip(chunk.game_id,chunk.play_id)),dtype=bool,count=len(chunk))
                    if mask.any():parts.append(chunk.loc[mask])
            tracking=pd.concat(parts,ignore_index=True)
            tracking.to_pickle(cache);manifest.write_text(json.dumps(signature),encoding='utf-8')
        relevant=pp[pp.set_index(['game_id','play_id']).index.isin(keys)]
        tg={k:g for k,g in tracking.groupby(['game_id','play_id'],sort=False)}
        mg={k:g for k,g in relevant.groupby(['game_id','play_id'],sort=False)}
        measures=[];exclusions=Counter()
        for r in eligible.itertuples(index=False):
            t=tg.get((r.game_id,r.play_id));m=mg[(r.game_id,r.play_id)]
            rep,reason=measure_pair(r,t,m)
            if rep is None:exclusions[reason]+=1
            else:measures.append(rep)
        reps=pd.DataFrame(measures)
        collision=reps.duplicated(['game_id','play_id','receiver_id'],keep=False)
        if collision.any():exclusions['Receiver selected by multiple measured CBs']+=int(collision.sum());reps=reps[~collision].copy()
        reps['blanket']=reps.mean_separation.map(blanket.is_blanket)
        reps.to_csv(OUT/'coverage-reps.csv',index=False)
        players=reps.groupby('nfl_id',as_index=False).agg(reps=('blanket','size'),blankets=('blanket','sum'),
                      mean_separation=('mean_separation','mean'),snap_cushion=('snap_cushion','mean'))
        players=players.merge(cb[['nfl_id','display_name','draft_year','three_cone','forty','combine_height','combine_weight']],on='nfl_id',validate='one_to_one')
        attempts,features,drill_rejects=drill_table(read('combine_tracking.csv'),cb.nfl_id)
        models=[]
        for name,label in DRILLS.items():
            f=features[features.drill==name]
            joined=players.merge(f,on='nfl_id',validate='one_to_one')
            for feature in ['turn_speed','braking_loss','reacceleration']:
                result=compare_model(joined,feature)
                models.append({'drill':label,'feature':feature,**result})
        players.to_csv(OUT/'players.csv',index=False)
        feature_availability=[{'drill':label,'players_with_tracking':int(features.loc[features.drill==name,'nfl_id'].nunique()),
                              'players_with_coverage':int(players.nfl_id.isin(features.loc[features.drill==name,'nfl_id']).sum())} for name,label in DRILLS.items()]
        summary=summarize(reps,players,eligible,exclusions)
        review=write_review_sample(reps,tg,mg)
        summary.update({'analysis_version':4,'updated':'October 18, 2026','input_sha256':fingerprint,
                        'features':feature_availability,'models':models,'drill_attempt_exclusions':drill_rejects,
                        'review':review})
        (OUT/'summary.json').write_text(json.dumps(summary,indent=2,allow_nan=False),encoding='utf-8')
        if args.publish:(ROOT/'_data/blanket_expanded.json').write_text(json.dumps(summary,indent=2,allow_nan=False),encoding='utf-8')
        print(json.dumps(summary,indent=2),flush=True)


def measure_pair(r,t,metadata):
    if t is None:return None,'No play tracking'
    defender=t[t.nfl_id==r.nfl_id].sort_values('time')
    snap=defender[defender.event=='ball_snap'];throw=defender[defender.event=='pass_forward']
    if len(snap)!=1 or len(throw)!=1:return None,'Missing or ambiguous snap/throw'
    snap,throw=snap.iloc[0],throw.iloc[0]
    start,end=pd.Timestamp(snap.time),pd.Timestamp(throw.time)
    duration=(end-start).total_seconds()
    if duration<1:return None,'Less than one second before throw'
    off=metadata[(metadata.team_abbr==r.possession_team)&metadata.route_ran.notna()&metadata.lined_up_position.isin(['WR','SLOT_WR','TE','RB','FB'])]
    runners=t[(t.time==snap.time)&t.nfl_id.isin(off.nfl_id)].copy()
    if runners.empty:return None,'No tracked route runner at snap'
    runners['distance']=np.hypot(runners.x-snap.x,runners.y-snap.y)
    runners=runners.sort_values('distance');best=runners.iloc[0]
    if best.distance>5:return None,'Nearest tracked route runner more than 5 yards at snap'
    if len(runners)>1 and runners.iloc[1].distance-best.distance<1:return None,'Ambiguous receiver at snap'
    other_ids=metadata.loc[(metadata.team_abbr==r.team_abbr)&(metadata.coverage_assignment=='MAN')&(metadata.nfl_id!=r.nfl_id),'nfl_id']
    others=t[(t.time==snap.time)&t.nfl_id.isin(other_ids)]
    competing=np.hypot(others.x-best.x,others.y-best.y)
    # This narrower sensitivity still cannot account for unobserved defenders.
    mutual=bool(len(competing)>0 and competing.min()-best.distance>=1)
    runner=t[t.nfl_id==best.nfl_id].sort_values('time')
    if defender.time.duplicated().any() or runner.time.duplicated().any():return None,'Duplicate player timestamps'
    pair=defender[['time','x','y']].merge(runner[['time','x','y']],on='time',suffixes=('_cb','_wr'),validate='one_to_one')
    pair['timestamp']=pd.to_datetime(pair.time,format='ISO8601')
    pair=pair[(pair.timestamp>=start)&(pair.timestamp<=end)].copy()
    expected=round(duration*10)+1
    if pair.empty or len(pair)<.9*expected or pair.timestamp.iloc[0]!=start or pair.timestamp.iloc[-1]!=end:return None,'Incomplete synchronized window'
    if pair.timestamp.diff().dt.total_seconds().max()>.201:return None,'Gap over 0.2 seconds'
    if not np.isfinite(pair[['x_cb','y_cb','x_wr','y_wr']].to_numpy()).all():return None,'Nonfinite coordinates'
    pair['elapsed']=(pair.timestamp-start).dt.total_seconds()
    pair['distance']=np.hypot(pair.x_cb-pair.x_wr,pair.y_cb-pair.y_wr)
    late=pair[pair.elapsed>=.5]
    receiver_meta=off[off.nfl_id==best.nfl_id].iloc[0]
    return {'game_id':int(r.game_id),'play_id':int(r.play_id),'nfl_id':int(r.nfl_id),'receiver_id':int(best.nfl_id),
            'mean_separation':blanket.average_separation(pair.distance.to_numpy(),pair.elapsed.to_numpy()),
            'late_mean_separation':blanket.average_separation(late.distance.to_numpy(),late.elapsed.to_numpy()),
            'throw_separation':float(pair.distance.iloc[-1]),'snap_cushion':float(best.distance),'duration':duration,
            'route':receiver_meta.route_ran,'observed_runners':len(runners),'mutual_observed_margin':mutual,
            'observed_other_man_defenders':len(others),'frames':len(pair)},None


def summarize(reps,players,eligible,exclusions):
    assert len(reps)+sum(exclusions.values())==len(eligible)
    assert not reps.duplicated(['game_id','play_id','nfl_id']).any()
    bins=[0,.5,1,1.5,2,3,5,8,12,float('inf')]
    hist,_=np.histogram(reps.mean_separation,bins=bins)
    threshold=[{'threshold':v,'count':int((reps.mean_separation<v).sum()),'late_count':int((reps.late_mean_separation<v).sum())} for v in [.5,.75,1,1.25,1.5,2,3]]
    strata=[]
    for label,selected in [('Starting cushion <2 yd',reps[reps.snap_cushion<2]),('Starting cushion 2–3 yd',reps[reps.snap_cushion.between(2,3,inclusive='left')]),('Starting cushion 3–5 yd',reps[reps.snap_cushion>=3]),('Observed reciprocal margin',reps[reps.mutual_observed_margin])]:
        strata.append({'label':label,'reps':len(selected),'players':int(selected.nfl_id.nunique()),'blankets':int(selected.blanket.sum()),
                       'mean_separation':float(selected.mean_separation.mean()) if len(selected) else None})
    return {'status':'Expanded exploratory sample; assignments inferred, not film verified',
            'candidate_reps':len(eligible),'candidate_players':int(eligible.nfl_id.nunique()),'screened_reps':len(reps),
            'screened_players':len(players),'provisional_blankets':int(reps.blanket.sum()),'blanket_rate':float(reps.blanket.mean()),
            'exclusions':dict(exclusions),'single_observed_runner_reps':int((reps.observed_runners==1).sum()),
            'median_separation':float(reps.mean_separation.median()),'thresholds':threshold,
            'histogram':[{'label':f'{bins[i]:g}–{bins[i+1]:g}' if i<8 else '12+','count':int(n)} for i,n in enumerate(hist)],
            'window_sensitivity':{'after_half_second_blankets':int((reps.late_mean_separation<1).sum()),'throw_only_below_one':int((reps.throw_separation<1).sum())},
            'strata':strata,'players_min_ten_reps':int((players.reps>=10).sum()),'data_source':'NFL / Next Gen Stats, Big Data Bowl 2027 on Kaggle',
            'season_scope':'Regular season 2023–2025','definition':'Average separation strictly below 1 yard, snap through throw'}


def write_review_sample(reps,tg,mg):
    # Deliberately include every positive plus near-threshold, high-distance,
    # reciprocal-margin, and random ordinary reps. This is not a random accuracy sample.
    selected=reps[reps.blanket].copy()
    extra=[reps.iloc[(reps.mean_separation-1).abs().argsort()[:8]],reps.nlargest(5,'mean_separation'),
           reps[reps.mutual_observed_margin].sample(n=min(5,int(reps.mutual_observed_margin.sum())),random_state=2027),
           reps.sample(n=min(30,len(reps)),random_state=2027)]
    sample=pd.concat([selected,*extra]).drop_duplicates(['game_id','play_id','nfl_id']).head(30).copy()
    sample['review_id']=[f'R{i+1:02}' for i in range(len(sample))]
    sample['tracking_review']='pending';sample['film_review']='not verified';sample['review_notes']=''
    notes_path=OUT/'tracking-review-notes.json'
    notes=json.loads(notes_path.read_text(encoding='utf-8')) if notes_path.exists() else {}
    for index,r in sample.iterrows():
        key=f'{int(r.game_id)}/{int(r.play_id)}/{int(r.nfl_id)}/{int(r.receiver_id)}'
        note=notes.get(key)
        if note:
            sample.at[index,'tracking_review']=note['status']
            sample.at[index,'review_notes']=note['note']
    sample.to_csv(OUT/'matchup-review.csv',index=False)
    panels=[]
    for r in sample.itertuples(index=False):
        t=tg[(r.game_id,r.play_id)]
        d=t[t.nfl_id==r.nfl_id].sort_values('time');s=d[d.event=='ball_snap'].iloc[0];e=d[d.event=='pass_forward'].iloc[0]
        w=t[t.nfl_id==r.receiver_id].sort_values('time')
        pair=d[['time','x','y']].merge(w[['time','x','y']],on='time',suffixes=('_cb','_wr'))
        pair=pair[pair.time.between(s.time,e.time)].copy()
        pair['seconds']=(pd.to_datetime(pair.time)-pd.Timestamp(s.time)).dt.total_seconds()
        pair['distance']=np.hypot(pair.x_cb-pair.x_wr,pair.y_cb-pair.y_wr)
        panels.append({'review_id':r.review_id,'game_id':r.game_id,'play_id':r.play_id,'cb':r.nfl_id,'receiver':r.receiver_id,
                       'mean':r.mean_separation,'blanket':r.blanket,'mutual':r.mutual_observed_margin,
                       'route':r.route,'observed_runners':r.observed_runners,'frames':pair[['seconds','x_cb','y_cb','x_wr','y_wr','distance']].to_dict('records')})
    (OUT/'review-panels.json').write_text(json.dumps(panels,indent=2),encoding='utf-8')
    reviewed=int((sample.tracking_review!='pending').sum())
    return {'prepared':len(sample),'tracking_reviewed':reviewed,'flagged_for_film':int((sample.tracking_review=='flagged for film').sum()),
            'positive_reps_in_review':int(sample.blanket.sum()),'film_verified':0,
            'status':'Tracking-only visual consistency review; no assignment truth labels',
            'sampling':'Outcome-enriched: positives, near-threshold reps, large gaps, reciprocal pairs, and ordinary reps. Not an accuracy sample.',
            'flag_policy':'Flagged reps remain in the primary analysis; excluding poor outcomes after review would bias the result.'}


if __name__=='__main__':main()
