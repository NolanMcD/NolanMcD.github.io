# Baseball verbs

The project lives at `/baseball-verbs/` and is linked from Projects. Like Triple Atlas, the public Jekyll page is read-only and a local owner console saves edits to SQLite. No dependencies beyond Python 3.9+ are needed.

## Add words and clips

From the repository root:

```powershell
python tools/baseball-verbs.py serve
```

Open the complete private owner URL printed in the terminal. Keep the terminal running while editing. The default port is 8767, so Triple Atlas can run at the same time. Use `serve --port 8768` if needed. After a refresh or server restart, reopen the complete terminal URL to reconnect.

Enter a verb or phrase and optionally paste an HTTPS Baseball Savant URL. Announcer and call/notes are optional. Click **Save word**. You can add a word before finding a clip, then use **Edit** to attach it later. Duplicate words are rejected without regard to capitalization. Each word has one example link; edit it to replace the example. Words appear alphabetically, with search and filters for clips still needed. The three starter words—lined, roped, struck—are suggestions awaiting examples, not verified broadcast claims.

Edits are saved to `local-data/baseball-verbs/verbs.sqlite3`, which is git-ignored. Save explicitly before closing the page; unsaved edits trigger a navigation warning. Save errors leave the form intact. Conflicting edits from another tab are rejected; copy your unsaved form text elsewhere and reopen the terminal URL to reload. The console listens only on loopback, checks owner token, Host and Origin, and serves an explicit list of public files. Do not expose it to the Internet.

## Publish

```powershell
python tools/baseball-verbs.py publish
```

This updates `assets/data/baseball-verbs.json` with **all saved words, links, announcer names, and notes**. Review and commit the snapshot with the page changes, then use the site's usual GitHub Pages publishing workflow. This command does not commit or deploy. Public visitors cannot edit your collection. Videos open on Savant; they are not downloaded, embedded, or hosted here.

## Backups

Use **Export JSON** to download the currently loaded collection (save edits first), or export directly from disk:

```powershell
python tools/baseball-verbs.py export local-data/baseball-verbs-backup.json
```

For a full restorable backup, stop the console and copy the `local-data/baseball-verbs/` directory. Restore that directory with the console stopped. JSON exports are portable reference copies; there is no JSON import button. A fresh database seeds itself from the committed public snapshot once, including any existing clips. Deleting all words does not reseed them.

## Checks

```powershell
python tools/test-baseball-verbs.py
node --check assets/js/baseball-verbs.js
powershell -File tools/check-site.ps1
```
