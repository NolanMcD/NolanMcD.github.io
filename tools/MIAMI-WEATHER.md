# Morning Miami Weather Report

The Jekyll project publishes an illustrated, dated Miami / Brickell briefing. Reports use a separate `miami_weather` collection, so they do not overwhelm the blog or movie feed. The homepage reads `_data/miami_weather_latest.json`; `/miami-weather/` lists the archive. Original permitted source images and metadata live under `assets/weather/YYYY-MM-DD/revision/`. Manual revisions retain earlier assets and replace the same dated page.

## Schedule and publication

The **Morning Miami Weather Report** Actions workflow runs every 15 minutes throughout the day, at minutes 7, 22, 37 and 52 to avoid busy scheduling boundaries. Python applies America/New_York using IANA timezone data, including DST changes. Starting at **5:30 a.m. Eastern**, it publishes directly from free official NWS/NOAA sources. If collection fails, subsequent runs retry until **11:59 p.m. Eastern**. Reports collected after 10:30 a.m. are explicitly labeled late Existing dated reports prevent repeated publication on the same local date. X is not queried and no API token is needed.

Settings are in `_data/miami_weather_settings.json`: start, catch-up limit, timezone, interval, freshness limits, coordinates, source URLs, timeout and retries. When changing `interval_minutes`, change the workflow cron too. The all-day UTC cron covers both EST and EDT; Python enforces the configured local publication window. The interval is workflow cadence, not an exact execution-time promise.

[GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) can be delayed or dropped during busy periods; inactive public repositories can have schedules disabled. **5:30 is the target, not a guaranteed deadline.** Actual publication time is displayed. Reports older than the viewer's current Eastern date show a stale message, refreshed every minute while the page remains open. If runs miss the catch-up period, the previous report remains dated and stale; a manual run can recover.

The workflow uses bounded requests, a 12-minute job timeout, serialized concurrency and a local publication lock. It requires a fresh official point forecast covering the remaining local day. Optional sources fail independently. It validates image encodings and hashes, moves a complete dated asset directory, replaces the dated report, then atomically replaces latest metadata. In Actions, the full Jekyll build and navigation/image checks must pass before those files are committed together. A failed mandatory forecast or validation leaves the deployed latest unchanged.

Only schedule and `workflow_dispatch` trigger collection: its own commits cannot cause collection loops. The built-in `GITHUB_TOKEN` has `contents: write` and `pages: write`. After pushing a validated report it explicitly calls the [GitHub Pages build API](https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build), because token-generated pushes do not normally trigger the branch-based Pages build. The existing **main / root** deployment remains in use. If branch protection forbids bot commits, configure an approved GitHub App or repository automation policy. A concurrent main-branch edit causes a safe push rejection; rerun with “Update today” rather than force-pushing.

## Manual runs and real-data previews

In **Actions → Morning Miami Weather Report → Run workflow**, leave “Update today” unchecked to obey the schedule and duplicate guard. Check it to collect now and replace today's dated report. An outside-morning manual publication is explicitly labeled as a manual preview. No date override is exposed.

Locally, with Python 3.9+:

```text
python -m pip install -r tools/miami-weather-requirements.txt
python tools/test-miami-weather.py
python tools/miami_weather.py --preview-dir tmp/weather-preview
python tools/miami_weather.py --manual
```

Preview mode downloads **real current data**, writing to an isolated directory rather than the live collection. It creates `_miami_weather`, `_data/miami_weather_latest.json`, and `assets/weather` within that directory. To review in Jekyll, overlay those paths into a clean site checkout and run `bundle exec jekyll serve`. The ordinary manual command updates the working tree; inspect, build, validate, then commit to publish. After an interrupted local process, verify it has stopped before removing `local-data/miami-weather.lock`.

## Sources, rights and optional setup

No AI service, model credential, paid weather service, or third-party account is required for the official fallback. Deterministic factual templates render the report. Fetched text is escaped as HTML and Liquid data; it is never executed or treated as instructions.

* **NWS:** documented [weather.gov API](https://www.weather.gov/documentation/services-web-api). Point lookup discovers Miami forecasts; KMIA supplies a nearby airport observation, not conditions measured at Brickell. Separate alert queries cover the point and Miami-Dade coastal / Biscayne Bay zones. Miami AFD, coastal Miami-Dade SRF and AMZ630 marine forecasts provide discussion, beach and bay guidance. Unknown alert validity times make the check unavailable, not “no alerts.” Missing fields remain unknown. Source text is credited and linked; marine knot values include mph conversions.
* **Satellite:** follows actual frame links from the supplied GeoColor page, currently **GOES-19** despite `sat=G16`. Three recent original frames are archived and credited to **CIRA/NOAA**. Filenames supply observation times; original embedded timestamps remain visible.
* **Radar:** verified NOAA/NWS [OGC radar services](https://radar.weather.gov/) advertise timestamps and layer names. KAMX uses `kamx_sr_bref`; regional CONUS uses `conus_bref_qcd`. Regional imagery uses center **−80.217, 26.379**, Web Mercator zoom **7.36**, city markers, NOAA coast/state reference overlay and original reflectivity legend. Three frames are archived where available alongside original radar, map and legend downloads. Composite metadata retains original service URLs and the generated image hash. Location notes describe colored reflectivity echoes, **not confirmed rainfall**; no motion is extrapolated. Missing radar never implies clear conditions.
* **McNoldy:** the supplied HTTPS page currently fails certificate validation here. TLS verification stays enabled; the official KAMX fallback is labeled and the original page linked. Third-party imagery is not copied without permission. If reuse is authorized, configure `mcnoldy_reuse_authorized: true` and a verified `mcnoldy_image_url` advertised on that page. The collector still requires a recent file timestamp and retains embedded observation time.
* **NHC:** the Atlantic outlook RSS supplies official text and **item issuance time**, not merely RSS refresh time. The seven-day outlook graphic is discovered from NHC's page and archived unchanged, preserving its legend and embedded timestamp. Feed issuance is labeled separately from the graphic's embedded time. Basin development probabilities are not translated into Miami impact forecasts.
* **Tropical Tidbits:** optional context link when NHC reports activity. Its copyright reserves reuse rights, so imagery is not copied. NHC remains the forecast authority; no model-run hurricane prediction is generated.

Every source record includes availability, URL, retrieval time when actually retrieved, issuance/observation time when known, and missing-data reasons. Template inputs are archived in `sources.json`. Images include URLs, timestamps, credit, dimensions and SHA-256. Keep archived imagery; daily frames grow storage by several MB per day. Review storage before introducing any retention policy that breaks old reports.

## Checks

`tools/test-miami-weather.py` checks DST, local dates, publication-window behavior, duplicate prevention, stale forecasts, missing/expired alerts, escaped text, failed publication, manual reruns, image validation, Miami-Dade beach isolation and NHC issuance. `tools/test-miami-weather-ui.cjs` checks Eastern stale labels. `tools/check-miami-weather.py _site` verifies the built homepage/archive/latest page and archived images. Existing repository, Triple Atlas and Jekyll/navigation checks remain enabled.

On October 6, 2026, the only recorded scheduled run started at 11:47 a.m. Eastern and skipped publication under the previous 10:30 cutoff. The all-day schedule and end-of-day recovery window address that failure. GitHub scheduling still cannot guarantee a morning execution.
