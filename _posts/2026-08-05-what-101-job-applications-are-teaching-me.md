---
title: "What 101 Job Applications Are Teaching Me"
date: 2026-08-05
categories: [data, career]
excerpt: "A candid analysis of my software job search: where I am applying, how quickly decisions arrive, what the tracker is missing, and the experiments I am running next."
---

Job searching produces plenty of emotion and surprisingly little usable feedback. I wanted to turn my own search into a system I could inspect rather than a pile of confirmation and rejection emails.

This is a snapshot of **101 application records across 93 companies** from February 6 through August 4, 2026. The source workbook was assembled from Gmail labels, then deduplicated where possible. I have removed company names, contacts, email links, and active-application notes from this public analysis.

<aside class="job-data-note"><strong>An important limitation:</strong> “Open” means there is no recorded rejection. It does not mean a recruiter is actively considering the application. The tracker also does not yet capture recruiter screens, technical interviews, final rounds, or offers, so this is a pipeline audit—not a success-rate victory lap.</aside>

<div class="job-kpis" aria-label="Job application snapshot">
  <div><span>Applications</span><strong>101</strong><small>across 93 companies</small></div>
  <div><span>No rejection recorded</span><strong>48</strong><small>but 25 are 30+ days old</small></div>
  <div><span>Recorded denials</span><strong>53</strong><small>36 have usable timing</small></div>
  <div><span>Median denial time</span><strong>7.5</strong><small>days, when measurable</small></div>
</div>

## The pipeline is smaller than it looks

The spreadsheet calls 48 records pending. Age tells a more useful story:

<div class="job-aging" aria-label="Age of 48 applications without a recorded denial">
  <div><span>Under 7 days</span><i style="--value:18.75%"></i><strong>9</strong></div>
  <div><span>7–29 days</span><i style="--value:29.17%"></i><strong>14</strong></div>
  <div><span>30–89 days</span><i style="--value:27.08%"></i><strong>13</strong></div>
  <div><span>90+ days</span><i style="--value:25%"></i><strong>12</strong></div>
</div>

Only **23 of the 48 open records are less than 30 days old**. The other 25 should not remain in one undifferentiated “Pending” bucket forever. Unless there is real communication, I should move them to a separate **No response / dormant** status. That leaves a more honest current pipeline and stops old applications from disguising a thin week.

The nine applications submitted on August 4 also explain much of the freshest activity. They are real leads, but far too new to count as evidence that one lane is outperforming another.

## Where I have been applying

Software and internal-tools roles dominate the search. The bars show each lane’s total volume, split between records with and without a denial.

<div class="job-lanes" aria-label="Applications and recorded outcomes by job lane">
  <div class="job-lane-row"><header><strong>Software / Internal Tools</strong><span>60 total</span></header><div class="job-stack"><i class="is-open" style="--share:45%">27 open</i><i class="is-denied" style="--share:55%">33 denied</i></div></div>
  <div class="job-lane-row"><header><strong>Data / Analytics</strong><span>20 total</span></header><div class="job-stack"><i class="is-open" style="--share:40%">8 open</i><i class="is-denied" style="--share:60%">12 denied</i></div></div>
  <div class="job-lane-row"><header><strong>AI / Automation</strong><span>12 total</span></header><div class="job-stack"><i class="is-open" style="--share:66.67%">8 open</i><i class="is-denied" style="--share:33.33%">4 denied</i></div></div>
  <div class="job-lane-row"><header><strong>Adjacent roles</strong><span>9 total</span></header><div class="job-stack"><i class="is-open" style="--share:55.56%">5 open</i><i class="is-denied" style="--share:44.44%">4 denied</i></div></div>
</div>

AI has the largest open share, but that is not yet proof of better fit: much of that lane is recent, and an unresolved application is not an interview. The next version of the tracker needs an actual conversion event before I compare lanes.

The more actionable signal is job level. I classified titles containing words such as *senior*, *staff*, *lead*, or *manager* as stretch-level roles. They account for **24 applications; 17 already have denials**. Among the 17 stretch applications old enough to have had at least 30 days, 13 have denials.

By comparison, only **six applications** explicitly targeted associate, analyst, junior, or entry-level titles. That is too small a test given my three years of production engineering experience. I do not need to stop applying upward, but I should add more Software Engineer II, Data Engineer, Analytics Engineer, Application Developer, and technical analyst roles where the level aligns directly.

## Rejections usually arrive quickly

Only 36 denial records have both a usable application date and outcome date, so timing analysis uses that subset.

<div class="job-timing" aria-label="Time to recorded denial among 36 measurable records">
  <div style="--height:100%"><strong>11</strong><i></i><span>0–2 days</span></div>
  <div style="--height:55%"><strong>6</strong><i></i><span>3–7 days</span></div>
  <div style="--height:45%"><strong>5</strong><i></i><span>8–14 days</span></div>
  <div style="--height:82%"><strong>9</strong><i></i><span>15–30 days</span></div>
  <div style="--height:45%"><strong>5</strong><i></i><span>31+ days</span></div>
</div>

- 17 of 36 measurable denials arrived within seven days.
- 22 arrived within fourteen days.
- The median was 7.5 days, while the mean was 16.3 days because a few long waits pulled it upward.

Three records show a zero-day outcome, and 17 of the 53 denials have no usable timing at all. Some dates were inferred from email timestamps rather than captured at application time. The broad lesson—that most explicit decisions arrive early—is useful; decimal-level precision is not.

## Volume has come in bursts

The 92 applications with known dates were submitted on just **29 different days** across roughly six months. The five busiest days account for **41%** of all dated applications. Monthly volume was also uneven:

<div class="job-months" aria-label="Applications with known dates by month">
  <div><span>Feb</span><i style="--value:100%"></i><strong>36</strong></div>
  <div><span>Mar</span><i style="--value:2.78%"></i><strong>1</strong></div>
  <div><span>Apr</span><i style="--value:0%"></i><strong>0</strong></div>
  <div><span>May</span><i style="--value:5.56%"></i><strong>2</strong></div>
  <div><span>Jun</span><i style="--value:50%"></i><strong>18</strong></div>
  <div><span>Jul</span><i style="--value:72.22%"></i><strong>26</strong></div>
  <div><span>Aug*</span><i style="--value:25%"></i><strong>9</strong></div>
</div>
<p class="job-caption">*August includes data through August 4 only. Nine additional records are missing an application date.</p>

Bursts are not inherently bad, but they make learning harder. A steadier weekly cadence would give me time to tailor the correct résumé, find a relevant contact, follow up, and record what happened. My next test will be **four to six carefully matched applications spread across three days each week**, rather than a single high-volume session.

## Outreach needs to become an experiment

The outreach workbook ranks the 48 open records into six A-priority, ten B-priority, and 32 C-priority targets. Yet the application statuses record only **two warm-outreach leads and two completed action items**.

That suggests a simple operating order:

1. Complete the six A-priority follow-ups first.
2. Record an outreach date, channel, contact type, and whether anyone replied.
3. Follow up once after five business days, then stop unless there is engagement.
4. Compare interview conversion for applications with relevant outreach against applications without it.

The goal is not to send more generic messages. It is to learn whether timely, specific contact with an actual recruiter, hiring manager, or future teammate changes the funnel.

## What the tracker must capture next

At the moment, the data cannot answer the question I care about most: *which applications turn into conversations?* I am replacing the single status field with a small event funnel.

<div class="job-funnel-plan">
  <span>Applied</span><b>→</b><span>Recruiter screen</span><b>→</b><span>Technical interview</span><b>→</b><span>Final round</span><b>→</b><span>Offer</span>
</div>

Each record should include:

- the date of every stage, not only the final outcome;
- job level and location type;
- which of my three targeted résumés I used;
- application source and whether I had a referral;
- outreach date, contact type, and response;
- explicit final states for rejected, withdrawn, role closed, and no response;
- a stable application ID so repeat applications are not mistaken for duplicates.

There are currently 14 rows belonging to repeated company-and-role combinations, nine records without an application date, and 17 denials without measurable response time. Those are fixable data-quality problems.

## The plan for the next 30 applications

My next round will be a controlled test instead of another undifferentiated batch:

- Apply primarily to roles aligned with my actual level, while keeping a smaller stretch allocation.
- Use the Software, Data, or Applied AI résumé deliberately and tag the version used.
- Keep a consistent weekly cadence.
- Perform targeted outreach on A-priority applications within two business days.
- Retire silent applications from the active pipeline after 30 days.
- Judge lanes and résumé versions by recruiter-screen rate—not by how long an application avoids a rejection email.

After 30 new applications, I should be able to compare résumé-to-screen conversion, outreach response, time to first human contact, and progression between stages. That will turn this tracker from an email archive into a decision-making tool.
