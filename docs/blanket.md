# Blanket: Big Data Bowl prototype

Blanket is Nolan McDermott's proposed stat: a cornerback allows **less than 1 yard of average separation on a man-coverage assignment**. Version 3 defines the averaging window as snap through pass-forward. Exactly 1 yard does not qualify. Blanket rate is qualifying reps divided by eligible measured reps.

## First findings

The initial three-cone cohort yields 1,380 candidate regular-season man-coverage reps across 11 cornerbacks. Screening produces 215 inferred receiver–cornerback pairings and 2 provisional Blankets (0.93%). Omitting the first 0.5 seconds yields 12 reps under 1 yard; the throw-only snapshot yields 71. The latter two are sensitivity comparisons, not the fixed Blanket definition.

Eight players have at least ten screened reps. Their three-cone time / player-average separation correlation is about 0.33, with a player-bootstrap percentile 95% interval of approximately -0.98 to 0.94 (2,000 draws, seed 2027). This is descriptive, unadjusted, and too uncertain to establish predictive value. The interval does not account for incorrect receiver assignments.

## Reproduce locally

Obtain the competition data from [NFL Big Data Bowl 2027 on Kaggle](https://www.kaggle.com/competitions/nfl-big-data-bowl-2027) after accepting the rules. Place `nfl-big-data-bowl-2027.zip` at the repository root; it is ignored by Git. Python 3.10+ is supported.

```powershell
python -m pip install -r tools/blanket-requirements.txt
python tools/audit-big-data-bowl.py
python tools/analyze-blanket.py
python tools/test-blanket.py
```

The analysis streams the large game-tracking CSVs and caches candidate-play tracking under ignored `local-data/big-data-bowl/`. The cache is keyed to the input archive SHA-256 and eligibility-filter version. A first run takes longer than subsequent runs.

Private outputs include the audit, candidate reps, tracking diagnostics, inferred pair-level measurements, player summaries, three-cone sensor attempt features, and `matchup-review.html` with five tracking examples. Open the latter locally to review inferred assignments. The plots cannot establish actual coverage responsibilities without film or charted receiver IDs.

To update the public aggregate snapshot, explicitly run:

```powershell
python tools/analyze-blanket.py --publish
```

This updates only `_data/blanket_results.json`; it exports no player identities, stopwatch inputs, frame trajectories, or rep records. Jekyll renders the aggregate snapshot; the threshold explorer uses the same embedded data. The ZIP, local caches, and private review are not deployed. Data attribution: NFL / Next Gen Stats, via Kaggle.

## Eligibility and matching

1. Join combine results and NFL players one-to-one on `nfl_id` and `draft_year`. Combine labels use DB; NFL positions identify CBs. Require a recorded three-cone time.
2. Join game IDs to `games.csv` and retain `season_type == REG` in 2023–2025. Require CB/SLOT_CB alignment, team `MAN_COVERAGE`, player `coverage_assignment == MAN`, a non-nullified play, and pass result C, I, or IN. Sacks, runs, postseason, and zone calls are excluded.
3. Require unique defender `ball_snap` and `pass_forward` events and at least one second between them.
4. At the defender snap timestamp, choose the nearest observed offensive route runner within 5 yards. If multiple runners are observed, require the second-nearest to be at least 1 yard farther away. Freeze the receiver identity; never switch the pair or choose it using the eventual outcome.
5. Reject receivers selected by multiple measured CBs on one play. Synchronize by exact timestamp. Require both endpoints, at least 90% of expected 10 Hz samples, finite positions, and no gap over 0.2 seconds.
6. Compute Euclidean distance and trapezoidal integration divided by elapsed time. Treat x/y as yards under the NFL tracking convention; confirmation against the 2027 field dictionary remains an explicit unit check for the final submission.

Checks assert that accepted and excluded counts reconcile, reps are unique, the histogram reconciles, and Blanket uses the strict threshold. Tests verify time weighting, exact-one boundaries, momentary separation spikes, and invalid windows.

## Combine sensor feature

For tracked player three-cone attempts, circular direction differences avoid treating 359° → 1° as a huge turn. Select frames turning at least 120°/second with both adjacent speeds at least 1 and 0.09–0.11-second timestamp spacing. Require three qualifying frames per attempt, take median speed, then take the median across attempts per player.

Seven timed cornerbacks have this prototype feature; four also meet the minimum coverage workload. That narrow overlap cannot validate it. Thresholds, completeness, speed units, and drill phases need review before treating it as a scouting trait.

## Limits and next work

- Selected-player tracking omits many receivers. 135 of 215 screened pairs have only one observed route runner at the snap. The closest tracked player can be the wrong responsibility even within 5 yards; this method cannot verify assignments.
- The snap-distance filter favors tighter starting alignments. Blanket also depends on cushion and route duration. Targeted and untargeted assignments are pooled.
- Two positive reps cannot support a reliable Blanket-rate model. No player ranking, adjusted prediction model, out-of-sample performance, or causal claim is presented.
- Next: video-verified examples, cushion/window sensitivity, receiver/context adjustment, and DB movement drills with broader participation. Keep every player's reps together in validation splits.

The public page is a research progress artifact, not a completed Kaggle submission. The [competition overview](https://www.kaggle.com/competitions/nfl-big-data-bowl-2027/overview) asks participants to link combine sensor movement to regular-season performance.
