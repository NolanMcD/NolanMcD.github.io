# Miami Storms audio

Put the web-ready recordings in this directory. The original M4A voice memos work in modern browsers and are already efficiently compressed, so they do not need to be converted. Use numbered, URL-safe filenames such as `storm001.m4a`; the public player creates the duration label automatically, so the filenames are not shown.

Then add each file to `storms.json`:

```json
[
  { "file": "storm001.m4a", "date": "July 18, 2026" },
  { "file": "storm002.m4a", "date": "July 24, 2026" }
]
```

`date` is optional. Keep the JSON valid: commas go between entries, but not after the final entry. Alternatively, run `powershell -File tools/update-storm-catalog.ps1` from the repository root after copying in a new batch. The helper finds supported audio files, reads their durations, and rebuilds the catalog in filename order.

GitHub rejects individual files over 100 MB, and a large audio archive can make the repository cumbersome. At the current voice-memo bitrate, the recordings use approximately 29 MB per hour, which is reasonable for the planned collection. If an individual recording approaches 100 MB or the full archive grows unusually large, host the audio separately and place full `https://...` URLs in the `file` fields instead.
