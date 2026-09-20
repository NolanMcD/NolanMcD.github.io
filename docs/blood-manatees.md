# Blood Manatees developer guide

## Scenes

Scenes live in `_blood_manatees/`. To add a scene, create the next numbered Markdown file, give it the matching `scene_number`, and write its heading and body. The numeric filename creates `/blood-manatees/scene/<number>/`; Jekyll orders Previous/Next controls by `scene_number`, so routing code does not need to change. Scene 4 is the apartment packing / opening-title sequence.

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

The opening quote is in `pages/blood-manatees.md`. Its shell is `_layouts/blood-manatees.html`. Blood Manatees-specific styling is in `_sass/blood-manatees.scss`.

## Keeping Ewen’s packing sequence current

When a later scene introduces something Ewen brought from home, add an annotation in that scene with a stable ID and the short action that should appear in the packing montage:

```html
<!-- ewen-kit: {"id":"rope","packing_beat":"— Ewen coils a length of ROPE around his elbow and palms it into a side pocket."} -->
```

These comments are invisible in the rendered screenplay, but remain visible in its HTML source. They are authoring notes, not private storage. Write the later scene’s actual action normally. The annotation supplies its earlier setup; it does not replace the later action.

Use this for tools, props, or a visual setup for an idea (for example, a folded diagram). Only annotate things he already owns and takes with him. Do not annotate borrowed items, the returned company phone, or things acquired later. Ordinary prose is not automatically interpreted: explicit annotations prevent the synchronizer from inventing ownership or story beats.

Run once with `python tools/sync-blood-manatees-kit.py`, or run `python tools/sync-blood-manatees-kit.py --watch` in a terminal while writing. Watch mode checks saved scenes every 30 seconds; Ctrl+C stops it. Python 3.9+ is sufficient, with no extra packages.

The script updates only the marked generated block in Scene 4. Edit each beat in its annotation, not inside that block. The five initial items are declared immediately above the block. Later declarations are appended in scene order; identical IDs and beats appear once. Conflicting definitions or malformed annotations stop the update without writing. Removing all declarations for an item removes its packing beat. To revise a repeated declaration, update every copy or keep just one canonical declaration.

The `Sync Blood Manatees packing montage` workflow runs on relevant branch pushes, manually, and daily at 09:31 UTC on the default branch. It commits only Scene 4 if generated content changes. The workflow must be pushed to GitHub to run; the daily schedule becomes active after it reaches the default branch. Branch protection can prevent its automatic commit, in which case run the local command and commit normally. Bot commits do not trigger another normal push workflow, so the sync job checks its own output.

Validation: `python tools/test-blood-manatees-kit.py` and `python tools/sync-blood-manatees-kit.py --check`.

## Opening-title treatment

Scene 4 brackets a simple visual montage with BEGIN MAIN TITLES / END MAIN TITLES and uses TITLE OVER BLACK for the film name. The prop handling establishes Ewen’s preparation while seeding later payoffs. The late title follows the bridge and workplace opening, rather than replacing them. See John August’s [opening-title guidance](https://johnaugust.com/2005/opening-titles), [examples of title sequences](https://johnaugust.com/2012/planning-for-opening-titles), and [on-screen title notation](https://johnaugust.com/2004/incorporating-titles-into-a-screenplay).
