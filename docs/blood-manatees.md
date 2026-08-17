# Blood Manatees developer guide

## Scenes

Scenes live in `_blood_manatees/`. To add Scene 3, copy `2.md` to `3.md`, set `scene_number: 3`, and replace the placeholder body. The numeric filename creates `/blood-manatees/scene/3/`; Jekyll orders Previous/Next controls by `scene_number`, so routing code does not need to change.

Optional scene front matter includes:

```yaml
scene_heading: INT. LOCATION - NIGHT
layout_type: screenplay
image: /assets/blood-manatees/images/<filename>
image_alt: Concise description for screen-reader users
background_image: /assets/blood-manatees/storyboards/<filename>
audio: /assets/blood-manatees/audio/<filename>
```

Put images, audio, music, and storyboard art in the matching folders under `assets/blood-manatees/`. Omit any optional field when it is not needed. `layout_type` becomes a CSS class such as `bm-layout-screenplay`, providing a hook for future presentation variants without changing the shared layout.

## Controls and presentation

`_layouts/blood-manatees-scene.html` renders every scene and computes Previous/Next destinations. `assets/js/blood-manatees.js` handles arrow keys, fades, and optional single-track audio. Browsers require the visitor to press the audio control when autoplay is unavailable; the track stops when the page is left.

The opening quote is in `blood-manatees.md`. Its standalone, navigation-free shell is `_layouts/blood-manatees.html`. Blood Manatees-specific styling is in `_sass/blood-manatees.scss`.
