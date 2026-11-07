# Blood Manatees developer guide

## Scenes

Scenes live in `_blood_manatees/`. To add a scene, create the next numbered Markdown file, give it the matching `scene_number`, and write its heading and body. The numeric filename creates `/blood-manatees/scene/<number>/`; Jekyll orders Previous/Next controls by `scene_number`, so routing code does not need to change. Scene 4 is the apartment packing / opening-title sequence. Scene 5 follows Ewen’s drive from Dublin to Shannon International Airport.

Scene 5 interleaves five supplied traffic-camera references from `assets/images/screenshots/` with the drive. Preserve their original framing, overlays and camera directions. These are visual references, not consecutive documentary sightings: the capture times overlap and some cameras face east. The number-plate tracking and airport barrier are fictional screenplay action, not claims about capabilities demonstrated by the supplied images. The `bm-route-frame` treatment keeps each full image visible with a caption and descriptive alt text.

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

## Airport ticket scene

Scene 6 continues directly from Scene 5's Shannon parking barrier. It replaces the intended clerk transaction with a self-service ticket purchase: Ewen Walker, Shannon (SNN) to Miami (MIA). The reader identifies Ewen, confirms Miami, chooses a seat and checked baggage, authorizes fictional payment, and collects his ticket. No real flight number, airline, departure time, fare, or direct service is asserted.

The scene embeds `/airport-check-in/?story=blood-manatees`. The query selects `assets/js/blood-manatees-airport.js`; the original ANA training flow remains available at the existing bare URL. Shared terminal CSS keeps the visual language of the original simulator, while the story mode uses Shannon passenger-service branding. This is a Blood Manatees component, deliberately excluded from the sitemap and standalone Projects listings.

Recognition before identification, the vehicle-record match, and the saved payment method continue Scene 5's fictional surveillance motif. They are authored story responses, not actual tracking. Nothing is persisted or transmitted. The iframe tells its parent when the ticket is collected; the scene accepts only same-origin messages from that iframe, then reveals and focuses the closing action. The terminal can return directly to the scene when opened outside its frame. A native details element provides the complete scene without operating the terminal or requiring JavaScript.

The project date on the Blood Manatees entry marks this substantial update, so the homepage discovers the parent screenplay rather than treating its terminal as a separate project.

Run `node tools/test-blood-manatees-airport.cjs` to check purchase flow, seat/baggage retention, cancellation, standalone return, and iframe message boundaries. CI runs this check. Local verification also exercised the purchase in headless Edge and inspected terminal previews. The full Jekyll build still requires Ruby/Bundler; terminal preview checks do not replace the built-site navigation check.

## Controls and presentation

The shared screenplay shell uses one 680px reading measure, consistent scene headings and dialogue spacing, and the same readable labels, captions, transcript controls, and Previous/Next navigation across scene types. Terminal scenes widen only their interactive displays; their surrounding action and revealed endings retain the reading measure. Hidden endings stay hidden until their interactions complete. Display transcripts and controls retain keyboard focus indicators, and scene-navigation labels remain visible on mobile. The screenplay palette is independent of the regular site's theme; the Screenplays entry card follows the regular site's light/dark palette.

### Miami arrival scene

Scene 7 follows the ticket scene with Ewen's arrival at Miami International Airport. An inline fictional customs workstation opens his passenger record, reviews the journey and linked employment update, inspects the equipment description, and closes the arrival. The employment update recalls the matching approvals in Scene 3. The bag contents come from Scene 4, so this scene adds no new packing declarations. No particular airline, flight number, travel date, citizenship, passport number, immigration classification, or actual admission procedure is asserted.

`assets/js/blood-manatees-arrival.js` synchronizes the workstation with four inline SVG camera storyboards: arrivals corridor, primary desk, baggage-record image, and public exit. These are stylized animated storyboards, not real airport footage. Replace the visual treatment with supplied or licensed footage later while retaining the `data-arrival-view` hooks. The story's cross-linked records and automated tracking are fictional; no information is collected, requested, transmitted, or persisted. This workstation is embedded directly in the scene and does not extend the separate Scene 6 iframe protocol.

The workstation is hidden until JavaScript initializes. A native details transcript contains the complete scene without interaction, including the ending. The final action reveals and focuses the closing prose; replay resets the workstation, feed, and ending. Reduced-motion mode stops the camera-subject animations. The collection layout automatically links Scenes 6 and 7 in both directions. Run `node tools/test-blood-manatees-arrival.cjs` alongside the existing airport and packing checks; CI includes the new test.

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
