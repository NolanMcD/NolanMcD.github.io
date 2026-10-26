# Standalone-page discovery audit

Reviewed October 25, 2026 against repository source. All 25 files in `pages/` have an intentional inbound discovery path after the airport integration. The homepage and 404 are additional entry/recovery pages. Generated weather reports and screenplay scenes belong to collections rather than independent projects. This is a source audit; it does not certify the current production deployment or browser rendering.

| Page / route | Discovery path | Assessment |
| --- | --- | --- |
| About `/about/` | Main navigation; homepage | Discoverable |
| Blog `/blog/` | Main navigation; About; Projects | Discoverable |
| Movies `/reviews/` | Main navigation; homepage | Discoverable |
| Film Diary `/reviews/diary/` | Movies archive invitation; homepage | Child of Movies |
| Projects `/projects/` | Main navigation; homepage | Project catalog |
| Screenplays `/screenplays/` | Main navigation; Projects | Creative-work catalog |
| Blood Manatees `/blood-manatees/` | Screenplays; Projects; homepage latest-project metadata | Parent of interactive screenplay components |
| Airport `/airport-check-in/` | Blood Manatees Scene 6 embeds story mode; terminal links back to scene | Intentional child component, not an independent project; sitemap disabled |
| Application Event Lab `/projects/application-event-lab/` | Projects | Discoverable |
| Baseball Verbs `/baseball-verbs/` | Projects; latest-project metadata | Discoverable; shared active navigation now recognizes project metadata |
| Blanket `/projects/nfl-big-data-bowl/` | Projects; latest-project metadata | Discoverable |
| Blanket brief `/projects/nfl-big-data-bowl/brief/` | Blanket research page | Child of Blanket |
| Florida Keys `/projects/florida-keys/` | Projects | Discoverable |
| Crossword Creator `/crossword-creator/` | Projects; latest-project metadata | Discoverable |
| Elevator Game `/elevator-game/` | Projects; latest-project metadata | Discoverable |
| Miami Storms `/storms/` | Projects; appearance/Storms menu | Discoverable |
| Miami Weather `/miami-weather/` | Projects; homepage weather feature | Archive links to dated reports |
| Resumes `/resumes/` | About; Projects | Parent of professional variants |
| Applied AI resume `/resumes/applied-ai/` | Resumes | Intentional child |
| Data Analytics resume `/resumes/data-analytics/` | Resumes | Intentional child |
| Software Engineering resume `/resumes/software-engineering/` | Resumes | Intentional child |
| Spanish Words `/projects/top-1000-spanish-words/` | Projects; latest-project metadata | Discoverable |
| Sports Calendar `/projects/sports-calendar/` | Projects; latest-project metadata | Discoverable |
| Triple Atlas `/triple-atlas/` | Projects; Baseball Verbs; latest-project metadata | Discoverable |
| WARLeague `/projects/war-league/` | Projects; latest-project metadata | Discoverable |

## Collection and recovery paths

- Homepage: brand link in shared navigation and Blood Manatees exit navigation.
- 404: intentionally reached through invalid URLs; provides recovery destinations.
- Blood Manatees: opening → Scene 1 → numeric Previous/Next through Scene 6. Every scene has exits to Home and Screenplays. The terminal includes a reading fallback and parent return link.
- Weather reports: homepage feature and archive → dated reports; shared breadcrumbs return to the archive.
- Posts/reviews: Blog or Movies archive → article; shared breadcrumbs return to the appropriate archive.

## Remaining editorial opportunities

No additional standalone orphan was found. Do not create duplicate project cards for the airport, individual resumes, or the Blanket brief. Florida Keys, Miami Storms, Application Event Lab, and Miami Weather intentionally have catalog/feature discovery but no `project_date`; they will not rotate into Latest projects until a meaningful update date is assigned. Choose dates when those projects actually receive substantial updates rather than changing dates solely to promote them.

Project cards remain hand-maintained separately from front matter. Generating those cards from shared metadata is a useful future maintenance improvement, but is not necessary to repair discovery in this audit. A built-site navigation check should still run in CI; source references alone cannot establish deployed link health.
