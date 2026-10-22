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

## Measurement validation audit: October 22, 2026

The version 4 model and all nine predictions remain frozen. A separate reproducible
audit adds assignment-review preparation, movement-detector sensitivity, and one
football application. It does **not** turn geometric consistency into assignment
truth or turn a negative prediction result into a positive claim.

```powershell
python tools/validate-blanket.py --publish
python tools/plot-blanket-validation.py
python tools/test-blanket-validation.py
```

First run `expand-blanket.py --publish` when preparing a fresh checkout. The audit
requires the identical archive, coverage CSV, cache, and published expanded sample.
It hashes the archive and coverage table, checks the cache source, and freezes the
random assignment sample. If the input sample changes, preserve the old private
validation folder under a different name before starting a new study. Never reuse
old annotations against a new sample. The nine historical sensor comparisons are
not refit or tuned; the audit additionally fits four fixed simple comparators.

### Assignment evidence

The supplied ZIP contains nine CSVs, no video, and no explicit assigned-receiver
identifier in player/play metadata. Coverage assignment labels such as MAN describe
responsibility type; they do not name the receiver. The audit records this archive
inventory so the need for independent evidence is explicit.

Private outputs live in `local-data/big-data-bowl/expanded/validation/`:

| Artifact | Use |
| --- | --- |
| `assignment-review.html` | 80 simple-random accepted pairs, seed 20261022, with all available tracked paths and calculated outcomes masked |
| `assignment-review-template.csv` | Blank worksheet; copy it before editing because templates regenerate |
| `assignment-sample-manifest.json` | Frozen coverage-table hash and ordered sample identities |
| `positive-assignment-review.html` | All 13 provisional positives, separately labeled as outcome enriched |
| `positive-review-template.csv` | Blank positive-review worksheet |
| `phase-review.html` | Six randomly selected attempts per drill, including trajectory and speed plots |
| `phase-review-template.csv` | Blank independent boundary-annotation worksheet |
| `phase-sample-manifest.json` | Archive identity and frozen attempt sample |
| `football-review.html` | 12 contrasting cases and meeting questions, followed by tracked paths |
| `football-review-queue.csv` | All 274 disagreements between average and throw-time tightness |
| `football-meeting-shortlist.csv` | Four cases per diagnostic category, where available |
| `phase-sensitivity.csv` | Per-attempt detector outputs for private diagnostics |

The random assignment sample is chosen without reading outcomes and is invariant
to CSV row order. It estimates neither the quality of excluded plays nor recall of
the pairing procedure. Players and plays can recur. Do not interpret it as 80
independent player observations. The positive review overlaps the random sample
when applicable and must never be pooled with it to estimate accuracy.

Independent film/charting labels are optional input JSON, not generated facts.
Create `assignment-labels.json` in the private validation folder. Keys are
`game_id/play_id/nfl_id/receiver_id`, exactly as shown in the packet. Each value
requires `verdict` (`confirmed`, `incorrect`, or `unresolved`), `reviewer`,
`evidence_type` (`film` or `independent charting`), `source` (a video/chart locator,
including timestamps where applicable), and `note`. Use the same schema in
`positive-assignment-labels.json` for the positive review; copy an annotation to both
sets if a case overlaps. Tracking plots cannot serve as independent assignment
evidence. Review source film first, record ambiguous responsibilities as unresolved,
and do not remove high-separation reps because they look bad.

Missing annotation files produce pending counts, never a fabricated accuracy
estimate. The confirmed fraction stays null until every sampled pair has a verdict;
unresolved cases remain a separate category. Annotation provenance is checked for
required fields, not independently authenticated. A second blinded reviewer and
adjudication are still needed before claiming a dependable validation result.

### Movement-phase evidence

The audit compares the unchanged published detector with an elapsed-time reference
and six one-at-a-time perturbations: smoothing of one/five frames, heading windows
of 0.2/0.6 seconds, and flanks of 0.4/0.8 seconds. An eighth configuration derives
heading from centered x/y coordinate gradients. Interpolation uses actual elapsed
time; duplicate times, nonfinite geometry, and gaps over 0.2 seconds are rejected.
The comparison reports changed eligibility, detector-center shifts, and Spearman
correlations between player-median features from identical paired attempts.

The elapsed-time reference reproduces the published results on this sample. The
audit breaks numerical ties at the earliest eligible timestamp, making tied-turn
selection invariant to heading rotation; the historical detector remains unchanged.
The coordinate-heading cross-check moves 16/61 W-drill centers by more than 0.2 seconds;
the W-drill reacceleration ranking has correlation 0.633 with the published ranking.
The same sensor system supplies coordinates and reported heading, so this is a
geometric cross-check, not independent truth. It is a reason to validate the feature
before interpreting the earlier 0.019-yard MAE improvement. No setting was selected
using NFL outcomes, and no historical sensor prediction was recomputed.

W-drill and 90-degree drills have only one CB each with repeated attempts. The
45-degree drill has 59. Repetitions may have different directions or tasks, so
these counts do not establish test–retest reliability. Entry speed, turn angle,
detector ambiguity, and phase identity remain unresolved. Speed/time panels in the
local packet provide a shape view; raw numeric observations are in the panel JSON.

Create `phase-labels.json` for independent boundary annotations, keyed by
`nfl_id/drill/event_id/attempt`. Values require `verdict` (`annotated` or
`unresolved`), `reviewer`, `evidence_type`, `source`, and `note`. Annotated cases also
require `phase_start_seconds` and `phase_end_seconds`, measured from the first
observed tracking timestamp, within the attempt. Align source video to tracking
before annotating. The audit reports detector-center agreement with those intervals;
it does not pretend that the supplied labels were independently authenticated.
Zero independent annotations are available as of this update.

### Football application and limits

The application is a **coverage film-meeting clip selector**. It distinguishes
sustained proximity from throw-time tightness, starting with confirmed assignment
responsibility and starting cushion. Of 874 inferred pairs, nine are under one yard
by both measurements, four only by average, 270 only at throw, and 591 by neither.
There are zero average-tight pairs with separation at throw at least two yards.
The latter failure mode remains theoretical in this sample.

The 12-case shortlist contains up to four fixed-seed examples from each of three
categories: average-only tight, throw-only tight starting at least three yards
away, and both tight. This is an intentionally enriched teaching/review sample,
not an accuracy sample. Ask whether responsibility was identified correctly,
whether cushion explains the disagreement, and whether separation opened or
closed late. Descriptive temporal context is the added information; incremental
prediction, target suppression, coaching improvement, or causal defensive value
have not been established.

Public outputs are aggregate `_data/blanket_validation.json` and the two
PNG/SVG figures under `assets/images/blanket/`. No review identities, trajectories,
annotations, or individual drill values are exported. The current-year Kaggle data
dictionary could not be read in this environment; game units remain assumed yards,
and combine speed retains source units. Source to verify:
<https://www.kaggle.com/competitions/nfl-big-data-bowl-2027/data>.

## Research brief, simple comparators, and portable notebook

The [research brief](https://noland.blog/projects/nfl-big-data-bowl/brief/) is the
short first read; the full page and this runbook are its supporting methods. The
[comparative review](blanket-review.md) records the public projects examined,
the judging fit, implemented improvements, and unresolved evidence requirements.

Four fixed comparator configurations use the same 26 workload-eligible CBs:
training-player median (MAE 0.358 yards), conventional combine only (0.356),
starting cushion only (0.245), and the existing context baseline (0.251). These
are equal-player leave-one-out errors for player-average separation. The median
excludes the held-out player. Numeric imputation/scaling for the fixed-penalty
ridge fits is training-only. Conventional inputs are forty, height, and weight;
context adds observed NFL starting cushion. These are retrospective comparisons
with no untouched cohort, independent assignment truth, or full uncertainty
interval. All four are reported; no winner or sensor feature is selected.

Build and verify the output-free public notebook:

```powershell
python tools/build-blanket-notebook.py
python tools/build-blanket-notebook.py --check
python tools/run-blanket-notebook.py --reuse-verified-cache
```

`notebooks/blanket-reproduction.ipynb` bundles exact source copies and hashes. It
uses no runtime network requests. Set `DATA_PATH` to the official ZIP or extracted
CSV folder, or attach one matching dataset on Kaggle for auto-discovery. The
folder route builds a working uncompressed ZIP, so allow disk space equal to the
CSV size plus generated caches. Kaggle hosting/execution is not claimed. Uploading
and attaching a public Kaggle notebook is a separate, still-pending submission step.

The local executor runs every ordinary Python cell sequentially in a fresh process,
checks historical model and aggregate results against the published snapshot, and
writes a private execution record to `local-data/big-data-bowl/notebook-run/`.
`--reuse-verified-cache` requests the identical-archive tracking cache; it is not a
cold raw-data audit. Run without it in a fresh work directory for cold reproduction.
Notebook outputs are not saved into the public source notebook. The regenerated
independent-review counts correctly remain pending when annotation files are absent.

On October 22, 2026, the local executor completed all nine code cells in a fresh
Python process using the archive-verified tracking cache. The historical aggregate
counts and all nine model results matched the published snapshot exactly; all
three figures regenerated. This validates cached local cell execution, not a
Kaggle-hosted run or a new cold-data audit.
