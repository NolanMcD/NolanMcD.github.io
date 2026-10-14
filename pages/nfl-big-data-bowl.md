---
layout: landing
title: "Three Cones, Tight Coverage"
permalink: /projects/nfl-big-data-bowl/
description: "Introducing Blanket: a proposed man-coverage stat for cornerbacks, explored through three-cone and NFL player tracking."
project_date: 2026-10-14
project_label: NFL Big Data Bowl 2027
project_summary: A first look at Blanket, a proposed stat for man-coverage assignments averaging less than one yard of separation.
---

{% assign b = site.data.blanket_results %}
<link rel="stylesheet" href="{{ '/assets/css/blanket.css' | relative_url }}">
<div class="blanket-project">
  <section class="blanket-hero" aria-labelledby="blanket-title">
    <div>
      <p class="blanket-eyebrow">NFL Big Data Bowl 2027 <span>First findings · October 14, 2026</span></p>
      <h1 id="blanket-title">Three cones.<br>Tight coverage.</h1>
      <p class="blanket-lede">Can change of direction at the combine tell us who stays close on Sundays? I'm starting with cornerbacks, the three-cone drill, and a new stat: <strong>Blanket.</strong></p>
      <div class="blanket-actions"><a class="blanket-button" href="#blanket-lab">Explore the results ↗</a><a href="https://github.com/NolanMcD/NolanMcD.github.io/blob/main/tools/analyze-blanket.py">Analysis code</a></div>
    </div>
    <div class="blanket-definition">
      <p class="blanket-eyebrow">Introducing</p><h2>Blanket</h2>
      <p class="blanket-equation">average separation <strong>&lt; 1 yd</strong></p>
      <p>One man-coverage assignment. One receiver. Less than a yard of separation on average.</p>
      <svg viewBox="0 0 340 120" role="img" aria-label="Illustration of a cornerback following a receiver closely through a route break"><path d="M30 105V10M90 105V10M150 105V10M210 105V10M270 105V10M330 105V10" stroke="currentColor" opacity=".15"/><path d="M30 82H168Q188 82 203 67L269 24" stroke="#c9f26f" stroke-width="3" fill="none" stroke-dasharray="5 5"/><path d="M31 92H168Q188 92 208 77L275 35" stroke="#74d9c2" stroke-width="3" fill="none"/><circle cx="269" cy="24" r="7" fill="#c9f26f"/><circle cx="275" cy="35" r="7" fill="#74d9c2"/></svg>
      <p class="blanket-caption"><span class="blanket-key receiver">Receiver</span><span class="blanket-key corner">Cornerback</span>Concept illustration</p>
    </div>
  </section>
  <aside class="blanket-status"><strong>Exploratory prototype</strong><span>Pairings are inferred from selected-player tracking, not independently verified assignments. All counts are provisional. Regular season only, 2023–2025.</span></aside>
  <section class="blanket-stats" aria-label="Initial analysis at a glance">
    <div><strong>{{ b.screened_reps }}</strong><span>screened pairings</span><small>from {{ b.candidate_reps }} candidate reps</small></div>
    <div><strong>{{ b.screened_players }}</strong><span>cornerbacks</span><small>with timed three-cone results</small></div>
    <div><strong>{{ b.provisional_blankets }}</strong><span>provisional Blankets</span><small>{{ b.blanket_rate | times: 100 | round: 2 }}% of screened pairings</small></div>
  </section>
  <section class="blanket-section blanket-intro" aria-labelledby="blanket-meaning">
    <div><p class="blanket-eyebrow">A stat built around staying close</p><h2 id="blanket-meaning">What counts as a Blanket?</h2></div>
    <div><p>For this first version, I average the distance between a cornerback and the same receiver <strong>from the snap through the throw</strong>. A time-weighted average below one yard earns one Blanket. Exactly one yard does not.</p><p>A receiver can briefly get more than a yard away and still be blanketed on average. Being close only when the ball is thrown does not guarantee a Blanket.</p><p><strong>Blanket rate</strong> is Blankets divided by eligible, measured man-coverage assignments. Missing tracking is excluded from the denominator; it never counts as a failed rep.</p></div>
  </section>
  <section class="blanket-lab" id="blanket-lab" aria-labelledby="blanket-lab-title">
    <div class="blanket-lab-heading"><div><p class="blanket-eyebrow">Try the definition</p><h2 id="blanket-lab-title">How tight is tight?</h2></div><span class="blanket-pill">{{ b.screened_reps }} inferred pairings</span></div>
    <p>Change the threshold or the averaging window to explore sensitivity. The proposed Blanket definition stays fixed at <strong>under 1 yard, snap to throw</strong>.</p>
    <div class="blanket-controls"><fieldset><legend>Average separation below</legend><div class="blanket-thresholds" id="blanket-thresholds">{% for item in b.thresholds %}<button type="button" data-threshold="{{ item.threshold }}" aria-pressed="{% if item.threshold == 1 %}true{% else %}false{% endif %}"{% if item.threshold == 1 %} class="is-active"{% endif %}>{{ item.threshold }} yd</button>{% endfor %}</div></fieldset><div class="blanket-window"><label for="blanket-window">Averaging window</label><select id="blanket-window"><option value="full">Snap → throw (proposed definition)</option><option value="late">0.5 seconds after snap → throw</option></select></div></div>
    <div class="blanket-result" aria-live="polite" aria-atomic="true"><div><strong id="blanket-count">{{ b.provisional_blankets }}</strong><span id="blanket-count-label">provisional Blankets</span></div><div><strong id="blanket-rate">{{ b.blanket_rate | times: 100 | round: 2 }}%</strong><span>of {{ b.screened_reps }} measured pairings</span></div><p id="blanket-lab-note">Average separation &lt; 1 yard, from snap through throw.</p></div>
    <noscript><p>The explorer needs JavaScript. The fixed-definition result is {{ b.provisional_blankets }} provisional Blankets out of {{ b.screened_reps }} pairings.</p></noscript>
  </section>
  <section class="blanket-section" aria-labelledby="blanket-distribution-title">
    <p class="blanket-eyebrow">The separation distribution</p><h2 id="blanket-distribution-title">Most measured reps sit above one yard.</h2><p>Each bar counts pairings in a range. Ranges have different widths; this is a count chart, not a density plot. Values use the snap-to-throw time average.</p>
    <div class="blanket-histogram" role="list" aria-label="Average separation distribution">{% for bin in b.histogram %}<div class="blanket-bar-row" role="listitem"><span>{{ bin.label }} yd</span><div class="blanket-bar-track"><div class="blanket-bar{% if forloop.index <= 2 %} blanket-bar-under{% endif %}" style="width: {{ bin.count | times: 100.0 | divided_by: b.screened_reps }}%"></div></div><strong>{{ bin.count }}</strong></div>{% endfor %}</div>
    <p class="blanket-caption">Median rep average: {{ b.median_separation | round: 2 }} yards. Bar widths show a share of all {{ b.screened_reps }} screened pairings.</p>
  </section>
  <section class="blanket-finding" aria-labelledby="blanket-window-title">
    <div><p class="blanket-eyebrow">The first football question</p><h2 id="blanket-window-title">Should starting cushion count?</h2><p>Omitting the first half-second changes the result from <strong>{{ b.provisional_blankets }} to {{ b.window_sensitivity.after_half_second_blankets }}</strong> reps under one yard. Starting cushion can penalize a cornerback before the receiver has made a move.</p><p>At the throw alone, {{ b.window_sensitivity.throw_only_below_one }} pairings are below one yard. That snapshot cannot tell us how tightly the whole route was covered.</p></div>
    <div class="blanket-window-comparison"><div><span>Snap → throw</span><strong>{{ b.provisional_blankets }}</strong><small>provisional Blankets</small></div><div><span>After 0.5 s → throw</span><strong>{{ b.window_sensitivity.after_half_second_blankets }}</strong><small>alternative window</small></div><div><span>At the throw only</span><strong>{{ b.window_sensitivity.throw_only_below_one }}</strong><small>snapshot below 1 yard</small></div></div>
  </section>
  <section class="blanket-section" aria-labelledby="blanket-combine-title">
    <p class="blanket-eyebrow">Combine → coverage</p><h2 id="blanket-combine-title">Does the three-cone drill explain it?</h2>
    <p><strong>We don't have convincing evidence yet.</strong> Among {{ b.correlation_players }} cornerbacks with at least {{ b.correlation_min_reps }} screened pairings each, three-cone time and player-average separation have Pearson correlation <strong>r = {{ b.correlation | round: 2 }}</strong>. Longer times trend toward more separation in this sample, but the player-bootstrap 95% interval runs from <strong>{{ b.correlation_bootstrap_95[0] | round: 2 }} to {{ b.correlation_bootstrap_95[1] | round: 2 }}</strong>. It spans strong relationships in both directions.</p>
    <div class="blanket-two-up"><article><h3>The sample is the constraint.</h3><p>The audit found 60 cornerbacks, but only 14 have recorded three-cone times. Repeated snaps don't create extra independent combine observations. The correlation is unadjusted for speed, receiver quality, route, cushion, or scheme.</p></article><article><h3>Use the movement, too.</h3><p>I extracted a prototype turning-speed feature from three-cone sensor tracking. Only {{ b.sensor.comparison_players }} players clear its data requirements and the coverage workload filter. That's a feasibility check, not a validated scouting metric.</p></article></div>
    <p>The box, W, and two backpedal/break drills have tracking for all 60 cornerbacks in the audit, which could support a broader test of the same change-of-direction idea.</p>
  </section>
  <section class="blanket-section" aria-labelledby="blanket-sample-title">
    <p class="blanket-eyebrow">Follow the denominator</p><h2 id="blanket-sample-title">What made it into the prototype?</h2>
    <div class="blanket-sample-flow"><div><strong>{{ b.candidate_reps }}</strong><span>candidate reps</span></div><span aria-hidden="true">→</span><div><strong>{{ b.screened_reps }}</strong><span>screened pairings</span></div><span aria-hidden="true">→</span><div><strong>{{ b.provisional_blankets }}</strong><span>provisional Blankets</span></div></div>
    <div class="blanket-table-wrap"><table><caption>Excluded reps, counted once at their first failed check</caption><thead><tr><th scope="col">Reason</th><th scope="col">Reps</th></tr></thead><tbody>{% for reason in b.exclusions %}<tr><td>{{ reason[0] }}</td><td>{{ reason[1] }}</td></tr>{% endfor %}</tbody></table></div>
    <p><strong>The big limitation:</strong> only selected players are tracked. {{ b.single_observed_runner_reps }} of the {{ b.screened_reps }} accepted pairings have one observed route runner at the snap. The closest <em>tracked</em> receiver may not be the CB's actual responsibility. This is why the page reports provisional counts and does not rank players.</p>
  </section>
  <section class="blanket-section" id="methodology" aria-labelledby="blanket-method-title">
    <p class="blanket-eyebrow">Methodology · version {{ b.analysis_version }}</p><h2 id="blanket-method-title">How the first pass works</h2>
    <ol class="blanket-method"><li><strong>Choose the cohort.</strong> Join combine and NFL players by ID and draft year. Keep CBs with a three-cone time, then regular-season passing plays with CB/SLOT_CB alignment, team MAN_COVERAGE, player assignment MAN, and no nullified penalty.</li><li><strong>Infer a receiver at the snap.</strong> Choose the nearest tracked offensive route runner within 5 yards, with a 1-yard margin to the next observed candidate when there is one. Freeze that identity for the rep. Reject receivers paired to multiple measured CBs.</li><li><strong>Check the window.</strong> Require unique snap/throw events, at least one second of coverage, both endpoints, at least 90% of expected 10 Hz samples, finite positions, and no synchronized gap above 0.2 seconds.</li><li><strong>Measure separation.</strong> Integrate Euclidean distance between simultaneous x/y positions using the trapezoidal rule, then divide by elapsed time. Coordinates are treated as yards under the NFL tracking convention; the final study must confirm units against the 2027 field dictionary.</li><li><strong>Count and compare.</strong> A time average strictly below 1 yard is a provisional Blanket. Give each player equal weight in the combine correlation and resample players, not snaps, in 2,000 bootstrap draws.</li></ol>
    <details><summary>Three-cone sensor feature</summary><p>Within each attempt, measure median speed at frames with a circular heading change of at least 120 degrees/second. Require both adjacent speeds of at least 1, timestamps 0.09–0.11 seconds apart, and three qualifying frames. Take the median across attempts. These exploratory thresholds and drill phases need sensitivity checks.</p></details>
    <p class="blanket-caption">This first pass has not verified assignments with film, fit a predictive model, or tested incremental value beyond speed. The 5-yard filter favors tighter starting alignments. Results describe this screened sample, not all NFL coverage.</p>
  </section>
  <section class="blanket-next"><div><p class="blanket-eyebrow">Next in the notebook</p><h2>Verify the matchup.<br>Then test the movement.</h2><p>Five tracking examples are prepared for private review. Next: check assignments against play video, test cushion and window choices, and expand to drills with broader participation.</p></div><a class="blanket-button" href="https://github.com/NolanMcD/NolanMcD.github.io/blob/main/docs/blanket.md">Reproduce the analysis ↗</a></section>
  <footer class="blanket-footer"><p>Research by Nolan McDermott. Data: NFL / Next Gen Stats, <a href="https://www.kaggle.com/competitions/nfl-big-data-bowl-2027">NFL Big Data Bowl 2027</a>. Public artifacts contain aggregate analysis only.</p><p><a href="{{ '/projects/' | relative_url }}">All projects</a> · <a href="https://operations.nfl.com/programs-initiatives/innovation/big-data-bowl">About the competition</a></p></footer>
</div>
<script type="application/json" id="blanket-results">{{ b | jsonify }}</script>
<script src="{{ '/assets/js/blanket.js' | relative_url }}" defer></script>
