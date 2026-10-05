# Noland — movies, projects, and side quests

Nolan McDermott's movie-review site and personal portfolio, built with Jekyll and hosted by GitHub Pages at [noland.blog](https://noland.blog).

## Run locally

1. Install Ruby and Bundler.
2. Run `bundle install`.
3. Run `bundle exec jekyll serve`.
4. Open `http://localhost:4000`.

Standalone pages live in `pages/`, while posts live in `_posts` and use the `YYYY-MM-DD-title.md` filename format. Site-wide settings and navigation are in `_config.yml`; visual styles are in `_sass/style.scss`.

The shared site header includes a light/dark mode toggle. It follows the system preference initially and saves a manual choice in `noland.theme` local storage. Palette overrides live in `_sass/theme.scss`, with early initialization in `assets/js/theme.js` to avoid a light-theme flash. The standalone airport kiosk retains the ANA screen colors.

The homepage ratings curve uses a local Letterboxd `ratings.csv` export, with one current rating per film, rather than review/rewatch counts. The raw export is git-ignored; only aggregate counts are published. After replacing the export, run `powershell -File tools/sync-rating-distribution.ps1`; `python tools/test-rating-distribution.py` checks the published counts against it. The daily review sync also imports this export when present and preserves the profile snapshot when it is absent. A newer private export at `local-data/ratings.csv` takes precedence in the daily sync. To import that file directly, pass `-CsvPath local-data/ratings.csv`.

The standalone airport kiosk simulator lives at `/airport-check-in/` (`pages/airport-check-in.html`, `assets/css/airport-check-in.css`, and `assets/js/airport-check-in.js`). Its terminal styling references [ANA's official screen guide](https://www.ana.co.jp/en/jp/guide/boarding-procedures/checkin/international/auto_howto-1/). Try booking reference `ABC123`, e-ticket `2051234567890`, or membership number `1234567890`; all correctly formatted entries return a fictional itinerary. Passport/barcode scanning and boarding-pass printing are simulated entirely in the browser.

## Publish a movie review

Copy `_drafts/movie-review-template.md` into `_posts`, rename it using `YYYY-MM-DD-movie-title.md`, fill in the front matter, and write the review. Keep `categories: [movies]` so it appears automatically on the homepage and review archive.

Ratings use five whole-star categories: **Story, Directing, Theme, Cast, and Characters**. Award one gold star for each category that worked, then set `rating` to the total. There are no half stars. The template explains how to turn an unearned gold star into a hollow star. `poster` is optional.

## Film Diary and Letterboxd sync

The complete Film Diary at `/reviews/diary/` is generated from a local `local-data/reviews.csv` and Nolan's official Letterboxd RSS feed. The raw CSV seeds the historical archive and supplies tags; RSS supplies new review text, ratings, watched dates, and rewatches between exports. Everything in `local-data/` is deliberately git-ignored and never published—only normalized public artifacts are committed.

Run the synchronizer locally from the repository root:

```powershell
powershell -File tools/sync-letterboxd.ps1
```

The command rewrites `assets/data/film-diary.json` and the lightweight homepage feed at `assets/data/latest-letterboxd.json`. It is safe to run repeatedly: recent RSS items are matched by their Letterboxd ID or by film, year, and watched date. RSS-only entries are preserved until a newer CSV export incorporates them.

The `Sync Letterboxd reviews` GitHub Action runs every day and can also be started manually from the Actions tab. On GitHub, where the private CSV is absent, the script uses the committed normalized diary as its baseline and merges RSS changes into it. It commits only when the generated diary changes. Letterboxd RSS does not expose tags, so periodically replace `local-data/reviews.csv` with a fresh Letterboxd export, run the script, and publish the regenerated JSON to reconcile viewing sources, star categories, older edits, and deletions.

## Repository checks

Run `powershell -File tools/check-site.ps1` before publishing. It validates JSON files, post naming and front matter, local asset references, the storm audio catalog, and GitHub's per-file size limit. GitHub Actions runs the same checks on every push and pull request.

## Elevator Game

The browser game at `/elevator-game/` is implemented by `pages/elevator-game.md` and `assets/js/elevator-game.js`, with scoped styles in `_sass/style.scss`. Gameplay and computer-dispatch tuning live in the `C` constants near the top of the script. High scores, sound preference, and achievements use the `nolandElevatorGame.*` local-storage namespace; the arrival ding is generated with the Web Audio API.

## Strava sync

The homepage Strava lane reads `assets/data/strava-feed.json`, generated daily by the `Sync public Strava activities` GitHub Action. It publishes only activities marked **Everyone**, and its OAuth refresh token is rotated back into GitHub Actions secrets before feed generation continues. Follow [the one-time secure OAuth setup](docs/strava-oauth-setup.md) to activate it.

## Triple Atlas

The 2026 triple catalog lives at `/triple-atlas/`. Explore interactive player/ballpark leaderboards, month-by-month counts, shareable filters, and a random linked play from any view. Run `python tools/triple-atlas.py import` to sync Savant metadata, then `python tools/triple-atlas.py serve` and open the private URL it prints to watch and tag plays. Annotations live in the git-ignored `local-data/triple-atlas/atlas.sqlite3`. Publish a read-only snapshot with `python tools/triple-atlas.py publish`; add `--annotations` only when notes and tags should be public. See [the explorer, owner workflow, video matching limitations, backups, and security model](docs/triple-atlas.md).

## Baseball verbs

The broadcast vocabulary collection lives at `/baseball-verbs/`. Run `python tools/baseball-verbs.py serve`, open the private URL it prints, and add words and Baseball Savant links. Run `python tools/baseball-verbs.py publish` to prepare the public snapshot. See [the editing and publishing guide](docs/baseball-verbs.md).

## Custom domain

The canonical domain is `noland.blog`. The root `CNAME` file and `url` in
`_config.yml` must remain aligned with that domain. DNS points the apex domain
and `www` subdomain to GitHub Pages.
