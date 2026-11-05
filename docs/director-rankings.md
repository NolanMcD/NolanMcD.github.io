# Director ranking post

The November 5, 2026 post uses `_data/director_rankings.json` and `_data/director_images.json`. The HTML is rendered by Jekyll, so the complete default ranking and film lists remain readable without JavaScript. JavaScript switches the DOM order and rank labels, retains tied ranks, and supports `?rank=average` sharing. Images load lazily from Wikimedia; failed images fall back to text.

Keep the original Letterboxd list CSVs in `local-data/director-lists/`. Root `nolans-*-rankings.csv` exports are also ignored and excluded from Jekyll. Do not commit raw exports. The director allowlist in `tools/build-director-rankings.py` excludes franchises, Pixar, Stephen King, and Recatopia. Guy Ritchie's export filename is spelled `richie`; the public name is corrected.

Rebuild the public data:

```powershell
python tools/build-director-rankings.py
```

The builder matches ratings first by Letterboxd URI, then by exact case-insensitive title plus year. The ratings export takes precedence over diary history. Missing export ratings use the latest rated diary entry; missing ratings and duplicate list films fail the build. Nolan supplied a four-star rating for Paths of Glory on November 5, 2026; that explicit override remains in the builder. Each film counts once per director list; the Coen brothers are one list-based team. These are list memberships, not independently researched directing credits or full filmographies.

Run `python tools/test-director-rankings.py`, `node tools/test-director-rankings-ui.cjs`, and the standard repository checker before publishing. The GitHub site-check workflow includes both director tests. Ruby/Jekyll is not installed in the current Windows shell; local template verification used a temporary Python Liquid renderer, and a full Jekyll build still needs to run in CI or a Ruby environment.

The post is a dated snapshot, not part of the daily diary sync. When updating it, refresh the source exports, review any owner overrides, and update the snapshot date and numeric prose together. No rounding is applied before ranking. Equal scores share competition ranks; the other metric then name breaks display-order ties.

Refresh image URLs and credits separately:

```powershell
python tools/fetch-director-images.py
```

This uses Wikipedia's PageImages API for portraits and the top-listed film's poster, including non-free local film poster images, then queries file metadata on Wikipedia and Commons for credits. It stores URLs and attribution only, with no credentials or local image archive. Review filenames after refresh: Wikipedia article thumbnails can change or resolve to the wrong subject. The current mapping uses explicit film articles where disambiguation is needed. Image credits and license/file links appear in each director card. See the [PageImages API](https://www.mediawiki.org/wiki/API:Pageimages).

For a fuller poster gallery later, retain this data model and add a poster URL per film. TMDB could provide movie posters and director photos through its authenticated API; keep credentials in a local build environment and publish only resolved image URLs. Avoid visitor-side API keys. Local licensed image copies would remove the dependency on third-party thumbnail availability.
