# Blanket: comparative review and improvement decisions

Reviewed October 22, 2026. This is an editorial assessment of selected public
projects, not an exhaustive survey, official judging, or an estimate of prize odds.
Public README claims below have not been independently reproduced.

## Assessment

Blanket is a more credible research project after the measurement audit. Its
clearest strengths are an understandable question, player-held-out comparisons,
disclosed negative results, and explicit assignment uncertainty. It is not yet a
convincing prize-level scouting result: the assigned receiver is unverified, drill
phase identity is unresolved, and incremental sensor value is inconclusive.

The best recognition strategy is a focused, reproducible coverage-measurement
study. Do not position a generic reliability audit as unique: other 2027 projects
already emphasize that contribution. Distinguish Blanket by connecting starting
responsibility, temporal coverage summaries, and movement-phase sensitivity to a
concrete film-review decision.

## Public comparisons

| Project | Evidence visible in its public materials | Implication for Blanket |
| --- | --- | --- |
| [Combine Tracking Audit, Faith Amanze, 2027](https://github.com/faith-amanze/combine-tracking-audit) | Authors report reliability screening, conventional-test comparators, a null get-off result, and a Kaggle notebook. | A negative result and an audit are not sufficient distinctions. Specify the coverage measurement problem and provide runnable reproduction. |
| [Relative Mirror Recovery, Abhishek Das, 2027](https://github.com/Hermes-25/nfl-bdb-2027-mirror-recovery) | Provides a paper, notebook, frozen historical test, simple constant comparator, and an unfavorable result retained through later exploration. | Make the simplest comparator visible and separate historical evaluation from post-inspection exploration. |
| [Combine-to-game movement project, 2027](https://github.com/bansal1600/kaggle-NFL-big-data-2027) | Public materials describe a common pipeline measuring movement in drills and games. | A physically comparable combine/game task is a stronger next step than associating an arbitrary drill extreme with whole-route separation. |
| [SEAL, public 2026 submission](https://github.com/anikaranam/nfl-big-data-bowl-2026) | Connects closing behavior with modeled first-down conversion probability. | Explain football consequences eventually; for now distinguish the information supplied by an average from a throw snapshot without claiming outcome value. |
| [Ghostbusters, 2026 winner, NFL description](https://operations.nfl.com/programs-initiatives/innovation/big-data-bowl) | NFL identifies the winner's comparison of defender movement with hypothetical defender distributions. | Provide an interpretable reference and a decision, not only a named statistic. Its different year's task is not a direct benchmark for Blanket. |

The 2027 projects listed are public projects, not established prize winners.
Method sophistication is not evidence of correctness. Claims about their results
above are attributed to their authors rather than adopted as verified NFL findings.

## Judging fit

The [official 2027 requirements](https://www.kaggle.com/competitions/nfl-big-data-bowl-2027/overview/submission-requirements)
weight Football and Data Science at 30% each, Writing and Visualization at 20%
each. The published format calls for no more than 2,000 words and fewer than ten
tables/figures, an explicit combine-to-NFL linkage, and an attached public Kaggle
notebook. Recheck the live requirements before submitting.

| Area | Current assessment | Work implemented in this pass |
| --- | --- | --- |
| Football | Practical clip selection is defensible; verified scouting or coaching benefit is not established. | A self-contained brief leads with the decision and its limits. |
| Data science | Player-level validation is a strength; receiver truth and movement validity remain the main weaknesses. | Added training-median, conventional-only, cushion-only, and original-context comparators on identical players. |
| Writing | The full page is useful as an appendix but too long and chronological for a judge's first read. | Added a concise brief with one table and three figures; retained detailed methods separately. |
| Visualization | Aggregate figures are readable; showing them does not establish assignments. | Linked figures directly to specific claims and retained caveats in captions/alt text. |
| Reproduction | Website scripts alone are harder to assess than a portable notebook. | Added an offline reproduction notebook bundling the exact source, with no raw data or stored outputs. |

## New baseline finding

On the same 26 workload-eligible CBs, equal-player leave-one-out MAE is approximately
0.358 yards for a training-player median, 0.356 for conventional combine inputs,
0.245 for starting cushion alone, and 0.251 for the existing combined context
baseline. All are reported; none is chosen as a validated winner. No sensor
feature or ridge penalty was tuned. The original nine sensor comparisons remain
unchanged.

This strengthens a specific interpretation: context observed during NFL play
accounts for much more of the current outcome than the conventional combine
inputs in this retrospective exercise. It does not establish causal effects or
future prospect performance. Sensor comparisons still depend on inferred pairs
and operational drill windows.

## What remains worth doing

1. Obtain independently supported receiver assignments, review the frozen random
   sample and every positive, and adjudicate disagreement. Do not substitute
   trajectory resemblance for assignment truth.
2. Validate physical drill phases and comparable entry-speed/turn-angle tasks.
   W-drill reacceleration's 0.633 rank agreement under coordinate heading makes
   this necessary before treating its small MAE gain as a useful trait.
3. Evaluate whether temporal separation adds information beyond starting cushion
   and throw-time separation for a defined football endpoint, with route/receiver
   context and appropriate handling of target selection. Existing descriptive
   disagreements do not prove incremental outcome value.
4. Seek independent feedback on a small set of examples and the proposed football
   decision. The generated 12-case shortlist supports that discussion once source
   evidence is available.
5. Evaluate on genuinely new players/cohorts when available. Label retrospective
   resplits honestly. Do not create an apparently untouched test by renaming
   already inspected data.

No public source for these exact assignments or phase labels was established in
this review. The notebook and brief are GitHub artifacts; uploading and attaching
a public Kaggle notebook remains a separate submission step. A GitHub publication
alone does not satisfy the competition's submission requirements.
