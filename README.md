# Noland — movies, projects, and side quests

Nolan McDermott's movie-review site and personal portfolio, built with Jekyll and hosted by GitHub Pages at [noland.blog](https://noland.blog).

## Run locally

1. Install Ruby and Bundler.
2. Run `bundle install`.
3. Run `bundle exec jekyll serve`.
4. Open `http://localhost:4000`.

Standalone pages live in `pages/`, while posts live in `_posts` and use the `YYYY-MM-DD-title.md` filename format. Site-wide settings and navigation are in `_config.yml`; visual styles are in `_sass/style.scss`.

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

## Custom domain

The canonical domain is `noland.blog`. The root `CNAME` file and `url` in
`_config.yml` must remain aligned with that domain. DNS points the apex domain
and `www` subdomain to GitHub Pages.
