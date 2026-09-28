# Triple Atlas

Triple Atlas follows this site's Jekyll/GitHub Pages setup: `pages/triple-atlas.html`, plain JavaScript, scoped CSS, and a generated public JSON snapshot. Find it from Projects or `/triple-atlas/`. There are no new Python packages, JavaScript build dependencies, cloud services, or video assets.

## Owner workflow

From the repository root, with Python 3.9 or later:

```powershell
python tools/triple-atlas.py import
python tools/triple-atlas.py serve
```

Open the **private owner URL printed in the terminal**. Keep the terminal running while tagging. The console serves the same page, script, and stylesheet as the public site; Ruby is not needed for this console. The default address is `http://127.0.0.1:8765/triple-atlas/`, but you must use the printed URL with its random token to unlock it. Restarting the server invalidates the previous token. Ctrl+C stops it.

If the tab says its connection expired, paste the latest complete terminal URL into the reconnect form. Opening a fresh owner link in the same tab now reconnects correctly. Run only one owner server per port: the server reserves its port exclusively, including on Windows. If the port is already occupied, use the existing console or stop it before restarting; you can also choose `serve --port 8766`.

1. Open the Unwatched queue, then **Watch on Baseball Savant**. The video opens in another tab; return to the atlas to tag it.
2. Open **Create & manage your tags** and enter a tag name. Tags start empty: you create the vocabulary yourself, with no required groups or preset choices. Add as many tags as you like, then select any number on a play. Enter notes and optionally a 1–5 rating.
3. **Save & next** marks it tagged and advances to the next unwatched play. Ctrl/⌘ + Enter does the same. Tags have single-key shortcuts printed beside them; these do not fire while typing in a field.
4. **Skip for now** (Alt + right arrow) preserves the draft and skips the play for this session. Unwatched queue resets skips. **Review again & next** saves that status and advances. Filter the catalog by review again to return to those plays.

Draft changes save after 500 ms. The editor also keeps an immediate recovery copy in browser local storage, attempts a save when the tab becomes hidden, and warns before leaving with unsaved changes. Navigation waits for saves and stops on errors. Concurrent edits are rejected by revision number rather than silently overwriting another tab. Draft recovery offers export and explicit discard/reload. If browser storage is disabled, disk autosave still works, but an abrupt browser crash can lose edits made during the debounce interval.

The interface uses touch-sized controls and responsive layouts. This first version restricts the owner server to the owner's computer: there is no remote/mobile editing service. The public catalog is usable on phones; all tagging actions have buttons and do not require a keyboard when used on a touch-capable owner device. Do not expose or tunnel this development server to the Internet.

## Durable data and publishing

- Source metadata and annotations are stored in **`local-data/triple-atlas/atlas.sqlite3`**. This directory is git-ignored and excluded by Jekyll. Browser storage is only a recovery draft, never the authoritative annotation store.
- SQLite transactions make saves durable. Back up this directory with the server stopped, or export JSON while running. SQLite may use `-wal` and `-shm` files while open; do not copy just the database file while writing.
- The public site reads **`assets/data/triple-atlas.json`**. It has no write endpoint and no public editing controls. GitHub Pages has no built-in owner authentication, so editing is available only through the token-protected loopback console. The server checks token, Host, and Origin, and serves only an explicit allowlist of assets.
- Create tags directly in the owner console using **Create & manage your tags**, or **+ Create a tag** beside the play's tag choices. Names and optional single-letter/number shortcuts save to the database's `tags` table. Rename a tag with **Save changes**; its stable ID keeps every existing play selection attached. Names and shortcuts must be unique. New tags appear in the play choices, catalog filters, and counts immediately, without a page reload or a code change.
- Only previously used preset tags are retained when an older database is opened. Unused presets disappear from the interface. `assets/data/triple-atlas-tags.json` is now a legacy lookup used only to recover names from older databases/exports; editing it does not manage the new tag collection. Your custom tag definitions travel with JSON exports and published annotation snapshots. Metadata-only publication hides them along with annotations.
- Tags are personal observations. They never set or imply an official scoring error.

Publish metadata only (keeps your notes private):

```powershell
python tools/triple-atlas.py publish
```

Publish your annotations, **including every note**, when ready to share them:

```powershell
python tools/triple-atlas.py publish --annotations
```

Review and commit the generated JSON, then publish through the site's usual GitHub Pages workflow. The tool does not commit or deploy for you. Share a play using `/triple-atlas/?play=GAME-ATBAT-PITCH`; query URLs work directly on Pages without server routing. Link previews use the atlas page's general metadata; the visible page title updates to the selected play.

## Repeatable source import

The source is [the requested Savant search](https://baseballsavant.mlb.com/statcast_search?hfAB=triple%7C&hfGT=R%7C&hfSea=2026%7C&player_type=batter&group_by=name-event&min_pitches=0&min_results=0&min_pas=0). The importer requests pitch-level CSV (`type=details`, `hfAB=triple|`, `hfGT=R|`, `hfSea=2026|`) in monthly date ranges and independently filters every row for a 2026 regular-season triple. It validates required headers before accepting a response. Source request failures abort before updating the database; each request has a timeout and three attempts. Completed data can be imported repeatedly.

**The CSV was inspected and does not contain `playId`.** `sv_id` is not a suitable video identifier. For each unique game, the importer fetches MLB's JSON `https://statsapi.mlb.com/api/v1.1/game/GAME/feed/live` and requires all of:

- `game_pk` selects the game.
- CSV `at_bat_number` equals game-feed `about.atBatIndex + 1`.
- CSV `batter` matches the plate appearance's batter ID and its event is `triple`.
- CSV `pitch_number` matches exactly one `isPitch` event with `details.isInPlay`.

Only then does its pitch-level `playId` become `https://baseballsavant.mlb.com/sporty-videos?playId=...`. Names and venue come from the matching game feed where available. It does not guess from the player name, inning, or last event in the array. The database key is `game_pk-at_bat_number-pitch_number`; reimports update source metadata and preserve annotations, notes, statuses, ratings, and manual URL overrides. An enrichment outage does not erase an existing matched link. Missing records are retained, not deleted; scoring corrections that remove a previously imported triple need manual reconciliation against a new source export.

Initial run on September 28, 2026: **668 distinct triples, 664 matched video IDs, 4 unresolved links, zero game-feed request failures**. A matched Chandler Simpson example (`823807-53-2`) returned a Savant HTML title matching the triple. No video media was requested for verification. Exact matching failures remain visible in the catalog and never cause the play to disappear.

Savant can reject full-season requests or temporarily block requests. Monthly requests worked during implementation. If automated CSV access stops working, download the **pitch-level results CSV** from the search, then:

```powershell
python tools/triple-atlas.py import --csv "C:\path\to\savant.csv"
```

This still attempts game-feed enrichment. If lookup fails or Savant lacks a clip, open the play in the owner console and paste a corrected **direct Savant URL** into its video field. Manual URLs are stored in annotations and survive reimport; clearing the field intentionally marks a link unavailable. Paste the original imported URL back to use the automatic mapping again. A matched identifier or HTTP 200 is not a guarantee of video playback. Savant's player and coverage can change, and some clips may remain unavailable. There is no embed: an external link avoids relying on an undocumented embedding contract. The importer only requests metadata endpoints, never video pages or media files; no videos are downloaded, cached, proxied, or rehosted.

## Portable annotations

The console has Export JSON and owner-only Import annotations controls. JSON exports include all source IDs, original and overridden video URLs, custom tag definitions, notes, ratings, statuses, and revisions. Imports replace annotations for the included play IDs and leave other plays untouched. They restore missing tag definitions while keeping local names/shortcuts for existing IDs. Conflicting imported shortcuts are left blank; duplicate names with different IDs are rejected. They validate the entire document before committing; unknown play IDs or invalid definitions roll back both tag and annotation changes. Import the source plays first. A timestamped backup JSON is written to `local-data/triple-atlas/` before every restore.

Equivalent commands:

```powershell
python tools/triple-atlas.py export local-data/triple-atlas-backup.json
python tools/triple-atlas.py restore local-data/triple-atlas-backup.json
```

JSON is the portable format for this first version (it preserves multiple tags without lossy CSV encoding). Public visitors can export only the published snapshot. Owner exports include private annotations.

## Verification

```powershell
python tools/test-triple-atlas.py
powershell -File tools/check-site.ps1
bundle exec jekyll build --strict_front_matter
```

All 18 regression tests passed after the custom-tag update. Tests cover tag creation/renaming, empty initial collections, legacy migration, tag definition export/restore, duplicate names/shortcuts, stable identity, source filtering, exact pitch matching, duplicate imports, preserving annotations and manual URLs, feed outages, transactional restoration, validation, persistence after reconnect, conflicting-tab writes, token/Origin/Host enforcement, and private-file denial. They use temporary databases and never modify owner annotations. JavaScript syntax checking passed. The repository checker passed against a clean snapshot of versioned/new files; running it directly in the workspace was blocked by an unrelated inaccessible `tmp/broken-sword/soffice_convert_9gndn738` directory. GitHub also passed the full Jekyll build and navigation checks for the initial deployment.

For a manual browser check: tag two plays, save/advance, skip one, mark another review again, refresh, filter by tags/status/rating, export, change a note, reimport the export, and verify the restored note. Check the same URL without a token and on the public site: neither should allow writes. Also check a narrow phone viewport and a corrected/missing video URL. The implementation environment had no connected browser and no Ruby/Bundler, so interactive browser QA and a full local Jekyll build could not be completed there; the local owner HTTP server and automated regression tests were exercised instead. The existing GitHub workflow builds Jekyll on push/PR.
