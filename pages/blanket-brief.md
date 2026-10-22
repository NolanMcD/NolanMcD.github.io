---
layout: landing
title: "Blanket: Research Brief"
permalink: /projects/nfl-big-data-bowl/brief/
description: "What sustained coverage proximity measures, where it fails, and why combine-to-coverage prediction remains unproven."
---

{% assign b = site.data.blanket_expanded %}
{% assign v = site.data.blanket_validation %}

# Blanket: what does staying close actually measure?

**Nolan McDermott · NFL Big Data Bowl 2027 · October 22, 2026**

Can movement through combine defensive-back drills identify cornerbacks who sustain
tight coverage in NFL games? I investigate this through **Blanket**: a proposed
man-coverage assignment with time-weighted average receiver–defender separation
strictly below one yard, from snap through throw. Exactly one yard does not qualify.

**Finding:** the current study does not establish useful combine-to-coverage
prediction. Starting alignment changes the interpretation of separation, receiver
assignments remain inferred, and a promising W-drill feature is sensitive to how
movement direction is measured. The contribution is an auditable test of the
proposal, with a practical way to choose contrasting coverage clips for review.

[Full analysis and interactive explorer]({{ '/projects/nfl-big-data-bowl/' | relative_url }}) ·
[Reproduction notebook](https://github.com/NolanMcD/NolanMcD.github.io/blob/main/notebooks/blanket-reproduction.ipynb) ·
[Methods and review protocol](https://github.com/NolanMcD/NolanMcD.github.io/blob/main/docs/blanket.md)

## Measure the assignment before evaluating the player

The study joins combine and NFL records by player ID and draft year. It includes
regular-season passing plays from 2023–2025 with CB/SLOT_CB alignment, team man
coverage, an individual MAN assignment, and no nullified play. Three defensive-back
drills provide prototype features for all 60 combine CBs; 43 have measured pairs.

Of {{ b.candidate_reps }} candidate reps, {{ b.screened_reps }} survive tracking and
pairing checks. The procedure selects the nearest observed route runner within
five yards at snap, requires a one-yard advantage over a second observed runner
when present, freezes receiver identity, and rejects collisions across measured
CBs. It requires synchronized snap and throw endpoints, at least one second of
coverage, 90% of expected 10 Hz observations, finite positions, and no gap above
0.2 seconds. Missing tracking is excluded, not scored as failed coverage.

The denominator is measured, eligible pairs. Trapezoidal integration of simultaneous
Euclidean distance, divided by elapsed time, yields average separation. There are
{{ b.provisional_blankets }} provisional Blankets ({{ b.blanket_rate | times: 100 | round: 2 }}%).
A brief gap above one yard can coexist with a qualifying average.

The critical limitation is incomplete opponent tracking: {{ b.single_observed_runner_reps }}
pairs have only one observed route runner at snap. The true assignment may be
untracked. The five-yard screen also limits off-man representation. These results
describe selected measured pairs, not all coverage or all prospects. Game distances
assume yards; current-year dictionary confirmation is still pending.

## Average proximity adds temporal context, not demonstrated defensive value

<figure>
<img src="{{ '/assets/images/blanket/coverage-context.png' | relative_url }}" width="1600" height="800" style="max-width:100%;height:auto" alt="Nine pairings are tight by average and at throw, four only by average, 270 only at throw, and 591 by neither; starting-cushion strata show different rates.">
<figcaption>Figure 1. Average and throw-time tightness answer different questions. Counts are descriptive and assignments are inferred.</figcaption>
</figure>

Of 279 pairs under one yard at throw, 270 do not qualify as Blankets. Four
provisional Blankets finish at least one yard apart; none finishes at least two
yards apart. A large late-gap failure is therefore possible mathematically but
not observed among these positives. Removing the first 0.5 seconds changes the
under-one-yard count from 13 to 63; this is a sensitivity comparison, not a revised
Blanket definition.

Ten of the 13 positives start under two yards away. None starts three to five
yards away. This cannot establish cushion's causal effect, but it shows why a
low average cannot be interpreted without the starting responsibility.

**Football application:** select contrasting reps for a coverage meeting. A private,
fixed-seed 12-case shortlist includes four average-only tight reps, four throw-only
tight reps starting at least three yards away, and four tight by both measures.
First confirm responsibility from independent evidence. Then ask whether cushion
explains the disagreement and whether the gap opened or closed late. The tool
prioritizes film questions; target suppression, player grades, and coaching benefit
have not been established.

## Establish the simple baseline

All comparisons below hold out one entire CB, use the same 26 players with at least
ten measured reps, and score player-average separation with equal player weight.
Imputation and standardization use training players only; ridge penalty is fixed
at one. The constant comparator uses the training-player median, appropriate to
absolute-error scoring.

<table>
<caption>Table 1. Retrospective leave-one-player-out MAE in yards; lower is better. These are fixed diagnostic comparators, not a model-selection contest.</caption>
<thead><tr><th>Inputs</th><th>MAE</th><th>Available before NFL play?</th></tr></thead>
<tbody>{% for comparison in v.baselines.comparisons %}<tr><td>{{ comparison.name }}</td><td>{{ comparison.mae | round: 3 }}</td><td>{% if forloop.index <= 2 %}No held-out NFL context used{% else %}Uses observed NFL cushion{% endif %}</td></tr>{% endfor %}</tbody>
</table>

Starting cushion alone yields about 0.245 yards MAE, versus 0.358 for the training
median and 0.356 for conventional combine measurements. Adding those conventional
measurements to cushion yields about 0.251. The contextual analysis is therefore
strongly influenced by information observed in NFL play. It is not a deployable
pre-draft forecast, and these retrospective comparisons have no untouched final
cohort or independent assignment truth.

## Validate the movement before interpreting the prediction

The drill detector selects the largest moving heading change over 0.4 seconds,
with 0.6 seconds of observed data on either side. Three-frame smoothing reduces
noise. Speed at the turn, braking, and reacceleration are aggregated by player
median across attempts. These are operational windows, not validated biomechanical
phases or reaction times. Combine speed remains in source units.

<figure>
<img src="{{ '/assets/images/blanket/phase-sensitivity.png' | relative_url }}" width="1600" height="1040" style="max-width:100%;height:auto" alt="W-drill features are more sensitive than backpedal features; coordinate-derived heading gives W reacceleration rank correlation 0.63.">
<figcaption>Figure 2. Player-rank sensitivity to smoothing, time windows, and coordinate-derived heading. Agreement does not establish phase accuracy.</figcaption>
</figure>

An elapsed-time implementation reproduces the published detector on this sample.
Six one-setting perturbations and coordinate-derived heading test robustness
without using coverage outcomes to choose settings. With coordinate-derived heading,
16 of 61 W-drill centers shift more than 0.2 seconds, and player reacceleration
rankings correlate only 0.633 with the original version. The same sensor system
supplies both signals, so this is geometric agreement, not independent validation.
Entry speed, turn angle, and intended phase still require confirmation.

<figure>
<img src="{{ '/assets/images/blanket/held-out-models.png' | relative_url }}" width="1600" height="960" style="max-width:100%;height:auto" alt="All nine original sensor-feature comparisons, with error-resampling ranges; no convincing predictive improvement.">
<figcaption>Figure 3. Original sensor comparisons remain unchanged; all nine are shown.</figcaption>
</figure>

Adding W-drill reacceleration to the context baseline reduces MAE from about 0.251
to 0.232 yards. Its 95% error-resampling range for improvement is −0.026 to 0.065
yards, including worsening. These 2,000 paired resamples keep predictions fixed;
they omit full training uncertainty, overlapping-fold dependence, multiple
comparisons, and assignment error. The small apparent gain is insufficient to
establish translation of a combine trait to coverage skill.

## What is trustworthy now, and what would change the conclusion?

The arithmetic, eligibility checks, denominator reconciliation, and measured
sensitivity are reproducible. Independent receiver assignments and physical
drill-phase identity are not verified. The ZIP contains nine CSVs, no video, and
no explicit assigned-receiver ID. The review workflow freezes 80 outcome-masked
random pairs, separately includes every positive, and prepares 18 random drill
attempts for independent source annotation. All remain pending. Tracking-only
visual review must not be substituted for that evidence.

Evidence needed next is specific: source-backed receiver responsibilities,
independently annotated drill boundaries, comparable entry-speed/turn-angle tasks,
route and receiver context, and genuinely new evaluation data. A new split of
already inspected outcomes would not restore an untouched test set.

Blanket currently supplies a transparent description of sustained proximity and
a clip-selection question. Whether that description improves player evaluation
beyond simpler measurements remains an open empirical question.

*Data: NFL / Next Gen Stats, via the [official competition](https://www.kaggle.com/competitions/nfl-big-data-bowl-2027).
This is a research brief and reproduction package, not a claim of completed Kaggle submission or verified player rankings.*
