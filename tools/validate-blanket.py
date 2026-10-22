"""Audit Blanket measurement without fitting or selecting prediction models.

Requires expand-blanket.py outputs from the identical archive. Review packets and
annotations stay private; --publish writes aggregate evidence only.
"""
import argparse
import hashlib
import importlib.util
import json
from collections import Counter
from html import escape
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'local-data/big-data-bowl/expanded'
OUT = INPUT / 'validation'
KEYS = ['game_id', 'play_id', 'nfl_id', 'receiver_id']
SEED = 20261022
spec = importlib.util.spec_from_file_location('expanded', ROOT / 'tools/expand-blanket.py')
expanded = importlib.util.module_from_spec(spec)
spec.loader.exec_module(expanded)


def record_key(row):
    return '/'.join(str(int(row[k])) for k in KEYS)


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def review_sample(reps, count=80):
    """Simple random sample of pairs, independent of separation and flags."""
    ordered = reps.sort_values(KEYS).reset_index(drop=True)
    if ordered.duplicated(KEYS).any():
        raise ValueError('Duplicate coverage pairs')
    indices = np.random.default_rng(SEED).choice(len(ordered), min(count, len(ordered)), replace=False)
    return ordered.iloc[indices].copy()


def assess_labels(sample, labels):
    """An independent source and reviewer are required even for unresolved labels."""
    allowed = {record_key(row) for _, row in sample.iterrows()}
    if set(labels) - allowed:
        raise ValueError('Assignment labels contain keys outside the frozen random sample')
    counts = Counter()
    for key, label in labels.items():
        if label.get('verdict') not in {'confirmed', 'incorrect', 'unresolved'}:
            raise ValueError('Invalid assignment verdict: ' + key)
        if label.get('evidence_type') not in {'film', 'independent charting'}:
            raise ValueError('Tracking-only annotations cannot verify assignments: ' + key)
        if not all(str(label.get(field, '')).strip() for field in ['reviewer', 'source', 'note']):
            raise ValueError('Review requires reviewer, source locator, and note: ' + key)
        counts[label['verdict']] += 1
    total = len(sample)
    return {'sampled': total, 'reviewed': len(labels), 'pending': total - len(labels),
            'confirmed': counts['confirmed'], 'incorrect': counts['incorrect'],
            'unresolved': counts['unresolved'],
            'confirmed_share_of_sample': counts['confirmed'] / total if total and len(labels) == total else None,
            'status': 'Independent labels pending' if not labels else 'Independent source annotations supplied; not independently audited',
            'sampling': 'Simple random sample of accepted pairs, seed 20261022; no outcome-based selection',
            'scope': 'Accepted pairs only; does not measure missed assignments or excluded plays. Shared players and plays limit independence.'}


def phase_variant(frame, smoothing=3, heading_window=.4, flank=.6):
    """Sensitivity detector using elapsed-time heading interpolation, not row offsets.

    No coverage outcomes are used. This is a geometric turn, not a reaction-time
    or biomechanical ground-truth annotation.
    """
    f = frame.sort_values('time')
    if len(f) < 15 or f.time.duplicated().any():
        return None
    t = (pd.to_datetime(f.time) - pd.Timestamp(f.time.iloc[0])).dt.total_seconds().to_numpy()
    raw = f[['s', 'dir', 'x', 'y']].to_numpy(dtype=float)
    if not np.isfinite(raw).all() or not np.isfinite(t).all() or np.any(np.diff(t) <= 0) or np.diff(t).max() > .201:
        return None
    speed = f.s.rolling(smoothing, center=True, min_periods=1).median().to_numpy()
    angle = np.deg2rad(f.dir.to_numpy())
    sin = pd.Series(np.sin(angle)).rolling(smoothing, center=True, min_periods=1).mean()
    cos = pd.Series(np.cos(angle)).rolling(smoothing, center=True, min_periods=1).mean()
    heading = np.unwrap(np.arctan2(sin, cos).to_numpy())
    half = heading_window / 2
    delta = np.interp(t + half, t, heading) - np.interp(t - half, t, heading)
    swing = np.abs(np.arctan2(np.sin(delta), np.cos(delta)))
    eligible = (t >= max(flank, half)) & (t <= t[-1] - max(flank, half) + 1e-8) & (speed >= 1)
    if not eligible.any() or np.max(swing[eligible]) < 1e-6:
        return None
    # Break numerical ties by earliest time; a coordinate rotation must not move
    # an otherwise identical flat maximum because of floating-point roundoff.
    maximum = np.max(swing[eligible])
    center = t[np.flatnonzero(eligible & (swing >= maximum - 1e-10))[0]]
    turn = np.flatnonzero(np.abs(t - center) <= .2 + 1e-8)
    low = turn[np.argmin(speed[turn])]
    before = np.flatnonzero((t >= center - flank - 1e-8) & (t <= t[low] - .1 + 1e-8))
    after = np.flatnonzero((t >= t[low] + .1 - 1e-8) & (t <= center + flank + 1e-8))
    if not len(before) or not len(after):
        return None
    pre = before[np.argmax(speed[before])]
    post = after[np.argmax(speed[after])]
    return {'center_seconds': float(center), 'turn_speed': float(speed[low]),
            'heading_change_degrees': float(np.rad2deg(swing[np.argmin(abs(t - center))])),
            'braking_loss': float((speed[pre] - speed[low]) / (t[low] - t[pre])),
            'reacceleration': float((speed[post] - speed[low]) / (t[post] - t[low]))}


def safe_rank(a, b):
    if len(a) < 3 or pd.Series(a).nunique() < 2 or pd.Series(b).nunique() < 2:
        return None
    return float(pd.Series(a).rank().corr(pd.Series(b).rank()))


def baseline_benchmarks(players):
    """Fixed simple comparators, not an expanded sensor-feature model search."""
    p = players[players.reps >= 10].sort_values('nfl_id').copy()
    if len(p) < 12:
        return {'players': len(p), 'status': 'Insufficient players', 'comparisons': []}
    target = p.mean_separation.to_numpy()
    configurations = [
        ('Training-player median', [], 'No held-out-player measurements'),
        ('Conventional combine only', ['forty', 'combine_height', 'combine_weight'], 'Pre-draft inputs; retrospective evaluation'),
        ('Starting cushion only', ['snap_cushion'], 'Observed NFL context; not available pre-draft'),
        ('Existing context baseline', ['snap_cushion', 'forty', 'combine_height', 'combine_weight'], 'Observed NFL context plus conventional combine')]
    results = []
    for label, columns, scope in configurations:
        errors = []
        for i in range(len(p)):
            keep = np.arange(len(p)) != i
            prediction = (expanded.ridge_predict(p[columns].to_numpy()[keep], target[keep], p[columns].to_numpy()[[i]])[0]
                          if columns else np.median(target[keep]))
            errors.append(abs(target[i] - prediction))
        results.append({'name': label, 'inputs': columns, 'mae': float(np.mean(errors)), 'scope': scope})
    return {'players': len(p), 'comparisons': results,
            'status': 'Exploratory leave-one-player-out comparators on the same workload-eligible cohort',
            'method': 'Player-average separation; equal held-out-player weight; fold-local imputation/scaling; fixed ridge penalty 1 where applicable.',
            'limits': 'No untouched cohort, independent assignment truth, or full uncertainty interval. Comparing these baselines does not validate pre-draft prediction.'}


def assess_phase_labels(review, labels):
    prepared = {'/'.join(str(r[k]) for k in ['nfl_id', 'drill', 'event_id', 'attempt']): r for r in review}
    if set(labels) - set(prepared):
        raise ValueError('Phase annotation outside the random review sample')
    confirmed, unresolved, inside, distances = 0, 0, 0, []
    for key, label in labels.items():
        if label.get('verdict') not in {'annotated', 'unresolved'}:
            raise ValueError('Invalid phase annotation verdict: ' + key)
        if label.get('evidence_type') not in {'film', 'independent charting'} or not all(
                str(label.get(field, '')).strip() for field in ['reviewer', 'source', 'note']):
            raise ValueError('Phase annotations require independent source, reviewer, and note')
        if label['verdict'] == 'unresolved':
            unresolved += 1
            continue
        start, end = float(label['phase_start_seconds']), float(label['phase_end_seconds'])
        r = prepared[key]
        if not np.isfinite([start, end]).all() or not 0 <= start <= end <= max(r['seconds']):
            raise ValueError('Phase boundaries must be finite and within the observed attempt')
        confirmed += 1
        center = r['detected_center']
        if center is not None:
            distance = max(start - center, center - end, 0)
            distances.append(distance)
            inside += int(distance == 0)
    return {'independently_annotated_phases': confirmed, 'unresolved': unresolved,
            'pending': len(review) - len(labels), 'detected_annotated_phases': len(distances),
            'detector_centers_inside_annotated_phase': inside,
            'median_distance_to_phase_seconds': float(np.median(distances)) if distances else None,
            'status': 'Independent annotations pending' if not labels else 'Source annotations supplied; source evidence not independently audited'}


def phase_audit(drill, cb_ids):
    selected = drill[drill.nfl_id.isin(cb_ids) & (drill.entity_type == 'PLAYER') & drill.drill_name.isin(expanded.DRILLS)]
    settings = [('Elapsed-time reference', 3, .4, .6), ('No smoothing', 1, .4, .6),
                ('Five-frame smoothing', 5, .4, .6), ('0.2-second heading window', 3, .2, .6),
                ('0.6-second heading window', 3, .6, .6), ('0.4-second flanks', 3, .4, .4),
                ('0.8-second flanks', 3, .4, .8), ('Coordinate-derived heading', 3, .4, .6)]
    rows, packet = [], []
    for key, frame in selected.groupby(['nfl_id', 'drill_name', 'event_id', 'attempt'], sort=True):
        pid, name, event, attempt = key
        base = expanded.phase_features(frame)
        identity = {'nfl_id': int(pid), 'drill': name, 'event_id': str(event), 'attempt': int(attempt)}
        if base is not None:
            rows.append({**identity, 'setting': 'Published detector', **base})
        for label, smooth, window, flank in settings:
            candidate = frame
            if label == 'Coordinate-derived heading':
                candidate = frame.sort_values('time').copy()
                times = (pd.to_datetime(candidate.time) - pd.Timestamp(candidate.time.iloc[0])).dt.total_seconds().to_numpy()
                if candidate.time.duplicated().any() or len(candidate) < 3:
                    continue
                vx = np.gradient(candidate.x.to_numpy(), times)
                vy = np.gradient(candidate.y.to_numpy(), times)
                candidate['dir'] = np.rad2deg(np.arctan2(vx, vy)) % 360
            result = phase_variant(candidate, smooth, window, flank)
            if result is not None:
                rows.append({**identity, 'setting': label, **result})
        # Outcome-independent random selection is performed below, not here.
        packet.append((identity, frame, base))
    values = pd.DataFrame(rows)
    values.to_csv(OUT / 'phase-sensitivity.csv', index=False)
    summary = []
    ids = ['nfl_id', 'drill', 'event_id', 'attempt']
    for name, label in expanded.DRILLS.items():
        subset = values[values.drill == name]
        base = subset[subset.setting == 'Published detector']
        multi = base.groupby('nfl_id').size()
        variants = []
        for setting, _, _, _ in settings:
            alt = subset[subset.setting == setting]
            paired = base.merge(alt, on=ids, suffixes=('_base', '_alt'), validate='one_to_one')
            ranks = {}
            for feature in ['turn_speed', 'braking_loss', 'reacceleration']:
                # Aggregate the identical intersection of attempts per player.
                player = paired.groupby('nfl_id')[[feature + '_base', feature + '_alt']].median()
                ranks[feature] = safe_rank(player[feature + '_base'].to_numpy(), player[feature + '_alt'].to_numpy())
            shifts = abs(paired.center_seconds_base - paired.center_seconds_alt)
            variants.append({'setting': setting, 'paired_attempts': len(paired), 'detected_attempts': len(alt),
                             'changed_eligibility': len(base) + len(alt) - 2 * len(paired),
                             'median_center_shift': float(shifts.median()) if len(shifts) else None,
                             'centers_shifted_over_point_two': int((shifts > .200001).sum()),
                             'player_rank_correlations': ranks})
        summary.append({'drill': label, 'attempts': len(base), 'players': int(base.nfl_id.nunique()),
                        'players_with_repeated_attempts': int((multi > 1).sum()), 'variants': variants})
    # A small random attempt sample per drill supports independent phase annotation.
    review = []
    rng = np.random.default_rng(SEED)
    for name in expanded.DRILLS:
        candidates = [p for p in packet if p[0]['drill'] == name]
        for index in rng.choice(len(candidates), min(6, len(candidates)), replace=False):
            identity, frame, base = candidates[index]
            f = frame.sort_values('time').copy()
            seconds = (pd.to_datetime(f.time) - pd.Timestamp(f.time.iloc[0])).dt.total_seconds()
            review.append({**identity, 'seconds': seconds.tolist(), 'speed': f.s.tolist(),
                           'x': f.x.tolist(), 'y': f.y.tolist(), 'direction': f.dir.tolist(),
                           'detected_center': base['center_seconds'] if base else None})
    phase_manifest = {'input_sha256': sha256(ROOT / 'nfl-big-data-bowl-2027.zip'),
                      'attempts': [{k: r[k] for k in ['nfl_id', 'drill', 'event_id', 'attempt']} for r in review]}
    phase_manifest_path = OUT / 'phase-sample-manifest.json'
    if phase_manifest_path.exists() and json.loads(phase_manifest_path.read_text(encoding='utf-8')) != phase_manifest:
        raise ValueError('Frozen phase sample changed; archive prior validation outputs before a new study')
    phase_manifest_path.write_text(json.dumps(phase_manifest, indent=2), encoding='utf-8')
    (OUT / 'phase-review-panels.json').write_text(json.dumps(review, indent=2, allow_nan=False), encoding='utf-8')
    pd.DataFrame([{k: r[k] for k in ['nfl_id', 'drill', 'event_id', 'attempt']} for r in review]).assign(
        reviewer='', evidence_type='', source='', phase_start_seconds='', phase_end_seconds='', verdict='', note=''
    ).to_csv(OUT / 'phase-review-template.csv', index=False)
    label_path = OUT / 'phase-labels.json'
    annotations = assess_phase_labels(review, json.loads(label_path.read_text(encoding='utf-8')) if label_path.exists() else {})
    return {'status': 'Detector sensitivity measured; independent annotation status reported separately',
            'annotation_review': annotations, 'prepared_review_attempts': len(review), 'drills': summary,
            'scope': 'Rank correlation measures sensitivity, not accuracy or test-retest reliability. Entry speed and turn angle are not controlled.',
            'settings': 'Published detector versus elapsed-time reference, six one-setting perturbations, and coordinate-derived heading; no outcome-based tuning.'}


def application(reps):
    """Prespecified descriptive film-review flags; no new success endpoint or model."""
    pairs = reps.copy()
    pairs['average_tight'] = pairs.mean_separation < 1
    pairs['throw_tight'] = pairs.throw_separation < 1
    pairs['review_reason'] = np.select(
        [pairs.average_tight & ~pairs.throw_tight,
         ~pairs.average_tight & pairs.throw_tight],
        ['Average-tight but not throw-tight', 'Throw-tight despite average >=1 yard'], default='Ordinary context review')
    cells = []
    for mean in [True, False]:
        for throw in [True, False]:
            p = pairs[(pairs.average_tight == mean) & (pairs.throw_tight == throw)]
            cells.append({'average': '<1 yard' if mean else '>=1 yard', 'throw': '<1 yard' if throw else '>=1 yard',
                          'reps': len(p), 'players': int(p.nfl_id.nunique())})
    strata = []
    for label, mask in [('Under 2 yards', pairs.snap_cushion < 2),
                        ('2 to under 3 yards', (pairs.snap_cushion >= 2) & (pairs.snap_cushion < 3)),
                        ('3 to 5 yards', pairs.snap_cushion >= 3)]:
        p = pairs[mask]
        strata.append({'cushion': label, 'reps': len(p), 'average_tight': int(p.average_tight.sum()),
                       'throw_tight': int(p.throw_tight.sum())})
    queue = pairs[pairs.review_reason != 'Ordinary context review'].sort_values(KEYS)
    queue.to_csv(OUT / 'football-review-queue.csv', index=False)
    shortlist = pd.concat([p.sample(n=min(4, len(p)), random_state=SEED) for p in [
        pairs[pairs.average_tight & ~pairs.throw_tight],
        pairs[~pairs.average_tight & pairs.throw_tight & (pairs.snap_cushion >= 3)],
        pairs[pairs.average_tight & pairs.throw_tight]]]).sort_values(KEYS)
    shortlist.to_csv(OUT / 'football-meeting-shortlist.csv', index=False)
    return {'use': 'Select contrasting clips for a coverage film meeting', 'cells': cells, 'cushion_strata': strata,
            'late_gap_flags': int((pairs.average_tight & (pairs.throw_separation >= 2)).sum()),
            'throw_tight_only_flags': int((~pairs.average_tight & pairs.throw_tight).sum()),
            'average_tight_only_flags': int((pairs.average_tight & ~pairs.throw_tight).sum()),
            'queued_pairs': len(queue), 'meeting_shortlist': len(shortlist),
            'shortlist_policy': 'Up to four fixed-seed examples each: average-only tight; throw-only tight starting >=3 yards; both tight. Diagnostic examples, not an accuracy sample.',
            'scope': 'Descriptive disagreement between measurements, not proven coverage wins, target suppression, causal value, or scouting grades.',
            'threshold_policy': 'Keep Blanket <1 yard snap-to-throw; >=2 yards at throw is a separate review flag, not a replacement definition.'}


def line_svg(x, y, caption, marker=None, equal_aspect=True):
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    valid = np.isfinite(x) & np.isfinite(y)
    if not valid.any():
        return '<p>No finite coordinates</p>'
    x, y = x[valid], y[valid]
    sx, sy = 410 / max(float(np.ptp(x)), 1), 155 / max(float(np.ptp(y)), 1)
    if equal_aspect:
        sx = sy = min(sx, sy)
    px, py = 60 + (x - x.min()) * sx, 180 - (y - y.min()) * sy
    points = ' '.join(f'{a:.2f},{b:.2f}' for a, b in zip(px, py))
    mark = ''
    if marker is not None:
        nearest = int(np.argmin(abs(x - marker)))
        mark = f'<circle cx="{px[nearest]:.2f}" cy="{py[nearest]:.2f}" r="6" fill="#ac4400"/>'
    ticks = ''
    for value in np.linspace(x.min(), x.max(), 5):
        position = 60 + (value - x.min()) * sx
        ticks += f'<text x="{position:.2f}" y="202" text-anchor="middle" font-size="11">{value:.1f}</text>'
    for value in np.linspace(y.min(), y.max(), 4):
        position = 180 - (value - y.min()) * sy
        ticks += f'<text x="52" y="{position+4:.2f}" text-anchor="end" font-size="11">{value:.1f}</text>'
    return f'<figure><svg viewBox="0 0 500 220" role="img" aria-label="{escape(caption, quote=True)}"><path d="M60 20V180H475" fill="none" stroke="#89988d"/>{ticks}<polyline points="{points}" fill="none" stroke="#176957" stroke-width="2"/>{mark}</svg><figcaption>{escape(caption)}</figcaption></figure>'


def assignment_panels(sample, tracking):
    groups = {k: g for k, g in tracking.groupby(['game_id', 'play_id'], sort=False)}
    panels = []
    for index, (_, row) in enumerate(sample.iterrows(), 1):
        t = groups[(row.game_id, row.play_id)]
        d = t[t.nfl_id == row.nfl_id].sort_values('time')
        snap = d[d.event == 'ball_snap'].iloc[0].time
        end = d[d.event == 'pass_forward'].iloc[0].time
        # Show every tracked player as context; no computed separation or outcome.
        window = t[t.time.between(snap, end)].copy()
        coords = window[['x', 'y']].to_numpy(dtype=float)
        low = coords.min(axis=0)
        span = np.maximum(coords.max(axis=0) - low, 1)
        scale = min(680 / span[0], 300 / span[1])
        paths = []
        for pid, f in window.groupby('nfl_id'):
            f = f.sort_values('time')
            color = '#176957' if pid == row.nfl_id else '#ad6700' if pid == row.receiver_id else '#929999'
            width = 3 if pid in [row.nfl_id, row.receiver_id] else 1
            xy = (f[['x', 'y']].to_numpy() - low) * scale
            points = ' '.join(f'{x+20:.2f},{330-y:.2f}' for x, y in xy)
            x, y = xy[0]
            paths.append(f'<polyline points="{points}" fill="none" stroke="{color}" stroke-width="{width}"/><circle cx="{x+20:.2f}" cy="{330-y:.2f}" r="4" fill="{color}"/><text x="{x+25:.2f}" y="{325-y:.2f}" font-size="11">{int(pid)}</text>')
        panels.append(f'<article><h2>A{index:03}: {escape(record_key(row))}</h2><p>Green: CB; amber: proposed receiver; gray: other tracked players. Dots: snap. Equal coordinate scales.</p><svg viewBox="0 0 720 350" role="img" aria-label="All available tracked paths for assignment review">{"".join(paths)}</svg></article>')
    return panels


def write_html(name, title, intro, articles):
    html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    html += f'<title>{escape(title)}</title><style>body{{font:16px/1.6 system-ui;max-width:1000px;margin:30px auto;padding:20px;background:#f4f5ee;color:#172d27}}article{{border-top:1px solid #bac9bf;padding:25px 0}}svg{{width:100%;max-height:400px}}figure{{margin:15px 0}}figcaption{{font-size:14px}}code{{overflow-wrap:anywhere}}</style>'
    html += f'<h1>{escape(title)}</h1><p>{escape(intro)}</p>' + ''.join(articles) + '</html>'
    (OUT / name).write_text(html, encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    source = json.loads((INPUT / 'summary.json').read_text(encoding='utf-8'))
    archive_path = ROOT / 'nfl-big-data-bowl-2027.zip'
    if sha256(archive_path) != source['input_sha256']:
        raise ValueError('Archive changed; rerun expand-blanket.py first')
    cache = json.loads((INPUT / 'tracking-cache.json').read_text(encoding='utf-8'))
    if cache['input_sha256'] != source['input_sha256']:
        raise ValueError('Tracking cache does not match source archive')
    reps = pd.read_csv(INPUT / 'coverage-reps.csv')
    if (len(reps) != source['screened_reps'] or int(reps.blanket.sum()) != source['provisional_blankets']
            or reps.nfl_id.nunique() != source['screened_players']
            or not np.isclose(reps.mean_separation.median(), source['median_separation'])):
        raise ValueError('Coverage source differs from expanded summary')
    if not np.isfinite(reps[['mean_separation', 'throw_separation', 'snap_cushion']].to_numpy()).all():
        raise ValueError('Nonfinite coverage measurements')
    if not (reps.blanket == (reps.mean_separation < 1)).all():
        raise ValueError('Coverage flags differ from the strict Blanket definition')
    sample = review_sample(reps)
    signature = {'source_sha256': sha256(INPUT / 'coverage-reps.csv'), 'seed': SEED,
                 'sample_keys': [record_key(row) for _, row in sample.iterrows()]}
    manifest_path = OUT / 'assignment-sample-manifest.json'
    if manifest_path.exists() and json.loads(manifest_path.read_text(encoding='utf-8')) != signature:
        raise ValueError('Frozen assignment sample changed; archive the old validation directory before a new study')
    manifest_path.write_text(json.dumps(signature, indent=2), encoding='utf-8')
    worksheet = sample[KEYS].copy()
    worksheet['review_id'] = [f'A{i+1:03}' for i in range(len(worksheet))]
    for field in ['verdict', 'reviewer', 'evidence_type', 'source', 'note']:
        worksheet[field] = ''
    worksheet.to_csv(OUT / 'assignment-review-template.csv', index=False)
    labels_path = OUT / 'assignment-labels.json'
    labels = json.loads(labels_path.read_text(encoding='utf-8')) if labels_path.exists() else {}
    assignment = assess_labels(sample, labels)
    positives = reps[reps.blanket].sort_values(KEYS).copy()
    positive_template = positives[KEYS].copy()
    for field in ['verdict', 'reviewer', 'evidence_type', 'source', 'note']:
        positive_template[field] = ''
    positive_template.to_csv(OUT / 'positive-review-template.csv', index=False)
    positive_path = OUT / 'positive-assignment-labels.json'
    positive_review = assess_labels(positives, json.loads(positive_path.read_text(encoding='utf-8')) if positive_path.exists() else {})
    positive_review['sampling'] = 'Every provisional Blanket, reported separately from the random accuracy sample; samples may overlap'
    assignment['positive_review'] = positive_review
    tracking = pd.read_pickle(INPUT / 'tracking.pkl')
    write_html('assignment-review.html', 'Blanket: random assignment review',
               'Private, outcome-masked random sample. Use independent film or charting before labeling. Only selected players are tracked; unseen players may hold the true assignment. Review against source video, not trajectory resemblance.',
               assignment_panels(sample, tracking))
    write_html('positive-assignment-review.html', 'Blanket: all provisional positives',
               'Private outcome-enriched review, separate from the random sample. Review each proposed assignment with independent evidence. These cases cannot estimate overall pairing accuracy.',
               assignment_panels(positives, tracking))
    with ZipFile(archive_path) as archive:
        prefix = 'nfl-big-data-bowl-2027/'
        cb = pd.read_csv(archive.open(prefix + 'players.csv'))
        drill = pd.read_csv(archive.open(prefix + 'combine_tracking.csv'))
        members = [n for n in archive.namelist() if not n.endswith('/')]
        metadata_columns = pd.read_csv(archive.open(prefix + 'player_play.csv'), nrows=0).columns.tolist()
        inventory = {'csv_files': sum(n.lower().endswith('.csv') for n in members),
                     'video_files': sum(Path(n).suffix.lower() in {'.mp4', '.mov', '.avi', '.mkv', '.webm'} for n in members),
                     'coverage_label_fields_present': all(n in metadata_columns for n in ['coverage_assignment', 'coverage_assignment_at_snap']),
                     'explicit_receiver_id_field_present': any(n in metadata_columns for n in ['receiver_id', 'assigned_receiver_id', 'coverage_receiver_id', 'matchup_nfl_id']),
                     'interpretation': 'The supplied archive contains CSV tracking and metadata, not film. MAN labels do not name the assigned receiver.'}
    phases = phase_audit(drill, cb.loc[cb.nfl_position == 'CB', 'nfl_id'])
    phase_panels = json.loads((OUT / 'phase-review-panels.json').read_text(encoding='utf-8'))
    articles = []
    for r in phase_panels:
        title = f"{r['drill']} / {r['nfl_id']} / {r['event_id']} / attempt {r['attempt']}"
        articles.append('<article><h2>' + escape(title) + '</h2>' + line_svg(r['x'], r['y'], 'Trajectory: equal source-coordinate scales') +
                        line_svg(r['seconds'], r['speed'], 'Horizontal: time (seconds); vertical: speed (source units); orange dot is detector center', r['detected_center'], equal_aspect=False) + '</article>')
    write_html('phase-review.html', 'Blanket: drill phase review',
               'Private random sample, six attempts per drill. Compare the detector with independent drill video or annotated phase boundaries. A plausible trajectory is not independent phase verification.', articles)
    football = application(reps)
    benchmarks = baseline_benchmarks(pd.read_csv(INPUT / 'players.csv'))
    queue = pd.read_csv(OUT / 'football-meeting-shortlist.csv')
    # Public flags are aggregate only. The local casebook contains the review identifiers.
    write_html('football-review.html', 'Blanket: coverage film meeting queue',
               'Start by confirming the assignment from independent film. Then compare starting cushion, average separation, and throw separation. These flags prioritize questions; they do not grade defenders.',
               [f'<article><h2>{escape(record_key(row))}</h2><p>{escape(row.review_reason)}</p><p>Cushion {row.snap_cushion:.2f}; average {row.mean_separation:.2f}; throw {row.throw_separation:.2f} assumed yards. Route: {escape(str(row.route))}.</p><ol><li>Is this the assigned receiver?</li><li>Does the starting cushion explain the disagreement?</li><li>Did the receiver create separation late, or did the CB close it?</li></ol></article>' for _, row in queue.iterrows()] + assignment_panels(queue, tracking))
    report = {'validation_version': 1, 'updated': 'October 22, 2026', 'input_sha256': source['input_sha256'],
              'coverage_source_sha256': signature['source_sha256'], 'source_analysis_version': source['analysis_version'],
              'audit_code_sha256': sha256(Path(__file__)),
              'detector_code_sha256': sha256(ROOT / 'tools/expand-blanket.py'),
              'screened_reps': len(reps), 'assignment': assignment, 'phases': phases, 'application': football,
              'archive_inventory': inventory,
              'baselines': benchmarks, 'player_source_sha256': sha256(INPUT / 'players.csv'),
              'units': 'Game distances assume yards; combine speed retains source units. Current-year field dictionary confirmation remains pending.',
              'model_policy': 'Version 4 sensor comparisons remain unchanged. Four fixed simple baselines were added; no sensor-feature model was tuned or selected.'}
    (OUT / 'summary.json').write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf-8')
    if args.publish:
        published = json.loads((ROOT / '_data/blanket_expanded.json').read_text(encoding='utf-8'))
        if published['input_sha256'] != source['input_sha256'] or published['screened_reps'] != len(reps):
            raise ValueError('Public expanded snapshot differs from validation source')
        (ROOT / '_data/blanket_validation.json').write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf-8')
    print(json.dumps({'assignment': assignment, 'phase_review_attempts': len(phase_panels), 'application': football}, indent=2))


if __name__ == '__main__':
    main()
