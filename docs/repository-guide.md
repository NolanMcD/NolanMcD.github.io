# Repository and website organization

Reviewed October 19, 2026. The existing Jekyll structure is retained; public URLs remain stable.

| Location | Purpose |
| --- | --- |
| `index.md` | Homepage: social shortcuts, daily weather, newest projects, and movie activity |
| `pages/` | Standalone pages with explicit permalinks; Projects is the catalog of tools and ongoing work |
| `_posts/` | Essays and movie reviews; review layout determines the movie archive |
| `_miami_weather/` | Generated dated weather reports in their own collection |
| `_layouts/`, `_includes/`, `_sass/` | Shared presentation, breadcrumbs, and themes |
| `_data/` | Public settings and generated aggregate snapshots; no private credentials or raw competition data |
| `assets/` | Public scripts, styles, images, audio, and published data |
| `tools/` | Collection, local analysis, publication, and validation scripts |
| `docs/` | Contributor runbooks; excluded from generated site output |
| `.github/workflows/` | Checks and scheduled updates |
| `local-data/`, `tmp/` | Private inputs, caches, review notes, and disposable previews; ignored by Git and excluded from Jekyll |
| `win-at-life/` | Separate local checkout, ignored and excluded from this website; managed in its own repository |

The competition ZIP at the repository root is explicitly ignored and excluded from local Jekyll builds as well as GitHub publication. Keep `CNAME` and `_config.yml` pointed at the same canonical domain, `noland.blog`.

## Adding or updating a project

1. Add a standalone page under `pages/`, preserve any existing permalink, and choose a title and description.
2. Add `project_date: YYYY-MM-DD`, `project_label`, and `project_summary` to front matter. The homepage sorts dated project pages newest first and displays three links automatically. Use the substantial project update date, not a daily data refresh.
3. Add the card to `pages/projects.md` with matching tags so it appears in the full catalog and filters. Dated project pages receive a Projects breadcrumb automatically; known undated projects also retain their return links.
4. Put public assets under `assets/` and document owner workflows under `docs/` or the existing tool runbook. Keep source data and credentials out of public snapshots.

## Organization changes in this pass

- Replaced homepage blog links with automatic latest-project links. Blog remains available in primary navigation.
- Generalized project breadcrumbs using project metadata and repaired the baseball-verbs return path.
- Excluded contributor docs, the separate local checkout, and the competition ZIP from generated output.
- Retained existing content folders and routes rather than moving public pages or archived assets.
- Changed weather eligibility from 5:30 a.m. to Miami sunrise plus 60 minutes, retaining the existing duplicate guard and all-day failure recovery. Satellite frames now come from the newest fresh daylight observations.

## Checks

Run `powershell -File tools/check-site.ps1`, `python tools/test-miami-weather.py`, and the relevant feature tests. The repository checker enumerates tracked and new non-ignored files through Git, so private downloads, caches, generated builds, and separate checkouts do not interfere. It validates front matter for standalone pages as well as posts. Build with `bundle exec jekyll build --strict_front_matter`, then run `python tools/check-navigation.py _site` and `python tools/check-miami-weather.py _site`. GitHub Actions runs the full build and checks.

The navigation check requires the homepage's Latest projects section. The weather tests cover sunrise/DST eligibility boundaries, daily duplicates, manual overrides, newest-daylight satellite selection, and nighttime fallback in addition to existing source/publication protections.
