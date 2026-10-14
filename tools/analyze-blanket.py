"""Prototype Blanket measurement from locally licensed BDB tracking data."""
from pathlib import Path
from zipfile import ZipFile
import json
import pandas as pd
import numpy as np
import hashlib
from html import escape
import argparse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'local-data/big-data-bowl'
OUT.mkdir(parents=True, exist_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publish', action='store_true', help='Publish only aggregate results to the website.')
    args = parser.parse_args()
    archive_path = ROOT / 'nfl-big-data-bowl-2027.zip'
    # The cache is private and may only be reused for the identical input archive.
    digest = hashlib.sha256()
    with archive_path.open('rb') as handle:
        for block in iter(lambda: handle.read(1024*1024), b''):
            digest.update(block)
    fingerprint = digest.hexdigest()
    with ZipFile(archive_path) as archive:
        def read(name, **kwargs):
            return pd.read_csv(archive.open('nfl-big-data-bowl-2027/' + name), **kwargs)
        combine = read('combine_results.csv').merge(read('players.csv'), on=['nfl_id', 'draft_year'], validate='one_to_one')
        cb = combine[(combine.nfl_position == 'CB') & combine.three_cone.notna()]
        pp = read('player_play.csv', low_memory=False)
        games = read('games.csv')
        regular_ids = games.loc[games.season_type == 'REG','game_id']
        eligible = pp[pp.nfl_id.isin(cb.nfl_id) & pp.lined_up_position.isin(['CB', 'SLOT_CB']) &
                      (pp.team_coverage_man_zone == 'MAN_COVERAGE') & (pp.coverage_assignment == 'MAN') &
                      (pp.play_nullified_by_penalty == 'N') & pp.pass_result.isin(['C', 'I', 'IN']) & pp.game_id.isin(regular_ids)].copy()
        eligible.to_csv(OUT / 'eligible-man-reps.csv', index=False)
        print('Eligible reps:', len(eligible), 'players:', eligible.nfl_id.nunique(), flush=True)
        keys = set(zip(eligible.game_id, eligible.play_id))
        cache = OUT / 'candidate-tracking.pkl'
        manifest = OUT / 'tracking-cache.json'
        cache_key = {'archive_sha256': fingerprint, 'filter_version': 2}
        if cache.exists() and manifest.exists() and json.loads(manifest.read_text()) == cache_key:
            tracking = pd.read_pickle(cache)
        else:
            blocks = []
            for year in [2023, 2024, 2025]:
                print('Reading tracking', year, flush=True)
                with archive.open(f'nfl-big-data-bowl-2027/game_tracking_{year}.csv') as raw:
                    for chunk in pd.read_csv(raw, chunksize=250000):
                        selected = np.fromiter(((g, p) in keys for g, p in zip(chunk.game_id, chunk.play_id)), dtype=bool, count=len(chunk))
                        if selected.any():
                            blocks.append(chunk.loc[selected])
            tracking = pd.concat(blocks, ignore_index=True)
            tracking.to_pickle(cache)
            manifest.write_text(json.dumps(cache_key), encoding='utf-8')
        print('Tracking rows:', len(tracking), 'events:', tracking.event.value_counts().to_dict(), flush=True)
        metadata = pp[pp.set_index(['game_id', 'play_id']).index.isin(keys)]
        print('Positions:', metadata.lined_up_position.value_counts().to_dict(), flush=True)
        diagnostics = []
        for (game, play), t in tracking.groupby(['game_id', 'play_id'], sort=False):
            meta = metadata[(metadata.game_id == game) & (metadata.play_id == play)]
            offense = meta[(meta.team_abbr == meta.possession_team) & meta.route_ran.notna()]
            diagnostics.append({'game_id': int(game), 'play_id': int(play), 'tracked_ids': int(t.nfl_id.nunique()),
                                'offensive_route_rows': len(offense), 'tracked_receivers': int(offense.nfl_id.isin(t.nfl_id).sum()),
                                'snap_events': int((t.event == 'ball_snap').sum()), 'throw_events': int((t.event == 'pass_forward').sum())})
        pd.DataFrame(diagnostics).to_csv(OUT / 'tracking-diagnostics.csv', index=False)
        print(pd.DataFrame(diagnostics).describe().to_string(), flush=True)
        drill = read('combine_tracking.csv')
        sensor = sensor_features(drill, cb)
        measure(eligible, tracking, metadata, cb, sensor, fingerprint, args.publish)


def sensor_features(drill, cb):
    """Median speed during fast heading changes, summarized by attempt then player.

    Direction changes use circular differences. Speed <1 is excluded to reduce
    unstable headings near rest; this is exploratory and not a calibrated trait.
    """
    selected = drill[(drill.drill_type == 'THREE_CONE_DRILL') &
                     (drill.entity_type == 'PLAYER') & drill.nfl_id.isin(cb.nfl_id)]
    attempts = []
    for (pid,event,attempt), frame in selected.groupby(['nfl_id','event_id','attempt']):
        frame = frame.sort_values('time').copy()
        seconds = pd.to_datetime(frame.time).diff().dt.total_seconds()
        heading = ((frame.dir.diff()+180)%360-180).abs()
        turn = (heading / seconds >= 120) & seconds.between(.09,.11) & (frame.s >= 1) & (frame.s.shift(1) >= 1)
        if turn.sum() >= 3:
            attempts.append({'nfl_id': int(pid), 'event_id': event, 'attempt': int(attempt),
                             'turn_speed': float(frame.loc[turn,'s'].median()), 'turn_frames': int(turn.sum())})
    table = pd.DataFrame(attempts, columns=['nfl_id','event_id','attempt','turn_speed','turn_frames'])
    table.to_csv(OUT/'three-cone-sensor-attempts.csv',index=False)
    return table.groupby('nfl_id',as_index=False).agg(turn_speed=('turn_speed','median'),sensor_attempts=('attempt','size'))


def measure(eligible, tracking, metadata, cb, sensor, fingerprint, publish):
    """Infer pairs at snap only. Outputs are provisional, never charted assignments."""
    groups = {k: t for k, t in tracking.groupby(['game_id', 'play_id'], sort=False)}
    metas = {k: m for k, m in metadata.groupby(['game_id', 'play_id'], sort=False)}
    excluded = {}
    reps = []
    examples = []
    def reject(reason):
        excluded[reason] = excluded.get(reason, 0) + 1
    for r in eligible.itertuples(index=False):
        key = (r.game_id, r.play_id)
        t = groups.get(key)
        if t is None:
            reject('No play tracking'); continue
        defender = t[t.nfl_id == r.nfl_id].sort_values('time')
        snaps = defender[defender.event == 'ball_snap']
        throws = defender[defender.event == 'pass_forward']
        if len(snaps) != 1 or len(throws) != 1:
            reject('Missing or ambiguous defender snap/throw'); continue
        snap, throw = snaps.iloc[0], throws.iloc[0]
        start, end = pd.Timestamp(snap.time), pd.Timestamp(throw.time)
        duration = (end-start).total_seconds()
        if duration < 1:
            reject('Less than one second before throw'); continue
        meta = metas[key]
        offense = meta[(meta.team_abbr == r.possession_team) & meta.route_ran.notna() &
                       meta.lined_up_position.isin(['WR', 'SLOT_WR', 'TE', 'RB', 'FB'])]
        at_snap = t[(t.time == snap.time) & t.nfl_id.isin(offense.nfl_id)].copy()
        if at_snap.empty:
            reject('No tracked route runner at snap'); continue
        at_snap['distance'] = np.hypot(at_snap.x - snap.x, at_snap.y - snap.y)
        at_snap = at_snap.sort_values('distance')
        best = at_snap.iloc[0]
        if best.distance > 5:
            reject('Nearest tracked route runner more than 5 yards at snap'); continue
        if len(at_snap) > 1 and at_snap.iloc[1].distance - best.distance < 1:
            reject('Ambiguous snap pairing: margin below 1 yard'); continue
        receiver = t[t.nfl_id == best.nfl_id].sort_values('time')
        # Never switch receivers during a play or select a pair by its outcome.
        pair = defender[['time', 'x', 'y']].merge(receiver[['time', 'x', 'y']], on='time',
                                               suffixes=('_cb', '_wr'), validate='one_to_one')
        pair['timestamp'] = pd.to_datetime(pair.time)
        pair = pair[(pair.timestamp >= start) & (pair.timestamp <= end)].copy()
        expected = round(duration * 10) + 1
        if len(pair) < .9 * expected or pair.empty or pair.timestamp.iloc[0] != start or pair.timestamp.iloc[-1] != end:
            reject('Incomplete synchronized window'); continue
        if pair.timestamp.diff().dt.total_seconds().max() > .201:
            reject('Tracking gap over 0.2 seconds'); continue
        if not np.isfinite(pair[['x_cb','y_cb','x_wr','y_wr']].to_numpy()).all():
            reject('Nonfinite coordinates'); continue
        pair['elapsed'] = (pair.timestamp - start).dt.total_seconds()
        pair['distance'] = np.hypot(pair.x_cb - pair.x_wr, pair.y_cb - pair.y_wr)
        # Trapezoidal time average handles occasional missing 10 Hz samples.
        mean = average_separation(pair.distance.to_numpy(),pair.elapsed.to_numpy())
        late = pair[pair.elapsed >= .5]
        late_mean = float(np.trapezoid(late.distance, late.elapsed) / (late.elapsed.iloc[-1]-late.elapsed.iloc[0])) if len(late)>1 else None
        reps.append({'game_id': int(r.game_id), 'play_id': int(r.play_id), 'nfl_id': int(r.nfl_id),
                     'receiver_id': int(best.nfl_id), 'mean_separation': mean, 'late_mean_separation': late_mean,
                     'throw_separation': float(pair.distance.iloc[-1]), 'duration': duration,
                     'snap_cushion': float(best.distance), 'blanket': is_blanket(mean),
                     'observed_runner_count': len(at_snap), 'frames': len(pair)})
        if len(examples) < 5:
            examples.append((reps[-1], pair.copy(), r.play_direction))
    data = pd.DataFrame(reps)
    # A receiver cannot be assigned to two measured cornerbacks on the same rep.
    if not data.empty:
        collision = data.duplicated(['game_id','play_id','receiver_id'],keep=False)
        if collision.any():
            excluded['Receiver paired to multiple cornerbacks'] = int(collision.sum())
            data = data[~collision].copy()
    data.to_csv(OUT / 'inferred-coverage-reps.csv', index=False)
    if data.empty:
        raise RuntimeError('No usable inferred pairs. Do not publish Blanket estimates.')
    player = data.groupby('nfl_id').agg(reps=('blanket','size'), blankets=('blanket','sum'),
                                       mean_separation=('mean_separation','mean'),
                                       snap_cushion=('snap_cushion','mean')).reset_index()
    player['blanket_rate'] = player.blankets / player.reps
    player = player.merge(cb[['nfl_id','display_name','three_cone','forty','draft_year']], on='nfl_id', validate='one_to_one')
    player = player.merge(sensor,on='nfl_id',how='left',validate='one_to_one')
    player.to_csv(OUT / 'provisional-player-summary.csv', index=False)
    rng = np.random.default_rng(2027)
    def correlation(frame):
        if len(frame)<4 or frame.three_cone.nunique()<2 or frame.mean_separation.nunique()<2:
            return None
        return float(np.corrcoef(frame.three_cone, frame.mean_separation)[0,1])
    stable = player[player.reps >= 10]
    sensor_stable = stable.dropna(subset=['turn_speed'])
    bootstrap = []
    for _ in range(2000):
        v = correlation(stable.iloc[rng.integers(0,len(stable),len(stable))]) if len(stable) else None
        if v is not None and np.isfinite(v): bootstrap.append(v)
    counts = []
    for threshold in [.5,.75,1,1.25,1.5,2,3]:
        counts.append({'threshold': threshold, 'count': int((data.mean_separation < threshold).sum()),
                       'late_count': int((data.late_mean_separation < threshold).sum())})
    bins = [0,.5,1,1.5,2,3,5,8,12,1000]
    hist, edges = np.histogram(data.mean_separation, bins=bins)
    summary = {'status': 'Exploratory inferred pairings; assignments not independently verified',
               'definition': 'Blanket: time-average separation strictly below 1 yard from snap through pass_forward.',
               'candidate_reps': len(eligible), 'candidate_players': int(eligible.nfl_id.nunique()),
               'screened_reps': len(data), 'screened_players': int(data.nfl_id.nunique()),
               'provisional_blankets': int(data.blanket.sum()), 'blanket_rate': float(data.blanket.mean()),
               'mean_separation': float(data.mean_separation.mean()),
               'median_separation': float(data.mean_separation.median()), 'exclusions': excluded,
               'single_observed_runner_reps': int((data.observed_runner_count == 1).sum()),
               'correlation': correlation(stable), 'correlation_players': len(stable),
               'correlation_min_reps': 10,
               'correlation_bootstrap_95': [float(v) for v in np.quantile(bootstrap,[.025,.975])] if bootstrap else None,
               'thresholds': counts,
               'histogram': [{'label': f'{bins[i]:g}–{bins[i+1]:g}' if i<len(hist)-1 else '12+', 'count': int(n)} for i,n in enumerate(hist)],
               'window_sensitivity': {'after_half_second_blankets': int((data.late_mean_separation < 1).sum()),
                                      'throw_only_below_one': int((data.throw_separation < 1).sum())},
               'sensor': {'players_with_feature': len(sensor), 'comparison_players': len(sensor_stable),
                          'correlation_with_mean_separation': float(np.corrcoef(sensor_stable.turn_speed,sensor_stable.mean_separation)[0,1]) if len(sensor_stable)>=4 else None,
                          'definition': 'Median speed during heading changes of at least 120 degrees/second; adjacent speeds >=1; median across eligible attempts.'},
               'data_source': 'NFL / Next Gen Stats, NFL Big Data Bowl 2027 on Kaggle',
               'analysis_version': 3,
               'season_scope': 'Regular season only, 2023–2025',
               'input_sha256': fingerprint}
    assert len(data)+sum(excluded.values()) == len(eligible)
    assert int(hist.sum()) == len(data)
    assert not data.duplicated(['game_id','play_id','nfl_id']).any()
    assert data.blanket.equals(data.mean_separation < 1)
    (OUT/'blanket-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    write_review(examples, player)
    if publish:
        # No frame trajectories, player identities, stopwatch inputs, or rep rows.
        (ROOT/'_data/blanket_results.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary,indent=2),flush=True)


def average_separation(distance, seconds):
    distance, seconds = np.asarray(distance,dtype=float), np.asarray(seconds,dtype=float)
    if len(distance) != len(seconds) or len(seconds)<2 or not np.isfinite(distance).all() or not np.isfinite(seconds).all():
        raise ValueError('A complete finite distance/time series is required')
    if (distance<0).any() or (np.diff(seconds)<=0).any():
        raise ValueError('Distances must be nonnegative and timestamps strictly increasing')
    return float(np.trapezoid(distance,seconds)/(seconds[-1]-seconds[0]))


def is_blanket(mean_separation):
    if not np.isfinite(mean_separation) or mean_separation<0:
        raise ValueError('Blanket requires a finite nonnegative measurement')
    return bool(mean_separation < 1)


def write_review(examples, player):
    cards = []
    for rep, p, direction in examples:
        xmin, xmax = min(p.x_cb.min(),p.x_wr.min())-2, max(p.x_cb.max(),p.x_wr.max())+2
        ymin, ymax = min(p.y_cb.min(),p.y_wr.min())-2, max(p.y_cb.max(),p.y_wr.max())+2
        scale = min(500/(xmax-xmin),250/(ymax-ymin))
        point = lambda x,y: f'{30+(x-xmin)*scale:.1f},{280-(y-ymin)*scale:.1f}'
        paths = ''.join(f'<polyline points="{" ".join(point(x,y) for x,y in zip(p[f"x_{side}"],p[f"y_{side}"]))}" fill="none" stroke="{color}" stroke-width="3"/>' for side,color in [('cb','#6ee7b7'),('wr','#fbbf24')])
        markers = ''.join(f'<circle cx="{point(p[f"x_{side}"].iloc[0],p[f"y_{side}"].iloc[0]).split(",")[0]}" cy="{point(p[f"x_{side}"].iloc[0],p[f"y_{side}"].iloc[0]).split(",")[1]}" r="5" fill="{color}"/>' for side,color in [('cb','#6ee7b7'),('wr','#fbbf24')])
        curve = ' '.join(f'{30+float(t)/rep["duration"]*500:.1f},{260-float(d)/max(3,p.distance.max())*210:.1f}' for t,d in zip(p.elapsed,p.distance))
        threshold_y = 260-210/max(3,p.distance.max())
        cards.append(f'<article><h2>Game {rep["game_id"]} · Play {rep["play_id"]}</h2><p>CB {rep["nfl_id"]} / inferred receiver {rep["receiver_id"]}. Mean {rep["mean_separation"]:.2f} yards. Blanket: {rep["blanket"]}. Offense moves {escape(direction)}. Dots mark snap; trajectories end at throw. Equal yard scale on both field axes.</p><svg viewBox="0 0 560 310" role="img" aria-label="Inferred cornerback and receiver trajectories">{paths}{markers}</svg><svg viewBox="0 0 560 310" role="img" aria-label="Separation from snap to throw"><line x1="30" x2="530" y1="{threshold_y}" y2="{threshold_y}" stroke="#fbbf24" stroke-dasharray="5 5"/><polyline points="{curve}" fill="none" stroke="#6ee7b7" stroke-width="3"/><text x="30" y="300" fill="white">Snap → throw · dashed line = 1 yard · max {p.distance.max():.1f} yards</text></svg></article>')
    html = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Private Blanket matchup review</title><style>body{background:#101c23;color:#eee;font:16px system-ui;max-width:1150px;margin:40px auto;padding:20px}article{border-top:1px solid #567;padding:20px 0}svg{width:48%;background:#16372d;border-radius:12px}p{line-height:1.7}</style><h1>Five inferred matchup examples</h1><p>Private review of supplied tracking. Green = CB. Gold = inferred receiver. These pairings are algorithmic and are not confirmed coverage assignments. Missing players can invalidate a pairing. Do not redistribute this review as raw tracking.</p>' + ''.join(cards) + '</html>'
    (OUT/'matchup-review.html').write_text(html,encoding='utf-8')


if __name__ == '__main__':
    main()
