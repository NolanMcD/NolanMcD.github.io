# Application Event Lab

Local route: `/projects/application-event-lab/`.

Uses the existing Jekyll landing layout, Projects archive, Minima typography,
and Noland cream/red palette. The site explicitly uses a light color scheme;
this project follows it. There are no runtime dependencies or network calls.

## Implementation

- `pages/application-event-lab.html`: accessible controls, customer view, pipeline, metrics, and log.
- `assets/js/application-event-engine.js`: deterministic, in-memory inbox, queue, application, outbox, and customer replica.
- `assets/js/application-event-lab.js`: interface binding, cancellable stage progression, held deliveries, and filters.
- `_sass/application-event-lab.scss`: scoped responsive styles, focus states, and reduced motion.
- `_includes/application-event-production.html`: architecture and explanatory TypeScript.
- `assets/main.scss` imports the stylesheet; `pages/projects.md` links the project.

The model assumes one trusted application-wide source sequence and snapshots.
It permits explicit target-status changes to explore ordering; a real service
would additionally enforce domain transitions and provider-specific ordering.
Receipt atomically models inbox + job creation; processing models application +
outbox + job completion. Failures happen before commit. Worker retries retain
the original delivery attempt and increment a separate worker attempt.
The simulated clock starts at 2026-01-12 09:00 UTC, with fixed 20 ms receipt
and 400 ms worker costs. These are illustrative values, not measurements.
The most recent 250 log entries are displayed; the deduplication ledger is
retained until reset. Refresh/reset clears all in-memory data.

## Verification

Run the development-only regression suite with:

```sh
node tools/test-application-event-lab.cjs
bundle exec jekyll build --strict_front_matter
```

Run the repository checker with `powershell -File tools/check-site.ps1`.
Node is only a test runner and is not needed to build or use the static site.

In the implementation environment, the engine regression suite passed through
the available JavaScript runtime: normal processing, receipt before effects,
outbox separation, invalid signatures, duplicate deliveries (including pending
jobs), ordering, worker failures, retry without extra delivery, reconnect,
reset, all six event types, and retry of an older job after a newer commit.
UI JavaScript syntax and HTML IDs, labels, element references, local assets,
pipeline/workflow counts, and six production sketches also passed checks.
`git diff --check` passed.

Jekyll build was attempted but `bundle` is not installed. Browser discovery
returned no browsers, so rendered desktop/mobile checks, keyboard interaction,
reduced-motion behavior, and browser console inspection remain unverified.
The repository checker reported unrelated missing assets under the pre-existing
untracked `win-at-life/node_modules` directory, then stopped on a null-content
regex error. That directory and checker were left unchanged.

## Remaining browser checks

1. Build/serve with Jekyll; open the route at desktop and 390 px widths.
2. Send a status change, then duplicate it: only one version increment.
3. Send an invalid signature: no inbox/job/application change.
4. Deliver out of order: Documents Verified survives the older snapshot.
5. Arm worker failure, send, retry: job remains pending until one commit.
6. Disconnect, send a newer status, reconnect: customer freezes then refetches.
7. Delay an event, process a newer one, release: old event cannot overwrite.
8. Reset during animation and while a delivery is held: no later mutation.
9. Exercise filters, all buttons, selects, and disclosure controls by keyboard.
10. Enable reduced motion, repeat processing, and check console and overflow.
11. Confirm the Projects archive filter includes the lab under Code & Data.
