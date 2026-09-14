# Navigation review — September 14, 2026

## Structure

| Content | Primary home | Routes preserved | Return path |
| --- | --- | --- | --- |
| Essays, explainers, technical posts | Blog | Existing dated/category post URLs remain unchanged | Blog breadcrumb and older/newer non-review posts |
| Full movie reviews | Movies | `/reviews/` and individual review URLs | Movies breadcrumb and All movie reviews |
| Synced Letterboxd entries | Movies → Film Diary | `/reviews/diary/` | Movies breadcrumb |
| Interactive tools and ongoing projects | Projects | All existing project URLs | Projects breadcrumb |
| Original screenplay and transcriptions | Screenplays | `/screenplays/`, `/blood-manatees/`, scene URLs | Persistent Home/Screenplays exits plus scene navigation |
| Storm recordings | Projects → Miami Storms | `/storms/` | Projects breadcrumb |
| Resumes | About or Projects → Resumes | All resume routes | Existing resume toolbar and main navigation |

## Findings and changes

- Essays were discoverable only through a Projects list mixing tools and posts.
  Added `/blog/`, separated that list from Projects, and added three compact
  latest-post links on the homepage. The five small homepage shortcuts remain.
- The primary navigation gave an individual audio project a top-level place
  while omitting the blog. It now reads Blog, Movies, Projects, Screenplays,
  About, with Noland linking home. Links wrap on narrow screens without a
  JavaScript-dependent menu. Active sections are marked with text underlines
  and ARIA state, not just color.
- Added shared breadcrumbs for standard pages, posts, reviews, and landing
  pages. The Film Diary now uses the landing layout to avoid duplicate H1s.
- Added direct paths between movie reviews and film essays, and between
  screenplays and the blog. Original writing is linked near the top of
  Screenplays and included in Projects. About now links directly to resumes.
- Blood Manatees previously lacked an exit to Noland. Added a quiet shared
  return navigation above the experience, including the opening and all scenes.
- Filters previously lost state when returning from an item and did not expose
  selection to assistive technology. Shared filtering now uses URL hashes,
  `aria-pressed`, result counts, and browser Back/Forward handling. Invalid
  hashes recover to All. With JavaScript disabled, all entries remain readable.
- The 404 page now offers Blog, Movies, and Screenplays alongside Home and
  Projects. No existing public URLs were renamed.
- The MLB ballpark project is still an informational card without a detail
  page. It has no fake link; no detail content was invented for it.

## New post

`/blog/miami-september-cutoff-low-el-nino/` expands the supplied ChatGPT
conversation into an explanatory article. Includes an official tweet embed
with readable fallback, quick summary, table of contents, HTML/CSS diagram,
comparison table, dated primary-source links, and related local destinations.
The tweet widget is loaded only for posts opting in with `tweet_embed: true`.
The post has two invisible editorial comments marking optional image locations;
there are no broken placeholder images or empty image boxes.

## Verification

- Shared archive-filter logic tested for selection, visibility, counts, ARIA
  state, hash URLs, browser Back events, and invalid-hash recovery.
- `tools/check-navigation.py` checks destinations and fragment anchors in the
  complete built site, including the known archive filter hashes. Added it to
  GitHub Actions after the strict Jekyll build to catch navigation regressions.
- Local Ruby/Bundler and an interactive browser were unavailable in this
  environment. GitHub build/link-check and deployment results are reported
  separately; visual viewport and assistive-technology testing are not implied
  by source or link checks.

For future posts, use `_posts/YYYY-MM-DD-title.md` with title, date, categories,
and excerpt. Ordinary posts appear in Blog automatically; `layout: review`
posts appear in Movies. Add standalone tools to Projects explicitly. Keep
Screenplays for manuscript work, and avoid renaming existing permalinks.
