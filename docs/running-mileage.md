# Homepage running mileage

## Enter a total

Edit `_data/running.yml`, then rebuild/publish through the normal site workflow:

```yaml
year: 2026
total_miles: 1250.5
last_updated: "2026-11-08"
```

These are example values, not Nolan's mileage. The committed total and date are blank. Enter miles as a non-negative number without commas. Zero is a valid total. The display rounds to one decimal place, omits a trailing `.0`, and adds thousands separators. `last_updated` is optional and means the date you verified the total; use `YYYY-MM-DD`. Leave `total_miles` blank to show an em dash and “Mileage coming soon.” No current total is inferred from race bibs, medals, or recent activities.

The sole production data source is `_data/running.yml`. `_includes/running-mileage.html` renders the photo, SVG text, and caption at Jekyll build time. It needs no JavaScript, framework, API request, or backend. Use `{% include running-mileage.html %}` to reuse it. The photo alt text describes the rack; the caption announces the total/date. The duplicate visual SVG number is hidden from assistive technology, but remains real, selectable text.

## Photo and alignment

`assets/images/running/medal-rack.webp` retains the supplied photo's complete 1086 × 1448 frame. It is 188,090 bytes, down from the 2,410,370-byte PNG (about 92% smaller). It has not been cropped or stretched. The original root PNG is kept locally and excluded from Git/Jekyll output.

The SVG viewBox is `0 0 1086 1448`. Its center anchor is `(858, 210)`, approximately 79% across and 14.5% down. The number uses a 96-unit, self-hosted Barlow Condensed Bold font, warm cream fill, a subtle dark outline, and a -1° rotation. The photo and SVG share a responsive positioning container. Values longer than seven characters are constrained to 270 image units. Change these SVG/style coordinates only while checking the actual bib; avoid `object-fit: cover`, fixed image heights, or independently positioned text in viewport pixels.

The font lives in `assets/fonts/barlow-condensed/`, with its SIL Open Font License. Its only browser use is this component. Source: [Google Fonts Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed).

The homepage's `running-home` wrapper replaces the old Strava shortcut with the photo beside the remaining social shortcuts. At phone widths, the shortcuts remain together above the full photo. Component styles live in `_sass/running-mileage.scss` and follow the existing site palette for the frame/caption; bib colors remain constant over the photo in both themes.

## Preview and validation

```text
bundle install
bundle exec jekyll serve
```

Open `http://127.0.0.1:4000/`. Restart/rebuild if a data-file edit is not picked up. For browser layout checks:

```text
bundle exec jekyll build --strict_front_matter
bundle exec ruby tools/build-running-previews.rb
pnpm test:browser
bundle exec ruby tools/build-running-previews.rb --clean
```

The Ruby helper renders the actual Jekyll include with blank, 0, 125.4, 999.9, and 1250.5 fixture values. It never edits `_data/running.yml` and verifies its digest afterward. Playwright checks 1280px, 390px, and narrow 320px viewports, the SVG anchor/width, full-photo aspect ratio, selectable text, optional date and zero handling, no page overflow, and no-JavaScript homepage rendering. It attaches light/dark component screenshots to the browser report. CI removes the temporary `_site/__running-preview/` pages before uploading the production artifact; no sample totals are published.

## Existing Strava integration

The repository already has `tools/sync-strava.ps1`, `.github/workflows/sync-strava.yml`, and `assets/data/strava-feed.json`, documented in [Strava OAuth setup](strava-oauth-setup.md). They fetch a limited recent activity feed, retain only Everyone-visible activities, and rotate the refresh token. That recent feed is not a yearly running total. This version does not change that script, workflow, secrets, or its output, and does not add another Strava data source or any automatic mileage sync.

## Future scheduled automation — design only

If requested later, extend the existing authenticated Strava job rather than creating a second token-refreshing job:

1. Define which running activities count, the target year, and the reporting timezone. Decide whether the published total covers public runs only or includes private runs with explicitly approved access.
2. Keep `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, and `STRAVA_REFRESH_TOKEN` in GitHub Actions secrets. Reuse the existing restricted secret-rotation mechanism; persist a rotated refresh token before continuing. Never embed tokens in Jekyll data, HTML, client scripts, logs, or committed API responses.
3. For a current-year **public-only** total, Strava's authenticated [`GET /athletes/{id}/stats`](https://developers.strava.com/docs/reference/#api-Athletes-getStats) exposes `ytd_run_totals`. Its documentation says the statistics include only Everyone-visible activities; do not silently label that as an all-activity total.
4. For a specified year or other visibility policy, retrieve **all pages** of the authorized [activity list](https://developers.strava.com/docs/reference/#api-Activities-getLoggedInAthleteActivities), filter the agreed run types and calendar-year boundaries, deduplicate activity IDs, and sum distances. Broader visibility may require a different OAuth authorization scope; review it before implementing. Do not sum the existing last-six-activities JSON.
5. Convert meters to miles using 1609.344 meters per mile. Validate a finite non-negative result, then atomically update the same `_data/running.yml` fields: `year`, `total_miles`, and `last_updated`. Keep the previous data on API, authentication, pagination, or validation failure. A failed fetch must not become zero.
6. Commit only the aggregate YAML when it changes. The existing Check site workflow already follows successful completion of the Strava workflow, so the normal Jekyll build, browser tests, and deployment gate can publish the updated number.

No new scheduler, API call, authorization, or mileage syncing is implemented by this initial display.
