# Blanket: combine-to-coverage research

Blanket is Nolan McDermott's proposed stat: **a cornerback allows less than 1 yard of average separation on a man-coverage assignment**. The averaging window remains snap through pass-forward. Exactly 1 yard does not qualify. Integrate simultaneous player-to-player distance over time with the trapezoidal rule, then divide by elapsed time. Blanket rate uses only eligible measured assignments in its denominator.

## Version 4: expanded DB-drill study

The first prototype required a three-cone time and produced 215 inferred pairs across 11 CBs, with two provisional Blankets. The audit found that player IDs matched correctly, but only 14 of 60 cornerbacks had official three-cone times. The original snapshot is preserved in `_data/blanket_results.json` and can still be reproduced with `tools/analyze-blanket.py`.

The expanded study no longer requires that stopwatch result. It uses W-drill, 90-degree backpedal/break, and 45-degree backpedal/transition tracking. Prototype features are available for all 60 CBs. Among them, 49 have eligible regular-season man-coverage reps; 43 have measured inferred pairs.

| Stage / outcome | Count |
| --- | ---: |
| Candidate reps | 4,777 |
| Screened inferred pairs | 874 |
| CBs with measured pairs | 43 |
| CBs with at least ten measured pairs | 26 |
| Provisional Blankets | 13 |
| Provisional Blanket rate | 1.49% |
| Under 1 yard with first 0.5 seconds omitted | 63 |
| Under 1 yard at throw only | 279 |

Alternative windows are sensitivity comparisons, not replacements for the fixed Blanket definition. Expanding the CB pool creates additional pairing collisions, so the historical and expanded samples are not assumed to be perfectly nested.

## Reproduce

Obtain `nfl-big-data-bowl-2027.zip` from the [official Kaggle competition](https://www.kaggle.com/competitions/nfl-big-data-bowl-2027) after agreeing to its rules. Place it at the repository root, where Git ignores it. Python 3.10+ is supported.

```powershell
python -m pip install -r tools/blanket-requirements.txt
python tools/expand-blanket.py
python tools/test-blanket.py
python tools/test-blanket-expanded.py
node tools/test-blanket-ui.cjs
```

The script streams game-tracking files and caches only candidate-play tracking in ignored `local-data/big-data-bowl/expanded/`. Reuse requires the same archive SHA-256 and filter version. Private outputs include candidate and measured reps, player summaries, per-attempt drill features, a 30-case review worksheet, and synchronized review panels. No raw data is added to Git.

For optional plotting:

```powershell
python -m pip install -r tools/blanket-review-requirements.txt
python tools/plot-blanket-review.py
```

This produces five private contact sheets of tracking trajectories and separation curves. Dots mark the snap; crosses mark the throw. The review has equal yard scales on both field axes. Source coordinate units still need confirmation against the 2027 dictionary; game coordinates are treated as yards under the NFL tracking convention. Combine speed features retain source units.

To update the site after reviewing the result:

```powershell
python tools/expand-blanket.py --publish
python tools/plot-blanket-models.py
```

The first command writes aggregate analysis only to `_data/blanket_expanded.json`. The second plots those aggregates to PNG/SVG under `assets/images/blanket/`. No player identities, stopwatch inputs, individual drill values, rep IDs, or trajectories are exported. The interactive explorer and rendered tables use the same aggregate snapshot. Attribution: NFL / Next Gen Stats, via Kaggle.

## Coverage eligibility and pairing

Join combine and player records one-to-one on `nfl_id` and `draft_year`; identify CBs using NFL position rather than the combine's broader DB label. Use `games.csv` to select regular-season games only. Require CB/SLOT_CB alignment, team `MAN_COVERAGE`, individual `coverage_assignment == MAN`, a non-nullified play, and pass result C, I, or IN.

At the defender's unique snap event, choose the nearest observed offensive route runner within five yards. If a second runner is observed, require a one-yard advantage. Keep that receiver fixed for the rep; do not switch to whoever becomes nearest later. Reject all collisions where multiple measured CBs select the same receiver on the same play.

Require a unique defender throw event, at least one second between snap and throw, both synchronized endpoints, at least 90% of expected 10 Hz samples, finite positions, and no synchronized gap above 0.2 seconds. Missing tracking is not a failed Blanket. Checks reconcile all candidate, exclusion, histogram, and stratum counts.

For the overlapping reciprocal-margin sensitivity subset, also require at least one other observed MAN defender and a one-yard snap-distance advantage over the closest such competitor to the selected receiver. This leaves 331 pairs across 36 CBs and seven provisional Blankets. It cannot account for unobserved defenders or receivers and is not a verified subset.

Starting-cushion strata are disjoint: under 2 yards (120 reps, 10 provisional Blankets), 2–3 yards (440 reps, three Blankets), and 3–5 yards (314 reps, zero Blankets). These are descriptive counts, not estimates of cushion's causal effect.

## Operational drill phases

For each player/event/attempt in the three named drills:

1. Sort by timestamp, require finite data and no gap above 0.2 seconds, smooth speed with a centered three-frame median, and smooth direction with a three-frame circular mean.
2. Among moving frames with speed at least 1, find the largest circular heading change across a 0.4-second window. Require 0.6 seconds of observed data before and after its center. Reject a straight or stationary trace with no qualifying turn.
3. Select minimum smoothed speed within 0.2 seconds of the center as turn speed. Find the maximum earlier and later speeds within the 0.6-second flanks. Speed lost before the minimum, divided by elapsed time, measures braking; speed gained afterward, divided by time, measures reacceleration.
4. Use median feature values across attempts for each player and drill.

These are reproducible dominant-heading-change windows, not independently annotated biomechanical phases. This replaces the earlier three-cone heuristic that discarded players unless enough frames exceeded a fixed angular-velocity threshold. The new phases require validation against drill video and sensitivity checks for smoothing and window size.

## Held-out-player comparisons

Use continuous player-average separation as the modeling outcome. Only 13 positive Blanket reps exist, so no Blanket-rate prediction model is fit. Include CBs with at least ten measured reps: 26 players for each of the nine comparisons.

The baseline uses mean starting cushion, forty time, height, and weight. Add one of three features from one of three drills at a time. Ridge penalty is fixed at 1; the intercept is unpenalized. In each leave-one-CB-out fold, learn numeric medians and standardization from training players only. Entire players, with all their coverage reps, remain outside that fold's training. Two modeled CBs lack forty times, handled by fold-local median imputation. Score mean absolute error with equal weight per held-out CB.

The context baseline MAE is approximately 0.251 yards. Adding W-drill reacceleration yields approximately 0.232 yards, an improvement of 0.019 yards. Its 95% error-resampling range is approximately -0.026 to 0.065 yards, spanning worsening and improvement. Most other added features worsen error in this run. All nine results are reported; none is selected as a validated winner.

Intervals use 2,000 paired resamples of held-out-player absolute-error differences with seed 20271018, conditional on fixed predictions. Models are not refit within those resamples. This does not capture full model-training uncertainty, overlapping-fold dependence, multiple comparisons, noisy player averages, or incorrect assignments. There is no untouched final cohort. The baseline includes observed NFL cushion, making this a diagnostic exercise rather than a deployable pre-draft prediction model. Route and receiver context are not fully adjusted.

## Thirty-case tracking review

The review sample includes every provisional Blanket, near-threshold reps, extreme separation gaps, reciprocal-margin cases, and ordinary reps. All 30 synchronized plots were visually reviewed; eight were flagged for film because paths diverged, crossed, or showed extended-play context. Twenty-two showed compatible continuous motion, but that does not establish assignment truth. Zero assignments are film verified.

Private manual annotations are keyed by game/play/CB/receiver in `tracking-review-notes.json`. On a fresh clone they are absent, so the script correctly labels the prepared sample pending rather than inventing review results. The numerical coverage/model outputs are reproducible without those notes; published review counts document the maintainer's local visual review.

The sample is deliberately enriched for outcomes and is not suitable for estimating pairing accuracy. Flagged reps remain in the main data: removing bad-looking outcomes after inspecting separation would bias the result. Even reciprocal snap pairs show divergence; missing opponents remain the central problem.

## Remaining limits

- 516 of 874 pairs have only one observed route runner at snap. The nearest tracked receiver can be unrelated to the CB's actual responsibility.
- The five-yard filter excludes many off-man alignments; the sample is not representative of all NFL coverage.
- Small player counts, selective drill participation, and observed NFL playing time limit generalization. Repeated snaps do not create more independent combine observations.
- Next: film or charted assignment truth, receiver/route context, validated drill phases, and an untouched test cohort. Keep the strict Blanket threshold and label alternative windows separately.

The public page is a research progress artifact, not a completed Kaggle submission or a player ranking.
